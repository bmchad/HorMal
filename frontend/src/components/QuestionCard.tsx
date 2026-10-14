import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAudio } from '../context/AudioContext';
import { useStory } from '../context/StoryContext';
import type { Question } from '../types';
import { EyeIcon, EyeOffIcon, SpeakerIcon } from './icons';

export function QuestionCard({ question, position }: { question: Question; position: number }) {
  const { t } = useApp();
  const audio = useAudio();
  const { answers, setAnswer, openDoubt } = useStory();
  const [revealed, setRevealed] = useState(false);
  const value = answers[question.id] ?? '';

  return (
    <article
      id={`question-${question.id}`}
      className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm animate-rise"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-accent-500 font-display text-[13px] font-bold text-white">
          {position}
        </span>
        <p className={`blur-listen flex-1 text-[16px] font-medium leading-snug text-slate-900 ${revealed ? 'revealed' : ''}`}>
          {question.questionTarget}
        </p>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          id={`question-${question.id}-listen`}
          onClick={() => audio.speakOnce(question.questionTarget)}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 text-[13px] font-semibold text-white shadow-sm shadow-brand-600/30 transition active:scale-95"
        >
          <SpeakerIcon width={16} height={16} /> {t('sentence.listen')}
        </button>
        <button
          id={`question-${question.id}-reveal`}
          onClick={() => setRevealed((v) => !v)}
          aria-label={t('questions.reveal')}
          aria-pressed={revealed}
          className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition active:scale-95"
        >
          {revealed ? <EyeOffIcon width={18} height={18} /> : <EyeIcon width={18} height={18} />}
        </button>
        <button
          onClick={() => openDoubt(question.questionTarget)}
          className="ml-auto inline-flex min-h-[40px] items-center rounded-xl px-2 text-[13px] font-semibold text-slate-500 transition active:scale-95"
        >
          ❓ {t('sentence.ask')}
        </button>
      </div>
      <input
        id={`answer-${question.id}`}
        type="text"
        value={value}
        onChange={(e) => setAnswer(question.id, e.target.value)}
        enterKeyHint="next"
        autoComplete="off"
        autoCapitalize="sentences"
        spellCheck={false}
        placeholder={t('questions.placeholder')}
        className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:ring-4 focus:ring-brand-500/15"
      />
    </article>
  );
}
