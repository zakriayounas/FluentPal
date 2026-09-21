export type TargetLanguage =
  | 'English'
  | 'Spanish'
  | 'French'
  | 'German'
  | 'Arabic'
  | 'Urdu'
  | 'Hindi'
  | 'Chinese (Mandarin)'
  | 'Japanese'
  | 'Korean'
  | 'Portuguese'
  | 'Italian'
  | 'Turkish'
  | 'Russian';

export type LanguageLevel = 'Beginner (A1-A2)' | 'Intermediate (B1-B2)' | 'Advanced (C1-C2)';

export type CorrectionStrictness =
  | 'Gentle (major errors only)'
  | 'Balanced'
  | 'Strict (every error)';

export type CorrectionTiming =
  | 'Instant (right after I finish speaking)'
  | 'Batched (every few turns)'
  | 'End-of-session only';

export type ConversationMode =
  | 'Free conversation'
  | 'Roleplay scenario'
  | 'Pronunciation practice'
  | 'Debate/opinion practice';

export type RoleplayScenario =
  | 'Ordering food at a restaurant'
  | 'Airport check-in & customs'
  | 'Job interview'
  | 'Doctor & clinic visit'
  | 'Shopping at a local store'
  | 'Phone call inquiries'
  | 'Custom scenario';

export type SpeakingSpeed = 'Slow' | 'Normal' | 'Native';

export type TutorVoice = 'Zephyr' | 'Puck' | 'Kore' | 'Fenrir' | 'Charon';

export type EnglishAccent = 'American' | 'British' | 'Australian' | 'Neutral';

export type PausePatience = 'Quick' | 'Natural' | 'Patient' | 'Very patient';

export type TurnTakingMode = 'auto' | 'manual';

export type NativeUpgradeSetting = 'When useful' | 'Every turn' | 'Off';

export interface SessionSettings {
  targetLanguage: TargetLanguage;
  explanationLanguage: TargetLanguage | 'Same as target language';
  level: LanguageLevel;
  strictness: CorrectionStrictness;
  timing: CorrectionTiming;
  mode: ConversationMode;
  roleplayScenario?: RoleplayScenario;
  customScenario?: string;
  speed: SpeakingSpeed;
  tutorVoice: TutorVoice;
  accentPreference: EnglishAccent;
  topic?: string;
  pausePatience: PausePatience;
  turnTakingMode: TurnTakingMode;
  nativeUpgrade: NativeUpgradeSetting;
  showLatencyMeter?: boolean;
}

export type CorrectionCategory =
  | 'grammar'
  | 'vocabulary'
  | 'word_choice'
  | 'pronunciation'
  | 'fluency'
  | 'politeness_register';

export interface Correction {
  id: string;
  original: string;
  corrected: string;
  explanation: string;
  category: CorrectionCategory;
  timestamp: number;
}

export type Register = 'casual' | 'neutral' | 'formal';

export interface NativeUpgrade {
  id: string;
  original: string;
  native_version: string;
  why_it_sounds_more_native: string;
  register: Register;
  timestamp: number;
}

export interface TranscriptMessage {
  id: string;
  speaker: 'user' | 'tutor';
  text: string;
  isInterim?: boolean;
  timestamp: number;
}

export interface SessionReport {
  summary: string;
  estimatedCefrLevel: string;
  cefrReasoning: string;
  topMistakePatterns: Array<{
    pattern: string;
    example: string;
    explanation: string;
  }>;
  vocabulary: Array<{
    term: string;
    translationOrDefinition: string;
    exampleSentence: string;
  }>;
  practiceSuggestions: string[];
  nativePhrases?: Array<{
    original: string;
    nativeVersion: string;
    explanation: string;
    register?: string;
  }>;
  sessionStats?: {
    durationSeconds: number;
    turnsCount: number;
    correctionsCount: number;
    nativeUpgradesCount?: number;
    targetLanguage: string;
  };
}

export interface SavedSession {
  id: string;
  date: string;
  durationSeconds: number;
  targetLanguage: string;
  level: string;
  mode?: string;
  turnsCount?: number;
  correctionsCount: number;
  report: SessionReport;
}

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error';

export type TutorState = 'idle' | 'listening' | 'thinking' | 'speaking';
