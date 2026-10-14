import { useApp } from '../context/AppContext';
import { useStory } from '../context/StoryContext';
import { flagFor, voiceLabel } from '../lib/voices';
import { PlusIcon } from './icons';

export function Header() {
  const { profile, t, voiceVariant } = useApp();
  const { story, library, setGeneratorOpen, setHistoryOpen, generating } = useStory();

  const pill = profile
    ? `${flagFor(profile.targetLanguage)} ${profile.cefrLevel} • ${voiceLabel(profile.preferredVoiceEngine, profile.targetLanguage, voiceVariant)}`
    : '';

  return (
    <header className="relative z-20 shrink-0 bg-gradient-to-r from-ink-900 via-ink-800 to-brand-700 pt-[env(safe-area-inset-top)] text-white">
      <div className="flex h-14 items-center gap-2 px-3.5">
        <button
          id="btn-header-title"
          type="button"
          onClick={() => setHistoryOpen(true)}
          className="group min-w-0 flex-1 text-left transition active:opacity-80"
          title={t('header.history')}
        >
          <div className="flex items-center gap-1.5">
            <h1 className="truncate font-display text-[16px] sm:text-[17px] font-bold leading-tight tracking-tight group-hover:text-brand-200 transition">
              {story?.title ?? t('header.noStory')}
            </h1>
            <svg
              className="h-3.5 w-3.5 shrink-0 text-brand-300/80 transition-transform group-hover:translate-y-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          <span
            id="voice-status-pill"
            className="mt-0.5 inline-flex items-center rounded-full bg-white/15 px-2 py-px text-[11px] font-medium text-brand-100 ring-1 ring-white/10"
          >
            {pill}
          </span>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            id="btn-history"
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 text-xs font-semibold text-white backdrop-blur-md transition hover:bg-white/20 active:scale-95"
            title={t('header.history')}
          >
            <span>📚</span>
            <span className="hidden xs:inline">{t('header.history')}</span>
            {library.length > 0 && (
              <span className="rounded-full bg-accent-500 px-1.5 py-0.2 text-[10px] font-bold text-white shadow-xs">
                {library.length}
              </span>
            )}
          </button>

          <button
            id="btn-new-story"
            type="button"
            onClick={() => setGeneratorOpen(true)}
            disabled={generating}
            className="inline-flex min-h-[38px] items-center gap-1 rounded-full bg-gradient-to-r from-accent-500 to-brand-500 px-3.5 text-xs sm:text-sm font-semibold shadow-lg shadow-fuchsia-900/30 transition active:scale-95 disabled:opacity-60"
          >
            <PlusIcon width={15} height={15} />
            {t('header.new')}
          </button>
        </div>
      </div>
    </header>
  );
}
