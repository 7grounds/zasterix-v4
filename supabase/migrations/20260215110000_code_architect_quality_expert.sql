-- Create Architect (L3) and Quality Expert (L2) agents for code development
-- Following Origo Architecture principles with English naming

DO $$
DECLARE
    zasterix_org_id uuid := '17b2f0fe-f89d-47b1-9fd4-aafe1a327388';
    architect_id uuid;
    quality_expert_id uuid;
    groq_config jsonb := '{"provider":"groq","model":"llama-3.1-8b-instant","temperature":0.2}'::jsonb;
BEGIN
    -- Verify organization exists
    IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = zasterix_org_id) THEN
        RAISE EXCEPTION 'Organization % does not exist', zasterix_org_id;
    END IF;

    -- Create Architect agent (L3 - Strategic Layer)
    INSERT INTO public.agent_templates (
        name,
        description,
        level,
        system_prompt,
        organization_id,
        category,
        icon,
        search_keywords,
        ai_model_config,
        produced_by
    )
    VALUES (
        'Code Architect',
        'Strategic code design agent. Plans structure before implementation, ensures minimal and data-centric solutions.',
        3,
        'You are the Code Architect (L3) in the Zasterix system.

ROLE: Design code structure before implementation begins.

PRINCIPLES:
1. Minimalism: Avoid code bloat. Direct database access over abstractions.
2. Data-Centric: Logic flows from database state. Use existing JSONB columns.
3. Schema-First: Always reference actual database schema from migrations.

WORKFLOW:
1. Analyze requirements and existing code patterns.
2. Design minimal solution using Supabase direct queries.
3. Propose structure with max 3 lines of explanation per section.
4. Ensure all DB operations log to universal_history.
5. Validate against Origo Architecture principles.

CONSTRAINTS:
- Use existing tables (agent_templates, agent_blueprints, projects, discussion_logs, universal_history)
- Prefer JSONB payload over new tables
- Follow Next.js App Router patterns
- Keep TypeScript types strict
- Max 3 lines per code explanation (Manager Alpha Rule)

OUTPUT FORMAT:
[Code Architect]: Brief strategic explanation
Code implementation
[Quality Check Required]: List validation points

Respond in English. Be concise and precise.',
        zasterix_org_id,
        'Development',
        'code',
        ARRAY['architect', 'code-design', 'strategic', 'l3'],
        groq_config,
        'migration:code-architect-quality-expert'
    )
    ON CONFLICT (name, organization_id) DO UPDATE
    SET
        description = EXCLUDED.description,
        level = EXCLUDED.level,
        system_prompt = EXCLUDED.system_prompt,
        category = EXCLUDED.category,
        icon = EXCLUDED.icon,
        search_keywords = EXCLUDED.search_keywords,
        ai_model_config = EXCLUDED.ai_model_config,
        produced_by = EXCLUDED.produced_by,
        updated_at = now()
    RETURNING id INTO architect_id;

    -- Create Quality Expert agent (L2 - Validation Layer)
    INSERT INTO public.agent_templates (
        name,
        description,
        level,
        system_prompt,
        organization_id,
        category,
        icon,
        search_keywords,
        ai_model_config,
        produced_by
    )
    VALUES (
        'Quality Expert',
        'Code validation specialist. Ensures production readiness, TypeScript correctness, and audit compliance.',
        2,
        'You are the Quality Expert (L2) in the Zasterix system.

ROLE: Validate code for production readiness after Architect designs.

VALIDATION CHECKLIST:
1. TypeScript: All types explicit, no ''any'', proper error handling.
2. Database: Every mutation logs to universal_history for audit.
3. Origo Compliance: Minimal code, direct queries, no unnecessary abstractions.
4. Testing: Edge cases handled, error responses structured.
5. Security: RLS policies respected, user context validated.

FOCUS AREAS:
- Check 3-line rule implementation in agent responses
- Verify universal_history logging on all DB updates
- Ensure proper error handling with structured responses
- Validate schema alignment with migrations
- Check for code bloat or unnecessary wrappers

OUTPUT FORMAT:
[Quality Expert]: Validation summary
✓ Passed: [list items]
⚠ Issues: [list items with specific line numbers]
✗ Blocked: [critical issues preventing merge]

STANDARDS:
- All issues must reference specific code lines
- Suggest minimal fixes, not rewrites
- Prioritize data integrity and auditability

Respond in English. Be specific and actionable.',
        zasterix_org_id,
        'Development',
        'shield-check',
        ARRAY['quality', 'validation', 'testing', 'l2'],
        groq_config,
        'migration:code-architect-quality-expert'
    )
    ON CONFLICT (name, organization_id) DO UPDATE
    SET
        description = EXCLUDED.description,
        level = EXCLUDED.level,
        system_prompt = EXCLUDED.system_prompt,
        category = EXCLUDED.category,
        icon = EXCLUDED.icon,
        search_keywords = EXCLUDED.search_keywords,
        ai_model_config = EXCLUDED.ai_model_config,
        produced_by = EXCLUDED.produced_by,
        updated_at = now()
    RETURNING id INTO quality_expert_id;

    -- Log the creation
    RAISE NOTICE 'Code Architect (L3) created/updated: %', architect_id;
    RAISE NOTICE 'Quality Expert (L2) created/updated: %', quality_expert_id;
END
$$;

-- Update existing German agent names to English
UPDATE public.agent_templates
SET 
    name = 'Tourism Expert L2',
    description = REPLACE(description, 'Tourismus', 'Tourism'),
    system_prompt = REPLACE(system_prompt, 'Tourismus', 'Tourism'),
    search_keywords = ARRAY_REPLACE(search_keywords, 'tourismus', 'tourism'),
    updated_at = now()
WHERE name LIKE '%Tourismus%'
    AND organization_id = '17b2f0fe-f89d-47b1-9fd4-aafe1a327388';

-- Function to replace array elements (helper for search_keywords)
CREATE OR REPLACE FUNCTION array_replace(arr text[], old_val text, new_val text)
RETURNS text[] AS $$
DECLARE
    result text[] := '{}';
    elem text;
BEGIN
    FOREACH elem IN ARRAY arr
    LOOP
        IF elem = old_val THEN
            result := array_append(result, new_val);
        ELSE
            result := array_append(result, elem);
        END IF;
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add comment explaining the dual-agent system
COMMENT ON TABLE public.agent_templates IS 
'Agent templates for the Zasterix MAS. Includes dual-agent system: Code Architect (L3) for strategic design and Quality Expert (L2) for validation. All agents use English naming for consistency.';
