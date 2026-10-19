import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useStory } from '../context/StoryContext';
import { flagFor } from '../lib/voices';
import { BottomSheet } from './BottomSheet';
import { CheckIcon, HistoryIcon, PlusIcon } from './icons';

const THEME_EMOJI: Record<string, string> = {
  fun_facts: '🤯',
  science_nature: '🌿',
  history: '🏛️',
  culture_daily: '☕',
  tech_inventions: '💡',
  travel_places: '🧭',
  food_culinary: '🍜',
  psychology: '🧠',
  space_cosmos: '🪐',
  sports_pop: '🎸',
};

export function HistorySheet() {
  const { t } = useApp();
  const { library, story, openStory, historyOpen, setHistoryOpen, setGeneratorOpen } = useStory();
  const [query, setQuery] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return library;
    return library.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (t(`theme.${s.theme}`) || '').toLowerCase().includes(q) ||
        s.cefrLevel.toLowerCase().includes(q)
    );
  }, [library, query, t]);

  const select = async (id: string) => {
    if (id === story?.id) {
      setHistoryOpen(false);
      return;
    }
    setLoadingId(id);
    try {
      await openStory(id);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <BottomSheet
      id="sheet-history"
      open={historyOpen}
      onClose={() => setHistoryOpen(false)}
      title={
        <span className="flex items-center gap-2">
          <HistoryIcon width={20} height={20} className="text-brand-600" />
          <span>{t('history.title')}</span>
        </span>
      }
    >
      {library.length > 3 && (
        <div className="mb-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('history.search')}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-[14px] text-slate-800 placeholder-slate-400 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
          />
        </div>
      )}

      {library.length === 0 ? (
        <div className="py-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <HistoryIcon width={28} height={28} />
          </div>
          <p className="mx-auto max-w-xs text-[14px] leading-relaxed text-slate-600">
            {t('history.empty')}
          </p>
          <button
            id="btn-history-empty-new"
            onClick={() => {
              setHistoryOpen(false);
              setGeneratorOpen(true);
            }}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-brand-600/25 active:scale-95"
          >
            <PlusIcon width={16} height={16} /> {t('header.new')}
          </button>
        </div>
      ) : (
        <div className="space-y-2.5 pb-2" role="list">
          {filtered.map((s) => {
            const isCurrent = story?.id === s.id;
            const isLoading = loadingId === s.id;
            const emoji = THEME_EMOJI[s.theme] ?? '🎧';
            const themeLabel = t(`theme.${s.theme}`);

            let scoreBadge = null;
            if (s.score !== null) {
              const bg =
                s.score >= 80
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  : s.score >= 50
                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                  : 'bg-rose-100 text-rose-800 border-rose-200';
              scoreBadge = (
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${bg}`}>
                  🎯 {s.score}%
                </span>
              );
            } else {
              scoreBadge = (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                  ⏳ {t('history.pending')}
                </span>
              );
            }

            return (
              <button
                key={s.id}
                id={`history-item-${s.id}`}
                onClick={() => select(s.id)}
                disabled={isLoading}
                className={`flex w-full flex-col rounded-2xl border p-3.5 text-left transition active:scale-[0.98] ${
                  isCurrent
                    ? 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-500/25 shadow-sm'
                    : 'border-slate-200/80 bg-white hover:border-brand-200 hover:bg-slate-50/80 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-500">
                    <span>{emoji}</span>
                    <span className="truncate">{themeLabel}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {scoreBadge}
                    {isCurrent && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white">
                        <CheckIcon width={12} height={12} /> {t('history.current')}
                      </span>
                    )}
                  </div>
                </div>

                <h3 className="mt-1 font-display text-[15px] font-bold leading-snug text-slate-900">
                  {s.title}
                </h3>

                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <span>{flagFor(s.targetLanguage)}</span>
                    <span className="font-semibold text-slate-600">{s.cefrLevel}</span>
                    <span className="text-slate-300">•</span>
                    <span className={`font-semibold ${s.difficultyMode === 'hard' ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {s.difficultyMode === 'hard' ? '⚡ ' + t('difficulty.hard') : '🟢 ' + t('difficulty.normal')}
                    </span>
                  </div>
                  <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                </div>

                {isLoading && (
                  <div className="mt-2 flex items-center justify-center gap-2 text-[12px] font-semibold text-brand-600">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600" />
                    <span>{t('common.loading')}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </BottomSheet>
  );
}
