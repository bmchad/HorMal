import { useMemo, useState } from 'react';
import { FeedbackCard } from '../components/FeedbackCard';
import { NextStoryBanner } from '../components/NextStoryBanner';
import { QuestionCard } from '../components/QuestionCard';
import { SentenceCard } from '../components/SentenceCard';
import { EyeIcon, EyeOffIcon, ShuffleIcon } from '../components/icons';
import { useApp } from '../context/AppContext';
import { useStory } from '../context/StoryContext';

function Skeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <div key={i} className="skeleton h-28 rounded-2xl" style={{ animationDelay: `${i * 120}ms` }} />
      ))}
    </div>
  );
}

function EmptyState() {
  const { t } = useApp();
  const { setGeneratorOpen } = useStory();
  return (
    <div className="flex h-full min-h-[60dvh] flex-col items-center justify-center px-6 text-center animate-rise">
      <div className="relative mb-6 flex h-28 w-28 items-center justify-center rounded-[2rem] bg-gradient-to-br from-brand-600 to-accent-500 text-5xl shadow-2xl shadow-brand-600/40">
        🎧
        <span className="absolute -right-2 -top-2 text-3xl animate-pulse">✨</span>
      </div>
      <h2 className="font-display text-2xl font-extrabold text-slate-900">{t('practice.empty.title')}</h2>
      <p className="mt-2 max-w-[18rem] text-[15px] leading-snug text-slate-500">{t('practice.empty.text')}</p>
      <button
        id="btn-empty-generate"
        onClick={() => setGeneratorOpen(true)}
        className="mt-6 min-h-[52px] rounded-2xl bg-gradient-to-r from-brand-600 to-accent-500 px-7 text-[16px] font-bold text-white shadow-xl shadow-brand-600/30 transition active:scale-95"
      >
        ✨ {t('practice.generate')}
      </button>
    </div>
  );
}

export function PracticeTab() {
  const { t } = useApp();
  const { story, result, answers, order, booting, evaluating, error, setSubmitModalOpen, shuffle } = useStory();
  const [revealed, setRevealed] = useState(false);

  const questionsById = useMemo(() => new Map(story?.questions.map((q) => [q.id, q]) ?? []), [story]);
  const answered = story ? story.questions.filter((q) => (answers[q.id] ?? '').trim()).length : 0;

  return (
    <div id="content-scroll" className="scroll-area flex-1 overflow-y-auto bg-gradient-to-b from-brand-50/60 to-slate-50">
      {booting ? (
        <div className="p-4">
          <Skeleton />
        </div>
      ) : !story ? (
        <EmptyState />
      ) : (
        <div className="space-y-3 p-4">
          {error && (
            <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-[14px] font-medium text-rose-700 ring-1 ring-rose-100">
              {error}
            </p>
          )}

          {result && <NextStoryBanner score={result.score} />}

          {result &&
            order.map((qid, i) => {
              const q = questionsById.get(qid);
              const ev = result.evaluations.find((e) => e.questionId === qid);
              if (!q || !ev) return null;
              return (
                <FeedbackCard
                  key={qid}
                  evaluation={ev}
                  question={q}
                  userAnswer={result.answers.find((a) => a.questionId === qid)?.userAnswer ?? answers[qid] ?? ''}
                  position={i + 1}
                  targetLanguage={story.targetLanguage}
                />
              );
            })}

          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="flex-1 text-[13px] leading-snug text-slate-500">{t('story.hint')}</p>
            <button
              id="btn-reveal-story"
              onClick={() => setRevealed((v) => !v)}
              aria-pressed={revealed}
              className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13px] font-semibold text-brand-700 shadow-sm ring-1 ring-brand-200 transition active:scale-95"
            >
              {revealed ? <EyeOffIcon width={16} height={16} /> : <EyeIcon width={16} height={16} />}
              {revealed ? t('story.hide') : t('story.reveal')}
            </button>
          </div>

          {story.sentences.map((s) => (
            <SentenceCard key={`${story.id}-${s.index}`} sentence={s} revealed={revealed} total={story.sentences.length} />
          ))}

          {!result && (
            <>
              <div className="flex items-center justify-between pt-3">
                <h2 className="font-display text-xl font-extrabold text-slate-900">{t('questions.title')}</h2>
                <button
                  id="btn-shuffle"
                  onClick={shuffle}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-white px-3.5 text-[13px] font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition active:scale-95"
                >
                  <ShuffleIcon width={16} height={16} /> 🔀 {t('questions.shuffle')}
                </button>
              </div>
              {order.map((qid, i) => {
                const q = questionsById.get(qid);
                return q ? <QuestionCard key={qid} question={q} position={i + 1} /> : null;
              })}
              <button
                id="btn-submit"
                onClick={() => setSubmitModalOpen(true)}
                disabled={evaluating}
                className="mt-1 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-600 to-accent-500 text-[16px] font-bold text-white shadow-xl shadow-brand-600/30 transition active:scale-[0.98] disabled:opacity-70"
              >
                {evaluating ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    {t('questions.submitting')}
                  </>
                ) : (
                  <>
                    📝 {t('questions.submit')}
                    <span className="rounded-full bg-white/20 px-2 py-px text-[12px] font-semibold">
                      {answered}/{story.questions.length}
                    </span>
                  </>
                )}
              </button>
            </>
          )}
          <div className="h-2" />
        </div>
      )}
    </div>
  );
}
