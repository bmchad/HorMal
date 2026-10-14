import { useCallback, useEffect, useState } from 'react';
import { SpeakerIcon, TrashIcon } from '../components/icons';
import { useApp } from '../context/AppContext';
import { useAudio } from '../context/AudioContext';
import { api } from '../lib/api';
import { flagFor } from '../lib/voices';
import type { SavedWord } from '../types';

const GENDER_STYLE: Record<string, string> = {
  der: 'bg-sky-100 text-sky-700',
  die: 'bg-rose-100 text-rose-700',
  das: 'bg-emerald-100 text-emerald-700',
};

export function VocabTab() {
  const { t, profile } = useApp();
  const audio = useAudio();
  const [words, setWords] = useState<SavedWord[] | null>(null);

  const load = useCallback(async () => {
    setWords(await api.listVocab());
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const visible = (words ?? []).filter((w) => !profile || w.targetLanguage === profile.targetLanguage);

  const remove = async (id: number) => {
    setWords((cur) => cur?.filter((w) => w.id !== id) ?? cur);
    await api.deleteVocab(id).catch(() => load());
  };

  return (
    <div className="scroll-area flex-1 overflow-y-auto bg-gradient-to-b from-brand-50/60 to-slate-50 p-4">
      <h2 className="mb-3 flex items-center gap-2 font-display text-2xl font-extrabold text-slate-900">
        {t('vocab.title')}
        {profile && <span className="text-xl">{flagFor(profile.targetLanguage)}</span>}
        <span className="ml-auto rounded-full bg-brand-100 px-2.5 py-0.5 text-[13px] font-bold text-brand-700">{visible.length}</span>
      </h2>

      {words === null && <div className="skeleton h-20 rounded-2xl" />}

      {words !== null && visible.length === 0 && (
        <div className="mt-10 flex flex-col items-center text-center animate-rise">
          <div className="mb-4 text-6xl">📚</div>
          <p className="max-w-[16rem] text-[15px] leading-snug text-slate-500">{t('vocab.empty')}</p>
        </div>
      )}

      <ul className="space-y-2">
        {visible.map((w) => {
          const g = w.gender?.toLowerCase();
          return (
            <li key={w.id} className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm animate-rise">
              <button
                id={`vocab-${w.id}-listen`}
                onClick={() => audio.speakOnce([g, w.word].filter(Boolean).join(' '))}
                aria-label={t('sentence.listen')}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-accent-500 text-white shadow-md shadow-brand-600/30 transition active:scale-90"
              >
                <SpeakerIcon width={18} height={18} />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  {g && <span className={`rounded-md px-1.5 py-px text-[11px] font-bold ${GENDER_STYLE[g] ?? 'bg-slate-200 text-slate-600'}`}>{g}</span>}
                  <span className="font-display text-[17px] font-bold text-slate-900">{w.word}</span>
                  {w.plural && w.plural !== '—' && <span className="text-[12px] text-slate-400">pl. {w.plural}</span>}
                </div>
                {w.note && <p className="text-[13px] leading-snug text-slate-500">{w.note}</p>}
              </div>
              <button
                onClick={() => remove(w.id)}
                aria-label={t('vocab.remove')}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-400 transition active:scale-90 active:bg-rose-50 active:text-rose-500"
              >
                <TrashIcon width={18} height={18} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
