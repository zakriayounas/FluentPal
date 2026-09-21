import React from 'react';
import {
  Mic,
  Headphones,
  Sparkles,
  Sliders,
  Languages,
  BookOpen,
  Check,
  ChevronRight,
  ShieldCheck,
  Award,
  Volume2,
} from 'lucide-react';
import { SessionSettings, TargetLanguage, LanguageLevel, ConversationMode, SavedSession } from '../types';
import { TARGET_LANGUAGES } from './SettingsModal';

interface LobbyViewProps {
  settings: SessionSettings;
  onUpdateSettings: (newSettings: SessionSettings) => void;
  onStartSession: () => void;
  onOpenSettings: () => void;
  isStarting: boolean;
  savedSessions: SavedSession[];
  onOpenHistory: () => void;
  hasPreviousSession: boolean;
  onResumePrevious: () => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  settings,
  onUpdateSettings,
  onStartSession,
  onOpenSettings,
  isStarting,
  savedSessions,
  onOpenHistory,
  hasPreviousSession,
  onResumePrevious,
}) => {
  const topLanguages: TargetLanguage[] = [
    'English',
    'Spanish',
    'French',
    'German',
    'Japanese',
    'Chinese (Mandarin)',
    'Italian',
    'Korean',
  ];

  return (
    <div id="lobby-view" className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8 animate-fadeIn">
      {/* Hero Welcome Header */}
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Low-Latency Real-Time Voice with Gemini Live</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
          Speak freely. Learn naturally.
        </h1>
        <p className="text-sm sm:text-base text-slate-400 leading-relaxed">
          Have an authentic spoken conversation with Sam, your patient AI language tutor. Sam listens, answers in real time, and gently recasts mistakes like a native friend.
        </p>
      </div>

      {/* Main Start Card */}
      <div className="relative rounded-3xl border border-slate-700/80 bg-gradient-to-b from-slate-900/90 to-slate-950/90 p-6 sm:p-10 shadow-2xl backdrop-blur-xl flex flex-col items-center text-center space-y-6">
        {/* Glow ambient background aura */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Headphone Tip */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs sm:text-sm font-medium shadow-sm">
          <Headphones className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Use headphones for best results, to avoid microphone echo.</span>
        </div>

        {/* Big Start Conversation Button */}
        <div className="relative group pt-2">
          <div className="absolute -inset-1.5 bg-gradient-to-r from-emerald-500 to-indigo-600 rounded-full blur-md opacity-60 group-hover:opacity-100 transition duration-300 group-hover:scale-105" />
          <button
            id="start-conversation-btn"
            onClick={onStartSession}
            disabled={isStarting}
            className="relative flex items-center justify-center gap-3 px-8 sm:px-12 py-5 rounded-full bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 text-white font-extrabold text-lg sm:text-xl shadow-xl shadow-emerald-500/25 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isStarting ? (
              <>
                <div className="w-6 h-6 rounded-full border-3 border-white/30 border-t-white animate-spin" />
                <span>Connecting live audio...</span>
              </>
            ) : (
              <>
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                  <Mic className="w-5 h-5 text-white" />
                </div>
                <span>Start Conversation</span>
              </>
            )}
          </button>
        </div>

        {/* Resume Session Button if applicable */}
        {hasPreviousSession && !isStarting && (
          <button
            id="resume-previous-session-btn"
            onClick={onResumePrevious}
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 underline underline-offset-4 decoration-indigo-400/50"
          >
            Resume previous conversation context
          </button>
        )}

        {/* Active Session Configuration Preview Bar */}
        <div className="w-full max-w-2xl pt-4 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
          <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Language</span>
            <span className="text-sm font-semibold text-white truncate block">{settings.targetLanguage}</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Level</span>
            <span className="text-sm font-semibold text-white truncate block">{settings.level.split(' ')[0]}</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Voice & Speed</span>
            <span className="text-sm font-semibold text-white truncate block">{settings.tutorVoice} • {settings.speed}</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Mode</span>
            <span className="text-sm font-semibold text-white truncate block">{settings.mode.split(' ')[0]}</span>
          </div>
        </div>

        <button
          id="open-settings-from-lobby-btn"
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <Sliders className="w-3.5 h-3.5 text-indigo-400" />
          <span>Customize full session settings & corrections</span>
        </button>
      </div>

      {/* Quick Language Switch Bar */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Languages className="w-4 h-4 text-indigo-400" />
            Quick Select Target Language
          </h2>
          <button
            id="view-all-languages-btn"
            onClick={onOpenSettings}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
          >
            All 14 Languages &rarr;
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {topLanguages.map((lang) => (
            <button
              key={lang}
              id={`quick-lang-${lang.toLowerCase().replace(/[^a-z]/g, '-')}`}
              onClick={() => onUpdateSettings({ ...settings, targetLanguage: lang })}
              className={`flex items-center justify-between p-3 rounded-xl border text-left text-sm transition-all ${
                settings.targetLanguage === lang
                  ? 'border-indigo-500 bg-indigo-500/15 text-white font-bold'
                  : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
              }`}
            >
              <span>{lang}</span>
              {settings.targetLanguage === lang && <Check className="w-4 h-4 text-indigo-400" />}
            </button>
          ))}
        </div>
      </div>

      {/* Modes & Scenarios Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          id="quick-mode-free"
          onClick={() => onUpdateSettings({ ...settings, mode: 'Free conversation' })}
          className={`p-5 rounded-2xl border cursor-pointer transition-all ${
            settings.mode === 'Free conversation'
              ? 'border-indigo-500 bg-indigo-950/20 text-white'
              : 'border-slate-800 bg-slate-900/50 text-slate-300 hover:border-slate-700'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3 border border-indigo-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-base text-white">Free Conversation</h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Chat organically about your day, hobbies, opinions, and current events.
          </p>
        </div>

        <div
          id="quick-mode-roleplay"
          onClick={() => onUpdateSettings({ ...settings, mode: 'Roleplay scenario' })}
          className={`p-5 rounded-2xl border cursor-pointer transition-all ${
            settings.mode === 'Roleplay scenario'
              ? 'border-indigo-500 bg-indigo-950/20 text-white'
              : 'border-slate-800 bg-slate-900/50 text-slate-300 hover:border-slate-700'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3 border border-emerald-500/20">
            <BookOpen className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-base text-white">Roleplay Scenarios</h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Order food at a Parisian bistro, check in at Tokyo airport, or ace a tech interview.
          </p>
        </div>

        <div
          id="quick-mode-pronunciation"
          onClick={() => onUpdateSettings({ ...settings, mode: 'Pronunciation practice' })}
          className={`p-5 rounded-2xl border cursor-pointer transition-all ${
            settings.mode === 'Pronunciation practice'
              ? 'border-indigo-500 bg-indigo-950/20 text-white'
              : 'border-slate-800 bg-slate-900/50 text-slate-300 hover:border-slate-700'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3 border border-amber-500/20">
            <Volume2 className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-base text-white">Pronunciation Focus</h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Get targeted phonetic coaching, mouth position guidance, and audio repetition.
          </p>
        </div>
      </div>

      {/* Past Session Preview if available */}
      {savedSessions.length > 0 && (
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-white">
                You have {savedSessions.length} completed {savedSessions.length === 1 ? 'session' : 'sessions'}
              </h4>
              <p className="text-xs text-slate-400">
                Latest: {savedSessions[0].targetLanguage} • {savedSessions[0].level} ({savedSessions[0].report?.estimatedCefrLevel || 'CEFR'})
              </p>
            </div>
          </div>
          <button
            id="view-history-btn"
            onClick={onOpenHistory}
            className="flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
          >
            <span>View Reports</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
