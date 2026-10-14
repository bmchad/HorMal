import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAudio } from '../context/AudioContext';
import { useStory } from '../context/StoryContext';
import { api } from '../lib/api';
import type { Evaluation, Question, VocabWord } from '../types';
import { CheckIcon, PlusIcon, SpeakerIcon } from './icons';

const GENDER_STYLE: Record<string, string> = {
  der: 'bg-sky-100 text-sky-700',
  die: 'bg-rose-100 text-rose-700',
  das: 'bg-emerald-100 text-emerald-700',
  le: 'bg-sky-100 text-sky-700',
  la: 'bg-rose-100 text-rose-700',
  el: 'bg-sky-100 text-sky-700',
  il: 'bg-sky-100 text-sky-700',
};

const STATUS_STYLE = {
  correct: { chip: 'bg-emerald-100 text-emerald-700', bar: 'from-emerald-400 to-teal-400', icon: '✓' },
  partial: { chip: 'bg-amber-100 text-amber-700', bar: 'from-amber-300 to-orange-400', icon: '≈' },
  incorrect: { chip: 'bg-rose-100 text-rose-700', bar: 'from-rose-400 to-pink-500', icon: '✕' },
} as const;

function SectionLabel({ children }: { children: string }) {
  return <h4 className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">{children}</h4>;
}

/** Compact stacked vocab row — zero horizontal scrolling on 9:16 screens. */
export function VocabPill({ word, targetLanguage }: { word: VocabWord; targetLanguage: string }) {
  const { t } = useApp();
  const audio = useAudio();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const g = word.gender?.trim().toLowerCase();

  const save = async () => {
    if (saved || busy) return;
    setBusy(true);
    try {
      await api.saveVocab({ ...word, targetLanguage });
      setSaved(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="flex items-start gap-2 rounded-xl bg-slate-50 p-2.5 ring-1 ring-slate-100">
      <button
        onClick={() => audio.speakOnce([g, word.word].filter(Boolean).join(' '))}
        aria-label={t('sentence.listen')}
        className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-brand-600 ring-1 ring-slate-200 active:scale-90"
      >
        <SpeakerIcon width={15} height={15} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {g && (
            <span className={`rounded-md px-1.5 py-px text-[11px] font-bold ${GENDER_STYLE[g] ?? 'bg-slate-200 text-slate-600'}`}>
              {g}
            </span>
          )}
          <span className="font-display text-[15px] font-bold text-slate-900">{word.word}</span>
          {word.pos && <span className="text-[11px] italic text-slate-400">{word.pos}</span>}
        </div>
        {word.plural && word.plural !== '—' && <p className="text-[12px] text-slate-500">pl. {word.plural}</p>}
        {word.note && <p className="mt-0.5 text-[13px] leading-snug text-slate-600">{word.note}</p>}
      </div>
      <button
        onClick={save}
        aria-label={t('vocab.save')}
        disabled={busy}
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-90 ${
          saved ? 'bg-emerald-500 text-white' : 'bg-brand-600 text-white shadow shadow-brand-600/30'
        }`}
      >
        {saved ? <CheckIcon width={16} height={16} /> : <PlusIcon width={16} height={16} />}
      </button>
    </li>
  );
}

/** Stacked 4-part correction card: sentence correction · translation · vocab breakdown · grammar. */
export function FeedbackCard({
  evaluation,
  question,
  userAnswer,
  position,
  targetLanguage,
}: {
  evaluation: Evaluation;
  question: Question;
  userAnswer: string;
  position: number;
  targetLanguage: string;
}) {
  const { t } = useApp();
  const audio = useAudio();
  const { openDoubt } = useStory();
  const sc = evaluation.sentenceCorrection;
  const style = STATUS_STYLE[sc.status];
  const statusLabel = t(`feedback.${sc.status}`);

  return (
    <article
      id={`feedback-${question.id}`}
      className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm animate-rise"
    >
      <div className={`h-1 bg-gradient-to-r ${style.bar}`} />
      <div className="p-4">
        <header className="flex items-start gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 font-display text-[13px] font-bold text-white">
            {position}
          </span>
          <p className="flex-1 text-[15px] font-semibold leading-snug text-slate-900">{question.questionTarget}</p>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${style.chip}`}>
            {style.icon} {statusLabel}
          </span>
        </header>

        {/* 1 · Sentence correction */}
        <section className="mt-3.5">
          <SectionLabel>{t('feedback.yourAnswer')}</SectionLabel>
          <p className={`rounded-xl bg-slate-50 px-3 py-2 text-[15px] ${userAnswer ? 'text-slate-700' : 'italic text-slate-400'}`}>
            {userAnswer || t('feedback.empty')}
          </p>
          {sc.status !== 'correct' && sc.correctedUserSentence && (
            <>
              <SectionLabel>{t('feedback.corrected')}</SectionLabel>
              <p className="rounded-xl bg-emerald-50 px-3 py-2 text-[15px] font-medium text-emerald-800">{sc.correctedUserSentence}</p>
            </>
          )}
          {sc.feedbackNote && <p className="mt-2 text-[14px] leading-snug text-slate-600">💡 {sc.feedbackNote}</p>}
          <div className="mt-2 flex items-start gap-2 rounded-xl bg-brand-50 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand-600">{t('feedback.model')}</p>
              <p className="text-[15px] font-medium text-brand-700">{sc.modelAnswer}</p>
            </div>
            <button
              onClick={() => audio.speakOnce(sc.modelAnswer)}
              aria-label={t('sentence.listen')}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white active:scale-90"
            >
              <SpeakerIcon width={16} height={16} />
            </button>
          </div>
        </section>

        {/* 2 · Translation */}
        <section className="mt-4">
          <SectionLabel>{t('feedback.translation')}</SectionLabel>
          <p className="text-[14px] leading-snug text-slate-500">{evaluation.translation.question}</p>
          <p className="mt-1 text-[14px] font-medium leading-snug text-slate-700">{evaluation.translation.modelAnswer}</p>
        </section>

        {/* 3 · Word-by-word breakdown */}
        {evaluation.vocabBreakdown.length > 0 && (
          <section className="mt-4">
            <SectionLabel>{t('feedback.vocab')}</SectionLabel>
            <ul className="space-y-1.5">
              {evaluation.vocabBreakdown.map((w) => (
                <VocabPill key={w.word} word={w} targetLanguage={targetLanguage} />
              ))}
            </ul>
          </section>
        )}

        {/* 4 · Grammar */}
        {evaluation.grammarAnalysis && (
          <section className="mt-4 rounded-xl bg-amber-50 px-3 py-2.5 ring-1 ring-amber-100">
            <SectionLabel>{t('feedback.grammar')}</SectionLabel>
            <p className="text-[14px] leading-snug text-amber-900">{evaluation.grammarAnalysis}</p>
          </section>
        )}

        <button
          onClick={() => openDoubt(question.questionTarget)}
          className="mt-3 inline-flex min-h-[40px] items-center gap-1.5 text-[13px] font-semibold text-brand-600 active:opacity-60"
        >
          ❓ {t('feedback.askTutor')}
        </button>
      </div>
    </article>
  );
}
