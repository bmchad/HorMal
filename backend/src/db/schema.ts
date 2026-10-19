import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  serial,
  jsonb,
  unique,
  index,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  cognitoSub: varchar('cognito_sub', { length: 128 }).notNull().unique(),
  email: varchar('email', { length: 320 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  avatarUrl: text('avatar_url'),
  uiLanguage: varchar('ui_language', { length: 16 }).notNull().default('en'),
  targetLanguage: varchar('target_language', { length: 16 }).notNull().default('de-DE'),
  cefrLevel: varchar('cefr_level', { length: 4 }).notNull().default('A2'),
  preferredVoiceEngine: varchar('preferred_voice_engine', { length: 32 })
    .notNull()
    .default('google_cloud_tts'),
  difficultyMode: varchar('difficulty_mode', { length: 16 }).notNull().default('normal'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const stories = pgTable(
  'stories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    theme: varchar('theme', { length: 64 }).notNull(),
    additionalInstructions: text('additional_instructions'),
    targetLanguage: varchar('target_language', { length: 16 }).notNull(),
    uiLanguage: varchar('ui_language', { length: 16 }).notNull(),
    cefrLevel: varchar('cefr_level', { length: 4 }).notNull(),
    difficultyMode: varchar('difficulty_mode', { length: 16 }).notNull().default('normal'),
    title: varchar('title', { length: 255 }).notNull(),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('stories_user_created_idx').on(t.createdByUserId, t.createdAt)],
);

export const storySentences = pgTable(
  'story_sentences',
  {
    id: serial('id').primaryKey(),
    storyId: uuid('story_id')
      .notNull()
      .references(() => stories.id, { onDelete: 'cascade' }),
    sentenceIndex: integer('sentence_index').notNull(),
    textTarget: text('text_target').notNull(),
    textUi: text('text_ui').notNull(),
  },
  (t) => [index('story_sentences_story_idx').on(t.storyId, t.sentenceIndex)],
);

export const storyQuestions = pgTable(
  'story_questions',
  {
    id: serial('id').primaryKey(),
    storyId: uuid('story_id')
      .notNull()
      .references(() => stories.id, { onDelete: 'cascade' }),
    defaultShuffledOrder: integer('default_shuffled_order').notNull(),
    questionTarget: text('question_target').notNull(),
    questionUi: text('question_ui').notNull(),
    modelAnswerTarget: text('model_answer_target').notNull(),
    modelAnswerUi: text('model_answer_ui').notNull(),
  },
  (t) => [index('story_questions_story_idx').on(t.storyId, t.defaultShuffledOrder)],
);

export const audioCache = pgTable('audio_cache', {
  hash: varchar('hash', { length: 64 }).primaryKey(),
  engine: varchar('engine', { length: 32 }).notNull(),
  voiceId: varchar('voice_id', { length: 64 }).notNull(),
  targetLanguage: varchar('target_language', { length: 16 }).notNull(),
  s3Key: text('s3_key').notNull(),
  cloudfrontUrl: text('cloudfront_url').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userProgress = pgTable(
  'user_progress',
  {
    id: serial('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    storyId: uuid('story_id')
      .notNull()
      .references(() => stories.id, { onDelete: 'cascade' }),
    score: integer('score').notNull(),
    aiFeedbackJson: jsonb('ai_feedback_json').notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('user_progress_user_story_uq').on(t.userId, t.storyId)],
);

export const userVocabulary = pgTable(
  'user_vocabulary',
  {
    id: serial('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetLanguage: varchar('target_language', { length: 16 }).notNull(),
    word: varchar('word', { length: 255 }).notNull(),
    gender: varchar('gender', { length: 16 }),
    plural: varchar('plural', { length: 255 }),
    pos: varchar('pos', { length: 32 }),
    note: text('note'),
    savedAt: timestamp('saved_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('user_vocab_uq').on(t.userId, t.targetLanguage, t.word)],
);

export type User = typeof users.$inferSelect;
