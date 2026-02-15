-- Create discussion_participants table for database-orchestrated agent flow
-- This table tracks who participates in each discussion and their turn order

CREATE TABLE IF NOT EXISTS public.discussion_participants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    agent_id uuid REFERENCES public.agent_templates(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('manager', 'leader', 'specialist', 'user')),
    sequence_order integer NOT NULL,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'completed')),
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (project_id, sequence_order)
);

-- Add turn_index column to discussion_logs for turn tracking
ALTER TABLE public.discussion_logs 
ADD COLUMN IF NOT EXISTS turn_index integer DEFAULT 0;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_discussion_participants_project_id
ON public.discussion_participants (project_id);

CREATE INDEX IF NOT EXISTS idx_discussion_participants_sequence
ON public.discussion_participants (project_id, sequence_order);

CREATE INDEX IF NOT EXISTS idx_discussion_logs_turn_index
ON public.discussion_logs (project_id, turn_index);

-- Add RLS policies for discussion_participants
ALTER TABLE public.discussion_participants ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read participants from their organization's projects
CREATE POLICY discussion_participants_select_policy
ON public.discussion_participants
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.projects p
        LEFT JOIN public.profiles prof ON prof.organization_id = p.organization_id
        WHERE p.id = discussion_participants.project_id
        AND (
            prof.id = auth.uid()
            OR p.organization_id IS NULL
        )
    )
);

-- Policy: Authenticated users can insert participants
CREATE POLICY discussion_participants_insert_policy
ON public.discussion_participants
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Policy: Authenticated users can update participants
CREATE POLICY discussion_participants_update_policy
ON public.discussion_participants
FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_discussion_participants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the update function
CREATE TRIGGER discussion_participants_updated_at
    BEFORE UPDATE ON public.discussion_participants
    FOR EACH ROW
    EXECUTE FUNCTION update_discussion_participants_updated_at();

-- Add comment
COMMENT ON TABLE public.discussion_participants IS 'Tracks agents and their turn order in multi-agent discussions';
COMMENT ON COLUMN public.discussion_participants.sequence_order IS 'Turn order: Manager (0), Leader (1), Specialist A (2), Specialist B (3), User (4)';
COMMENT ON COLUMN public.discussion_participants.turn_index IS 'Used in discussion_logs to track conversation turns, -1 for system messages';
