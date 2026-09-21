import React, { useEffect, useRef } from 'react';
import { TutorState } from '../types';

interface WaveformVisualizerProps {
  state: TutorState;
  userAnalyser: AnalyserNode | null;
  tutorAnalyser: AnalyserNode | null;
  isMuted?: boolean;
}

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({
  state,
  userAnalyser,
  tutorAnalyser,
  isMuted = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // Select active analyser depending on state
      const activeAnalyser = state === 'speaking' ? tutorAnalyser : state === 'listening' ? userAnalyser : null;

      let volume = 0;
      let frequencyData: Uint8Array | null = null;

      if (activeAnalyser && !isMuted) {
        frequencyData = new Uint8Array(activeAnalyser.frequencyBinCount);
        activeAnalyser.getByteFrequencyData(frequencyData as any);

        let sum = 0;
        const count = Math.min(32, frequencyData.length);
        for (let i = 0; i < count; i++) {
          sum += frequencyData[i];
        }
        volume = sum / (count * 255);
      }

      phase += 0.05;

      const centerY = height / 2;
      const barCount = 36;
      const barSpacing = width / barCount;
      const barWidth = Math.max(3, barSpacing * 0.55);

      for (let i = 0; i < barCount; i++) {
        const x = i * barSpacing + (barSpacing - barWidth) / 2;
        let barHeight = 4;

        if (state === 'speaking') {
          // Dynamic wave based on tutor audio output
          const freqIndex = Math.floor((i / barCount) * (frequencyData ? frequencyData.length / 2 : 16));
          const freqVal = frequencyData ? frequencyData[freqIndex] / 255 : 0;
          const sineMod = Math.sin(phase * 2 + i * 0.3);
          barHeight = Math.max(6, (freqVal * 0.75 + 0.25) * height * 0.75 * (0.6 + 0.4 * sineMod));
        } else if (state === 'listening') {
          // Mic input wave
          const freqIndex = Math.floor((i / barCount) * (frequencyData ? frequencyData.length / 3 : 16));
          const freqVal = frequencyData ? frequencyData[freqIndex] / 255 : 0;
          const sineMod = Math.sin(phase * 1.5 + i * 0.4);
          barHeight = Math.max(5, (freqVal * 0.8 + 0.1) * height * 0.7 * (0.7 + 0.3 * sineMod));
        } else if (state === 'thinking') {
          // Smooth pulsating wave
          const wave = Math.sin(phase * 3 + (i / barCount) * Math.PI * 4);
          barHeight = Math.max(6, Math.abs(wave) * (height * 0.45) + 6);
        } else {
          // Idle ambient gentle wave
          barHeight = 4 + Math.sin(phase + i * 0.2) * 3;
        }

        // Color styling according to state
        let gradient: CanvasGradient;
        if (state === 'speaking') {
          gradient = ctx.createLinearGradient(0, centerY - barHeight / 2, 0, centerY + barHeight / 2);
          gradient.addColorStop(0, '#38bdf8'); // sky-400
          gradient.addColorStop(0.5, '#6366f1'); // indigo-500
          gradient.addColorStop(1, '#a855f7'); // purple-500
        } else if (state === 'listening') {
          gradient = ctx.createLinearGradient(0, centerY - barHeight / 2, 0, centerY + barHeight / 2);
          gradient.addColorStop(0, '#34d399'); // emerald-400
          gradient.addColorStop(0.5, '#10b981'); // emerald-500
          gradient.addColorStop(1, '#059669'); // emerald-600
        } else if (state === 'thinking') {
          gradient = ctx.createLinearGradient(0, centerY - barHeight / 2, 0, centerY + barHeight / 2);
          gradient.addColorStop(0, '#fbbf24'); // amber-400
          gradient.addColorStop(0.5, '#f59e0b'); // amber-500
          gradient.addColorStop(1, '#d97706'); // amber-600
        } else {
          gradient = ctx.createLinearGradient(0, centerY - barHeight / 2, 0, centerY + barHeight / 2);
          gradient.addColorStop(0, '#94a3b8');
          gradient.addColorStop(1, '#64748b');
        }

        ctx.fillStyle = gradient;
        const radius = barWidth / 2;
        const topY = centerY - barHeight / 2;

        ctx.beginPath();
        ctx.roundRect(x, topY, barWidth, barHeight, radius);
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [state, userAnalyser, tutorAnalyser, isMuted]);

  return (
    <div id="waveform-container" className="w-full flex justify-center items-center py-2">
      <canvas
        id="waveform-canvas"
        ref={canvasRef}
        width={400}
        height={64}
        className="w-full max-w-md h-14"
      />
    </div>
  );
};
