-- Create discussion_logs table for storing multi-agent discussion messages
CREATE TABLE IF NOT EXISTS public.discussion_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
    agent_id uuid REFERENCES public.agent_templates(id) ON DELETE SET NULL,
    speaker_name text NOT NULL,
    content text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_discussion_logs_project_id
ON public.discussion_logs (project_id);

CREATE INDEX IF NOT EXISTS idx_discussion_logs_created_at
ON public.discussion_logs (created_at);

CREATE INDEX IF NOT EXISTS idx_discussion_logs_project_created
ON public.discussion_logs (project_id, created_at);

-- Add RLS policies
ALTER TABLE public.discussion_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read discussion logs from their organization's projects
CREATE POLICY discussion_logs_select_policy
ON public.discussion_logs
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.projects p
        LEFT JOIN public.profiles prof ON prof.organization_id = p.organization_id
        WHERE p.id = discussion_logs.project_id
        AND (
            prof.id = auth.uid()
            OR p.organization_id IS NULL
        )
    )
);

-- Policy: Authenticated users can insert discussion logs
CREATE POLICY discussion_logs_insert_policy
ON public.discussion_logs
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Add comment
COMMENT ON TABLE public.discussion_logs IS 'Stores individual messages from multi-agent discussion sessions';
