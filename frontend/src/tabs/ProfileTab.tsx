import { useState, type ReactNode } from 'react';
import { useApp } from '../context/AppContext';
import { useAudio } from '../context/AudioContext';
import { UI_LANGUAGE_OPTIONS } from '../i18n';
import { LANGUAGE_OPTIONS, VOICE_VARIANTS } from '../lib/voices';
import type { CefrLevel, VoiceEngine } from '../types';

const ENGINES: VoiceEngine[] = ['google_cloud_tts', 'polly_generative', 'browser_natural', 'openai_tts'];
const LEVELS: CefrLevel[] = ['A1', 'A2', 'B1', 'B2'];

const SAMPLE: Record<string, string> = {
  'de-DE': 'Hallo! Ich bin deine Stimme zum Hören und Lernen.',
  'fr-FR': 'Bonjour ! Je suis ta voix pour écouter et apprendre.',
  'es-ES': '¡Hola! Soy tu voz para escuchar y aprender.',
  'it-IT': 'Ciao! Sono la tua voce per ascoltare e imparare.',
  'en-US': 'Hi! I am your voice for listening and learning.',
  'pt-BR': 'Olá! Eu sou a sua voz para ouvir e aprender.',
};

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">{title}</h3>
      {children}
    </section>
  );
}

const chip = (active: boolean) =>
  `min-h-[44px] rounded-xl px-3 text-[14px] font-semibold transition active:scale-95 ${
    active ? 'bg-gradient-to-br from-brand-600 to-brand-500 text-white shadow-md shadow-brand-600/30' : 'bg-slate-100 text-slate-700'
  }`;

export function ProfileTab() {
  const { t, profile, updatePreferences, voiceVariant, setVoiceVariant, signOut } = useApp();
  const audio = useAudio();
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  if (!profile) return null;

  const save = async (patch: Parameters<typeof updatePreferences>[0]) => {
    setSaveState('saving');
    try {
      await updatePreferences(patch);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 1600);
    } catch {
      setSaveState('error');
    }
  };

  const engine = profile.preferredVoiceEngine;
  const variants = engine === 'openai_tts' || engine === 'google_cloud_tts' ? VOICE_VARIANTS[engine] : null;

  return (
    <div className="scroll-area flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-brand-50/60 to-slate-50 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-extrabold text-slate-900">{t('profile.title')}</h2>
        <span
          aria-live="polite"
          className={`rounded-full px-2.5 py-1 text-[12px] font-semibold transition-opacity ${
            saveState === 'idle' ? 'opacity-0' : 'opacity-100'
          } ${saveState === 'error' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}
        >
          {saveState === 'saving' ? t('profile.saving') : saveState === 'error' ? t('error.generic') : `✓ ${t('profile.saved')}`}
        </span>
      </div>

      <Card title={t('profile.siteLanguage')}>
        <div className="grid grid-cols-2 gap-2">
          {UI_LANGUAGE_OPTIONS.map((o) => {
            const active =
              profile.uiLanguage === o.value ||
              (profile.uiLanguage === 'en' && o.value === 'en-US') ||
              (profile.uiLanguage === 'es' && o.value === 'es-ES') ||
              (profile.uiLanguage === 'de' && o.value === 'de-DE') ||
              (profile.uiLanguage === 'fr' && o.value === 'fr-FR') ||
              (profile.uiLanguage === 'it' && o.value === 'it-IT');
            return (
              <button key={o.value} id={`ui-lang-${o.value}`} className={chip(active)} onClick={() => save({ uiLanguage: o.value })}>
                {o.flag} {o.label}
              </button>
            );
          })}
        </div>
      </Card>

      <Card title={t('profile.studiedLanguage')}>
        <div className="grid grid-cols-2 gap-2">
          {LANGUAGE_OPTIONS.map((o) => (
            <button key={o.value} id={`target-lang-${o.value}`} className={chip(profile.targetLanguage === o.value)} onClick={() => save({ targetLanguage: o.value })}>
              {o.flag} {o.label}
            </button>
          ))}
        </div>
      </Card>

      <Card title={t('profile.level')}>
        <div className="grid grid-cols-4 gap-2">
          {LEVELS.map((l) => (
            <button key={l} id={`cefr-${l}`} className={chip(profile.cefrLevel === l)} onClick={() => save({ cefrLevel: l })}>
              {l}
            </button>
          ))}
        </div>
      </Card>

      <Card title={t('profile.difficulty')}>
        <div className="grid grid-cols-2 gap-2" role="radiogroup">
          <button
            type="button"
            id="profile-diff-normal"
            role="radio"
            aria-checked={(profile.difficultyMode ?? 'normal') === 'normal'}
            onClick={() => save({ difficultyMode: 'normal' })}
            className={`flex flex-col items-start rounded-2xl border p-3 text-left transition active:scale-[0.98] ${
              (profile.difficultyMode ?? 'normal') === 'normal'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-950 shadow-sm ring-2 ring-emerald-500/30'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold text-[13px]">
              <span>🟢</span>
              <span>{t('difficulty.normal')}</span>
            </div>
            <span className="mt-1 text-[11px] leading-tight text-slate-500">
              {t('difficulty.normal.desc')}
            </span>
          </button>

          <button
            type="button"
            id="profile-diff-hard"
            role="radio"
            aria-checked={profile.difficultyMode === 'hard'}
            onClick={() => save({ difficultyMode: 'hard' })}
            className={`flex flex-col items-start rounded-2xl border p-3 text-left transition active:scale-[0.98] ${
              profile.difficultyMode === 'hard'
                ? 'border-amber-500 bg-amber-50 text-amber-950 shadow-sm ring-2 ring-amber-500/30'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold text-[13px]">
              <span>⚡</span>
              <span>{t('difficulty.hard')}</span>
            </div>
            <span className="mt-1 text-[11px] leading-tight text-slate-500">
              {t('difficulty.hard.desc')}
            </span>
          </button>
        </div>
      </Card>

      <Card title={t('profile.voiceEngine')}>
        <div className="space-y-2" role="radiogroup">
          {ENGINES.map((e) => {
            const active = engine === e;
            return (
              <button
                key={e}
                id={`engine-${e}`}
                role="radio"
                aria-checked={active}
                onClick={() => save({ preferredVoiceEngine: e })}
                className={`flex min-h-[48px] w-full items-center gap-3 rounded-xl border px-3.5 text-left text-[14px] font-semibold transition active:scale-[0.98] ${
                  active ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/25' : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${active ? 'border-brand-600' : 'border-slate-300'}`}>
                  {active && <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />}
                </span>
                {t(`engine.${e}`)}
              </button>
            );
          })}
        </div>

        {variants && (
          <div className="mt-3">
            <p className="mb-1.5 text-[12px] font-semibold text-slate-500">{t('profile.voiceVariant')}</p>
            <div className="flex gap-2">
              {variants.map((v) => (
                <button
                  key={v.id}
                  className={`${chip((variants.some((x) => x.id === voiceVariant) ? voiceVariant : variants[0].id) === v.id)} flex-1`}
                  onClick={() => setVoiceVariant(v.id)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          id="btn-test-voice"
          onClick={() => audio.speakOnce(SAMPLE[profile.targetLanguage] ?? SAMPLE['en-US'])}
          className="mt-3 flex min-h-[48px] w-full items-center justify-center rounded-xl bg-gradient-to-r from-brand-600 to-accent-500 text-[15px] font-bold text-white shadow-lg shadow-brand-600/25 transition active:scale-[0.98]"
        >
          {t('profile.testVoice')}
        </button>
      </Card>

      <Card title={t('profile.account')}>
        <div className="flex items-center gap-3">
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt="" referrerPolicy="no-referrer" className="h-12 w-12 rounded-full object-cover ring-2 ring-brand-200" />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-accent-500 font-display text-lg font-bold text-white">
              {(profile.name ?? profile.email).slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900">{profile.name ?? '—'}</p>
            <p className="truncate text-[13px] text-slate-500">{profile.email}</p>
          </div>
        </div>
        <button
          id="btn-sign-out"
          onClick={() => void signOut()}
          className="mt-3 min-h-[48px] w-full rounded-xl bg-slate-100 text-[15px] font-semibold text-slate-700 transition active:scale-[0.98]"
        >
          {t('profile.signOut')}
        </button>
        <div className="mt-3 text-center">
          <a
            href="/privacy.html"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] font-medium text-slate-400 hover:text-slate-600 underline underline-offset-4 transition"
          >
            {t('login.privacy')}
          </a>
        </div>
      </Card>
      <div className="h-2" />
    </div>
  );
}
