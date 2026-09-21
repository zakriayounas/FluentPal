import React, { useState } from 'react';
import {
  X,
  Languages,
  Sliders,
  Sparkles,
  Volume2,
  HelpCircle,
  Check,
  RotateCcw,
} from 'lucide-react';
import {
  SessionSettings,
  TargetLanguage,
  LanguageLevel,
  CorrectionStrictness,
  CorrectionTiming,
  ConversationMode,
  RoleplayScenario,
  SpeakingSpeed,
  TutorVoice,
  EnglishAccent,
} from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SessionSettings;
  onSave: (newSettings: SessionSettings) => void;
  disabled?: boolean;
}

export const TARGET_LANGUAGES: TargetLanguage[] = [
  'English',
  'Spanish',
  'French',
  'German',
  'Arabic',
  'Urdu',
  'Hindi',
  'Chinese (Mandarin)',
  'Japanese',
  'Korean',
  'Portuguese',
  'Italian',
  'Turkish',
  'Russian',
];

export const ROLEPLAY_SCENARIOS: RoleplayScenario[] = [
  'Ordering food at a restaurant',
  'Airport check-in & customs',
  'Job interview',
  'Doctor & clinic visit',
  'Shopping at a local store',
  'Phone call inquiries',
  'Custom scenario',
];

export const TUTOR_VOICES: { voice: TutorVoice; label: string; tone: string }[] = [
  { voice: 'Zephyr', label: 'Zephyr', tone: 'Warm, natural & well-balanced (Recommended)' },
  { voice: 'Puck', label: 'Puck', tone: 'Upbeat, friendly & encouraging' },
  { voice: 'Kore', label: 'Kore', tone: 'Calm, patient & gentle' },
  { voice: 'Fenrir', label: 'Fenrir', tone: 'Deep, articulate & resonant' },
  { voice: 'Charon', label: 'Charon', tone: 'Clear, steady & thoughtful' },
];

export const DEFAULT_SETTINGS: SessionSettings = {
  targetLanguage: 'English',
  explanationLanguage: 'Same as target language',
  level: 'Intermediate (B1-B2)',
  strictness: 'Balanced',
  timing: 'Instant (right after I finish speaking)',
  mode: 'Free conversation',
  roleplayScenario: 'Ordering food at a restaurant',
  customScenario: '',
  speed: 'Normal',
  tutorVoice: 'Zephyr',
  accentPreference: 'American',
  topic: '',
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
  disabled = false,
}) => {
  const [formData, setFormData] = useState<SessionSettings>(settings);
  const [activeTab, setActiveTab] = useState<'language' | 'mode' | 'tutor' | 'correction'>('language');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const handleReset = () => {
    setFormData(DEFAULT_SETTINGS);
  };

  return (
    <div
      id="settings-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="settings-modal-dialog"
        className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Practice Session Settings</h2>
              <p className="text-xs text-slate-400">Configure your target language, tutor voice, and correction style</p>
            </div>
          </div>
          <button
            id="close-settings-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 gap-2 pt-2">
          <button
            id="tab-language"
            type="button"
            onClick={() => setActiveTab('language')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'language'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Languages className="w-4 h-4" />
            Language & Level
          </button>
          <button
            id="tab-mode"
            type="button"
            onClick={() => setActiveTab('mode')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'mode'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Mode & Topic
          </button>
          <button
            id="tab-tutor"
            type="button"
            onClick={() => setActiveTab('tutor')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'tutor'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Volume2 className="w-4 h-4" />
            Voice & Accent
          </button>
          <button
            id="tab-correction"
            type="button"
            onClick={() => setActiveTab('correction')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'correction'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            Corrections
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'language' && (
            <div className="space-y-5">
              {/* Target Language */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Target Language to Practice
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {TARGET_LANGUAGES.map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      id={`target-lang-${lang.toLowerCase().replace(/[^a-z]/g, '-')}`}
                      onClick={() => setFormData({ ...formData, targetLanguage: lang })}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-left text-sm transition-all ${
                        formData.targetLanguage === lang
                          ? 'border-indigo-500 bg-indigo-500/10 text-white font-semibold'
                          : 'border-slate-800 bg-slate-800/50 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      <span>{lang}</span>
                      {formData.targetLanguage === lang && <Check className="w-4 h-4 text-indigo-400 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Explanation Language */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Explanation Language
                </label>
                <p className="text-xs text-slate-400 mb-2">
                  Language used when you ask Sam for translations, explanations, or rule clarifications.
                </p>
                <select
                  id="explanation-lang-select"
                  value={formData.explanationLanguage}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      explanationLanguage: e.target.value as TargetLanguage | 'Same as target language',
                    })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
                >
                  <option value="Same as target language">Same as target language ({formData.targetLanguage})</option>
                  {TARGET_LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
              </div>

              {/* Level */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Your Current Level
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {(['Beginner (A1-A2)', 'Intermediate (B1-B2)', 'Advanced (C1-C2)'] as LanguageLevel[]).map(
                    (level) => (
                      <button
                        key={level}
                        type="button"
                        id={`level-${level.substring(0, 3).toLowerCase()}`}
                        onClick={() => setFormData({ ...formData, level })}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          formData.level === level
                            ? 'border-indigo-500 bg-indigo-500/10 text-white'
                            : 'border-slate-800 bg-slate-800/50 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
                        }`}
                      >
                        <div className="font-semibold text-sm">{level}</div>
                        <div className="text-xs text-slate-400 mt-1">
                          {level.startsWith('Beginner') && 'Simple words, short sentences & high encouragement'}
                          {level.startsWith('Intermediate') && 'Natural speed, idioms & varied topics'}
                          {level.startsWith('Advanced') && 'Native nuances, rapid phrasing & debate'}
                        </div>
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'mode' && (
            <div className="space-y-5">
              {/* Conversation Mode */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Practice Mode
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(
                    [
                      'Free conversation',
                      'Roleplay scenario',
                      'Pronunciation practice',
                      'Debate/opinion practice',
                    ] as ConversationMode[]
                  ).map((m) => (
                    <button
                      key={m}
                      type="button"
                      id={`mode-${m.toLowerCase().replace(/[^a-z]/g, '-')}`}
                      onClick={() => setFormData({ ...formData, mode: m })}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        formData.mode === m
                          ? 'border-indigo-500 bg-indigo-500/10 text-white font-medium'
                          : 'border-slate-800 bg-slate-800/50 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      <div className="font-semibold text-sm">{m}</div>
                      <div className="text-xs text-slate-400 mt-1">
                        {m === 'Free conversation' && 'Casual, friendly chat following your topics and interests.'}
                        {m === 'Roleplay scenario' && 'Real-world situations (ordering, airport, interviews).'}
                        {m === 'Pronunciation practice' && 'Mouth position guidance, tongue twisters & repetition.'}
                        {m === 'Debate/opinion practice' && 'Defend arguments and articulate complex viewpoints.'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Roleplay Scenarios dropdown if roleplay mode selected */}
              {formData.mode === 'Roleplay scenario' && (
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                  <label className="block text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                    Select Scenario
                  </label>
                  <select
                    id="roleplay-scenario-select"
                    value={formData.roleplayScenario}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        roleplayScenario: e.target.value as RoleplayScenario,
                      })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
                  >
                    {ROLEPLAY_SCENARIOS.map((scenario) => (
                      <option key={scenario} value={scenario}>
                        {scenario}
                      </option>
                    ))}
                  </select>

                  {formData.roleplayScenario === 'Custom scenario' && (
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Describe your custom scene:</label>
                      <input
                        type="text"
                        id="custom-scenario-input"
                        placeholder="e.g., Returning a defective watch at an electronics boutique"
                        value={formData.customScenario || ''}
                        onChange={(e) => setFormData({ ...formData, customScenario: e.target.value })}
                        className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Optional Topic Field */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Topic or Interest (Optional)
                </label>
                <p className="text-xs text-slate-400 mb-2">
                  Tell Sam what you want to talk about (e.g., &quot;cricket&quot;, &quot;software engineering jobs&quot;, &quot;street food in Tokyo&quot;).
                </p>
                <input
                  type="text"
                  id="topic-input"
                  placeholder="e.g. Travel, weekend plans, favourite music, football..."
                  value={formData.topic || ''}
                  onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white text-sm focus:outline-none focus:border-indigo-500 placeholder:text-slate-500"
                />
              </div>
            </div>
          )}

          {activeTab === 'tutor' && (
            <div className="space-y-5">
              {/* Tutor Voice */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Tutor Voice (Gemini Live API)
                </label>
                <div className="space-y-2">
                  {TUTOR_VOICES.map((v) => (
                    <button
                      key={v.voice}
                      type="button"
                      id={`voice-${v.voice.toLowerCase()}`}
                      onClick={() => setFormData({ ...formData, tutorVoice: v.voice })}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                        formData.tutorVoice === v.voice
                          ? 'border-indigo-500 bg-indigo-500/10 text-white'
                          : 'border-slate-800 bg-slate-800/50 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      <div>
                        <span className="font-semibold text-sm">{v.label}</span>
                        <p className="text-xs text-slate-400 mt-0.5">{v.tone}</p>
                      </div>
                      {formData.tutorVoice === v.voice && <Check className="w-5 h-5 text-indigo-400" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Speaking Speed */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Speaking Speed of Tutor
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Slow', 'Normal', 'Native'] as SpeakingSpeed[]).map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      id={`speed-${spd.toLowerCase()}`}
                      onClick={() => setFormData({ ...formData, speed: spd })}
                      className={`p-2.5 rounded-xl border text-center text-sm font-medium transition-all ${
                        formData.speed === spd
                          ? 'border-indigo-500 bg-indigo-500/10 text-white'
                          : 'border-slate-800 bg-slate-800/50 text-slate-400 hover:border-slate-700 hover:text-white'
                      }`}
                    >
                      {spd}
                    </button>
                  ))}
                </div>
              </div>

              {/* English Accent (Only for English target) */}
              {formData.targetLanguage === 'English' && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    English Accent Preference
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(['American', 'British', 'Australian', 'Neutral'] as EnglishAccent[]).map((acc) => (
                      <button
                        key={acc}
                        type="button"
                        id={`accent-${acc.toLowerCase()}`}
                        onClick={() => setFormData({ ...formData, accentPreference: acc })}
                        className={`p-2 rounded-xl border text-center text-xs font-medium transition-all ${
                          formData.accentPreference === acc
                            ? 'border-indigo-500 bg-indigo-500/10 text-white'
                            : 'border-slate-800 bg-slate-800/50 text-slate-400 hover:border-slate-700 hover:text-white'
                        }`}
                      >
                        {acc}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'correction' && (
            <div className="space-y-5">
              {/* Strictness */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Correction Strictness
                </label>
                <div className="space-y-2.5">
                  {(
                    [
                      'Gentle (major errors only)',
                      'Balanced',
                      'Strict (every error)',
                    ] as CorrectionStrictness[]
                  ).map((st) => (
                    <button
                      key={st}
                      type="button"
                      id={`strictness-${st.substring(0, 4).toLowerCase()}`}
                      onClick={() => setFormData({ ...formData, strictness: st })}
                      className={`w-full p-3 rounded-xl border text-left transition-all ${
                        formData.strictness === st
                          ? 'border-indigo-500 bg-indigo-500/10 text-white'
                          : 'border-slate-800 bg-slate-800/50 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      <div className="font-semibold text-sm">{st}</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {st.startsWith('Gentle') && 'Corrects only mistakes that hinder understanding; prioritizes flow.'}
                        {st === 'Balanced' && 'Recasts natural errors (1-2 per turn) while maintaining pleasant dialogue.'}
                        {st.startsWith('Strict') && 'Zeroes in on minor prepositions, grammar, and pronunciation nuances.'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Timing */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Correction Timing
                </label>
                <div className="space-y-2">
                  {(
                    [
                      'Instant (right after I finish speaking)',
                      'Batched (every few turns)',
                      'End-of-session only',
                    ] as CorrectionTiming[]
                  ).map((tm) => (
                    <button
                      key={tm}
                      type="button"
                      id={`timing-${tm.substring(0, 4).toLowerCase()}`}
                      onClick={() => setFormData({ ...formData, timing: tm })}
                      className={`w-full p-2.5 rounded-xl border text-left text-sm transition-all ${
                        formData.timing === tm
                          ? 'border-indigo-500 bg-indigo-500/10 text-white font-medium'
                          : 'border-slate-800 bg-slate-800/50 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      {tm}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
            <button
              type="button"
              id="reset-settings-btn"
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset to Defaults
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                id="cancel-settings-btn"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="save-settings-btn"
                disabled={disabled}
                className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:scale-98 transition-all shadow-lg shadow-indigo-600/20"
              >
                Save Settings
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
