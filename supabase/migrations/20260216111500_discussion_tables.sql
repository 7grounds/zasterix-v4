-- Create discussion_participants table
CREATE TABLE IF NOT EXISTS public.discussion_participants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    agent_id uuid NOT NULL REFERENCES public.agent_templates(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('manager', 'leader', 'user', 'specialist')),
    sequence_order integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(project_id, agent_id),
    UNIQUE(project_id, sequence_order)
);

CREATE INDEX IF NOT EXISTS idx_discussion_participants_project
ON public.discussion_participants (project_id, sequence_order);

-- Create discussion_state table
CREATE TABLE IF NOT EXISTS public.discussion_state (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
    current_turn_index integer NOT NULL DEFAULT 0,
    current_round integer NOT NULL DEFAULT 1,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discussion_state_project
ON public.discussion_state (project_id);

-- Create discussion_logs table
CREATE TABLE IF NOT EXISTS public.discussion_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    agent_id uuid REFERENCES public.agent_templates(id) ON DELETE SET NULL,
    role text NOT NULL CHECK (role IN ('manager', 'leader', 'user', 'specialist')),
    content text NOT NULL,
    turn_index integer NOT NULL,
    round_number integer NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discussion_logs_project_order
ON public.discussion_logs (project_id, round_number, turn_index, created_at);

CREATE INDEX IF NOT EXISTS idx_discussion_logs_agent
ON public.discussion_logs (agent_id);

-- Add RLS policies for discussion tables
ALTER TABLE public.discussion_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discussion_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discussion_logs ENABLE ROW LEVEL SECURITY;

-- Policies for discussion_participants
CREATE POLICY "Users can view discussion participants in their org"
ON public.discussion_participants FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = discussion_participants.project_id
        AND (
            projects.organization_id = (auth.jwt()->>'organization_id')::uuid
            OR projects.organization_id IS NULL
        )
    )
);

CREATE POLICY "Service role can manage discussion participants"
ON public.discussion_participants FOR ALL
USING (auth.role() = 'service_role');

-- Policies for discussion_state
CREATE POLICY "Users can view discussion state in their org"
ON public.discussion_state FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = discussion_state.project_id
        AND (
            projects.organization_id = (auth.jwt()->>'organization_id')::uuid
            OR projects.organization_id IS NULL
        )
    )
);

CREATE POLICY "Service role can manage discussion state"
ON public.discussion_state FOR ALL
USING (auth.role() = 'service_role');

-- Policies for discussion_logs
CREATE POLICY "Users can view discussion logs in their org"
ON public.discussion_logs FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.projects
        WHERE projects.id = discussion_logs.project_id
        AND (
            projects.organization_id = (auth.jwt()->>'organization_id')::uuid
            OR projects.organization_id IS NULL
        )
    )
);

CREATE POLICY "Service role can manage discussion logs"
ON public.discussion_logs FOR ALL
USING (auth.role() = 'service_role');
