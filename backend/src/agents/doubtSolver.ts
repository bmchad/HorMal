import { z } from 'zod';
import { languageName } from '../lib/constants';
import { generateChat } from '../lib/gemini';
import { loadProgress, loadStoryRows } from '../services/storyService';
import type { UserRow } from '../services/userService';

export const askDoubtInput = z.object({
  storyId: z.string().uuid(),
  userQuestion: z.string().trim().min(1).max(800),
  selectedSentenceOrQuestionContext: z.string().max(800).optional(),
  userAnswers: z.array(z.object({ questionId: z.number().int(), userAnswer: z.string().max(600) })).max(12).optional(),
  chatHistory: z
    .array(z.object({ role: z.enum(['user', 'model']), text: z.string().max(2000) }))
    .max(20)
    .optional(),
});

/** AGENT 3 — Contextual Doubt & Grammar Assistant. */
export async function runDoubtSolverAgent(user: UserRow, input: z.infer<typeof askDoubtInput>) {
  const rows = await loadStoryRows(input.storyId, user.id);
  const target = languageName(rows.story.targetLanguage);
  const ui = languageName(user.uiLanguage);

  let answers = input.userAnswers ?? [];
  if (!answers.length) {
    const progress = await loadProgress(input.storyId, user.id);
    const saved = (progress?.aiFeedbackJson as { answers?: { questionId: number; userAnswer: string }[] } | undefined)?.answers;
    answers = saved ?? [];
  }
  const answerById = new Map(answers.map((a) => [a.questionId, a.userAnswer]));

  const context = [
    `STORY "${rows.story.title}" (${target}, CEFR ${rows.story.cefrLevel}):`,
    ...rows.sentences.map((s) => `${s.sentenceIndex + 1}. ${s.textTarget}  [${ui}: ${s.textUi}]`),
    '',
    'QUESTIONS (with learner answers if any):',
    ...rows.questions.map(
      (q, i) =>
        `${i + 1}. ${q.questionTarget} [${ui}: ${q.questionUi}] | learner: "${answerById.get(q.id) ?? ''}"`,
    ),
    rows.story.additionalInstructions ? `\nLearner's focus keywords: ${rows.story.additionalInstructions}` : '',
    input.selectedSentenceOrQuestionContext ? `\nThe learner is asking about: "${input.selectedSentenceOrQuestionContext}"` : '',
  ].join('\n');

  const systemInstruction = [
    `You are a concise, friendly ${target} language tutor inside a mobile app. The learner's base language is ${ui} and their level is CEFR ${rows.story.cefrLevel}.`,
    `Reply in ${ui}, quoting ${target} examples. Keep answers SHORT and scannable on a 9:16 phone screen: max ~120 words, short paragraphs or 2-4 bullet points, no tables, minimal markdown (bold allowed).`,
    `Use the story context below; stay within the learner's level and give one example when helpful.`,
    '',
    context,
  ].join('\n');

  const reply = await generateChat({
    systemInstruction,
    history: (input.chatHistory ?? []).slice(-10),
    message: input.userQuestion,
  });
  return { reply: reply || '…' };
}
