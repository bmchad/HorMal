import { useApp } from '../context/AppContext';
import { useStory } from '../context/StoryContext';

/** Progression banner shown above the correction cards: live status of the background next-story generation. */
export function NextStoryBanner({ score }: { score: number }) {
  const { t } = useApp();
  const { prefetchState, prefetched, startNext, retryPrefetch } = useStory();

  const tone = score >= 80 ? 'from-emerald-500 to-teal-500' : score >= 50 ? 'from-amber-400 to-orange-500' : 'from-rose-500 to-pink-500';

  return (
    <section
      id="next-story-banner"
      className="overflow-hidden rounded-2xl bg-gradient-to-br from-ink-900 via-ink-800 to-brand-700 p-4 text-white shadow-lg shadow-brand-700/30 animate-rise"
    >
      <div className="flex items-center gap-3">
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${tone} font-display text-xl font-extrabold shadow-lg`}>
          {score}
          <span className="text-xs font-bold opacity-80">%</span>
        </div>
        <div>
          <p className="font-display text-base font-bold">{t('feedback.title')}</p>
          <p className="text-[12px] text-brand-200">
            {score >= 80 ? '🎉' : score >= 50 ? '👍' : '💪'} {score}/100
          </p>
        </div>
      </div>

      <div className="mt-3.5" aria-live="polite">
        {prefetchState === 'loading' && (
          <div className="flex min-h-[48px] items-center gap-2.5 rounded-xl bg-white/10 px-3.5 py-2.5 text-[14px] font-medium ring-1 ring-white/15">
            <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            <span>{t('next.generating')}</span>
          </div>
        )}
        {prefetchState === 'ready' && prefetched && (
          <button
            id="btn-next-story"
            onClick={startNext}
            className="min-h-[52px] w-full animate-glow rounded-xl bg-gradient-to-r from-accent-500 to-brand-500 px-4 py-3 text-left text-[15px] font-bold leading-snug transition active:scale-[0.98]"
          >
            {t('next.ready', { title: prefetched.title })}
          </button>
        )}
        {prefetchState === 'error' && (
          <button
            onClick={retryPrefetch}
            className="min-h-[48px] w-full rounded-xl bg-white/10 px-3.5 py-2.5 text-left text-[14px] font-medium ring-1 ring-white/20 active:scale-[0.98]"
          >
            ⚠️ {t('next.failed')} <span className="font-bold underline">{t('next.retry')}</span>
          </button>
        )}
      </div>
    </section>
  );
}
