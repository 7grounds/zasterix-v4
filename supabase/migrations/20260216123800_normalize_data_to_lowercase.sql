-- Database Data Normalization to Lowercase
-- This migration normalizes all data values to lowercase for case-insensitive operations
-- Schema is already lowercase, this only affects data content

-- ============================================================================
-- PART 1: Normalize agent_templates data
-- ============================================================================

-- Step 1: Normalize discipline column to lowercase
UPDATE public.agent_templates
SET discipline = LOWER(discipline)
WHERE discipline IS NOT NULL AND discipline != LOWER(discipline);

-- Step 2: Normalize category column to lowercase
UPDATE public.agent_templates
SET category = LOWER(category)
WHERE category IS NOT NULL AND category != LOWER(category);

-- Step 3: Normalize engine_type column to lowercase
UPDATE public.agent_templates
SET engine_type = LOWER(engine_type)
WHERE engine_type IS NOT NULL AND engine_type != LOWER(engine_type);

-- Step 4: Normalize provider column to lowercase
UPDATE public.agent_templates
SET provider = LOWER(provider)
WHERE provider IS NOT NULL AND provider != LOWER(provider);

-- Step 5: Normalize trigger_keywords array elements to lowercase
UPDATE public.agent_templates
SET trigger_keywords = (
  SELECT array_agg(LOWER(elem))
  FROM unnest(trigger_keywords) AS elem
)
WHERE trigger_keywords IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM unnest(trigger_keywords) AS elem
    WHERE elem != LOWER(elem)
  );

-- Step 6: Normalize search_keywords array elements to lowercase
UPDATE public.agent_templates
SET search_keywords = (
  SELECT array_agg(LOWER(elem))
  FROM unnest(search_keywords) AS elem
)
WHERE search_keywords IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM unnest(search_keywords) AS elem
    WHERE elem != LOWER(elem)
  );

-- ============================================================================
-- PART 2: Normalize projects data
-- ============================================================================

-- Step 7: Normalize projects.status to lowercase
UPDATE public.projects
SET status = LOWER(status)
WHERE status IS NOT NULL AND status != LOWER(status);

-- Step 8: Normalize projects.type to lowercase
UPDATE public.projects
SET type = LOWER(type)
WHERE type IS NOT NULL AND type != LOWER(type);

-- ============================================================================
-- PART 3: Normalize discussion_participants data
-- ============================================================================

-- Step 9: Normalize discussion_participants.role to lowercase
UPDATE public.discussion_participants
SET role = LOWER(role)
WHERE role IS NOT NULL AND role != LOWER(role);

-- ============================================================================
-- PART 4: Normalize discussion_state data
-- ============================================================================

-- Step 10: Normalize discussion_state.status to lowercase
UPDATE public.discussion_state
SET status = LOWER(status)
WHERE status IS NOT NULL AND status != LOWER(status);

-- ============================================================================
-- PART 5: Normalize discussion_logs data
-- ============================================================================

-- Step 11: Normalize discussion_logs.role to lowercase
UPDATE public.discussion_logs
SET role = LOWER(role)
WHERE role IS NOT NULL AND role != LOWER(role);

-- ============================================================================
-- PART 6: Create case-insensitive indices for better query performance
-- ============================================================================

-- Step 12: Create lowercase indices for common search columns
CREATE INDEX IF NOT EXISTS idx_agent_templates_discipline_lower
ON public.agent_templates (LOWER(discipline));

CREATE INDEX IF NOT EXISTS idx_agent_templates_category_lower
ON public.agent_templates (LOWER(category));

CREATE INDEX IF NOT EXISTS idx_agent_templates_engine_type_lower
ON public.agent_templates (LOWER(engine_type));

CREATE INDEX IF NOT EXISTS idx_projects_status_lower
ON public.projects (LOWER(status));

CREATE INDEX IF NOT EXISTS idx_projects_type_lower
ON public.projects (LOWER(type));

-- ============================================================================
-- PART 7: Update check constraints to enforce lowercase
-- ============================================================================

-- Step 13: Drop and recreate check constraints with lowercase values

-- discussion_participants role constraint
ALTER TABLE public.discussion_participants
DROP CONSTRAINT IF EXISTS discussion_participants_role_check;

ALTER TABLE public.discussion_participants
ADD CONSTRAINT discussion_participants_role_check 
CHECK (role IN ('manager', 'leader', 'user', 'specialist'));

-- discussion_state status constraint
ALTER TABLE public.discussion_state
DROP CONSTRAINT IF EXISTS discussion_state_status_check;

ALTER TABLE public.discussion_state
ADD CONSTRAINT discussion_state_status_check 
CHECK (status IN ('active', 'completed', 'paused'));

-- discussion_logs role constraint
ALTER TABLE public.discussion_logs
DROP CONSTRAINT IF EXISTS discussion_logs_role_check;

ALTER TABLE public.discussion_logs
ADD CONSTRAINT discussion_logs_role_check 
CHECK (role IN ('manager', 'leader', 'user', 'specialist'));

-- ============================================================================
-- PART 8: Summary logging
-- ============================================================================

DO $$
DECLARE
  normalized_disciplines integer;
  normalized_categories integer;
  normalized_engine_types integer;
  normalized_project_statuses integer;
  normalized_project_types integer;
BEGIN
  SELECT COUNT(*) INTO normalized_disciplines 
  FROM public.agent_templates 
  WHERE discipline IS NOT NULL AND discipline = LOWER(discipline);
  
  SELECT COUNT(*) INTO normalized_categories 
  FROM public.agent_templates 
  WHERE category IS NOT NULL AND category = LOWER(category);
  
  SELECT COUNT(*) INTO normalized_engine_types 
  FROM public.agent_templates 
  WHERE engine_type IS NOT NULL AND engine_type = LOWER(engine_type);
  
  SELECT COUNT(*) INTO normalized_project_statuses 
  FROM public.projects 
  WHERE status IS NOT NULL AND status = LOWER(status);
  
  SELECT COUNT(*) INTO normalized_project_types 
  FROM public.projects 
  WHERE type IS NOT NULL AND type = LOWER(type);
  
  RAISE NOTICE 'Data Normalization Complete:';
  RAISE NOTICE '  agent_templates.discipline: % records normalized', normalized_disciplines;
  RAISE NOTICE '  agent_templates.category: % records normalized', normalized_categories;
  RAISE NOTICE '  agent_templates.engine_type: % records normalized', normalized_engine_types;
  RAISE NOTICE '  projects.status: % records normalized', normalized_project_statuses;
  RAISE NOTICE '  projects.type: % records normalized', normalized_project_types;
  RAISE NOTICE '  All data now uses lowercase values';
  RAISE NOTICE '  Case-insensitive indices created';
  RAISE NOTICE '  Check constraints updated to enforce lowercase';
END $$;
