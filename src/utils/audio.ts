/**
 * Audio helpers for Gemini Live API
 * Input: 16-bit linear PCM at 16,000 Hz Little-Endian
 * Output: 16-bit linear PCM at 24,000 Hz Little-Endian
 */

/**
 * Downsample Float32 audio samples from source sample rate to target sample rate (default 16000Hz)
 * and convert to 16-bit signed integer PCM.
 */
export function downsampleAndConvertToPcm16(
  inputBuffer: Float32Array,
  sourceSampleRate: number,
  targetSampleRate: number = 16000
): Int16Array {
  if (sourceSampleRate === targetSampleRate) {
    const output = new Int16Array(inputBuffer.length);
    for (let i = 0; i < inputBuffer.length; i++) {
      const s = Math.max(-1, Math.min(1, inputBuffer[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output;
  }

  const ratio = sourceSampleRate / targetSampleRate;
  const newLength = Math.round(inputBuffer.length / ratio);
  const result = new Int16Array(newLength);

  let offsetResult = 0;
  let offsetBuffer = 0;

  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    // Linear interpolation or average over filter window
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < inputBuffer.length; i++) {
      accum += inputBuffer[i];
      count++;
    }
    const sample = count > 0 ? accum / count : 0;
    const clamped = Math.max(-1, Math.min(1, sample));
    result[offsetResult] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }

  return result;
}

/**
 * Converts Int16Array PCM buffer to Base64 string
 */
export function pcm16ToBase64(int16Array: Int16Array): string {
  const uint8 = new Uint8Array(int16Array.buffer, int16Array.byteOffset, int16Array.byteLength);
  let binary = '';
  const len = uint8.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const sub = uint8.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, Array.from(sub));
  }
  return btoa(binary);
}

/**
 * Converts Base64 PCM data (16-bit Little-Endian) into Float32Array [-1.0 .. 1.0]
 */
export function base64Pcm16ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768.0;
  }
  return float32;
}

/**
 * Calculate Root-Mean-Square (RMS) audio level from Float32 buffer [0.0 - 1.0]
 */
export function calculateRms(buffer: Float32Array): number {
  if (!buffer || buffer.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  return Math.min(1, Math.sqrt(sum / buffer.length) * 2.5); // normalized boost
}

/**
 * Inline AudioWorklet processor code for ultra-low latency microphone capture
 * Buffers ~20-30ms chunks and posts them immediately off the main thread.
 */
const MIC_CAPTURE_WORKLET_CODE = `
class MicCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const sampleRate = options?.processorOptions?.sampleRate || 16000;
    // Target ~25ms chunks: 400 samples at 16kHz, 1200 samples at 48kHz
    this.chunkSize = Math.max(256, Math.round((sampleRate * 25) / 1000));
    this.buffer = new Float32Array(this.chunkSize);
    this.offset = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const channel = input[0];

    for (let i = 0; i < channel.length; i++) {
      this.buffer[this.offset++] = channel[i];
      if (this.offset >= this.chunkSize) {
        // Post copy of raw chunk to main thread
        this.port.postMessage(this.buffer.slice(0, this.chunkSize));
        this.offset = 0;
      }
    }
    return true;
  }
}
registerProcessor('mic-capture-processor', MicCaptureProcessor);
`;

export interface MicCaptureNode {
  disconnect: () => void;
}

/**
 * Creates low-latency microphone capture node using AudioWorklet (20-30ms chunks),
 * with seamless fallback to ScriptProcessor if AudioWorklet is not permitted in the context.
 */
export async function createMicCaptureNode(
  audioCtx: AudioContext,
  source: MediaStreamAudioSourceNode,
  onAudioChunk: (pcm16Base64: string, rms: number) => void
): Promise<MicCaptureNode> {
  // Try AudioWorklet first for off-main-thread processing and 20-30ms chunking
  if (audioCtx.audioWorklet) {
    try {
      const blob = new Blob([MIC_CAPTURE_WORKLET_CODE], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);
      await audioCtx.audioWorklet.addModule(workletUrl);
      URL.revokeObjectURL(workletUrl);

      const workletNode = new AudioWorkletNode(audioCtx, 'mic-capture-processor', {
        processorOptions: { sampleRate: audioCtx.sampleRate },
      });

      workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
        const float32Data = event.data;
        if (!float32Data || float32Data.length === 0) return;
        const rms = calculateRms(float32Data);
        const pcm16 = downsampleAndConvertToPcm16(float32Data, audioCtx.sampleRate, 16000);
        const base64 = pcm16ToBase64(pcm16);
        onAudioChunk(base64, rms);
      };

      source.connect(workletNode);
      // Dummy gain node (0 gain) to keep the AudioWorklet clock running without echo
      const dummyGain = audioCtx.createGain();
      dummyGain.gain.value = 0;
      workletNode.connect(dummyGain);
      dummyGain.connect(audioCtx.destination);

      return {
        disconnect: () => {
          try {
            source.disconnect(workletNode);
            workletNode.disconnect();
            dummyGain.disconnect();
          } catch {}
        },
      };
    } catch (err) {
      console.warn('[Audio] AudioWorklet not available or blocked, falling back to low-buffer processor:', err);
    }
  }

  // Graceful fallback: ScriptProcessor with small buffer size (512 samples at 16kHz = 32ms; 1024 at 48kHz = 21ms)
  const bufferSize = audioCtx.sampleRate <= 24000 ? 512 : 1024;
  const scriptNode = audioCtx.createScriptProcessor(bufferSize, 1, 1);
  scriptNode.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0);
    const rms = calculateRms(input);
    const pcm16 = downsampleAndConvertToPcm16(input, audioCtx.sampleRate, 16000);
    const base64 = pcm16ToBase64(pcm16);
    onAudioChunk(base64, rms);
  };

  source.connect(scriptNode);
  scriptNode.connect(audioCtx.destination);

  return {
    disconnect: () => {
      try {
        source.disconnect(scriptNode);
        scriptNode.disconnect();
      } catch {}
    },
  };
}

/**
 * Gapless audio player for incoming 24kHz PCM chunks from Gemini Live
 */
export class LiveAudioPlayer {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private nextStartTime: number = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private isMuted: boolean = false;

  public init(): AudioContext {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioContextClass({ sampleRate: 24000 });
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.connect(this.audioCtx.destination);
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    this.nextStartTime = this.audioCtx.currentTime;
    return this.audioCtx;
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  public playChunk(float32Samples: Float32Array, sampleRate: number = 24000) {
    if (this.isMuted) return;
    const ctx = this.audioCtx || this.init();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const buffer = ctx.createBuffer(1, float32Samples.length, sampleRate);
    buffer.getChannelData(0).set(float32Samples);

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    if (this.analyser) {
      source.connect(this.analyser);
    } else {
      source.connect(ctx.destination);
    }

    const currentTime = ctx.currentTime;
    // Small playback buffer (120ms) when starting from silence to avoid crackling,
    // while never waiting for the full response and streaming immediately.
    if (this.nextStartTime < currentTime) {
      this.nextStartTime = currentTime + 0.12;
    }

    source.start(this.nextStartTime);
    this.nextStartTime += buffer.duration;
    this.activeSources.push(source);

    source.onended = () => {
      const index = this.activeSources.indexOf(source);
      if (index > -1) {
        this.activeSources.splice(index, 1);
      }
    };
  }

  /**
   * Stop immediately (Barge-in / Interruption)
   * Cancels all active playing sources and resets schedule clock
   */
  public stopAll() {
    for (const src of this.activeSources) {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // already stopped
      }
    }
    this.activeSources = [];
    if (this.audioCtx) {
      this.nextStartTime = this.audioCtx.currentTime;
    }
  }

  public setMute(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.stopAll();
    }
  }

  public close() {
    this.stopAll();
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close();
    }
    this.audioCtx = null;
    this.analyser = null;
  }
}
