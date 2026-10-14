import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useStory } from '../context/StoryContext';
import { THEMES, type ThemeId } from '../types';
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

/**
 * Slide-up Bottom Sheet opened upon clicking "Submit & Correct" (docs/corrections/2.md).
 * Lets the learner pick the theme for the next story, which starts generating in the background
 * immediately while Agent 2 evaluates their answers.
 */
export function SubmitThemeSheet() {
  const { t } = useApp();
  const { submitModalOpen, setSubmitModalOpen, submit, evaluating, story } = useStory();
  const [theme, setTheme] = useState<ThemeId>(() => (story?.theme as ThemeId) ?? 'fun_facts');
  const [extra, setExtra] = useState('');

  const confirmSubmit = async () => {
    setSubmitModalOpen(false);
    await submit(theme, extra);
  };

  return (
    <BottomSheet
      id="sheet-submit-theme"
      open={submitModalOpen}
      onClose={() => !evaluating && setSubmitModalOpen(false)}
      title={t('sheet.nextTheme.title')}
      footer={
        <button
          id="btn-confirm-submit-theme"
          onClick={confirmSubmit}
          disabled={evaluating}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-600 to-accent-500 text-[16px] font-bold text-white shadow-lg shadow-brand-600/30 transition active:scale-[0.98] disabled:opacity-70"
        >
          {evaluating ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              {t('questions.submitting')}
            </>
          ) : (
            t('sheet.nextTheme.submit')
          )}
        </button>
      }
    >
      <p className="mb-3 text-[14px] leading-snug text-slate-600">{t('sheet.nextTheme.desc')}</p>

      <p className="mb-2 text-[12px] font-bold uppercase tracking-wider text-slate-400">{t('sheet.generate.theme')}</p>
      <div className="grid grid-cols-2 gap-2">
        {THEMES.map((id) => {
          const active = theme === id;
          return (
            <button
              key={id}
              id={`submit-theme-${id}`}
              onClick={() => setTheme(id)}
              aria-pressed={active}
              className={`flex min-h-[60px] items-center gap-2 rounded-2xl border px-3 py-2 text-left text-[13px] font-semibold leading-tight transition active:scale-[0.97] ${
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

      <label htmlFor="submit-additional-instructions" className="mb-1.5 mt-4 block text-[12px] font-bold uppercase tracking-wider text-slate-400">
        {t('sheet.generate.extra')}
      </label>
      <textarea
        id="submit-additional-instructions"
        value={extra}
        onChange={(e) => setExtra(e.target.value)}
        maxLength={300}
        rows={2}
        enterKeyHint="done"
        placeholder={t('sheet.generate.placeholder')}
        className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-500/15"
      />
    </BottomSheet>
  );
}
