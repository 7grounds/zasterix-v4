-- =============================================================================
-- ORIGO AGENTIC OS — Core Tables Migration
-- Adds: discussion_state, discussion_participants, discussion_logs, agent_tasks,
--       system_guidelines, origo_logic_vault, few_shot_templates,
--       shared_insights, knowledge_base
-- Patches: agent_templates.engine_type
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. engine_type on agent_templates
--    "manager" drives rounds and generates agent_tasks
--    "specialist" contributes domain expertise
-- ---------------------------------------------------------------------------
ALTER TABLE public.agent_templates
  ADD COLUMN IF NOT EXISTS engine_type text NOT NULL DEFAULT 'specialist';

COMMENT ON COLUMN public.agent_templates.engine_type IS
'"manager" | "specialist" — controls agent role in the Origo loop.';

-- ---------------------------------------------------------------------------
-- 2. discussion_state  (one row per autonomous session)
--    The Supabase DB Webhook fires on INSERT to discussion_logs and POSTs to
--    /api/agent-loop, which reads this table to drive the state machine.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discussion_state (
    id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id         uuid        REFERENCES public.projects(id) ON DELETE CASCADE,
    current_turn_index integer     NOT NULL DEFAULT 0,
    current_round      integer     NOT NULL DEFAULT 0,
    max_rounds         integer     NOT NULL DEFAULT 3,
    status             text        NOT NULL DEFAULT 'active',
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.discussion_state IS
'Tracks the sequential state machine for one Origo agent discussion session.
status values: "active" | "complete" | "paused"';

CREATE INDEX IF NOT EXISTS idx_discussion_state_project
    ON public.discussion_state (project_id);
CREATE INDEX IF NOT EXISTS idx_discussion_state_status
    ON public.discussion_state (status);

-- ---------------------------------------------------------------------------
-- 3. discussion_participants  (guest list — ordered by sequence_order)
--    Manager = sequence_order 0, Specialists = 1, 2, 3 …
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discussion_participants (
    id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    discussion_id      uuid        NOT NULL REFERENCES public.discussion_state(id) ON DELETE CASCADE,
    agent_template_id  uuid        NOT NULL REFERENCES public.agent_templates(id) ON DELETE CASCADE,
    sequence_order     integer     NOT NULL DEFAULT 0,
    created_at         timestamptz NOT NULL DEFAULT now(),
    UNIQUE (discussion_id, agent_template_id)
);

COMMENT ON TABLE public.discussion_participants IS
'Ordered participant list for a discussion session.
sequence_order 0 = Manager, 1+ = Specialists.';

CREATE INDEX IF NOT EXISTS idx_discussion_participants_discussion
    ON public.discussion_participants (discussion_id, sequence_order);

-- ---------------------------------------------------------------------------
-- 4. discussion_logs  (every turn stored; webhook fires on every INSERT)
--    message_type: "human" | "agent" | "system"
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discussion_logs (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    discussion_id  uuid        NOT NULL REFERENCES public.discussion_state(id) ON DELETE CASCADE,
    agent_id       uuid        REFERENCES public.agent_templates(id) ON DELETE SET NULL,
    speaker_name   text        NOT NULL,
    turn_index     integer     NOT NULL,
    content        text        NOT NULL,
    message_type   text        NOT NULL DEFAULT 'agent',
    created_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.discussion_logs IS
'Every message in a discussion session.
INSERT triggers the Supabase DB Webhook → /api/agent-loop.';

CREATE INDEX IF NOT EXISTS idx_discussion_logs_discussion_turn
    ON public.discussion_logs (discussion_id, turn_index);
CREATE INDEX IF NOT EXISTS idx_discussion_logs_created
    ON public.discussion_logs (discussion_id, created_at);

-- ---------------------------------------------------------------------------
-- 5. agent_tasks  (Manager creates these at max_rounds)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_tasks (
    id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    discussion_id     uuid        REFERENCES public.discussion_state(id) ON DELETE CASCADE,
    assigned_agent_id uuid        REFERENCES public.agent_templates(id) ON DELETE SET NULL,
    title             text        NOT NULL,
    description       text        NOT NULL DEFAULT '',
    priority          text        NOT NULL DEFAULT 'medium',
    status            text        NOT NULL DEFAULT 'pending',
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.agent_tasks IS
'Actionable tasks generated by the Manager agent at max_rounds.
priority: "high"|"medium"|"low"  status: "pending"|"in_progress"|"done"';

CREATE INDEX IF NOT EXISTS idx_agent_tasks_discussion
    ON public.agent_tasks (discussion_id, priority);

-- ---------------------------------------------------------------------------
-- 6. system_guidelines  (global rules injected into every agent prompt)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_guidelines (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    content    text        NOT NULL,
    is_active  boolean     NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 7. origo_logic_vault  (additional governance rules, keyed)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.origo_logic_vault (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    key        text        NOT NULL UNIQUE,
    content    text        NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 8. few_shot_templates  (ideal input/output pairs injected into agent prompts)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.few_shot_templates (
    id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_template_id uuid        REFERENCES public.agent_templates(id) ON DELETE CASCADE,
    input_example     text        NOT NULL,
    output_example    text        NOT NULL,
    created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_few_shot_agent
    ON public.few_shot_templates (agent_template_id);

-- ---------------------------------------------------------------------------
-- 9. shared_insights  (extracted learnings stored for future sessions)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shared_insights (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    discussion_id uuid        REFERENCES public.discussion_state(id) ON DELETE CASCADE,
    content       text        NOT NULL,
    tags          text[]      NOT NULL DEFAULT '{}',
    created_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 10. knowledge_base  (cross-session knowledge for future injections)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.knowledge_base (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    title      text        NOT NULL,
    content    text        NOT NULL,
    tags       text[]      NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 11. Seed — "Zasterix Dashboard" session
--     Manager Alpha (engine_type = manager) + Specialist 3
--     Status: max_rounds reached, ready to populate agent_tasks
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    manager_alpha_id   uuid;
    specialist_3_id    uuid;
    dashboard_state_id uuid := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
BEGIN
    -- Upsert Manager Alpha
    INSERT INTO public.agent_templates (name, description, system_prompt, engine_type, ai_model_config)
    VALUES (
        'Manager Alpha',
        'Origo Manager Agent — orchestrates discussion rounds and generates agent_tasks.',
        'You are Manager Alpha, the orchestrating manager agent in the Origo system. '
        'Your role is to: 1) Guide the discussion toward concrete outcomes, '
        '2) Ensure specialists stay on-task, '
        '3) After max_rounds, synthesize the discussion into actionable tasks with clear priorities. '
        'Be decisive, concise, and outcome-oriented.',
        'manager',
        '{"provider":"groq","model":"llama3-70b-8192","temperature":0.3}'::jsonb
    )
    ON CONFLICT (name) DO UPDATE
        SET engine_type    = 'manager',
            ai_model_config = EXCLUDED.ai_model_config
    RETURNING id INTO manager_alpha_id;

    IF manager_alpha_id IS NULL THEN
        SELECT id INTO manager_alpha_id
        FROM public.agent_templates WHERE name = 'Manager Alpha';
    END IF;

    -- Upsert Specialist 3
    INSERT INTO public.agent_templates (name, description, system_prompt, engine_type, ai_model_config)
    VALUES (
        'Specialist 3',
        'Origo Specialist Agent — generates requirements schemas and technical specifications.',
        'You are Specialist 3, a technical requirements specialist in the Origo system. '
        'Your role is to: 1) Analyze project briefs and extract structured requirements, '
        '2) Produce clear schema definitions for features, APIs, and data models, '
        '3) Flag ambiguities and propose solutions. '
        'Be precise, technical, and structured in your outputs.',
        'specialist',
        '{"provider":"groq","model":"llama3-70b-8192","temperature":0.2}'::jsonb
    )
    ON CONFLICT (name) DO UPDATE
        SET engine_type    = 'specialist',
            ai_model_config = EXCLUDED.ai_model_config
    RETURNING id INTO specialist_3_id;

    IF specialist_3_id IS NULL THEN
        SELECT id INTO specialist_3_id
        FROM public.agent_templates WHERE name = 'Specialist 3';
    END IF;

    -- Create Zasterix Dashboard discussion session
    -- max_rounds already reached → status = 'active' so /api/agent-loop can
    -- pick it up and finalize with agent_tasks on the next POST.
    INSERT INTO public.discussion_state (
        id, current_turn_index, current_round, max_rounds, status
    )
    VALUES (
        dashboard_state_id,
        6,   -- 2 participants × 3 rounds = 6 turns completed
        3,   -- current_round = max_rounds → triggers task generation
        3,
        'active'
    )
    ON CONFLICT (id) DO NOTHING;

    -- Register participants
    INSERT INTO public.discussion_participants (discussion_id, agent_template_id, sequence_order)
    VALUES
        (dashboard_state_id, manager_alpha_id,  0),
        (dashboard_state_id, specialist_3_id,   1)
    ON CONFLICT (discussion_id, agent_template_id) DO NOTHING;

    -- Seed minimal discussion history (represents completed rounds)
    INSERT INTO public.discussion_logs
        (discussion_id, agent_id, speaker_name, turn_index, content, message_type)
    VALUES
        (dashboard_state_id, NULL,             'User',         0,
         'Project brief: Build the Zasterix Dashboard — a real-time investment monitoring UI.',
         'human'),
        (dashboard_state_id, manager_alpha_id, 'Manager Alpha', 1,
         'Understood. I will guide Specialist 3 through the requirements for the dashboard.',
         'agent'),
        (dashboard_state_id, specialist_3_id,  'Specialist 3',  2,
         'Requirements schema generated: authentication, portfolio view, real-time feed, alerts module.',
         'agent'),
        (dashboard_state_id, manager_alpha_id, 'Manager Alpha', 3,
         'Good. Elaborate on the real-time feed data model and latency targets.',
         'agent'),
        (dashboard_state_id, specialist_3_id,  'Specialist 3',  4,
         'Real-time feed: WebSocket connection, 500ms update interval, OHLCV data structure, Redis cache.',
         'agent'),
        (dashboard_state_id, manager_alpha_id, 'Manager Alpha', 5,
         'Confirmed. All specialist inputs received. Proceeding to task generation.',
         'agent')
    ON CONFLICT DO NOTHING;

    -- Seed a system guideline
    INSERT INTO public.system_guidelines (content, is_active)
    VALUES (
        'All agents must produce concise, actionable outputs. '
        'Max 3-4 sentences per turn. Stay focused on the project objective. '
        'Never repeat what a previous agent already said.',
        true
    )
    ON CONFLICT DO NOTHING;

END $$;
