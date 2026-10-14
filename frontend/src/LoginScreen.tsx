import { useState } from 'react';
import { useApp } from './context/AppContext';
import { AUTH_CONFIGURED, loginWithGoogle } from './lib/auth';
import { LANGUAGE_OPTIONS } from './lib/voices';

function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z" />
      <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.8 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

function isLangActive(current: string, optValue: string) {
  if (current === optValue) return true;
  if ((current === 'en' || current === 'en-US') && (optValue === 'en' || optValue === 'en-US')) return true;
  if ((current === 'pt' || current === 'pt-BR') && (optValue === 'pt' || optValue === 'pt-BR')) return true;
  if ((current === 'es' || current === 'es-ES') && (optValue === 'es' || optValue === 'es-ES')) return true;
  if ((current === 'de' || current === 'de-DE') && (optValue === 'de' || optValue === 'de-DE')) return true;
  if ((current === 'fr' || current === 'fr-FR') && (optValue === 'fr' || optValue === 'fr-FR')) return true;
  if ((current === 'it' || current === 'it-IT') && (optValue === 'it' || optValue === 'it-IT')) return true;
  return false;
}

export function LoginScreen() {
  const { t, uiLanguage, setUiLanguage } = useApp();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const activeOption = LANGUAGE_OPTIONS.find((o) => isLangActive(uiLanguage, o.value)) ?? LANGUAGE_OPTIONS[4];

  const go = async () => {
    setBusy(true);
    setErr(null);
    try {
      await loginWithGoogle();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('error.generic'));
      setBusy(false);
    }
  };

  return (
    <div className="relative flex flex-1 flex-col justify-between overflow-y-auto bg-gradient-to-b from-ink-900 via-ink-800 to-brand-700 px-6 sm:px-7 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(2.25rem,env(safe-area-inset-top))] text-white">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent-500/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-brand-500/40 blur-3xl" />

      {/* Top Hero Section */}
      <div className="relative animate-rise">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-gradient-to-br from-brand-500 to-accent-500 text-3xl shadow-xl shadow-accent-500/30">
            🎧
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-brand-100 backdrop-blur-md shadow-sm">
            <span>{activeOption.flag}</span>
            <span>{activeOption.label}</span>
          </div>
        </div>

        <p className="font-display text-sm font-bold uppercase tracking-[0.3em] text-accent-400">HörMal</p>
        <h1 className="mt-2 font-display text-[36px] sm:text-[40px] font-extrabold leading-[1.05] tracking-tight">{t('login.title')}</h1>
        <p className="mt-3 max-w-[20rem] text-[15px] leading-snug text-brand-200">{t('login.subtitle')}</p>

        <div className="mt-6 flex items-end gap-1.5" aria-hidden>
          {[28, 46, 22, 58, 34, 64, 40, 24, 50, 30].map((h, i) => (
            <span
              key={i}
              className="w-1.5 origin-bottom animate-wave rounded-full bg-gradient-to-t from-brand-400 to-accent-400"
              style={{ height: h, animationDelay: `${i * 0.12}s` }}
            />
          ))}
        </div>
      </div>

      {/* Language Selection Option with all learning languages */}
      <div
        className="relative my-4 animate-rise rounded-2xl border border-white/15 bg-white/[0.08] p-3.5 backdrop-blur-md shadow-xl"
        style={{ animationDelay: '80ms' }}
      >
        <div className="mb-2.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-200">
            <span>🌐</span>
            <span>{t('profile.siteLanguage')}</span>
          </span>
          <span className="text-[11px] font-semibold text-accent-300">
            {activeOption.flag} {activeOption.label}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('profile.siteLanguage')}>
          {LANGUAGE_OPTIONS.map((opt) => {
            const active = isLangActive(uiLanguage, opt.value);
            return (
              <button
                key={opt.value}
                id={`landing-lang-${opt.value}`}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setUiLanguage(opt.value)}
                className={`flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl px-2 py-1.5 text-[13px] font-semibold transition active:scale-95 ${
                  active
                    ? 'bg-gradient-to-r from-brand-500 to-accent-500 text-white font-bold shadow-md shadow-accent-500/25 ring-2 ring-white/40 scale-[1.02]'
                    : 'border border-white/10 bg-white/10 text-slate-200 hover:bg-white/20 hover:text-white'
                }`}
              >
                <span className="text-base">{opt.flag}</span>
                <span className="truncate">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom CTA / Sign-in */}
      <div className="relative animate-rise" style={{ animationDelay: '140ms' }}>
        {!AUTH_CONFIGURED && (
          <p role="alert" className="mb-3 rounded-xl bg-amber-400/15 px-3.5 py-2.5 text-[13px] leading-snug text-amber-200 ring-1 ring-amber-300/30">
            {t('login.config')}
          </p>
        )}
        {err && <p role="alert" className="mb-3 rounded-xl bg-rose-500/20 px-3.5 py-2.5 text-[13px] text-rose-100">{err}</p>}
        <button
          id="btn-google-signin"
          onClick={go}
          disabled={busy || !AUTH_CONFIGURED}
          className="flex min-h-[56px] w-full items-center justify-center gap-3 rounded-2xl bg-white text-[16px] font-bold text-slate-800 shadow-2xl shadow-black/30 transition hover:bg-slate-50 active:scale-[0.98] disabled:opacity-60"
        >
          <GoogleG /> {t('login.google')}
        </button>
        <p className="mt-3 text-center text-[12px] text-brand-200/80">{t('login.footer')}</p>
        <div className="mt-3 text-center">
          <a
            href="/privacy.html"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] text-brand-300/80 hover:text-white underline underline-offset-4 transition"
          >
            {t('login.privacy')}
          </a>
        </div>
      </div>
    </div>
  );
}
