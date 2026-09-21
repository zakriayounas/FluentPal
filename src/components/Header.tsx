import React from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sliders,
  History,
  Sparkles,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { ConnectionStatus, SessionSettings } from '../types';

interface HeaderProps {
  isSessionActive: boolean;
  sessionDuration: number;
  connectionStatus: ConnectionStatus;
  isMicMuted: boolean;
  onToggleMicMute: () => void;
  isSpeakerMuted: boolean;
  onToggleSpeakerMute: () => void;
  settings: SessionSettings;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isSessionActive,
  sessionDuration,
  connectionStatus,
  isMicMuted,
  onToggleMicMute,
  isSpeakerMuted,
  onToggleSpeakerMute,
  settings,
  onOpenSettings,
  onOpenHistory,
}) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <header
      id="app-header"
      className="w-full border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40 transition-colors"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo & Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg text-white tracking-tight font-display">
                FluentPal
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Gemini Live
              </span>
            </div>
            <p className="hidden md:block text-[11px] text-slate-400 font-medium">
              Real-time Voice Language Tutor
            </p>
          </div>
        </div>

        {/* Center: Language & Session Active Status */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Target language & level button */}
          <button
            id="header-language-pill"
            onClick={onOpenSettings}
            disabled={isSessionActive}
            title={isSessionActive ? 'Settings locked during active session' : 'Configure language & level'}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              isSessionActive
                ? 'bg-slate-800/60 border-slate-700/60 text-slate-300 cursor-default'
                : 'bg-indigo-500/10 hover:bg-indigo-500/20 border-indigo-500/30 text-indigo-300 hover:border-indigo-500/50'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{settings.targetLanguage}</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400 hidden sm:inline">{settings.level.split(' ')[0]}</span>
          </button>

          {/* Active Session Timer */}
          {isSessionActive && (
            <div
              id="header-timer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-bold bg-slate-800 border border-slate-700 text-white animate-fadeIn"
            >
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <span>{formatTime(sessionDuration)}</span>
            </div>
          )}

          {/* Connection Status Badge */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border border-slate-800 bg-slate-950/40 text-slate-400">
            {connectionStatus === 'connected' ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-slate-300">Live</span>
              </>
            ) : connectionStatus === 'connecting' || connectionStatus === 'reconnecting' ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span className="text-amber-300">Syncing...</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-slate-500" />
                <span>Standby</span>
              </>
            )}
          </div>
        </div>

        {/* Right: Audio Controls & Modals */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Mute Mic toggle (when active) */}
          {isSessionActive && (
            <button
              id="header-mute-mic-btn"
              onClick={onToggleMicMute}
              title={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
              className={`p-2 rounded-xl border text-sm transition-colors ${
                isMicMuted
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 hover:bg-rose-500/30'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          )}

          {/* Mute Speaker toggle (when active) */}
          {isSessionActive && (
            <button
              id="header-mute-speaker-btn"
              onClick={onToggleSpeakerMute}
              title={isSpeakerMuted ? 'Unmute tutor audio' : 'Mute tutor audio'}
              className={`p-2 rounded-xl border text-sm transition-colors ${
                isSpeakerMuted
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 hover:bg-rose-500/30'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              {isSpeakerMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          )}

          {/* History Drawer Button */}
          <button
            id="header-history-btn"
            onClick={onOpenHistory}
            title="View past sessions"
            className="p-2 rounded-xl border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <History className="w-4 h-4" />
          </button>

          {/* Settings Button */}
          <button
            id="header-settings-btn"
            onClick={onOpenSettings}
            title="Configure practice settings"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 text-xs font-semibold transition-colors"
          >
            <Sliders className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </div>
    </header>
  );
};
