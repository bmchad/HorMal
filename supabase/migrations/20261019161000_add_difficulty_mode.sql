-- ============================================================================
-- Migration: 20261019161000_add_difficulty_mode.sql
-- Description: Add difficulty_mode ('normal' | 'hard') to users and stories
-- ============================================================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS difficulty_mode VARCHAR(16) NOT NULL DEFAULT 'normal';
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS difficulty_mode VARCHAR(16) NOT NULL DEFAULT 'normal';
