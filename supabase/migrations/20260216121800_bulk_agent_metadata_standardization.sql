-- Bulk Agent Templates Metadata Standardization
-- This migration standardizes agent metadata for intelligent selection

-- Step 1: Add missing columns if they don't exist
ALTER TABLE public.agent_templates
ADD COLUMN IF NOT EXISTS discipline text,
ADD COLUMN IF NOT EXISTS trigger_keywords text[],
ADD COLUMN IF NOT EXISTS engine_type text,
ADD COLUMN IF NOT EXISTS provider text,
ADD COLUMN IF NOT EXISTS model_name text,
ADD COLUMN IF NOT EXISTS code_name text;

-- Step 2: Create index for code_name (will be unique)
CREATE INDEX IF NOT EXISTS idx_agent_templates_code_name
ON public.agent_templates (code_name);

-- Step 3: Update agents based on name/description patterns

-- Design/UI agents
UPDATE public.agent_templates
SET 
  discipline = 'frontend_design',
  trigger_keywords = COALESCE(trigger_keywords, ARRAY[]::text[]) || ARRAY['responsive', 'ux', 'visuals']
WHERE (
  name ILIKE '%Design%' 
  OR name ILIKE '%UI%'
  OR name ILIKE '%UX%'
  OR description ILIKE '%design%'
  OR description ILIKE '%user interface%'
)
AND (discipline IS NULL OR discipline = '');

-- DevOps/Infrastructure agents
UPDATE public.agent_templates
SET 
  discipline = 'infrastructure',
  trigger_keywords = COALESCE(trigger_keywords, ARRAY[]::text[]) || ARRAY['deployment', 'scaling', 'security']
WHERE (
  name ILIKE '%DevOps%'
  OR name ILIKE '%Cloud%'
  OR name ILIKE '%Infrastructure%'
  OR description ILIKE '%devops%'
  OR description ILIKE '%infrastructure%'
  OR description ILIKE '%deployment%'
)
AND (discipline IS NULL OR discipline = '');

-- Manager/Lead agents
UPDATE public.agent_templates
SET engine_type = 'manager_logic'
WHERE (
  name ILIKE '%Manager%'
  OR name ILIKE '%Lead%'
  OR name ILIKE '%Director%'
  OR description ILIKE '%manager%'
  OR description ILIKE '%lead%'
)
AND (engine_type IS NULL OR engine_type = '');

-- Tourism category agents
UPDATE public.agent_templates
SET category = 'tourism'
WHERE (
  name ILIKE '%Tourism%'
  OR name ILIKE '%Tourismus%'
  OR name ILIKE '%Hotel%'
  OR name ILIKE '%Guide%'
  OR name ILIKE '%Berner Oberland%'
  OR description ILIKE '%tourism%'
  OR description ILIKE '%hotel%'
  OR description ILIKE '%destination%'
)
AND (category IS NULL OR category = '' OR category != 'tourism');

-- Step 4: Standardize model_name and provider for all active agents
UPDATE public.agent_templates
SET 
  provider = 'groq',
  model_name = 'llama-3.1-8b-instant'
WHERE 
  (provider IS NULL OR provider = '' OR provider = 'xAI')
  AND (model_name IS NULL OR model_name = '');

-- Step 5: Generate unique code_names for agents that don't have one
-- Using a combination of normalized name and UUID prefix
UPDATE public.agent_templates
SET code_name = 
  UPPER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(name, '[^a-zA-Z0-9\s]', '', 'g'),
      '\s+', '_', 'g'
    )
  ) || '_' || SUBSTRING(id::text, 1, 8)
WHERE code_name IS NULL OR code_name = '';

-- Step 6: Ensure code_names are truly unique by appending sequence numbers where needed
WITH ranked_codes AS (
  SELECT
    id,
    code_name,
    ROW_NUMBER() OVER (PARTITION BY code_name ORDER BY created_at, id) AS row_num
  FROM public.agent_templates
  WHERE code_name IS NOT NULL
)
UPDATE public.agent_templates AS templates
SET code_name = CASE 
  WHEN ranked_codes.row_num > 1 
  THEN templates.code_name || '_' || ranked_codes.row_num::text
  ELSE templates.code_name
END
FROM ranked_codes
WHERE templates.id = ranked_codes.id;

-- Step 7: Now make code_name unique constraint
ALTER TABLE public.agent_templates
DROP CONSTRAINT IF EXISTS unique_agent_templates_code_name;

ALTER TABLE public.agent_templates
ADD CONSTRAINT unique_agent_templates_code_name UNIQUE (code_name);

-- Step 8: Update ai_model_config to ensure consistency
UPDATE public.agent_templates
SET ai_model_config = jsonb_build_object(
  'provider', COALESCE(provider, 'groq'),
  'model', COALESCE(model_name, 'llama-3.1-8b-instant'),
  'temperature', COALESCE((ai_model_config->>'temperature')::numeric, 0.2),
  'stop', COALESCE(ai_model_config->'stop', '["[", "\n\n", "Speaker:"]'::jsonb)
)
WHERE ai_model_config IS NULL 
   OR NOT (ai_model_config ? 'provider')
   OR NOT (ai_model_config ? 'model');

-- Step 9: Log the changes
DO $$
DECLARE
  design_count integer;
  devops_count integer;
  manager_count integer;
  tourism_count integer;
  total_count integer;
BEGIN
  SELECT COUNT(*) INTO design_count FROM public.agent_templates WHERE discipline = 'frontend_design';
  SELECT COUNT(*) INTO devops_count FROM public.agent_templates WHERE discipline = 'infrastructure';
  SELECT COUNT(*) INTO manager_count FROM public.agent_templates WHERE engine_type = 'manager_logic';
  SELECT COUNT(*) INTO tourism_count FROM public.agent_templates WHERE category = 'tourism';
  SELECT COUNT(*) INTO total_count FROM public.agent_templates;
  
  RAISE NOTICE 'Agent Templates Bulk Update Complete:';
  RAISE NOTICE '  Total agents: %', total_count;
  RAISE NOTICE '  Design/UI agents: %', design_count;
  RAISE NOTICE '  DevOps/Infrastructure agents: %', devops_count;
  RAISE NOTICE '  Manager/Lead agents: %', manager_count;
  RAISE NOTICE '  Tourism category agents: %', tourism_count;
  RAISE NOTICE '  All agents now have unique code_names';
  RAISE NOTICE '  All agents standardized to groq/llama-3.1-8b-instant';
END $$;
