import React, { useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Square,
  Sparkles,
  Headphones,
  CornerDownLeft,
  Volume2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { TutorState, TranscriptMessage, Correction, TargetLanguage, SessionSettings } from '../types';
import { WaveformVisualizer } from './WaveformVisualizer';
import { CorrectionCard } from './CorrectionCard';

interface LiveSessionViewProps {
  tutorState: TutorState;
  transcript: TranscriptMessage[];
  corrections: Correction[];
  settings: SessionSettings;
  userAnalyser: AnalyserNode | null;
  tutorAnalyser: AnalyserNode | null;
  isMicMuted: boolean;
  onToggleMicMute: () => void;
  onEndSession: () => void;
}

export const LiveSessionView: React.FC<LiveSessionViewProps> = ({
  tutorState,
  transcript,
  corrections,
  settings,
  userAnalyser,
  tutorAnalyser,
  isMicMuted,
  onToggleMicMute,
  onEndSession,
}) => {
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  const getStateMeta = () => {
    switch (tutorState) {
      case 'listening':
        return {
          title: isMicMuted ? 'Microphone Muted' : 'Listening to you...',
          subtitle: isMicMuted
            ? 'Click the microphone button to speak.'
            : 'Speak freely into your microphone. Say anything you like!',
          badgeClass: isMicMuted
            ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
          dotClass: isMicMuted ? 'bg-rose-500' : 'bg-emerald-400 animate-pulse',
          icon: isMicMuted ? MicOff : Mic,
        };
      case 'thinking':
        return {
          title: 'Sam is thinking...',
          subtitle: 'Processing your thoughts and preparing a natural reply.',
          badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
          dotClass: 'bg-amber-400 animate-ping',
          icon: Sparkles,
        };
      case 'speaking':
        return {
          title: 'Sam is speaking...',
          subtitle: 'You can interrupt or speak over Sam at any moment.',
          badgeClass: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
          dotClass: 'bg-indigo-400 animate-pulse',
          icon: Volume2,
        };
      default:
        return {
          title: 'Connecting live session...',
          subtitle: 'Setting up low-latency bidirectional voice stream.',
          badgeClass: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
          dotClass: 'bg-slate-400',
          icon: Sparkles,
        };
    }
  };

  const stateMeta = getStateMeta();
  const StateIcon = stateMeta.icon;

  return (
    <div id="live-session-view" className="w-full flex-1 flex flex-col max-w-7xl mx-auto px-3 sm:px-6 py-4 gap-4">
      {/* Top Banner: Headphone Tip & Live Status */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg">
        {/* Headphone Tip */}
        <div className="flex items-center gap-2 text-xs text-amber-300/90 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20">
          <Headphones className="w-4 h-4 shrink-0 text-amber-400" />
          <span>Tip: Use headphones for best results, to avoid microphone echo.</span>
        </div>

        {/* State Indicator Pill */}
        <div className="flex items-center gap-2">
          <div
            id="tutor-state-indicator"
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full border text-xs font-semibold ${stateMeta.badgeClass} shadow-sm transition-all duration-300`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${stateMeta.dotClass}`} />
            <StateIcon className="w-3.5 h-3.5" />
            <span>{stateMeta.title}</span>
          </div>

          <span className="hidden md:inline text-[11px] text-slate-400 italic">
            Interrupt Sam anytime (Barge-in active)
          </span>
        </div>
      </div>

      {/* Main Split Layout: Transcript on Left, Corrections on Right */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[460px]">
        {/* Left 7 Columns: Live Audio Waves + Conversation Transcript */}
        <div className="lg:col-span-7 flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-md overflow-hidden shadow-xl">
          {/* Waveform Visualizer & Hero Status Bar */}
          <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex flex-col items-center justify-center">
            <WaveformVisualizer
              state={tutorState}
              userAnalyser={userAnalyser}
              tutorAnalyser={tutorAnalyser}
              isMuted={isMicMuted}
            />
            <p className="text-xs text-slate-400 text-center font-medium mt-1">
              {stateMeta.subtitle}
            </p>
          </div>

          {/* Transcript Chat Area */}
          <div
            id="transcript-scroll-area"
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 max-h-[500px]"
          >
            {transcript.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                  <Mic className="w-6 h-6 animate-bounce" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-white">Start speaking when ready</h4>
                  <p className="text-xs text-slate-400 max-w-xs">
                    Sam will greet you in {settings.targetLanguage}. Greet back or answer Sam&apos;s opening question!
                  </p>
                </div>
              </div>
            ) : (
              transcript.map((item) => (
                <div
                  key={item.id}
                  id={`msg-${item.id}`}
                  className={`flex flex-col ${item.speaker === 'user' ? 'items-end' : 'items-start'} transition-opacity duration-200`}
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-300">
                      {item.speaker === 'user' ? 'You' : 'Sam (Tutor)'}
                    </span>
                    <span>•</span>
                    <span>
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div
                    className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      item.speaker === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-none shadow-md shadow-indigo-600/10'
                        : 'bg-slate-800/90 text-slate-100 border border-slate-700/80 rounded-bl-none shadow-sm'
                    } ${item.isInterim ? 'opacity-70 italic' : ''}`}
                  >
                    {item.text}
                  </div>
                </div>
              ))
            )}
            <div ref={transcriptEndRef} />
          </div>

          {/* Bottom Control Bar */}
          <div className="p-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                id="live-mute-toggle-btn"
                onClick={onToggleMicMute}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                  isMicMuted
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-400 hover:bg-rose-500/25'
                    : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
                }`}
              >
                {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-emerald-400" />}
                <span>{isMicMuted ? 'Unmute Mic' : 'Mute Mic'}</span>
              </button>
            </div>

            <button
              id="end-session-btn"
              onClick={onEndSession}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 active:scale-98 transition-all shadow-lg shadow-rose-600/20"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>End Session & View Report</span>
            </button>
          </div>
        </div>

        {/* Right 5 Columns: Real-Time Corrections Panel */}
        <div className="lg:col-span-5 flex flex-col rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-md overflow-hidden shadow-xl">
          {/* Corrections Header */}
          <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white tracking-tight">Live Corrections & Recasts</h3>
            </div>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
              {corrections.length} {corrections.length === 1 ? 'logged' : 'logged'}
            </span>
          </div>

          {/* Corrections Feed */}
          <div
            id="corrections-feed"
            className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[560px]"
          >
            {corrections.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-white">No mistakes logged yet</h4>
                  <p className="text-xs text-slate-400 max-w-xs">
                    Whenever Sam notices grammar, vocabulary, or pronunciation errors, native recasting cards will appear here.
                  </p>
                </div>
              </div>
            ) : (
              corrections.map((corr) => (
                <CorrectionCard
                  key={corr.id}
                  correction={corr}
                  targetLanguage={settings.targetLanguage}
                />
              ))
            )}
          </div>

          {/* Recasting Philosophy Tip */}
          <div className="p-3 border-t border-slate-800 bg-slate-950/40 flex items-center gap-2 text-[11px] text-slate-400">
            <HelpCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>
              Sam uses native recasting to repeat your thoughts naturally without disrupting conversational flow.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
