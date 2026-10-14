import { Type, type Schema } from '@google/genai';
import { z } from 'zod';
import { getDb, schema } from '../db/client';
import { THEMES, THEME_DESCRIPTIONS, languageName } from '../lib/constants';
import { generateStructured } from '../lib/gemini';
import type { UserRow } from '../services/userService';
import { loadStoryRows, toClientStory, type ClientStory } from '../services/storyService';

export const generateStoryInput = z.object({
  theme: z.enum(THEMES),
  additionalInstructions: z.string().trim().max(300).optional(),
  excludeRecentTitles: z.array(z.string().max(255)).max(100).optional(),
});

const storyOutput = z.object({
  title: z.string().min(1).max(255),
  sentences: z.array(z.object({ target: z.string().min(1), ui: z.string().min(1) })).min(5).max(10),
  questions: z
    .array(
      z.object({
        sentenceRef: z.number().int().optional(),
        questionTarget: z.string().min(1),
        questionUi: z.string().min(1),
        modelAnswerTarget: z.string().min(1),
        modelAnswerUi: z.string().min(1),
      }),
    )
    .length(6),
});

const str = { type: Type.STRING } as const;

const responseSchema: Schema = {
  type: Type.OBJECT,
  required: ['title', 'sentences', 'questions'],
  properties: {
    title: str,
    sentences: {
      type: Type.ARRAY,
      items: { type: Type.OBJECT, required: ['target', 'ui'], properties: { target: str, ui: str } },
    },
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ['sentenceRef', 'questionTarget', 'questionUi', 'modelAnswerTarget', 'modelAnswerUi'],
        properties: {
          sentenceRef: { type: Type.INTEGER },
          questionTarget: str,
          questionUi: str,
          modelAnswerTarget: str,
          modelAnswerUi: str,
        },
      },
    },
  },
};

const LEVEL_GUIDE: Record<string, string> = {
  A1: 'very short present-tense sentences (5-9 words), the 500 most common words, no subordinate clauses',
  A2: 'short sentences, everyday vocabulary, simple past/perfect tenses, basic connectors (and, but, because)',
  B1: 'connected sentences, past/future tenses, common subordinate clauses, some idiomatic expressions',
  B2: 'richer sentences with complex clauses, abstract vocabulary, passive voice and conditionals where natural',
};

/** Guards the SHUFFLE RULE: questions must never come out in the same order as the story sentences. */
function ensureNonChronological<T extends { sentenceRef?: number }>(qs: T[]): T[] {
  const isAscending = (arr: T[]) =>
    arr.every((q, i) => i === 0 || (q.sentenceRef ?? 0) >= (arr[i - 1].sentenceRef ?? 0));
  let out = [...qs];
  for (let attempt = 0; attempt < 8 && isAscending(out); attempt++) {
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
  }
  return out;
}

/** AGENT 1 — Story & Question Architect. */
export async function runStoryGeneratorAgent(
  user: UserRow,
  input: z.infer<typeof generateStoryInput>,
): Promise<ClientStory> {
  const target = languageName(user.targetLanguage);
  const ui = languageName(user.uiLanguage);
  const level = user.cefrLevel;
  const exclude = (input.excludeRecentTitles ?? []).slice(0, 40);

  const systemInstruction = [
    `You are an expert CEFR curriculum designer for ${target}, creating PURE-LISTENING practice material.`,
    `Write the story in ${target} strictly at CEFR ${level}: ${LEVEL_GUIDE[level] ?? LEVEL_GUIDE.A2}.`,
    `Produce a captivating, factual-feeling story of 6 to 8 sentences. Each sentence must be self-contained and easy to understand when HEARD aloud (no parentheses, no digits-heavy lists, no emojis).`,
    `Provide an accurate sentence-by-sentence translation into ${ui} (field "ui").`,
    `Create EXACTLY 6 comprehension questions written in ${target}, each answerable from the story, with: the question translated to ${ui}, a short ideal model answer in ${target} (full sentence), and its ${ui} translation. "sentenceRef" is the 1-based index of the story sentence the question relies on.`,
    `SHUFFLE RULE: order the 6 questions NON-CHRONOLOGICALLY — the sentenceRef sequence must NOT be ascending, so the learner cannot answer in story order.`,
    `The story topic MUST be completely different from these already seen titles: ${exclude.length ? exclude.map((t) => `"${t}"`).join(', ') : '(none)'}.`,
    input.additionalInstructions
      ? `The learner asked to include/focus on: "${input.additionalInstructions}". Weave those concepts or keywords seamlessly into the narrative, explaining them with simple everyday words so the text stays strictly at CEFR ${level}.`
      : '',
    `The title must be short (max 7 words) and written in ${target}.`,
    `Return only JSON that matches the provided schema.`,
  ]
    .filter(Boolean)
    .join('\n');

  const result = await generateStructured({
    systemInstruction,
    prompt: `Theme: ${THEME_DESCRIPTIONS[input.theme]}. Create a brand-new story and its 6 shuffled questions now. Variation seed: ${Math.random().toString(36).slice(2, 8)}.`,
    responseSchema,
    validator: storyOutput,
    temperature: 0.95,
  });

  const questions = ensureNonChronological(result.questions);
  const db = getDb();

  const storyId = await db.transaction(async (tx) => {
    const [story] = await tx
      .insert(schema.stories)
      .values({
        theme: input.theme,
        additionalInstructions: input.additionalInstructions || null,
        targetLanguage: user.targetLanguage,
        uiLanguage: user.uiLanguage,
        cefrLevel: user.cefrLevel,
        title: result.title.slice(0, 255),
        createdByUserId: user.id,
      })
      .returning({ id: schema.stories.id });

    await tx.insert(schema.storySentences).values(
      result.sentences.map((s, i) => ({ storyId: story.id, sentenceIndex: i, textTarget: s.target, textUi: s.ui })),
    );
    await tx.insert(schema.storyQuestions).values(
      questions.map((q, i) => ({
        storyId: story.id,
        defaultShuffledOrder: i,
        questionTarget: q.questionTarget,
        questionUi: q.questionUi,
        modelAnswerTarget: q.modelAnswerTarget,
        modelAnswerUi: q.modelAnswerUi,
      })),
    );
    return story.id;
  });

  return toClientStory(await loadStoryRows(storyId, user.id));
}
