import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { EvalResult, Story, StorySummary, ThemeId } from '../types';
import { useApp } from './AppContext';
import { useAudio } from './AudioContext';

type PrefetchState = 'idle' | 'loading' | 'ready' | 'error';
const LAST_STORY_KEY = 'hormal:lastStoryId';

interface StoryApi {
  library: StorySummary[];
  story: Story | null;
  result: EvalResult | null;
  answers: Record<number, string>;
  order: number[];
  booting: boolean;
  generating: boolean;
  evaluating: boolean;
  error: string | null;
  prefetched: Story | null;
  prefetchState: PrefetchState;
  generatorOpen: boolean;
  submitModalOpen: boolean;
  doubt: { open: boolean; context?: string };
  setGeneratorOpen: (v: boolean) => void;
  setSubmitModalOpen: (v: boolean) => void;
  openDoubt: (context?: string) => void;
  closeDoubt: () => void;
  setAnswer: (questionId: number, text: string) => void;
  shuffle: () => void;
  generate: (theme: ThemeId, additionalInstructions?: string) => Promise<boolean>;
  submit: (nextTheme?: ThemeId, nextInstructions?: string) => Promise<void>;
  startNext: () => void;
  retryPrefetch: () => void;
  openStory: (id: string) => Promise<void>;
}

const Ctx = createContext<StoryApi | null>(null);

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function StoryProvider({ children }: { children: ReactNode }) {
  const { profile, t } = useApp();
  const audio = useAudio();

  const [library, setLibrary] = useState<StorySummary[]>([]);
  const [story, setStory] = useState<Story | null>(null);
  const [result, setResult] = useState<EvalResult | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [order, setOrder] = useState<number[]>([]);
  const [booting, setBooting] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefetched, setPrefetched] = useState<Story | null>(null);
  const [prefetchState, setPrefetchState] = useState<PrefetchState>('idle');
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [doubt, setDoubt] = useState<{ open: boolean; context?: string }>({ open: false });

  // Active theme / keywords used for background pre-generation of the next story.
  const activeParams = useRef<{ theme: ThemeId; additionalInstructions?: string }>({ theme: 'fun_facts' });
  const prefetchRunId = useRef(0);
  const setQueueRef = useRef(audio.setQueue);
  setQueueRef.current = audio.setQueue;
  const prewarmRef = useRef(audio.prewarm);
  prewarmRef.current = audio.prewarm;

  const applyStory = useCallback((s: Story, r: EvalResult | null) => {
    setStory(s);
    setResult(r);
    setAnswers(Object.fromEntries((r?.answers ?? []).map((a) => [a.questionId, a.userAnswer])));
    setOrder(s.questions.slice().sort((a, b) => a.order - b.order).map((q) => q.id));
    setQueueRef.current(s.sentences.map((x) => x.target));
    localStorage.setItem(LAST_STORY_KEY, s.id);
    activeParams.current = {
      theme: (s.theme as ThemeId) ?? 'fun_facts',
      additionalInstructions: s.additionalInstructions ?? undefined,
    };
  }, []);

  const addToLibrary = useCallback((s: Story) => {
    setLibrary((cur) =>
      cur.some((x) => x.id === s.id)
        ? cur
        : [{ id: s.id, title: s.title, theme: s.theme, targetLanguage: s.targetLanguage, cefrLevel: s.cefrLevel, createdAt: s.createdAt, score: null }, ...cur],
    );
  }, []);

  // Boot: library + last opened story.
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await api.listStories();
        if (cancelled) return;
        setLibrary(list);
        const last = localStorage.getItem(LAST_STORY_KEY);
        const target = list.find((s) => s.id === last) ?? list[0];
        if (target) {
          const full = await api.getStory(target.id);
          if (!cancelled) applyStory(full.story, full.result);
        }
      } catch {
        if (!cancelled) setError(t('error.generic'));
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const excludeTitles = useCallback(
    (extra?: string) => [...new Set([...library.map((s) => s.title), ...(extra ? [extra] : [])])].slice(0, 40),
    [library],
  );

  const generate = useCallback(
    async (theme: ThemeId, additionalInstructions?: string) => {
      setGenerating(true);
      setError(null);
      try {
        const extra = additionalInstructions?.trim() || undefined;
        const s = await api.generateStory({ theme, additionalInstructions: extra, excludeRecentTitles: excludeTitles() });
        prefetchRunId.current++; // invalidate any in-flight prefetch for the old story
        setPrefetched(null);
        setPrefetchState('idle');
        applyStory(s, null);
        activeParams.current = { theme, additionalInstructions: extra };
        addToLibrary(s);
        document.getElementById('content-scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : t('error.generic'));
        return false;
      } finally {
        setGenerating(false);
      }
    },
    [addToLibrary, applyStory, excludeTitles, t],
  );

  /** AUTOMATIC BACKGROUND PRE-GENERATION: fires Agent 1 the moment corrections resolve. */
  const startPrefetch = useCallback(
    (currentTitle?: string) => {
      const run = ++prefetchRunId.current;
      setPrefetched(null);
      setPrefetchState('loading');
      const { theme, additionalInstructions } = activeParams.current;
      api
        .generateStory({ theme, additionalInstructions, excludeRecentTitles: excludeTitles(currentTitle) })
        .then((s) => {
          if (run !== prefetchRunId.current) return;
          setPrefetched(s);
          setPrefetchState('ready');
          addToLibrary(s);
          if (s.sentences[0]) prewarmRef.current(s.sentences[0].target); // pre-warm TTS cache for sentence 1
        })
        .catch(() => {
          if (run === prefetchRunId.current) setPrefetchState('error');
        });
    },
    [addToLibrary, excludeTitles],
  );

  const submit = useCallback(
    async (nextTheme?: ThemeId, nextInstructions?: string) => {
      if (!story || evaluating) return;
      if (nextTheme) {
        activeParams.current = {
          theme: nextTheme,
          additionalInstructions: nextInstructions?.trim() || undefined,
        };
      }
      setEvaluating(true);
      setError(null);
      try {
        const payload = story.questions.map((q) => ({ questionId: q.id, userAnswer: answers[q.id] ?? '' }));
        // As requested in docs/corrections/2.md:
        // Background generation of next story starts immediately with chosen theme!
        startPrefetch(story.title);
        const res = await api.evaluateAnswers(story.id, payload);
        setResult({ score: res.score, evaluations: res.evaluations, answers: res.answers });
        setLibrary((cur) => cur.map((s) => (s.id === story.id ? { ...s, score: res.score } : s)));
        requestAnimationFrame(() => document.getElementById('content-scroll')?.scrollTo({ top: 0, behavior: 'smooth' }));
      } catch (e) {
        setError(e instanceof Error ? e.message : t('error.generic'));
      } finally {
        setEvaluating(false);
      }
    },
    [answers, evaluating, startPrefetch, story, t],
  );

  const startNext = useCallback(() => {
    if (!prefetched) return;
    applyStory(prefetched, null); // 0 ms swap — story is already generated and saved
    setPrefetched(null);
    setPrefetchState('idle');
    document.getElementById('content-scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [applyStory, prefetched]);

  const openStory = useCallback(
    async (id: string) => {
      const full = await api.getStory(id);
      prefetchRunId.current++;
      setPrefetched(null);
      setPrefetchState('idle');
      applyStory(full.story, full.result);
    },
    [applyStory],
  );

  const value = useMemo<StoryApi>(
    () => ({
      library,
      story,
      result,
      answers,
      order,
      booting,
      generating,
      evaluating,
      error,
      prefetched,
      prefetchState,
      generatorOpen,
      submitModalOpen,
      doubt,
      setGeneratorOpen,
      setSubmitModalOpen,
      openDoubt: (context) => setDoubt({ open: true, context }),
      closeDoubt: () => setDoubt((d) => ({ ...d, open: false })),
      setAnswer: (id, text) => setAnswers((a) => ({ ...a, [id]: text })),
      shuffle: () => setOrder((o) => shuffled(o)),
      generate,
      submit,
      startNext,
      retryPrefetch: () => startPrefetch(story?.title),
      openStory,
    }),
    [library, story, result, answers, order, booting, generating, evaluating, error, prefetched, prefetchState, generatorOpen, submitModalOpen, doubt, generate, submit, startNext, startPrefetch, openStory],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStory(): StoryApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStory must be used inside StoryProvider');
  return v;
}
