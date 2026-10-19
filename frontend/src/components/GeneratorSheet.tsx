import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useStory } from '../context/StoryContext';
import { THEMES, type DifficultyMode, type ThemeId } from '../types';
import { BottomSheet } from './BottomSheet';

const THEME_EMOJI: Record<ThemeId, string> = {
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

/** "✨ Generate New Story" slide-up sheet: 2-column theme grid + optional keywords + difficulty mode. */
export function GeneratorSheet() {
  const { profile, t } = useApp();
  const { generatorOpen, setGeneratorOpen, generate, generating, error } = useStory();
  const [theme, setTheme] = useState<ThemeId>('fun_facts');
  const [difficulty, setDifficulty] = useState<DifficultyMode>(() => profile?.difficultyMode ?? 'normal');
  const [extra, setExtra] = useState('');

  useEffect(() => {
    if (profile?.difficultyMode) {
      setDifficulty(profile.difficultyMode);
    }
  }, [profile?.difficultyMode]);

  const go = async () => {
    const ok = await generate(theme, extra, difficulty);
    if (ok) setGeneratorOpen(false);
  };

  return (
    <BottomSheet
      id="sheet-generator"
      open={generatorOpen}
      onClose={() => !generating && setGeneratorOpen(false)}
      title={t('sheet.generate.title')}
      footer={
        <button
          id="btn-generate-go"
          onClick={go}
          disabled={generating}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-600 to-accent-500 text-[16px] font-bold text-white shadow-lg shadow-brand-600/30 transition active:scale-[0.98] disabled:opacity-70"
        >
          {generating ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              {t('sheet.generate.busy')}
            </>
          ) : (
            t('sheet.generate.go')
          )}
        </button>
      }
    >
      <p className="mb-2 text-[12px] font-bold uppercase tracking-wider text-slate-400">{t('sheet.generate.theme')}</p>
      <div className="grid grid-cols-2 gap-2">
        {THEMES.map((id) => {
          const active = theme === id;
          return (
            <button
              key={id}
              id={`theme-${id}`}
              onClick={() => setTheme(id)}
              aria-pressed={active}
              className={`flex min-h-[64px] items-center gap-2 rounded-2xl border px-3 py-2 text-left text-[13px] font-semibold leading-tight transition active:scale-[0.97] ${
                active
                  ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-sm shadow-brand-500/20 ring-2 ring-brand-500/30'
                  : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              <span className="text-2xl">{THEME_EMOJI[id]}</span>
              <span>{t(`theme.${id}`)}</span>
            </button>
          );
        })}
      </div>

      <p className="mb-2 mt-4 text-[12px] font-bold uppercase tracking-wider text-slate-400">
        {t('sheet.generate.difficulty')}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          id="sheet-diff-normal"
          onClick={() => setDifficulty('normal')}
          aria-pressed={difficulty === 'normal'}
          className={`flex flex-col items-start rounded-2xl border p-3 text-left transition active:scale-[0.98] ${
            difficulty === 'normal'
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
          id="sheet-diff-hard"
          onClick={() => setDifficulty('hard')}
          aria-pressed={difficulty === 'hard'}
          className={`flex flex-col items-start rounded-2xl border p-3 text-left transition active:scale-[0.98] ${
            difficulty === 'hard'
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

      <label htmlFor="additional-instructions" className="mb-1.5 mt-4 block text-[12px] font-bold uppercase tracking-wider text-slate-400">
        {t('sheet.generate.extra')}
      </label>
      <textarea
        id="additional-instructions"
        value={extra}
        onChange={(e) => setExtra(e.target.value)}
        maxLength={300}
        rows={2}
        enterKeyHint="done"
        placeholder={t('sheet.generate.placeholder')}
        className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-500/15"
      />
      {error && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-[13px] text-rose-700">{error}</p>}
    </BottomSheet>
  );
}
