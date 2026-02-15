-- SQL Functions for Database-Orchestrated Discussion Flow

-- 1. Architect Recruitment Function
-- Finds 2 active specialists based on project keywords and recruits them
CREATE OR REPLACE FUNCTION recruit_specialists_for_discussion(
    p_project_id uuid,
    p_project_keywords text[] DEFAULT ARRAY['expert', 'specialist']
)
RETURNS TABLE (
    agent_id uuid,
    agent_name text,
    agent_level integer,
    sequence_order integer
) AS $$
DECLARE
    v_manager_id uuid;
    v_leader_id uuid;
    v_specialist_1_id uuid;
    v_specialist_2_id uuid;
BEGIN
    -- Get Manager L3 agent
    SELECT id INTO v_manager_id
    FROM public.agent_templates
    WHERE name LIKE '%Manager%' AND level = 3
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Get Discussion Leader agent
    SELECT id INTO v_leader_id
    FROM public.agent_templates
    WHERE name = 'Discussion Leader'
    LIMIT 1;
    
    -- Find 2 specialists (Level 2) based on keywords
    -- First, try to match by name patterns
    WITH ranked_specialists AS (
        SELECT 
            id,
            name,
            level,
            ROW_NUMBER() OVER (
                ORDER BY 
                    CASE 
                        WHEN name ILIKE ANY(p_project_keywords) THEN 1
                        WHEN level = 2 THEN 2
                        ELSE 3
                    END,
                    created_at DESC
            ) as rank
        FROM public.agent_templates
        WHERE level = 2
        AND id IS NOT NULL
    )
    SELECT id INTO v_specialist_1_id
    FROM ranked_specialists
    WHERE rank = 1;
    
    SELECT id INTO v_specialist_2_id
    FROM ranked_specialists
    WHERE rank = 2;
    
    -- Insert Manager (sequence 0)
    IF v_manager_id IS NOT NULL THEN
        INSERT INTO public.discussion_participants 
            (project_id, agent_id, role, sequence_order, status)
        VALUES 
            (p_project_id, v_manager_id, 'manager', 0, 'active')
        ON CONFLICT (project_id, sequence_order) DO NOTHING;
    END IF;
    
    -- Insert Discussion Leader (sequence 1)
    IF v_leader_id IS NOT NULL THEN
        INSERT INTO public.discussion_participants 
            (project_id, agent_id, role, sequence_order, status)
        VALUES 
            (p_project_id, v_leader_id, 'leader', 1, 'active')
        ON CONFLICT (project_id, sequence_order) DO NOTHING;
    END IF;
    
    -- Insert Specialist A (sequence 2)
    IF v_specialist_1_id IS NOT NULL THEN
        INSERT INTO public.discussion_participants 
            (project_id, agent_id, role, sequence_order, status)
        VALUES 
            (p_project_id, v_specialist_1_id, 'specialist', 2, 'active')
        ON CONFLICT (project_id, sequence_order) DO NOTHING;
    END IF;
    
    -- Insert Specialist B (sequence 3)
    IF v_specialist_2_id IS NOT NULL THEN
        INSERT INTO public.discussion_participants 
            (project_id, agent_id, role, sequence_order, status)
        VALUES 
            (p_project_id, v_specialist_2_id, 'specialist', 3, 'active')
        ON CONFLICT (project_id, sequence_order) DO NOTHING;
    END IF;
    
    -- Insert User placeholder (sequence 4)
    INSERT INTO public.discussion_participants 
        (project_id, agent_id, role, sequence_order, status)
    VALUES 
        (p_project_id, NULL, 'user', 4, 'active')
    ON CONFLICT (project_id, sequence_order) DO NOTHING;
    
    -- Return all participants
    RETURN QUERY
    SELECT 
        dp.agent_id,
        COALESCE(at.name, 'User') as agent_name,
        COALESCE(at.level, 0) as agent_level,
        dp.sequence_order
    FROM public.discussion_participants dp
    LEFT JOIN public.agent_templates at ON at.id = dp.agent_id
    WHERE dp.project_id = p_project_id
    ORDER BY dp.sequence_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Discussion Leader "Seal" Function
-- Verifies participants and inserts "System Ready" message
CREATE OR REPLACE FUNCTION seal_discussion_recruitment(
    p_project_id uuid,
    p_user_id uuid DEFAULT NULL,
    p_organization_id uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
    v_participant_count integer;
    v_leader_id uuid;
    v_system_message_id uuid;
    v_result jsonb;
BEGIN
    -- Count participants
    SELECT COUNT(*) INTO v_participant_count
    FROM public.discussion_participants
    WHERE project_id = p_project_id
    AND status = 'active';
    
    -- Verify we have at least Manager, Leader, and 1 specialist
    IF v_participant_count < 3 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Insufficient participants',
            'participant_count', v_participant_count
        );
    END IF;
    
    -- Get Discussion Leader ID
    SELECT agent_id INTO v_leader_id
    FROM public.discussion_participants
    WHERE project_id = p_project_id
    AND role = 'leader'
    LIMIT 1;
    
    -- Insert "System Ready" message with turn_index = -1
    INSERT INTO public.discussion_logs 
        (project_id, agent_id, speaker_name, content, turn_index)
    VALUES 
        (
            p_project_id,
            v_leader_id,
            'Discussion Leader',
            'System Ready: All participants recruited. Discussion can begin.',
            -1
        )
    RETURNING id INTO v_system_message_id;
    
    -- Log to universal_history
    IF p_user_id IS NOT NULL THEN
        INSERT INTO public.universal_history 
            (user_id, organization_id, payload)
        VALUES 
            (
                p_user_id,
                p_organization_id,
                jsonb_build_object(
                    'type', 'discussion_sealed',
                    'project_id', p_project_id,
                    'participant_count', v_participant_count,
                    'system_message_id', v_system_message_id,
                    'timestamp', now()
                )
            );
    END IF;
    
    -- Build success response
    v_result := jsonb_build_object(
        'success', true,
        'participant_count', v_participant_count,
        'system_message_id', v_system_message_id,
        'message', 'Discussion sealed and ready'
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Get Next Speaker Function
-- Determines who speaks next based on current turn_index
CREATE OR REPLACE FUNCTION get_next_speaker(
    p_project_id uuid
)
RETURNS TABLE (
    agent_id uuid,
    agent_name text,
    sequence_order integer,
    system_prompt text,
    is_user boolean
) AS $$
DECLARE
    v_last_turn_index integer;
    v_next_sequence integer;
BEGIN
    -- Get the last turn index
    SELECT COALESCE(MAX(turn_index), -1) INTO v_last_turn_index
    FROM public.discussion_logs
    WHERE project_id = p_project_id;
    
    -- Calculate next sequence (0-based, wraps around)
    SELECT COALESCE(MIN(dp.sequence_order), 0) INTO v_next_sequence
    FROM public.discussion_participants dp
    WHERE dp.project_id = p_project_id
    AND dp.status = 'active'
    AND dp.sequence_order > (v_last_turn_index + 1) % (
        SELECT COUNT(*) FROM public.discussion_participants 
        WHERE project_id = p_project_id AND status = 'active'
    );
    
    -- If no next sequence found, start from beginning
    IF v_next_sequence IS NULL THEN
        SELECT MIN(sequence_order) INTO v_next_sequence
        FROM public.discussion_participants
        WHERE project_id = p_project_id
        AND status = 'active';
    END IF;
    
    -- Return the next speaker
    RETURN QUERY
    SELECT 
        dp.agent_id,
        COALESCE(at.name, 'User') as agent_name,
        dp.sequence_order,
        COALESCE(at.system_prompt, '') as system_prompt,
        (dp.role = 'user') as is_user
    FROM public.discussion_participants dp
    LEFT JOIN public.agent_templates at ON at.id = dp.agent_id
    WHERE dp.project_id = p_project_id
    AND dp.sequence_order = v_next_sequence
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON FUNCTION recruit_specialists_for_discussion IS 'Architect logic: Finds 2 specialists and bulk inserts all participants';
COMMENT ON FUNCTION seal_discussion_recruitment IS 'Discussion Leader logic: Verifies participants and inserts System Ready message';
COMMENT ON FUNCTION get_next_speaker IS 'Turn Controller: Determines next agent to speak based on turn_index';
