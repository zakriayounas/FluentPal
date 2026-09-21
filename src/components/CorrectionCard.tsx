import React, { useState } from 'react';
import { Volume2, CheckCircle2, XCircle, Sparkles } from 'lucide-react';
import { Correction, TargetLanguage } from '../types';

interface CorrectionCardProps {
  correction: Correction;
  targetLanguage: TargetLanguage;
}

const CATEGORY_STYLES: Record<string, { label: string; badgeClass: string; bgClass: string }> = {
  grammar: {
    label: 'Grammar',
    badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    bgClass: 'border-l-rose-500',
  },
  vocabulary: {
    label: 'Vocabulary',
    badgeClass: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
    bgClass: 'border-l-indigo-500',
  },
  word_choice: {
    label: 'Word Choice',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    bgClass: 'border-l-amber-500',
  },
  pronunciation: {
    label: 'Pronunciation',
    badgeClass: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    bgClass: 'border-l-cyan-500',
  },
  fluency: {
    label: 'Fluency',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    bgClass: 'border-l-emerald-500',
  },
  politeness_register: {
    label: 'Politeness & Register',
    badgeClass: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    bgClass: 'border-l-purple-500',
  },
};

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

export const CorrectionCard: React.FC<CorrectionCardProps> = ({ correction, targetLanguage }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const meta = CATEGORY_STYLES[correction.category] || {
    label: correction.category,
    badgeClass: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
    bgClass: 'border-l-indigo-500',
  };

  const handleSpeak = () => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(correction.corrected);
    utterance.lang = LANG_CODE_MAP[targetLanguage] || 'en-US';
    utterance.rate = 0.9;
    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div
      id={`correction-${correction.id}`}
      className={`relative p-3.5 rounded-xl border border-slate-700/60 bg-slate-800/80 shadow-sm border-l-4 ${meta.bgClass} hover:border-slate-600 transition-all duration-200`}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${meta.badgeClass}`}
        >
          {meta.label}
        </span>
        <button
          id={`play-correction-${correction.id}`}
          onClick={handleSpeak}
          title="Listen to corrected native pronunciation"
          aria-label="Listen to pronunciation"
          className={`p-1 rounded-md text-slate-400 hover:text-emerald-400 hover:bg-slate-700/60 transition-colors ${
            isPlaying ? 'text-emerald-400 animate-pulse' : ''
          }`}
        >
          <Volume2 className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-1.5 text-sm">
        {/* Original with strikethrough in red */}
        <div className="flex items-start gap-1.5 text-rose-400/90 font-medium">
          <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
          <span className="line-through decoration-rose-500/80 decoration-2">
            {correction.original}
          </span>
        </div>

        {/* Corrected version in green */}
        <div className="flex items-start gap-1.5 text-emerald-400 font-semibold">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
          <span>{correction.corrected}</span>
        </div>

        {/* Explanation */}
        <div className="flex items-start gap-1.5 pt-1 text-xs text-slate-300 bg-slate-900/40 p-2 rounded-lg mt-1 border border-slate-700/30">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{correction.explanation}</span>
        </div>
      </div>
    </div>
  );
};
