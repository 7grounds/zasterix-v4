-- Migration: Add trigger_keywords column for dynamic agent participation
-- This enables the "Universal Mention Trigger" or "Lean-In" system
-- Agents now "listen" for relevant keywords and can respond out of sequence

-- ============================================================================
-- STEP 1: Add trigger_keywords column to agent_templates
-- ============================================================================

ALTER TABLE public.agent_templates
ADD COLUMN IF NOT EXISTS trigger_keywords text[] DEFAULT '{}';

COMMENT ON COLUMN public.agent_templates.trigger_keywords IS 
'Array of lowercase keywords that trigger this agent to participate in discussions. 
When a message contains any of these keywords, the agent can respond regardless of sequence_order.';

-- ============================================================================
-- STEP 2: Create index for efficient keyword searching
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_agent_templates_trigger_keywords 
ON public.agent_templates USING GIN (trigger_keywords);

-- ============================================================================
-- STEP 3: Function to auto-populate trigger_keywords
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_populate_trigger_keywords()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Hotel Expert L2
    UPDATE public.agent_templates
    SET trigger_keywords = ARRAY['hotel', 'expert', 'accommodation', 'booking', 'room', 'lodging', 'hospitality', 'reservation', 'guest', 'check-in']
    WHERE name = 'Hotel Expert L2'
    AND (trigger_keywords IS NULL OR trigger_keywords = '{}');

    -- Tourism Expert L2
    UPDATE public.agent_templates
    SET trigger_keywords = ARRAY['tourism', 'expert', 'travel', 'destination', 'visitor', 'tour', 'attraction', 'sightseeing', 'tourist', 'vacation']
    WHERE name = 'Tourism Expert L2'
    AND (trigger_keywords IS NULL OR trigger_keywords = '{}');

    -- Guide Expert L2
    UPDATE public.agent_templates
    SET trigger_keywords = ARRAY['guide', 'expert', 'tour', 'experience', 'activity', 'local', 'excursion', 'walking', 'city', 'cultural']
    WHERE name = 'Guide Expert L2'
    AND (trigger_keywords IS NULL OR trigger_keywords = '{}');

    -- Quality Expert
    UPDATE public.agent_templates
    SET trigger_keywords = ARRAY['quality', 'expert', 'code', 'testing', 'review', 'qa', 'test', 'bug', 'performance', 'reliability']
    WHERE name = 'Quality Expert'
    AND (trigger_keywords IS NULL OR trigger_keywords = '{}');

    -- Experience Curator
    UPDATE public.agent_templates
    SET trigger_keywords = ARRAY['experience', 'curator', 'design', 'ux', 'ui', 'interface', 'user', 'usability', 'journey', 'interaction']
    WHERE name LIKE '%Experience Curator%'
    AND (trigger_keywords IS NULL OR trigger_keywords = '{}');

    -- Hotel Hub Integrator
    UPDATE public.agent_templates
    SET trigger_keywords = ARRAY['hotel', 'hub', 'integrator', 'integration', 'api', 'system', 'connect', 'sync', 'data', 'interface']
    WHERE name LIKE '%Hotel Hub Integrator%'
    AND (trigger_keywords IS NULL OR trigger_keywords = '{}');

    -- Manager Alpha (strategic keywords)
    UPDATE public.agent_templates
    SET trigger_keywords = ARRAY['manager', 'strategy', 'plan', 'decision', 'coordinate', 'overview', 'summary', 'goal', 'objective', 'direction']
    WHERE name = 'Manager Alpha'
    AND (trigger_keywords IS NULL OR trigger_keywords = '{}');

    -- Discussion Leader
    UPDATE public.agent_templates
    SET trigger_keywords = ARRAY['discussion', 'leader', 'facilitate', 'meeting', 'agenda', 'organize', 'moderate', 'coordinate', 'structure', 'flow']
    WHERE name = 'Discussion Leader'
    AND (trigger_keywords IS NULL OR trigger_keywords = '{}');

    -- Code Architect (if exists)
    UPDATE public.agent_templates
    SET trigger_keywords = ARRAY['code', 'architect', 'architecture', 'design', 'pattern', 'structure', 'system', 'technical', 'framework', 'implementation']
    WHERE name LIKE '%Code Architect%'
    AND (trigger_keywords IS NULL OR trigger_keywords = '{}');

    RAISE NOTICE 'Trigger keywords populated for all agents';
END;
$$;

-- ============================================================================
-- STEP 4: Execute the auto-population function
-- ============================================================================

SELECT public.auto_populate_trigger_keywords();

-- ============================================================================
-- STEP 5: Create function to check keyword matches
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_agent_keyword_match(
    p_message_content text,
    p_project_id uuid
)
RETURNS TABLE (
    agent_id uuid,
    speaker_name text,
    system_prompt text,
    trigger_keyword text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Find first agent whose trigger keywords match the message content
    -- Only considers agents that are participants in the current discussion
    RETURN QUERY
    SELECT DISTINCT ON (at.id)
        at.id as agent_id,
        at.name as speaker_name,
        at.system_prompt,
        kw as trigger_keyword
    FROM public.agent_templates at
    CROSS JOIN unnest(at.trigger_keywords) kw
    INNER JOIN public.discussion_participants dp 
        ON dp.agent_id = at.id 
        AND dp.project_id = p_project_id
        AND dp.status = 'active'
    WHERE lower(p_message_content) LIKE '%' || kw || '%'
        AND at.trigger_keywords IS NOT NULL
        AND array_length(at.trigger_keywords, 1) > 0
    ORDER BY at.id, array_position(at.trigger_keywords, kw)
    LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.check_agent_keyword_match IS 
'Checks if message content matches any agent trigger keywords. 
Returns the first matching agent who is a participant in the discussion.
Used by turn-controller Edge Function for dynamic agent participation.';

-- ============================================================================
-- STEP 6: Verify the migration
-- ============================================================================

DO $$
DECLARE
    keyword_count integer;
BEGIN
    SELECT COUNT(*) INTO keyword_count
    FROM public.agent_templates
    WHERE trigger_keywords IS NOT NULL 
    AND array_length(trigger_keywords, 1) > 0;

    RAISE NOTICE '=== KEYWORD TRIGGER SYSTEM INSTALLED ===';
    RAISE NOTICE 'Agents with trigger keywords: %', keyword_count;
    
    IF keyword_count > 0 THEN
        RAISE NOTICE 'Status: ✓ Keyword system ready';
    ELSE
        RAISE WARNING 'Status: ⚠ No keywords populated - run auto_populate_trigger_keywords()';
    END IF;
    
    RAISE NOTICE '=======================================';
END $$;
