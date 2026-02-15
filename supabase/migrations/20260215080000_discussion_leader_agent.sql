-- Create Discussion Leader agent for MAS discussion system
DO $$
DECLARE
    zasterix_org_id uuid := NULL;
    discussion_leader_id uuid;
    manager_alpha_id uuid;
    groq_config jsonb := '{"provider":"groq","model":"llama-3.1-8b-instant","temperature":0.2}'::jsonb;
BEGIN
    -- Get Zasterix organization ID
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

    -- Create or update Discussion Leader agent
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
- Tourismus: Manager L3, Hotel Expert L2, Guide Expert L2, Tourismus Expert L2
- Technologie: Manager L3, relevante Tech-Experten
- Geschäftsstrategie: Manager L3, Experience Curator, Hotel-Hub-Integrator

Antworte in kurzen, klaren Sätzen. Nutze Format: [Discussion Leader]: Text',
        zasterix_org_id,
        'Discussion',
        'users',
        ARRAY['discussion', 'leader', 'moderation', 'mas'],
        groq_config,
        'migration:discussion-leader'
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

    -- Create or update Manager Alpha agent to work with Discussion Leader
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
        zasterix_org_id,
        'Management',
        'crown',
        ARRAY['manager', 'alpha', 'coordination', 'discussion-initiator'],
        groq_config,
        'migration:discussion-leader'
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
    RETURNING id INTO manager_alpha_id;

    -- Log the creation
    RAISE NOTICE 'Discussion Leader created/updated: %', discussion_leader_id;
    RAISE NOTICE 'Manager Alpha created/updated: %', manager_alpha_id;
END
$$;
