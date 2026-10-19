import { getIdToken, IS_MOCK } from './auth';
import * as mock from './mockApi';
import type {
  ChatMessage,
  EvalResult,
  Profile,
  SavedWord,
  Story,
  StorySummary,
  SynthesizeResponse,
  ThemeId,
  VocabWord,
} from '../types';

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = await getIdToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? res.statusText);
  return data as T;
}

export interface GenerateStoryInput {
  theme: ThemeId;
  additionalInstructions?: string;
  excludeRecentTitles?: string[];
  difficultyMode?: 'normal' | 'hard';
}

export interface StoryWithResult {
  story: Story;
  result: EvalResult | null;
}

const real = {
  getMe: () => request<Profile>('GET', '/api/me'),
  patchPreferences: (
    p: Partial<Pick<Profile, 'uiLanguage' | 'targetLanguage' | 'cefrLevel' | 'preferredVoiceEngine' | 'difficultyMode'>>,
  ) => request<Profile>('PATCH', '/api/me/preferences', p),
  listStories: () => request<{ stories: StorySummary[] }>('GET', '/api/stories').then((r) => r.stories),
  getStory: (id: string) => request<StoryWithResult>('GET', `/api/stories/${id}`),
  generateStory: (input: GenerateStoryInput) =>
    request<{ story: Story }>('POST', '/api/agents/generate-story', input).then((r) => r.story),
  evaluateAnswers: (storyId: string, answers: { questionId: number; userAnswer: string }[]) =>
    request<EvalResult & { storyId: string }>('POST', '/api/agents/evaluate-answers', { storyId, answers }),
  askDoubt: (input: {
    storyId: string;
    userQuestion: string;
    selectedSentenceOrQuestionContext?: string;
    userAnswers?: { questionId: number; userAnswer: string }[];
    chatHistory: ChatMessage[];
  }) => request<{ reply: string }>('POST', '/api/agents/ask-doubt', input).then((r) => r.reply),
  synthesize: (input: { text: string; targetLanguage: string; engine: string; voiceId?: string }) =>
    request<SynthesizeResponse>('POST', '/api/tts/synthesize', input),
  listVocab: () => request<{ words: SavedWord[] }>('GET', '/api/vocab').then((r) => r.words),
  saveVocab: (w: VocabWord & { targetLanguage: string }) =>
    request<{ word: SavedWord }>('POST', '/api/vocab', w).then((r) => r.word),
  deleteVocab: (id: number) => request<{ ok: boolean }>('DELETE', `/api/vocab/${id}`),
};

export const api: typeof real = IS_MOCK ? (mock.mockApi as typeof real) : real;
