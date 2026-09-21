import React, { useState } from 'react';
import { Volume2, Sparkles, MessageSquare, ArrowRight, BookMarked } from 'lucide-react';
import { NativeUpgrade, TargetLanguage } from '../types';

interface NativeUpgradeCardProps {
  upgrade: NativeUpgrade;
  targetLanguage: TargetLanguage;
}

const LANG_CODE_MAP: Record<TargetLanguage, string> = {
  English: 'en-US',
  Spanish: 'es-ES',
  French: 'fr-FR',
  German: 'de-DE',
  Arabic: 'ar-SA',
  Urdu: 'ur-PK',
  Hindi: 'hi-IN',
  'Chinese (Mandarin)': 'zh-CN',
  Japanese: 'ja-JP',
  Korean: 'ko-KR',
  Portuguese: 'pt-BR',
  Italian: 'it-IT',
  Turkish: 'tr-TR',
  Russian: 'ru-RU',
};

const REGISTER_STYLES = {
  casual: {
    label: 'Casual / Natural',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  },
  neutral: {
    label: 'Everyday Neutral',
    badgeClass: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  },
  formal: {
    label: 'Formal / Professional',
    badgeClass: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  },
};

export const NativeUpgradeCard: React.FC<NativeUpgradeCardProps> = ({ upgrade, targetLanguage }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const registerMeta = REGISTER_STYLES[upgrade.register] || REGISTER_STYLES.casual;

  const handleSpeak = () => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(upgrade.native_version);
    utterance.lang = LANG_CODE_MAP[targetLanguage] || 'en-US';
    utterance.rate = 0.9;
    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div
      id={`native-upgrade-${upgrade.id}`}
      className="relative p-3.5 rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-950/20 via-slate-800/90 to-slate-900/90 shadow-sm border-l-4 border-l-amber-400 hover:border-amber-400/60 transition-all duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
            <Sparkles className="w-3 h-3 text-amber-400" />
            Say it like a native
          </span>
          <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${registerMeta.badgeClass}`}>
            {registerMeta.label}
          </span>
        </div>

        <button
          id={`play-upgrade-${upgrade.id}`}
          onClick={handleSpeak}
          title="Listen to native phrasing pronunciation"
          aria-label="Listen to native phrasing"
          className={`p-1 rounded-md text-slate-400 hover:text-amber-300 hover:bg-slate-700/60 transition-colors ${
            isPlaying ? 'text-amber-300 animate-pulse' : ''
          }`}
        >
          <Volume2 className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2 text-sm">
        {/* Original */}
        <div className="flex items-start gap-1.5 text-slate-300">
          <span className="text-xs text-slate-400 shrink-0 font-medium mt-0.5">You said:</span>
          <span className="italic text-slate-200 font-medium">&ldquo;{upgrade.original}&rdquo;</span>
        </div>

        {/* Native Phrasing */}
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <ArrowRight className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="text-[11px] uppercase tracking-wider font-bold text-amber-400 block mb-0.5">
              Native Upgrade
            </span>
            <span className="text-sm font-bold text-white leading-relaxed">
              {upgrade.native_version}
            </span>
          </div>
        </div>

        {/* Why it sounds more native */}
        <div className="flex items-start gap-1.5 text-xs text-slate-300 bg-slate-900/60 p-2 rounded-lg border border-slate-700/40">
          <BookMarked className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{upgrade.why_it_sounds_more_native}</span>
        </div>
      </div>
    </div>
  );
};
