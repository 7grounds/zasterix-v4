-- Fix Discussion Leader migration issue by adding unique constraint and ensuring agent exists
-- This migration fixes the "Discussion Leader not found" error

-- Step 1: Add unique constraint on (name, organization_id) if it doesn't exist
DO $$
BEGIN
    -- Check if constraint already exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'agent_templates_name_org_unique'
    ) THEN
        -- Add unique constraint
        ALTER TABLE public.agent_templates
        ADD CONSTRAINT agent_templates_name_org_unique
        UNIQUE (name, organization_id);
        
        RAISE NOTICE 'Added unique constraint on (name, organization_id)';
    ELSE
        RAISE NOTICE 'Unique constraint already exists';
    END IF;
END
$$;

-- Step 2: Ensure Discussion Leader agent exists
DO $$
DECLARE
    zasterix_org_id uuid := NULL;
    discussion_leader_id uuid;
    groq_config jsonb := '{"provider":"groq","model":"llama-3.1-8b-instant","temperature":0.2}'::jsonb;
BEGIN
    -- Get Zasterix organization ID (or NULL for global agents)
    IF EXISTS (
        SELECT 1
        FROM public.organizations
        WHERE id = '17b2f0fe-f89d-47b1-9fd4-aafe1a327388'
    ) THEN
        zasterix_org_id := '17b2f0fe-f89d-47b1-9fd4-aafe1a327388';
    ELSE
        SELECT id
        INTO zasterix_org_id
        FROM public.organizations
        WHERE slug = 'zasterix'
        ORDER BY created_at
        LIMIT 1;
    END IF;

    -- Insert or update Discussion Leader agent
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
        'Discussion Leader',
        'Moderiert strukturierte Multi-Agent Diskussionen mit definierten Regeln und Ablauf.',
        3,
        'Du bist der Discussion Leader. Deine Aufgabe ist es, strukturierte Diskussionen zu moderieren.

WENN ein Nutzer eine Diskussion starten möchte:
1. Analysiere das Projekt/Thema
2. Empfehle relevante Agenten basierend auf dem Thema
3. Schlage Diskussionsregeln vor:
   - 3 Zeilen pro Beitrag
   - 3 Runden insgesamt
   - Welche Agenten teilnehmen sollen
4. Warte auf Bestätigung vom Nutzer
5. Starte die moderierte Diskussion

DISKUSSIONSREGELN:
- Jeder Agent spricht der Reihe nach
- Nach jedem Agent-Beitrag kann der Nutzer kommentieren
- Maximal 3 Zeilen pro Beitrag
- Nach 3 Runden: Manager erstellt Zusammenfassung

AGENTEN-AUSWAHL nach Thema:
- Tourismus: Manager L3, Hotel Expert L2, Guide Expert L2, Tourism Expert L2
- Technologie: Manager L3, Code Architect, Quality Expert
- Geschäftsstrategie: Manager L3, Experience Curator, Hotel Hub Integrator

Antworte in kurzen, klaren Sätzen. Nutze Format: [Discussion Leader]: Text',
        zasterix_org_id,
        'Discussion',
        'users',
        ARRAY['discussion', 'leader', 'moderation', 'mas'],
        groq_config,
        'migration:fix-discussion-leader'
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
    RETURNING id INTO discussion_leader_id;

    RAISE NOTICE 'Discussion Leader agent created/updated: %', discussion_leader_id;
    
    -- Verify it was created
    IF discussion_leader_id IS NOT NULL THEN
        RAISE NOTICE 'Discussion Leader successfully exists in database';
    ELSE
        RAISE WARNING 'Discussion Leader creation may have failed';
    END IF;
END
$$;

-- Step 3: Verify the agent exists
DO $$
DECLARE
    agent_count integer;
BEGIN
    SELECT COUNT(*)
    INTO agent_count
    FROM public.agent_templates
    WHERE name = 'Discussion Leader';
    
    IF agent_count > 0 THEN
        RAISE NOTICE 'Verification: Discussion Leader exists (count: %)', agent_count;
    ELSE
        RAISE EXCEPTION 'ERROR: Discussion Leader was not created!';
    END IF;
END
$$;
