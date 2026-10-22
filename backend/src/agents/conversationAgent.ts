import { Type, type Schema } from '@google/genai';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '../db/client';
import { languageName, type DifficultyMode } from '../lib/constants';
import { generateStructured } from '../lib/gemini';
import { HttpError } from '../lib/http';
import { defaultVoiceId, synthesize } from '../services/ttsService';
import { loadConversationHistory, type ClientConversationMessage } from '../services/conversationService';
import type { UserRow } from '../services/userService';

const { conversations, conversationMessages } = schema;

export const sendMessageInput = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().trim().min(1).max(1000),
  audioToText: z.boolean().optional(),
});

const conversationOutput = z.object({
  reply: z.string().min(1).max(800),
  translation: z.string().min(1).max(800),
  suggestedVocab: z
    .array(
      z.object({
        word: z.string().min(1),
        gender: z.string().optional().default(''),
        plural: z.string().optional().default(''),
        pos: z.string().optional().default('word'),
        note: z.string().optional().default(''),
      }),
    )
    .max(3),
  conversationTitle: z.string().max(100).optional(),
});

const str = { type: Type.STRING } as const;

const responseSchema: Schema = {
  type: Type.OBJECT,
  required: ['reply', 'translation', 'suggestedVocab'],
  properties: {
    reply: str,
    translation: str,
    suggestedVocab: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        required: ['word'],
        properties: {
          word: str,
          gender: str,
          plural: str,
          pos: str,
          note: str,
        },
      },
    },
    conversationTitle: str,
  },
};

/** AGENT 4 — Conversational Chatbot & Voice Tutor */
export async function runConversationAgent(
  user: UserRow,
  input: z.infer<typeof sendMessageInput>,
): Promise<{ userMessage: ClientConversationMessage; modelMessage: ClientConversationMessage; conversationTitle?: string }> {
  const db = getDb();
  let convId = input.conversationId;

  // Resolve conversation or get active one
  let activeConv;
  if (convId) {
    const [found] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, convId), eq(conversations.userId, user.id)))
      .limit(1);
    if (!found) throw new HttpError(404, 'Conversation not found');
    activeConv = found;
  } else {
    const [latest] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.userId, user.id), eq(conversations.targetLanguage, user.targetLanguage)))
      .orderBy(eq(conversations.updatedAt, new Date())) // recent
      .limit(1);
    activeConv = latest;
  }

  if (!activeConv) {
    throw new HttpError(400, 'No active conversation found. Please initialize a conversation first.');
  }

  convId = activeConv.id;
  const target = languageName(activeConv.targetLanguage);
  const ui = languageName(user.uiLanguage);
  const level = activeConv.cefrLevel;
  const difficultyMode = (activeConv.difficultyMode as DifficultyMode) ?? 'normal';

  // Load history from DB (up to 30 messages) to preserve full multi-turn conversational context
  const history = await loadConversationHistory(convId, 30);

  const formattedHistory = history.map((m) => {
    return `${m.role === 'user' ? 'Learner' : 'Tutor'}: ${m.textTarget}`;
  }).join('\n');

  const difficultyInstruction =
    difficultyMode === 'normal'
      ? [
          `DIFFICULTY: NORMAL (DIDACTIC & ACCESSIBLE):`,
          `- Keep sentence structures simple, clear, and direct (Subject - Verb - Object).`,
          `- Keep vocabulary high-frequency and accessible.`,
          `- Avoid dense subordinate clauses, nested clauses, and passive voice.`,
          user.targetLanguage === 'de-DE'
            ? `- German A2 safeguard: Strictly speak at true A2 level. Do NOT use passive voice (wird/wurde) or relative clauses (der/die/das/welche). Use active voice and simple Perfekt/Präteritum (war, hatte).`
            : user.targetLanguage === 'ja-JP'
            ? `- Japanese calibration: Speak using polite form (です / ます). Keep sentences short and conversational. In suggestedVocab, include furigana/reading in parentheses (e.g., 食べる (たべる)).`
            : user.targetLanguage === 'zh-CN'
            ? `- Mandarin Chinese calibration: Speak natural conversational Putonghua. In suggestedVocab, include pinyin in parentheses (e.g., 朋友 (péngyou)).`
            : '',
        ]
          .filter(Boolean)
          .join('\n')
      : [
          `DIFFICULTY: HARD (CHALLENGING & RICH):`,
          `- Use richer vocabulary, varied connectors, and more expressive structures suited to upper CEFR ${level}.`,
        ].join('\n');

  const systemInstruction = [
    `You are a warm, supportive, native conversational language partner speaking in ${target} with a learner.`,
    `The learner's base/UI language is ${ui}. Their current proficiency is CEFR ${level}.`,
    difficultyInstruction,
    `IMPORTANT SPOKEN AUDIO RULE: Your reply will be synthesized into spoken speech and heard through headphones.`,
    `- Keep your answer natural, spoken, and concise (1 to 3 short sentences, max ~30-50 words total).`,
    `- Do NOT write long essays, bullet points, asterisks, emojis, or parentheses in the "reply" field.`,
    `- Ask a natural, friendly follow-up question at the end to keep the spoken conversation going!`,
    `DEEP CONTEXT PERSISTENCE RULE:`,
    `- Pay close attention to the entire dialogue history below.`,
    `- Acknowledge and remember whatever the learner previously mentioned (names, hobbies, past topics, opinions).`,
    `- If the conversation is already in progress, DO NOT restart or greet with "Hello! How are you?" again. Continue the flow naturally.`,
    `VOCABULARY ANCHORING:`,
    `- In the "suggestedVocab" array, extract 1 to 3 useful words or expressions from your reply so the learner can save them to their vocabulary notebook. Include gender and plural for nouns, and a short note/translation in ${ui}.`,
    `If this conversation is beginning or the topic shifted, you may suggest a short 2-4 word "conversationTitle" in ${target}.`,
  ].join('\n\n');

  const prompt = [
    '=== CONVERSATION HISTORY ===',
    formattedHistory || '(conversation just started)',
    '=== NEW LEARNER INPUT ===',
    `Learner: ${input.message}`,
    '\nRespond now as the Tutor in JSON.',
  ].join('\n');

  const result = await generateStructured({
    systemInstruction,
    prompt,
    responseSchema,
    validator: conversationOutput,
    temperature: difficultyMode === 'normal' ? 0.7 : 0.85,
  });

  // Synthesize audio for the tutor's reply
  let audioUrl: string | null = null;
  try {
    const synth = await synthesize({
      text: result.reply,
      targetLanguage: activeConv.targetLanguage as any,
      engine: user.preferredVoiceEngine as any,
      voiceId: defaultVoiceId(user.preferredVoiceEngine as any, activeConv.targetLanguage),
    });
    audioUrl = synth.url;
  } catch (err) {
    console.warn('Failed to synthesize conversation reply audio:', err);
  }

  // Save user message to database
  const [userMsgRow] = await db
    .insert(conversationMessages)
    .values({
      conversationId: convId,
      role: 'user',
      textTarget: input.message,
      textUi: null,
      audioUrl: null,
      suggestedVocabJson: null,
    })
    .returning();

  // Save model message to database
  const [modelMsgRow] = await db
    .insert(conversationMessages)
    .values({
      conversationId: convId,
      role: 'model',
      textTarget: result.reply,
      textUi: result.translation,
      audioUrl,
      suggestedVocabJson: result.suggestedVocab,
    })
    .returning();

  // Update conversation timestamp and title if provided
  await db
    .update(conversations)
    .set({
      updatedAt: new Date(),
      ...(result.conversationTitle ? { title: result.conversationTitle } : {}),
    })
    .where(eq(conversations.id, convId));

  return {
    userMessage: {
      id: userMsgRow.id,
      conversationId: userMsgRow.conversationId,
      role: 'user',
      textTarget: userMsgRow.textTarget,
      textUi: null,
      audioUrl: null,
      suggestedVocab: [],
      createdAt: userMsgRow.createdAt.toISOString(),
    },
    modelMessage: {
      id: modelMsgRow.id,
      conversationId: modelMsgRow.conversationId,
      role: 'model',
      textTarget: modelMsgRow.textTarget,
      textUi: modelMsgRow.textUi,
      audioUrl: modelMsgRow.audioUrl,
      suggestedVocab: result.suggestedVocab,
      createdAt: modelMsgRow.createdAt.toISOString(),
    },
    conversationTitle: result.conversationTitle,
  };
}
