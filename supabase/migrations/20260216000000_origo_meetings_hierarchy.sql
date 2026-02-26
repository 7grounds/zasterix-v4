-- Origo Multi-Agent System: Meetings, Hierarchy, and Discussion Logs
-- This migration creates the core tables for the database-driven agent system

-- Table: discussion_logs
-- Stores all agent messages in multi-agent discussions
CREATE TABLE IF NOT EXISTS public.discussion_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
    agent_id uuid REFERENCES public.agent_templates(id) ON DELETE SET NULL,
    speaker_name text NOT NULL,
    content text NOT NULL,
    turn_number integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discussion_logs_project_turn
ON public.discussion_logs (project_id, turn_number DESC);

CREATE INDEX IF NOT EXISTS idx_discussion_logs_project_created
ON public.discussion_logs (project_id, created_at DESC);

-- Table: hierarchy
-- Defines the turn-taking order for agents in a meeting/project
CREATE TABLE IF NOT EXISTS public.hierarchy (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
    agent_id uuid REFERENCES public.agent_templates(id) ON DELETE CASCADE,
    agent_name text NOT NULL,
    turn_order integer NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(project_id, turn_order)
);

CREATE INDEX IF NOT EXISTS idx_hierarchy_project_order
ON public.hierarchy (project_id, turn_order ASC);

-- Table: meetings (alternative view of projects for multi-agent discussions)
-- We'll use projects table but add a view for clarity
CREATE OR REPLACE VIEW public.meetings AS
SELECT 
    id,
    organization_id,
    name,
    type,
    status,
    metadata,
    current_discussion_step as current_turn,
    created_at,
    updated_at
FROM public.projects
WHERE type = 'discussion';

-- Add helpful columns to projects if they don't exist
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS current_turn_agent_id uuid REFERENCES public.agent_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_current_turn_agent
ON public.projects (current_turn_agent_id) WHERE current_turn_agent_id IS NOT NULL;

-- Function to get next agent in hierarchy
CREATE OR REPLACE FUNCTION public.get_next_agent_in_hierarchy(p_project_id uuid, p_current_turn integer)
RETURNS TABLE (
    agent_id uuid,
    agent_name text,
    turn_order integer
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT h.agent_id, h.agent_name, h.turn_order
    FROM public.hierarchy h
    WHERE h.project_id = p_project_id
      AND h.is_active = true
      AND h.turn_order > p_current_turn
    ORDER BY h.turn_order ASC
    LIMIT 1;
    
    -- If no next agent found, loop back to first
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT h.agent_id, h.agent_name, h.turn_order
        FROM public.hierarchy h
        WHERE h.project_id = p_project_id
          AND h.is_active = true
        ORDER BY h.turn_order ASC
        LIMIT 1;
    END IF;
END;
$$;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discussion_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hierarchy TO authenticated;
GRANT SELECT ON public.meetings TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_agent_in_hierarchy TO authenticated;

-- Seed initial hierarchy for the Tourismus Berner Oberland project
DO $$
DECLARE
    discussion_project_id uuid := '6e44f3ea-7d88-4fc8-b0ea-a1f41a7ec8df';
    manager_id uuid;
    hotel_id uuid;
    guide_id uuid;
    tourismus_id uuid;
BEGIN
    -- Get agent IDs
    SELECT id INTO manager_id FROM public.agent_templates WHERE name = 'Manager L3' LIMIT 1;
    SELECT id INTO hotel_id FROM public.agent_templates WHERE name = 'Hotel Expert L2' LIMIT 1;
    SELECT id INTO guide_id FROM public.agent_templates WHERE name = 'Guide Expert L2' LIMIT 1;
    SELECT id INTO tourismus_id FROM public.agent_templates WHERE name = 'Tourismus Expert L2' LIMIT 1;
    
    -- Insert hierarchy if agents exist
    IF manager_id IS NOT NULL THEN
        INSERT INTO public.hierarchy (project_id, agent_id, agent_name, turn_order)
        VALUES (discussion_project_id, manager_id, 'Manager L3', 1)
        ON CONFLICT (project_id, turn_order) DO NOTHING;
    END IF;
    
    IF hotel_id IS NOT NULL THEN
        INSERT INTO public.hierarchy (project_id, agent_id, agent_name, turn_order)
        VALUES (discussion_project_id, hotel_id, 'Hotel Expert L2', 2)
        ON CONFLICT (project_id, turn_order) DO NOTHING;
    END IF;
    
    IF guide_id IS NOT NULL THEN
        INSERT INTO public.hierarchy (project_id, agent_id, agent_name, turn_order)
        VALUES (discussion_project_id, guide_id, 'Guide Expert L2', 3)
        ON CONFLICT (project_id, turn_order) DO NOTHING;
    END IF;
    
    IF tourismus_id IS NOT NULL THEN
        INSERT INTO public.hierarchy (project_id, agent_id, agent_name, turn_order)
        VALUES (discussion_project_id, tourismus_id, 'Tourismus Expert L2', 4)
        ON CONFLICT (project_id, turn_order) DO NOTHING;
    END IF;
END
$$;
