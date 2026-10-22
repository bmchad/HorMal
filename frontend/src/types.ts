export type VoiceEngine = 'google_cloud_tts' | 'polly_generative' | 'openai_tts' | 'browser_natural';
export type TargetLanguage = 'de-DE' | 'fr-FR' | 'es-ES' | 'it-IT' | 'en-US' | 'pt-BR' | 'ja-JP' | 'zh-CN';
export type UiLanguage =
  | 'de-DE'
  | 'fr-FR'
  | 'es-ES'
  | 'it-IT'
  | 'en-US'
  | 'pt-BR'
  | 'ja-JP'
  | 'zh-CN'
  | 'en'
  | 'pt-BR'
  | 'es'
  | 'de'
  | 'fr'
  | 'it'
  | 'ja'
  | 'zh';
export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2';
export type DifficultyMode = 'normal' | 'hard';

export const THEMES = [
  'fun_facts',
  'science_nature',
  'history',
  'culture_daily',
  'tech_inventions',
  'travel_places',
  'food_culinary',
  'psychology',
  'space_cosmos',
  'sports_pop',
] as const;
export type ThemeId = (typeof THEMES)[number];

export interface Profile {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  uiLanguage: UiLanguage;
  targetLanguage: TargetLanguage;
  cefrLevel: CefrLevel;
  preferredVoiceEngine: VoiceEngine;
  difficultyMode?: DifficultyMode;
}

export interface Sentence {
  index: number;
  target: string;
  ui: string;
}

export interface Question {
  id: number;
  order: number;
  questionTarget: string;
  questionUi: string;
}

export interface Story {
  id: string;
  title: string;
  theme: ThemeId | string;
  additionalInstructions: string | null;
  targetLanguage: TargetLanguage;
  uiLanguage: UiLanguage;
  cefrLevel: CefrLevel;
  difficultyMode?: DifficultyMode;
  createdAt: string;
  sentences: Sentence[];
  questions: Question[];
}

export interface StorySummary {
  id: string;
  title: string;
  theme: string;
  targetLanguage: string;
  cefrLevel: string;
  difficultyMode?: DifficultyMode;
  createdAt: string;
  score: number | null;
}

export interface VocabWord {
  word: string;
  gender?: string;
  plural?: string;
  pos?: string;
  note?: string;
}

export interface Evaluation {
  questionId: number;
  sentenceCorrection: {
    status: 'correct' | 'partial' | 'incorrect';
    correctedUserSentence: string;
    feedbackNote: string;
    modelAnswer: string;
  };
  translation: { question: string; modelAnswer: string };
  vocabBreakdown: VocabWord[];
  grammarAnalysis: string;
}

export interface EvalResult {
  score: number;
  evaluations: Evaluation[];
  answers: { questionId: number; userAnswer: string }[];
}

export interface SavedWord extends VocabWord {
  id: number;
  targetLanguage: string;
  savedAt: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface SynthesizeResponse {
  engine: VoiceEngine;
  voiceId: string;
  url: string | null;
  cached: boolean;
}

export interface ConversationMessage {
  id: number;
  conversationId: string;
  role: 'user' | 'model';
  textTarget: string;
  textUi: string | null;
  audioUrl: string | null;
  suggestedVocab: VocabWord[];
  createdAt: string;
}

export interface Conversation {
  id: string;
  targetLanguage: TargetLanguage | string;
  cefrLevel: CefrLevel | string;
  difficultyMode: DifficultyMode | string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ConversationMessage[];
}
