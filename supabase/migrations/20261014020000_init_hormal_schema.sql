-- ============================================================================
-- Migration: 20261014020000_init_hormal_schema.sql
-- Description: HörMal Pure-Listening Tutor initial relational schema
-- ============================================================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Users table (Federated from AWS Cognito Google SSO)
CREATE TABLE IF NOT EXISTS public.users (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cognito_sub            VARCHAR(128) NOT NULL UNIQUE,
  email                  VARCHAR(320) NOT NULL UNIQUE,
  name                   VARCHAR(255),
  avatar_url             TEXT,
  ui_language            VARCHAR(16) NOT NULL DEFAULT 'en',
  target_language        VARCHAR(16) NOT NULL DEFAULT 'de-DE',
  cefr_level             VARCHAR(4)  NOT NULL DEFAULT 'A2',
  preferred_voice_engine VARCHAR(32) NOT NULL DEFAULT 'polly_generative',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Stories table
CREATE TABLE IF NOT EXISTS public.stories (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  theme                   VARCHAR(64) NOT NULL,
  additional_instructions TEXT,
  target_language         VARCHAR(16) NOT NULL,
  ui_language             VARCHAR(16) NOT NULL,
  cefr_level              VARCHAR(4)  NOT NULL,
  title                   VARCHAR(255) NOT NULL,
  created_by_user_id      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stories_user_created_idx ON public.stories (created_by_user_id, created_at DESC);

-- 4. Story Sentences (Sentence-by-sentence with UI translations)
CREATE TABLE IF NOT EXISTS public.story_sentences (
  id             SERIAL PRIMARY KEY,
  story_id       UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  sentence_index INT  NOT NULL,
  text_target    TEXT NOT NULL,
  text_ui        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS story_sentences_story_idx ON public.story_sentences (story_id, sentence_index);

-- 5. Story Questions (Shuffled non-chronological order)
CREATE TABLE IF NOT EXISTS public.story_questions (
  id                     SERIAL PRIMARY KEY,
  story_id               UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  default_shuffled_order INT  NOT NULL,
  question_target        TEXT NOT NULL,
  question_ui            TEXT NOT NULL,
  model_answer_target    TEXT NOT NULL,
  model_answer_ui        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS story_questions_story_idx ON public.story_questions (story_id, default_shuffled_order);

-- 6. Audio Cache (TTS synthesized .mp3 hashed by engine, voice, language, text)
CREATE TABLE IF NOT EXISTS public.audio_cache (
  hash            VARCHAR(64) PRIMARY KEY,
  engine          VARCHAR(32) NOT NULL,
  voice_id        VARCHAR(64) NOT NULL,
  target_language VARCHAR(16) NOT NULL,
  s3_key          TEXT NOT NULL,
  cloudfront_url  TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. User Progress (Story evaluation and scores)
CREATE TABLE IF NOT EXISTS public.user_progress (
  id               SERIAL PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  story_id         UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  score            INT  NOT NULL,
  ai_feedback_json JSONB NOT NULL,
  completed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, story_id)
);

-- 8. User Vocabulary (Saved vocabulary notebook)
CREATE TABLE IF NOT EXISTS public.user_vocabulary (
  id              SERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_language VARCHAR(16) NOT NULL,
  word            VARCHAR(255) NOT NULL,
  gender          VARCHAR(16),
  plural          VARCHAR(255),
  pos             VARCHAR(32),
  note            TEXT,
  saved_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, target_language, word)
);

-- 9. Row Level Security (RLS) Enablement
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_sentences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_vocabulary ENABLE ROW LEVEL SECURITY;

-- 10. Service Role / Backend Direct Access Policies
CREATE POLICY "Allow backend access to users" ON public.users FOR ALL USING (true);
CREATE POLICY "Allow backend access to stories" ON public.stories FOR ALL USING (true);
CREATE POLICY "Allow backend access to story_sentences" ON public.story_sentences FOR ALL USING (true);
CREATE POLICY "Allow backend access to story_questions" ON public.story_questions FOR ALL USING (true);
CREATE POLICY "Allow backend access to audio_cache" ON public.audio_cache FOR ALL USING (true);
CREATE POLICY "Allow backend access to user_progress" ON public.user_progress FOR ALL USING (true);
CREATE POLICY "Allow backend access to user_vocabulary" ON public.user_vocabulary FOR ALL USING (true);
