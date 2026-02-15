-- Comprehensive fix for "Discussion Leader agent not found" error
-- This migration ensures the Discussion Leader agent always exists

-- Step 1: Ensure unique constraint exists (if not already present)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'agent_templates_name_org_unique'
    ) THEN
        ALTER TABLE public.agent_templates
        ADD CONSTRAINT agent_templates_name_org_unique
        UNIQUE (name, organization_id);
        RAISE NOTICE 'Added unique constraint on (name, organization_id)';
    END IF;
EXCEPTION
    WHEN duplicate_table THEN
        RAISE NOTICE 'Unique constraint already exists';
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not add constraint, it may already exist';
END
$$;

-- Step 2: Create Discussion Leader as a GLOBAL agent (organization_id = NULL)
-- This ensures it's always available regardless of organization setup
DO $$
DECLARE
    discussion_leader_id uuid;
    groq_config jsonb := '{"provider":"groq","model":"llama-3.1-8b-instant","temperature":0.2}'::jsonb;
    agent_exists boolean;
BEGIN
    -- Check if Discussion Leader already exists (any organization)
    SELECT EXISTS (
        SELECT 1 FROM public.agent_templates
        WHERE name = 'Discussion Leader'
    ) INTO agent_exists;

    IF agent_exists THEN
        RAISE NOTICE 'Discussion Leader already exists, updating it...';
        
        -- Update existing Discussion Leader
        UPDATE public.agent_templates
        SET
            description = 'Moderiert strukturierte Multi-Agent Diskussionen mit definierten Regeln und Ablauf.',
            level = 3,
            system_prompt = 'Du bist der Discussion Leader. Deine Aufgabe ist es, strukturierte Diskussionen zu moderieren.

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
            category = 'Discussion',
            icon = 'users',
            search_keywords = ARRAY['discussion', 'leader', 'moderation', 'mas'],
            ai_model_config = groq_config,
            produced_by = 'migration:ensure-discussion-leader',
            updated_at = now()
        WHERE name = 'Discussion Leader'
        RETURNING id INTO discussion_leader_id;
        
        RAISE NOTICE 'Updated Discussion Leader: %', discussion_leader_id;
    ELSE
        RAISE NOTICE 'Discussion Leader does not exist, creating it...';
        
        -- Create new Discussion Leader as GLOBAL agent (organization_id = NULL)
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
            NULL, -- Global agent, no organization_id
            'Discussion',
            'users',
            ARRAY['discussion', 'leader', 'moderation', 'mas'],
            groq_config,
            'migration:ensure-discussion-leader'
        )
        RETURNING id INTO discussion_leader_id;
        
        RAISE NOTICE 'Created Discussion Leader: %', discussion_leader_id;
    END IF;
END
$$;

-- Step 3: Verify the agent exists
DO $$
DECLARE
    agent_count integer;
    agent_info record;
BEGIN
    SELECT COUNT(*)
    INTO agent_count
    FROM public.agent_templates
    WHERE name = 'Discussion Leader';
    
    IF agent_count > 0 THEN
        -- Get agent details
        SELECT id, name, organization_id, level, category
        INTO agent_info
        FROM public.agent_templates
        WHERE name = 'Discussion Leader'
        LIMIT 1;
        
        RAISE NOTICE '✓ VERIFICATION SUCCESS: Discussion Leader exists';
        RAISE NOTICE '  - ID: %', agent_info.id;
        RAISE NOTICE '  - Name: %', agent_info.name;
        RAISE NOTICE '  - Organization ID: % (NULL = global)', agent_info.organization_id;
        RAISE NOTICE '  - Level: %', agent_info.level;
        RAISE NOTICE '  - Category: %', agent_info.category;
    ELSE
        RAISE EXCEPTION '✗ VERIFICATION FAILED: Discussion Leader was not created!';
    END IF;
END
$$;

-- Step 4: Also ensure Manager Alpha exists (required for discussions)
DO $$
DECLARE
    manager_alpha_id uuid;
    groq_config jsonb := '{"provider":"groq","model":"llama-3.1-8b-instant","temperature":0.2}'::jsonb;
    agent_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.agent_templates
        WHERE name = 'Manager Alpha'
    ) INTO agent_exists;

    IF NOT agent_exists THEN
        RAISE NOTICE 'Manager Alpha does not exist, creating it...';
        
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
            'Manager Alpha',
            'Zasterix Haupt-Manager. Koordiniert Projekte und initiiert Diskussionen.',
            4,
            'Du bist Manager Alpha, der Haupt-Koordinator im Zasterix System.

DEINE AUFGABEN:
1. Projektmanagement und Koordination
2. Erkennung von Diskussionsbedarf
3. Delegation an Discussion Leader bei Meetings

WENN der Nutzer "discussion", "meeting", "Diskussion" oder "Besprechung" erwähnt:
- Analysiere das Thema kurz
- Sage: "Ich rufe den Discussion Leader für diese Diskussion."
- Übergebe an Discussion Leader mit Kontext

NORMAL-MODUS (ohne Diskussions-Keywords):
- Beantworte Fragen direkt
- Gib Management-Empfehlungen
- Koordiniere einzelne Agenten

Antworte professionell, kurz und klar. Format: [Manager Alpha]: Text',
            NULL, -- Global agent
            'Management',
            'crown',
            ARRAY['manager', 'alpha', 'coordination', 'discussion-initiator'],
            groq_config,
            'migration:ensure-discussion-leader'
        )
        RETURNING id INTO manager_alpha_id;
        
        RAISE NOTICE 'Created Manager Alpha: %', manager_alpha_id;
    ELSE
        RAISE NOTICE 'Manager Alpha already exists';
    END IF;
END
$$;

-- Final summary
DO $$
DECLARE
    discussion_leader_count integer;
    manager_alpha_count integer;
BEGIN
    SELECT COUNT(*) INTO discussion_leader_count
    FROM public.agent_templates
    WHERE name = 'Discussion Leader';
    
    SELECT COUNT(*) INTO manager_alpha_count
    FROM public.agent_templates
    WHERE name = 'Manager Alpha';
    
    RAISE NOTICE '';
    RAISE NOTICE '=== MIGRATION COMPLETE ===';
    RAISE NOTICE 'Discussion Leader agents: %', discussion_leader_count;
    RAISE NOTICE 'Manager Alpha agents: %', manager_alpha_count;
    
    IF discussion_leader_count > 0 AND manager_alpha_count > 0 THEN
        RAISE NOTICE 'Status: ✓ ALL REQUIRED AGENTS EXIST';
    ELSE
        RAISE WARNING 'Status: ✗ SOME AGENTS MISSING - Please investigate';
    END IF;
    RAISE NOTICE '==========================';
END
$$;
