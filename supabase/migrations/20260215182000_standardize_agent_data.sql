-- Migration: Standardize Agent Data (Phase 3)
-- Ensures all agents have consistent data quality following Origo Architecture

-- ============================================================================
-- STEP 1: Ensure all system prompts are at least 200 characters
-- ============================================================================

UPDATE public.agent_templates
SET system_prompt = CONCAT(
    system_prompt,
    E'\n\nYou are a specialized expert in your domain. ',
    'Provide concise, actionable insights based on your expertise. ',
    'Always consider the context of the discussion and the needs of the project. ',
    'Your responses should be clear, professional, and directly relevant to the topic at hand.'
)
WHERE LENGTH(system_prompt) < 200;

-- ============================================================================
-- STEP 2: Standardize metadata structure
-- ============================================================================

-- Ensure all agents have max_lines set to 3
UPDATE public.agent_templates
SET ai_model_config = jsonb_set(
    COALESCE(ai_model_config, '{}'::jsonb),
    '{max_lines}',
    '3'::jsonb
)
WHERE ai_model_config IS NULL 
    OR NOT (ai_model_config ? 'max_lines')
    OR (ai_model_config->>'max_lines')::int != 3;

-- Ensure all agents have provider set to 'groq'
UPDATE public.agent_templates
SET ai_model_config = jsonb_set(
    COALESCE(ai_model_config, '{}'::jsonb),
    '{provider}',
    '"groq"'::jsonb
)
WHERE ai_model_config IS NULL 
    OR NOT (ai_model_config ? 'provider')
    OR (ai_model_config->>'provider') != 'groq';

-- ============================================================================
-- STEP 3: Ensure minimum prompt quality for key agents
-- ============================================================================

-- Update Hotel Expert L2 if prompt is too short
UPDATE public.agent_templates
SET system_prompt = 
    'You are the Hotel Expert, specializing in accommodation management, booking systems, ' ||
    'and hotel operations. Your expertise covers hotel integrations, room management, ' ||
    'reservation systems, guest services, and hospitality best practices. ' ||
    'Provide insights on hotel partnerships, booking workflows, and accommodation strategies. ' ||
    'Always consider operational efficiency, guest satisfaction, and system integration when advising.'
WHERE name = 'Hotel Expert L2'
AND LENGTH(system_prompt) < 200;

-- Update Tourism Expert L2 if prompt is too short
UPDATE public.agent_templates
SET system_prompt =
    'You are the Tourism Expert, specializing in travel industry insights, destination management, ' ||
    'and visitor experiences. Your expertise covers tourism trends, destination marketing, ' ||
    'visitor behavior, seasonal patterns, and tourism industry best practices. ' ||
    'Provide strategic advice on tourism development, marketing strategies, and visitor engagement. ' ||
    'Always consider market trends, visitor preferences, and sustainable tourism practices.'
WHERE name = 'Tourism Expert L2'
AND LENGTH(system_prompt) < 200;

-- Update Guide Expert L2 if prompt is too short
UPDATE public.agent_templates
SET system_prompt =
    'You are the Guide Expert, specializing in tour experiences, local activities, ' ||
    'and cultural exploration. Your expertise covers tour planning, activity coordination, ' ||
    'local insights, experiential travel, and guide services. ' ||
    'Provide recommendations on tour design, activity programming, and guest experiences. ' ||
    'Always consider authenticity, engagement, and memorable experiences when advising.'
WHERE name = 'Guide Expert L2'
AND LENGTH(system_prompt) < 200;

-- Update Quality Expert if prompt is too short
UPDATE public.agent_templates
SET system_prompt =
    'You are the Quality Expert, specializing in code quality, testing, and system reliability. ' ||
    'Your expertise covers code reviews, test strategies, quality assurance, performance optimization, ' ||
    'and technical debt management. Provide insights on testing approaches, code standards, ' ||
    'and quality metrics. Always consider maintainability, reliability, and best practices ' ||
    'when reviewing technical implementations.'
WHERE name = 'Quality Expert'
AND LENGTH(system_prompt) < 200;

-- ============================================================================
-- STEP 4: Verification and Reporting
-- ============================================================================

DO $$
DECLARE
    total_agents integer;
    standardized_agents integer;
    agents_with_keywords integer;
    min_prompt_length integer;
BEGIN
    -- Count total agents
    SELECT COUNT(*) INTO total_agents
    FROM public.agent_templates;

    -- Count agents with standardized metadata
    SELECT COUNT(*) INTO standardized_agents
    FROM public.agent_templates
    WHERE ai_model_config ? 'max_lines'
    AND ai_model_config ? 'provider'
    AND (ai_model_config->>'max_lines')::int = 3
    AND (ai_model_config->>'provider') = 'groq'
    AND LENGTH(system_prompt) >= 200;

    -- Count agents with trigger keywords
    SELECT COUNT(*) INTO agents_with_keywords
    FROM public.agent_templates
    WHERE trigger_keywords IS NOT NULL
    AND array_length(trigger_keywords, 1) > 0;

    -- Get minimum prompt length
    SELECT MIN(LENGTH(system_prompt)) INTO min_prompt_length
    FROM public.agent_templates;

    RAISE NOTICE '=== AGENT DATA STANDARDIZATION COMPLETE ===';
    RAISE NOTICE 'Total agents: %', total_agents;
    RAISE NOTICE 'Fully standardized: %', standardized_agents;
    RAISE NOTICE 'With trigger keywords: %', agents_with_keywords;
    RAISE NOTICE 'Minimum prompt length: % characters', min_prompt_length;
    
    IF standardized_agents = total_agents THEN
        RAISE NOTICE 'Status: ✓ ALL AGENTS STANDARDIZED';
    ELSE
        RAISE WARNING 'Status: ⚠ Some agents need manual review';
    END IF;
    
    RAISE NOTICE '==========================================';
END $$;
