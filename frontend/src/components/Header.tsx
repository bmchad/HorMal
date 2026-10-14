import { useApp } from '../context/AppContext';
import { useStory } from '../context/StoryContext';
import { flagFor, voiceLabel } from '../lib/voices';
import { PlusIcon } from './icons';

export function Header() {
  const { profile, t, voiceVariant } = useApp();
  const { story, setGeneratorOpen, generating } = useStory();

  const pill = profile
    ? `${flagFor(profile.targetLanguage)} ${profile.cefrLevel} • ${voiceLabel(profile.preferredVoiceEngine, profile.targetLanguage, voiceVariant)}`
    : '';

  return (
    <header className="relative z-20 shrink-0 bg-gradient-to-r from-ink-900 via-ink-800 to-brand-700 pt-[env(safe-area-inset-top)] text-white">
      <div className="flex h-14 items-center gap-2 px-4">
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[17px] font-bold leading-tight tracking-tight">
            {story?.title ?? t('header.noStory')}
          </h1>
          <span
            id="voice-status-pill"
            className="mt-0.5 inline-flex items-center rounded-full bg-white/15 px-2 py-px text-[11px] font-medium text-brand-100 ring-1 ring-white/10"
          >
            {pill}
          </span>
        </div>
        <button
          id="btn-new-story"
          onClick={() => setGeneratorOpen(true)}
          disabled={generating}
          className="inline-flex min-h-[40px] items-center gap-1 rounded-full bg-gradient-to-r from-accent-500 to-brand-500 px-3.5 text-sm font-semibold shadow-lg shadow-fuchsia-900/30 transition active:scale-95 disabled:opacity-60"
        >
          <PlusIcon width={16} height={16} />
          {t('header.new')}
        </button>
      </div>
    </header>
  );
}
