-- Migration: Change discussion_state.status to is_active
-- This migration converts the status text column to a boolean is_active column
-- to match the actual database schema

-- Step 1: Add is_active column as boolean
ALTER TABLE public.discussion_state
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Step 2: Migrate existing data
-- Map 'active' -> true, all other statuses -> false
UPDATE public.discussion_state
SET is_active = CASE 
  WHEN status = 'active' THEN true
  ELSE false
END
WHERE status IS NOT NULL;

-- Step 3: Set default for new rows
ALTER TABLE public.discussion_state
ALTER COLUMN is_active SET DEFAULT true;

-- Step 4: Drop the old status column and constraint
ALTER TABLE public.discussion_state
DROP CONSTRAINT IF EXISTS discussion_state_status_check;

ALTER TABLE public.discussion_state
DROP COLUMN IF EXISTS status;

-- Step 5: Add index for is_active for better query performance
CREATE INDEX IF NOT EXISTS idx_discussion_state_is_active
ON public.discussion_state (is_active);

-- Step 6: Update the normalization migration's constraint if it exists
-- Remove the old status constraint that was added in the lowercase normalization
-- This is idempotent - won't fail if constraint doesn't exist
DO $$ 
BEGIN
  -- No additional constraints needed for boolean field
  RAISE NOTICE 'Migrated discussion_state.status to is_active boolean column';
END $$;
