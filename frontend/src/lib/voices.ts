import type { TargetLanguage, VoiceEngine } from '../types';

export const LANGUAGE_OPTIONS: { value: TargetLanguage; label: string; flag: string }[] = [
  { value: 'de-DE', label: 'Deutsch', flag: '🇩🇪' },
  { value: 'fr-FR', label: 'Français', flag: '🇫🇷' },
  { value: 'es-ES', label: 'Español', flag: '🇪🇸' },
  { value: 'it-IT', label: 'Italiano', flag: '🇮🇹' },
  { value: 'en-US', label: 'English', flag: '🇺🇸' },
  { value: 'pt-BR', label: 'Português (BR)', flag: '🇧🇷' },
];

export const flagFor = (lang: string) => LANGUAGE_OPTIONS.find((l) => l.value === lang)?.flag ?? '🌐';

/** Mirrors the backend's default feminine Polly voice per language (display only). */
const POLLY_NAME: Record<string, string> = {
  'de-DE': 'Vicki',
  'fr-FR': 'Gabrielle',
  'es-ES': 'Lucia',
  'it-IT': 'Beatrice',
  'en-US': 'Ruth',
  'pt-BR': 'Camila',
};

export const VOICE_VARIANTS: Record<
  Extract<VoiceEngine, 'google_cloud_tts' | 'openai_tts'>,
  { id: string; label: string }[]
> = {
  google_cloud_tts: [
    { id: 'chirp3_hd', label: 'Chirp 3: HD' },
    { id: 'neural2', label: 'Neural2' },
  ],
  openai_tts: [
    { id: 'nova', label: 'Nova' },
    { id: 'shimmer', label: 'Shimmer' },
    { id: 'coral', label: 'Coral' },
  ],
};

export function voiceLabel(engine: VoiceEngine, lang: string, variantId?: string): string {
  if (engine === 'google_cloud_tts') return variantId === 'neural2' ? 'Neural2' : 'Chirp 3 HD';
  if (engine === 'polly_generative') return POLLY_NAME[lang] ?? 'Polly';
  if (engine === 'browser_natural') return 'Browser';
  const v = VOICE_VARIANTS.openai_tts.find((x) => x.id === variantId) ?? VOICE_VARIANTS.openai_tts[0];
  return v.label;
}

const FEMININE_HINTS = [
  'natural', 'online', 'google', 'katja', 'vicki', 'anna', 'helena', 'paulina', 'female', 'amala', 'seraphina',
  'elke', 'marlene', 'hedda', 'denise', 'eloise', 'elvira', 'dalia', 'lucia', 'laura', 'elsa', 'isabella', 'francisca',
  'maria', 'luciana', 'ava', 'jenny', 'aria', 'samantha', 'amelie', 'audrey', 'monica', 'alice', 'zira',
];
const MASCULINE_HINTS = ['male', 'conrad', 'stefan', 'killian', 'hans', 'markus', 'claude', 'henri', 'jorge', 'diego', 'alvaro', 'antonio', 'guy', 'ryan', 'daniel', 'thomas', 'felipe', 'david'];

/** Picks the most natural-sounding feminine system voice for a BCP-47 locale ($0 client-side fallback). */
export function getBestFeminineVoice(targetLanguage: string): SpeechSynthesisVoice | undefined {
  if (typeof speechSynthesis === 'undefined') return undefined;
  const base = targetLanguage.slice(0, 2).toLowerCase();
  const voices = speechSynthesis
    .getVoices()
    .filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith(base));
  if (!voices.length) return undefined;

  const score = (v: SpeechSynthesisVoice) => {
    const name = v.name.toLowerCase();
    let s = 0;
    if (v.lang.replace('_', '-').toLowerCase() === targetLanguage.toLowerCase()) s += 4;
    FEMININE_HINTS.forEach((k, i) => {
      if (name.includes(k)) s += k === 'natural' || k === 'online' ? 6 : k === 'google' ? 3 : i < 10 ? 3 : 2;
    });
    if (MASCULINE_HINTS.some((k) => name.includes(k))) s -= 8;
    if (!v.localService) s += 1;
    return s;
  };
  return [...voices].sort((a, b) => score(b) - score(a))[0];
}
