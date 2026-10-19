import { and, asc, desc, eq } from 'drizzle-orm';
import { getDb, schema } from '../db/client';
import { HttpError } from '../lib/http';

const { stories, storySentences, storyQuestions, userProgress } = schema;

export interface ClientStory {
  id: string;
  title: string;
  theme: string;
  additionalInstructions: string | null;
  targetLanguage: string;
  uiLanguage: string;
  cefrLevel: string;
  difficultyMode: string;
  createdAt: string;
  sentences: { index: number; target: string; ui: string }[];
  questions: { id: number; order: number; questionTarget: string; questionUi: string }[];
}

export interface FullStoryRows {
  story: typeof stories.$inferSelect;
  sentences: (typeof storySentences.$inferSelect)[];
  questions: (typeof storyQuestions.$inferSelect)[];
}

export async function loadStoryRows(storyId: string, userId: string): Promise<FullStoryRows> {
  const db = getDb();
  if (!/^[0-9a-f-]{36}$/i.test(storyId)) throw new HttpError(400, 'Invalid story id');
  const [story] = await db
    .select()
    .from(stories)
    .where(and(eq(stories.id, storyId), eq(stories.createdByUserId, userId)))
    .limit(1);
  if (!story) throw new HttpError(404, 'Story not found');
  const [sentences, questions] = await Promise.all([
    db.select().from(storySentences).where(eq(storySentences.storyId, storyId)).orderBy(asc(storySentences.sentenceIndex)),
    db.select().from(storyQuestions).where(eq(storyQuestions.storyId, storyId)).orderBy(asc(storyQuestions.defaultShuffledOrder)),
  ]);
  return { story, sentences, questions };
}

/** Model answers are intentionally NOT sent before the user submits their answers. */
export function toClientStory(rows: FullStoryRows): ClientStory {
  const { story, sentences, questions } = rows;
  return {
    id: story.id,
    title: story.title,
    theme: story.theme,
    additionalInstructions: story.additionalInstructions,
    targetLanguage: story.targetLanguage,
    uiLanguage: story.uiLanguage,
    cefrLevel: story.cefrLevel,
    difficultyMode: story.difficultyMode ?? 'normal',
    createdAt: story.createdAt.toISOString(),
    sentences: sentences.map((s) => ({ index: s.sentenceIndex, target: s.textTarget, ui: s.textUi })),
    questions: questions.map((q) => ({
      id: q.id,
      order: q.defaultShuffledOrder,
      questionTarget: q.questionTarget,
      questionUi: q.questionUi,
    })),
  };
}

export async function listStories(userId: string, limit = 60) {
  const db = getDb();
  const rows = await db
    .select({
      id: stories.id,
      title: stories.title,
      theme: stories.theme,
      targetLanguage: stories.targetLanguage,
      cefrLevel: stories.cefrLevel,
      difficultyMode: stories.difficultyMode,
      createdAt: stories.createdAt,
      score: userProgress.score,
    })
    .from(stories)
    .leftJoin(userProgress, and(eq(userProgress.storyId, stories.id), eq(userProgress.userId, userId)))
    .where(eq(stories.createdByUserId, userId))
    .orderBy(desc(stories.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), score: r.score ?? null }));
}

export async function loadProgress(storyId: string, userId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(userProgress)
    .where(and(eq(userProgress.storyId, storyId), eq(userProgress.userId, userId)))
    .limit(1);
  return row ?? null;
}
