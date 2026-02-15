-- Migration: Add round_number column to discussion_logs
-- This aligns with Origo Architecture schema requirements
-- round_number replaces turn_index for discussion sequencing

-- Add round_number column if it doesn't exist
ALTER TABLE public.discussion_logs 
ADD COLUMN IF NOT EXISTS round_number integer DEFAULT 0;

-- Add metadata column if it doesn't exist (for tracking provider, triggered_by, etc.)
ALTER TABLE public.discussion_logs 
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Create index for efficient querying by round_number
CREATE INDEX IF NOT EXISTS idx_discussion_logs_round_number
ON public.discussion_logs (project_id, round_number);

-- Migrate existing turn_index data to round_number if turn_index exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'discussion_logs' 
        AND column_name = 'turn_index'
    ) THEN
        -- Copy turn_index to round_number for existing records
        UPDATE public.discussion_logs 
        SET round_number = COALESCE(turn_index, 0)
        WHERE round_number = 0 OR round_number IS NULL;
        
        RAISE NOTICE 'Migrated turn_index data to round_number';
    END IF;
END $$;

-- Add comment
COMMENT ON COLUMN public.discussion_logs.round_number IS 'Sequential round number for discussion flow (replaces turn_index)';
COMMENT ON COLUMN public.discussion_logs.metadata IS 'JSONB metadata including provider, triggered_by, etc.';
