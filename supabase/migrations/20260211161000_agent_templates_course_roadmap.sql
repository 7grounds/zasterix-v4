ALTER TABLE public.agent_templates
ADD COLUMN IF NOT EXISTS course_roadmap jsonb;

COMMENT ON COLUMN public.agent_templates.course_roadmap IS
'Roadmap data generated from chat planning responses.';
