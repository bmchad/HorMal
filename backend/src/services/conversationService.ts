import { and, asc, desc, eq } from 'drizzle-orm';
import { getDb, schema } from '../db/client';
import type { DifficultyMode } from '../lib/constants';
import { HttpError } from '../lib/http';
import { synthesize, defaultVoiceId } from './ttsService';
import type { UserRow } from './userService';

const { conversations, conversationMessages } = schema;

export interface ClientConversationMessage {
  id: number;
  conversationId: string;
  role: 'user' | 'model';
  textTarget: string;
  textUi: string | null;
  audioUrl: string | null;
  suggestedVocab: {
    word: string;
    gender: string;
    plural: string;
    pos: string;
    note: string;
  }[];
  createdAt: string;
}

export interface ClientConversation {
  id: string;
  targetLanguage: string;
  cefrLevel: string;
  difficultyMode: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ClientConversationMessage[];
}

const GREETINGS: Record<string, { target: string; ui: Record<string, string>; vocab: any[] }> = {
  'de-DE': {
    target: 'Hallo! Schön, dass du da bist. Worüber möchtest du heute sprechen?',
    ui: {
      en: 'Hello! Great that you are here. What would you like to talk about today?',
      'pt-BR': 'Olá! Que bom que você está aqui. Sobre o que você gostaria de conversar hoje?',
      es: '¡Hola! Qué bien que estés aquí. ¿De qué te gustaría hablar hoy?',
      fr: 'Bonjour ! Ravi de vous voir. De quoi aimeriez-vous parler aujourd’hui ?',
      it: 'Ciao! Bello averti qui. Di cosa vorresti parlare oggi?',
      de: 'Hallo! Schön, dass du da bist. Worüber möchtest du heute sprechen?',
    },
    vocab: [
      { word: 'sprechen', gender: '', plural: '', pos: 'verb', note: 'to speak / falar' },
      { word: 'heute', gender: '', plural: '', pos: 'adverb', note: 'today / hoje' },
    ],
  },
  'fr-FR': {
    target: 'Bonjour ! Ravi de te voir. De quoi aimerais-tu parler aujourd’hui ?',
    ui: {
      en: 'Hello! Glad to see you. What would you like to talk about today?',
      'pt-BR': 'Olá! Que bom te ver. Sobre o que você gostaria de conversar hoje?',
    },
    vocab: [{ word: 'parler', gender: '', plural: '', pos: 'verb', note: 'to speak / parler' }],
  },
  'es-ES': {
    target: '¡Hola! Qué bueno tenerte aquí. ¿De qué te gustaría hablar hoy?',
    ui: {
      en: 'Hello! Great to have you here. What would you like to talk about today?',
      'pt-BR': 'Olá! Que bom ter você aqui. Sobre o que você gostaria de falar hoje?',
    },
    vocab: [{ word: 'hablar', gender: '', plural: '', pos: 'verb', note: 'to speak / hablar' }],
  },
  'it-IT': {
    target: 'Ciao! Che bello vederti. Di cosa vorresti parlare oggi?',
    ui: {
      en: 'Hello! Nice to see you. What would you like to talk about today?',
      'pt-BR': 'Olá! Que bom ver você. Sobre o que você gostaria de falar hoje?',
    },
    vocab: [{ word: 'parlare', gender: '', plural: '', pos: 'verb', note: 'to speak / parlare' }],
  },
  'en-US': {
    target: 'Hello! Great to have you here. What would you like to talk about today?',
    ui: {
      'pt-BR': 'Olá! Que bom ter você aqui. Sobre o que você gostaria de falar hoje?',
      es: '¡Hola! Qué bueno tenerte aquí. ¿De qué te gustaría hablar hoy?',
    },
    vocab: [{ word: 'speak', gender: '', plural: '', pos: 'verb', note: 'to talk / falar' }],
  },
  'pt-BR': {
    target: 'Olá! Que bom ter você aqui. Sobre o que você gostaria de conversar hoje?',
    ui: {
      en: 'Hello! Great to have you here. What would you like to talk about today?',
    },
    vocab: [{ word: 'conversar', gender: '', plural: '', pos: 'verb', note: 'to converse / falar' }],
  },
  'ja-JP': {
    target: 'こんにちは！お会いできて嬉しいです。今日は何について話しましょうか？',
    ui: {
      en: 'Hello! Nice to meet you. What would you like to talk about today?',
      'pt-BR': 'Olá! Que bom ter você aqui. Sobre o que você gostaria de conversar hoje?',
      es: '¡Hola! Qué bien tenerte aquí. ¿De qué te gustaría hablar hoy?',
      de: 'Hallo! Schön, dass du da bist. Worüber möchtest du heute sprechen?',
      fr: 'Bonjour ! Ravi de vous voir. De quoi aimeriez-vous parler aujourd’hui ?',
      it: 'Ciao! Bello averti qui. Di cosa vorresti parlare oggi?',
    },
    vocab: [
      { word: '話す (はなす)', gender: '', plural: '', pos: 'verb', note: 'to speak / conversar' },
      { word: '今日 (きょう)', gender: '', plural: '', pos: 'noun', note: 'today / hoje' },
    ],
  },
  'zh-CN': {
    target: '你好！很高兴见到你。今天你想聊些什么呢？',
    ui: {
      en: 'Hello! Nice to meet you. What would you like to talk about today?',
      'pt-BR': 'Olá! Que bom ter você aqui. Sobre o que você gostaria de conversar hoje?',
      es: '¡Hola! Qué bien tenerte aquí. ¿De qué te gustaría hablar hoy?',
      de: 'Hallo! Schön, dass du da bist. Worüber möchtest du heute sprechen?',
      fr: 'Bonjour ! Ravi de vous voir. De quoi aimeriez-vous parler aujourd’hui ?',
      it: 'Ciao! Bello averti qui. Di cosa vorresti parlare oggi?',
    },
    vocab: [
      { word: '聊天 (liáotiān)', gender: '', plural: '', pos: 'verb', note: 'to chat / conversar' },
      { word: '今天 (jīntiān)', gender: '', plural: '', pos: 'noun', note: 'today / hoje' },
    ],
  },
};

export async function getOrCreateActiveConversation(user: UserRow): Promise<ClientConversation> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.userId, user.id), eq(conversations.targetLanguage, user.targetLanguage)))
    .orderBy(desc(conversations.updatedAt))
    .limit(1);

  if (existing) {
    const msgs = await db
      .select()
      .from(conversationMessages)
      .where(eq(conversationMessages.conversationId, existing.id))
      .orderBy(asc(conversationMessages.createdAt));

    return {
      id: existing.id,
      targetLanguage: existing.targetLanguage,
      cefrLevel: existing.cefrLevel,
      difficultyMode: existing.difficultyMode,
      title: existing.title,
      createdAt: existing.createdAt.toISOString(),
      updatedAt: existing.updatedAt.toISOString(),
      messages: msgs.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        role: m.role as 'user' | 'model',
        textTarget: m.textTarget,
        textUi: m.textUi,
        audioUrl: m.audioUrl,
        suggestedVocab: (m.suggestedVocabJson as any) ?? [],
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }

  // Create new conversation with an initial welcome message
  return createNewConversation(user);
}

export async function createNewConversation(user: UserRow, customTitle?: string): Promise<ClientConversation> {
  const db = getDb();
  const difficulty = (user.difficultyMode as DifficultyMode) ?? 'normal';
  const targetLang = user.targetLanguage;
  const uiLang = user.uiLanguage;

  const [createdConv] = await db
    .insert(conversations)
    .values({
      userId: user.id,
      targetLanguage: targetLang,
      cefrLevel: user.cefrLevel,
      difficultyMode: difficulty,
      title: customTitle || 'Daily Conversation',
    })
    .returning();

  // Create opening greeting message
  const greetingConfig = GREETINGS[targetLang] ?? GREETINGS['de-DE'];
  const textTarget = greetingConfig.target;
  const textUi = greetingConfig.ui[uiLang] ?? greetingConfig.ui['en'] ?? greetingConfig.ui['pt-BR'] ?? textTarget;

  // Synthesize audio
  let audioUrl: string | null = null;
  try {
    const synth = await synthesize({
      text: textTarget,
      targetLanguage: targetLang as any,
      engine: user.preferredVoiceEngine as any,
      voiceId: defaultVoiceId(user.preferredVoiceEngine as any, targetLang),
    });
    audioUrl = synth.url;
  } catch (err) {
    console.warn('Failed to synthesize initial greeting audio:', err);
  }

  const [createdMsg] = await db
    .insert(conversationMessages)
    .values({
      conversationId: createdConv.id,
      role: 'model',
      textTarget,
      textUi,
      audioUrl,
      suggestedVocabJson: greetingConfig.vocab,
    })
    .returning();

  return {
    id: createdConv.id,
    targetLanguage: createdConv.targetLanguage,
    cefrLevel: createdConv.cefrLevel,
    difficultyMode: createdConv.difficultyMode,
    title: createdConv.title,
    createdAt: createdConv.createdAt.toISOString(),
    updatedAt: createdConv.updatedAt.toISOString(),
    messages: [
      {
        id: createdMsg.id,
        conversationId: createdMsg.conversationId,
        role: 'model',
        textTarget: createdMsg.textTarget,
        textUi: createdMsg.textUi,
        audioUrl: createdMsg.audioUrl,
        suggestedVocab: greetingConfig.vocab,
        createdAt: createdMsg.createdAt.toISOString(),
      },
    ],
  };
}

export async function loadConversationHistory(conversationId: string, limit = 30) {
  const db = getDb();
  return db
    .select()
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversationId))
    .orderBy(desc(conversationMessages.createdAt))
    .limit(limit)
    .then((r) => r.reverse());
}
