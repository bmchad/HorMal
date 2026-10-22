-- ============================================================================
-- Migration: 20261022100000_add_conversations.sql
-- Description: Conversational chatbot persistent history and audio messages
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_language VARCHAR(16) NOT NULL,
  cefr_level      VARCHAR(4)  NOT NULL,
  difficulty_mode VARCHAR(16) NOT NULL DEFAULT 'normal',
  title           VARCHAR(255) NOT NULL DEFAULT 'Conversation',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS conversations_user_lang_idx ON public.conversations (user_id, target_language, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.conversation_messages (
  id                   SERIAL PRIMARY KEY,
  conversation_id      UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role                 VARCHAR(16) NOT NULL,
  text_target          TEXT NOT NULL,
  text_ui              TEXT,
  audio_url            TEXT,
  suggested_vocab_json JSONB,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS conversation_messages_conv_idx ON public.conversation_messages (conversation_id, created_at ASC);
