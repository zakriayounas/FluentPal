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
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
    // Small buffer delay to avoid underruns
    if (this.nextStartTime < currentTime) {
      this.nextStartTime = currentTime + 0.035;
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
