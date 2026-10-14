import { Type, type Schema } from '@google/genai';
import { z } from 'zod';
import { getDb, schema } from '../db/client';
import { languageName } from '../lib/constants';
import { generateStructured } from '../lib/gemini';
import { loadStoryRows } from '../services/storyService';
import type { UserRow } from '../services/userService';

export const evaluateInput = z.object({
  storyId: z.string().uuid(),
  answers: z
    .array(z.object({ questionId: z.number().int(), userAnswer: z.string().max(600) }))
    .min(1)
    .max(12),
});

const evaluationItem = z.object({
  questionId: z.number().int(),
  sentenceCorrection: z.object({
    status: z.enum(['correct', 'partial', 'incorrect']),
    correctedUserSentence: z.string(),
    feedbackNote: z.string(),
    modelAnswer: z.string(),
  }),
  translation: z.object({ question: z.string(), modelAnswer: z.string() }),
  vocabBreakdown: z
    .array(
      z.object({
        word: z.string(),
        gender: z.string().optional().default(''),
        plural: z.string().optional().default(''),
        pos: z.string().optional().default(''),
        note: z.string().optional().default(''),
      }),
    )
    .max(6),
  grammarAnalysis: z.string(),
});

const evaluationOutput = z.object({ evaluations: z.array(evaluationItem) });
export type Evaluation = z.infer<typeof evaluationItem>;

const str = { type: Type.STRING } as const;

const responseSchema: Schema = {
  type: Type.OBJECT,
  required: ['evaluations'],
  properties: {
    evaluations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ['questionId', 'sentenceCorrection', 'translation', 'vocabBreakdown', 'grammarAnalysis'],
        properties: {
          questionId: { type: Type.INTEGER },
          sentenceCorrection: {
            type: Type.OBJECT,
            required: ['status', 'correctedUserSentence', 'feedbackNote', 'modelAnswer'],
            properties: {
              status: { type: Type.STRING, enum: ['correct', 'partial', 'incorrect'] },
              correctedUserSentence: str,
              feedbackNote: str,
              modelAnswer: str,
            },
          },
          translation: {
            type: Type.OBJECT,
            required: ['question', 'modelAnswer'],
            properties: { question: str, modelAnswer: str },
          },
          vocabBreakdown: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              required: ['word', 'gender', 'plural', 'pos', 'note'],
              properties: { word: str, gender: str, plural: str, pos: str, note: str },
            },
          },
          grammarAnalysis: str,
        },
      },
    },
  },
};

/** AGENT 2 — Dynamic Answer Evaluator & Tutor (batch-evaluates all answers in ONE Gemini call). */
export async function runAnswerCorrectionAgent(user: UserRow, input: z.infer<typeof evaluateInput>) {
  const rows = await loadStoryRows(input.storyId, user.id);
  const target = languageName(rows.story.targetLanguage);
  const ui = languageName(user.uiLanguage);
  const level = rows.story.cefrLevel;

  const answerById = new Map(input.answers.map((a) => [a.questionId, a.userAnswer.trim()]));
  const items = rows.questions.map((q) => ({
    questionId: q.id,
    questionTarget: q.questionTarget,
    modelAnswerTarget: q.modelAnswerTarget,
    userAnswer: answerById.get(q.id) ?? '',
  }));

  const systemInstruction = [
    `You are a warm, precise ${target} tutor for a ${level} learner. The learner practised PURE LISTENING and typed answers to comprehension questions.`,
    `Evaluate ALL ${items.length} answers in one response, one evaluation object per questionId.`,
    `Judge COMPREHENSION first (is the content right?), then language accuracy. Be tolerant of tiny typos/missing accents; "partial" = right idea with notable language errors or incomplete; "incorrect" = wrong or empty.`,
    `Write ALL explanatory text (feedbackNote, translations, vocab notes, grammarAnalysis) in ${ui}. Keep it short and scannable on a phone.`,
    `Fields: sentenceCorrection.correctedUserSentence = the learner's answer corrected in ${target} (if empty, give the model answer); feedbackNote = 1-2 sentences in ${ui}; sentenceCorrection.modelAnswer = ideal answer in ${target}; translation.question / translation.modelAnswer = ${ui} translations; vocabBreakdown = 3-4 key words (as they appear in the model answer) with gender (e.g. der/die/das, le/la, el/la, il/la; empty string if not applicable), plural form (empty if not applicable), part of speech (pos) and a short note in ${ui}; grammarAnalysis = one bite-sized grammar rule at CEFR ${level} explained in ${ui}.`,
    `Use the exact questionId values provided. Return only JSON matching the schema.`,
  ].join('\n');

  const prompt = `Story (${target}):\n${rows.sentences.map((s) => `${s.sentenceIndex + 1}. ${s.textTarget}`).join('\n')}\n\nQuestions and learner answers:\n${JSON.stringify(items, null, 2)}`;

  const out = await generateStructured({
    systemInstruction,
    prompt,
    responseSchema,
    validator: evaluationOutput,
    temperature: 0.3,
  });

  // Keep order of the story's questions; guarantee one entry per question.
  const byId = new Map(out.evaluations.map((e) => [e.questionId, e]));
  const evaluations: Evaluation[] = items.map(
    (it) =>
      byId.get(it.questionId) ?? {
        questionId: it.questionId,
        sentenceCorrection: {
          status: 'incorrect',
          correctedUserSentence: it.modelAnswerTarget,
          feedbackNote: '',
          modelAnswer: it.modelAnswerTarget,
        },
        translation: { question: '', modelAnswer: '' },
        vocabBreakdown: [],
        grammarAnalysis: '',
      },
  );

  const points = evaluations.reduce(
    (sum, e) => sum + (e.sentenceCorrection.status === 'correct' ? 1 : e.sentenceCorrection.status === 'partial' ? 0.5 : 0),
    0,
  );
  const score = Math.round((points / Math.max(1, evaluations.length)) * 100);

  const answers = items.map((it) => ({ questionId: it.questionId, userAnswer: it.userAnswer }));
  const feedback = { evaluations, answers };

  await getDb()
    .insert(schema.userProgress)
    .values({ userId: user.id, storyId: input.storyId, score, aiFeedbackJson: feedback })
    .onConflictDoUpdate({
      target: [schema.userProgress.userId, schema.userProgress.storyId],
      set: { score, aiFeedbackJson: feedback, completedAt: new Date() },
    });

  return { storyId: input.storyId, score, ...feedback };
}
