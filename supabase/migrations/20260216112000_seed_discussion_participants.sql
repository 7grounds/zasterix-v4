-- Seed discussion participants for the Berner Oberland Tourism discussion
DO $$
DECLARE
    discussion_project_id uuid := '6e44f3ea-7d88-4fc8-b0ea-a1f41a7ec8df';
    manager_agent_id uuid;
    hotel_agent_id uuid;
    guide_agent_id uuid;
    tourism_agent_id uuid;
BEGIN
    -- Get agent IDs
    SELECT id INTO manager_agent_id
    FROM public.agent_templates
    WHERE name = 'Manager L3'
    LIMIT 1;

    SELECT id INTO hotel_agent_id
    FROM public.agent_templates
    WHERE name = 'Hotel Expert L2'
    LIMIT 1;

    SELECT id INTO guide_agent_id
    FROM public.agent_templates
    WHERE name = 'Guide Expert L2'
    LIMIT 1;

    SELECT id INTO tourism_agent_id
    FROM public.agent_templates
    WHERE name = 'Tourismus Expert L2'
    LIMIT 1;

    -- Insert participants if not already present
    IF manager_agent_id IS NOT NULL THEN
        INSERT INTO public.discussion_participants (project_id, agent_id, role, sequence_order)
        VALUES (discussion_project_id, manager_agent_id, 'manager', 0)
        ON CONFLICT (project_id, agent_id) DO NOTHING;
    END IF;

    IF hotel_agent_id IS NOT NULL THEN
        INSERT INTO public.discussion_participants (project_id, agent_id, role, sequence_order)
        VALUES (discussion_project_id, hotel_agent_id, 'specialist', 1)
        ON CONFLICT (project_id, agent_id) DO NOTHING;
    END IF;

    IF guide_agent_id IS NOT NULL THEN
        INSERT INTO public.discussion_participants (project_id, agent_id, role, sequence_order)
        VALUES (discussion_project_id, guide_agent_id, 'specialist', 2)
        ON CONFLICT (project_id, agent_id) DO NOTHING;
    END IF;

    IF tourism_agent_id IS NOT NULL THEN
        INSERT INTO public.discussion_participants (project_id, agent_id, role, sequence_order)
        VALUES (discussion_project_id, tourism_agent_id, 'specialist', 3)
        ON CONFLICT (project_id, agent_id) DO NOTHING;
    END IF;

    -- Add user as a participant
    INSERT INTO public.discussion_participants (project_id, agent_id, role, sequence_order)
    VALUES (discussion_project_id, NULL, 'user', 4)
    ON CONFLICT (project_id, sequence_order) DO NOTHING;

    -- Initialize discussion state if not exists
    INSERT INTO public.discussion_state (project_id, current_turn_index, current_round, status)
    VALUES (discussion_project_id, 0, 1, 'active')
    ON CONFLICT (project_id) DO UPDATE
    SET current_turn_index = 0,
        current_round = 1,
        status = 'active',
        updated_at = now();

END $$;
