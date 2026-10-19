export const VOICE_ENGINES = ['google_cloud_tts', 'polly_generative', 'openai_tts', 'browser_natural'] as const;
export type VoiceEngine = (typeof VOICE_ENGINES)[number];

export const TARGET_LANGUAGES = ['de-DE', 'fr-FR', 'es-ES', 'it-IT', 'en-US', 'pt-BR'] as const;
export type TargetLanguage = (typeof TARGET_LANGUAGES)[number];

export const UI_LANGUAGES = [
  'de-DE',
  'fr-FR',
  'es-ES',
  'it-IT',
  'en-US',
  'pt-BR',
  'en',
  'pt-BR',
  'es',
  'de',
  'fr',
  'it',
] as const;
export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2'] as const;

export const DIFFICULTY_MODES = ['normal', 'hard'] as const;
export type DifficultyMode = (typeof DIFFICULTY_MODES)[number];

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

const LANGUAGE_NAMES: Record<string, string> = {
  'de-DE': 'German',
  'fr-FR': 'French',
  'es-ES': 'Spanish',
  'it-IT': 'Italian',
  'en-US': 'English',
  'pt-BR': 'Brazilian Portuguese',
  en: 'English',
  es: 'Spanish',
  de: 'German',
  fr: 'French',
  it: 'Italian',
  pt: 'Brazilian Portuguese',
};

export function languageName(code: string): string {
  return LANGUAGE_NAMES[code] ?? code;
}

export const THEME_DESCRIPTIONS: Record<(typeof THEMES)[number], string> = {
  fun_facts: 'Curiosities & fun facts',
  science_nature: 'Science & nature',
  history: 'History & time travel',
  culture_daily: 'Everyday life & culture',
  tech_inventions: 'Technology & inventions',
  travel_places: 'Travel & hidden places',
  food_culinary: 'Food & culinary secrets',
  psychology: 'Psychology & human behavior',
  space_cosmos: 'Space & the universe',
  sports_pop: 'Sports, music & pop culture',
};
