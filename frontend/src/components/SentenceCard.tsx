import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAudio } from '../context/AudioContext';
import { useStory } from '../context/StoryContext';
import type { Sentence } from '../types';
import { GlobeIcon, HelpIcon, SpeakerIcon } from './icons';

const pill =
  'inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-[13px] font-semibold transition active:scale-95';

export function SentenceCard({ sentence, revealed, total }: { sentence: Sentence; revealed: boolean; total: number }) {
  const { t } = useApp();
  const audio = useAudio();
  const { openDoubt } = useStory();
  const [showTranslation, setShowTranslation] = useState(false);
  const active = audio.isActive(sentence.index);

  return (
    <article
      id={`sentence-${sentence.index}`}
      className={`overflow-hidden rounded-2xl border bg-white transition-all duration-300 ${
        active ? 'border-brand-400 shadow-lg shadow-brand-500/20 ring-2 ring-brand-400/40' : 'border-slate-200/80 shadow-sm'
      }`}
    >
      <div className="px-4 pb-2 pt-3.5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="font-display text-[11px] font-bold uppercase tracking-wider text-brand-600">
            {sentence.index + 1} / {total}
          </span>
          {active && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-accent-500 animate-fade-in">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-500" /> ♪
            </span>
          )}
        </div>
        <p className={`blur-listen text-[17px] font-medium leading-snug text-slate-900 ${revealed ? 'revealed' : ''}`}>
          {sentence.target}
        </p>
        {showTranslation && (
          <p className="mt-2 rounded-xl bg-brand-50 px-3 py-2 text-[14px] leading-snug text-brand-700 animate-fade-in">
            {sentence.ui}
          </p>
        )}
      </div>
      <div className="flex gap-1.5 border-t border-slate-100 bg-slate-50/70 p-1.5">
        <button
          id={`sentence-${sentence.index}-listen`}
          className={`${pill} bg-brand-600 text-white shadow-sm shadow-brand-600/30`}
          onClick={() => audio.playSentence(sentence.index)}
        >
          <SpeakerIcon width={16} height={16} /> {t('sentence.listen')}
        </button>
        <button
          id={`sentence-${sentence.index}-translate`}
          className={`${pill} ${showTranslation ? 'bg-brand-100 text-brand-700' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}
          onClick={() => setShowTranslation((v) => !v)}
          aria-pressed={showTranslation}
        >
          <GlobeIcon width={16} height={16} /> {t('sentence.translate')}
        </button>
        <button
          id={`sentence-${sentence.index}-ask`}
          className={`${pill} bg-white text-slate-700 ring-1 ring-slate-200`}
          onClick={() => openDoubt(sentence.target)}
        >
          <HelpIcon width={16} height={16} /> {t('sentence.ask')}
        </button>
      </div>
    </article>
  );
}
