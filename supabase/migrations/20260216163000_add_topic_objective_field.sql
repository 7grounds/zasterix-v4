-- Migration: Add topic_objective field to projects table
-- This field stores the discussion topic/objective dynamically

-- Add topic_objective column if it doesn't exist
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS topic_objective text;

-- Backfill existing projects with their name as topic_objective
UPDATE public.projects
SET topic_objective = name
WHERE topic_objective IS NULL;

-- Add comment explaining the field
COMMENT ON COLUMN public.projects.topic_objective IS 'Discussion topic or objective for the project. Used dynamically by Manager agents.';
