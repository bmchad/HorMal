-- HörMal PostgreSQL schema (Neon / Supabase / RDS). Run once: psql "$DATABASE_URL" -f schema.sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cognito_sub            VARCHAR(128) NOT NULL UNIQUE,
  email                  VARCHAR(320) NOT NULL UNIQUE,
  name                   VARCHAR(255),
  avatar_url             TEXT,
  ui_language            VARCHAR(16) NOT NULL DEFAULT 'en',
  target_language        VARCHAR(16) NOT NULL DEFAULT 'de-DE',
  cefr_level             VARCHAR(4)  NOT NULL DEFAULT 'A2',
  preferred_voice_engine VARCHAR(32) NOT NULL DEFAULT 'google_cloud_tts',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stories (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  theme                   VARCHAR(64) NOT NULL,
  additional_instructions TEXT,
  target_language         VARCHAR(16) NOT NULL,
  ui_language             VARCHAR(16) NOT NULL,
  cefr_level              VARCHAR(4)  NOT NULL,
  title                   VARCHAR(255) NOT NULL,
  created_by_user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stories_user_created_idx ON stories (created_by_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS story_sentences (
  id             SERIAL PRIMARY KEY,
  story_id       UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  sentence_index INT  NOT NULL,
  text_target    TEXT NOT NULL,
  text_ui        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS story_sentences_story_idx ON story_sentences (story_id, sentence_index);

CREATE TABLE IF NOT EXISTS story_questions (
  id                     SERIAL PRIMARY KEY,
  story_id               UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  default_shuffled_order INT  NOT NULL,
  question_target        TEXT NOT NULL,
  question_ui            TEXT NOT NULL,
  model_answer_target    TEXT NOT NULL,
  model_answer_ui        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS story_questions_story_idx ON story_questions (story_id, default_shuffled_order);

CREATE TABLE IF NOT EXISTS audio_cache (
  hash            VARCHAR(64) PRIMARY KEY,
  engine          VARCHAR(32) NOT NULL,
  voice_id        VARCHAR(64) NOT NULL,
  target_language VARCHAR(16) NOT NULL,
  s3_key          TEXT NOT NULL,
  cloudfront_url  TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_progress (
  id               SERIAL PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  story_id         UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  score            INT  NOT NULL,
  ai_feedback_json JSONB NOT NULL,
  completed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, story_id)
);

CREATE TABLE IF NOT EXISTS user_vocabulary (
  id              SERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_language VARCHAR(16) NOT NULL,
  word            VARCHAR(255) NOT NULL,
  gender          VARCHAR(16),
  plural          VARCHAR(255),
  pos             VARCHAR(32),
  note            TEXT,
  saved_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, target_language, word)
);
