CREATE TABLE IF NOT EXISTS public.agent_blueprints (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    logic_template text NOT NULL DEFAULT '',
    ai_model_config jsonb NOT NULL DEFAULT '{"provider":"groq","model":"llama-3.1-8b-instant"}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_templates
ADD COLUMN IF NOT EXISTS parent_template_id uuid,
ADD COLUMN IF NOT EXISTS ai_model_config jsonb;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'agent_templates_parent_template_id_fkey'
    ) THEN
        ALTER TABLE public.agent_templates
        ADD CONSTRAINT agent_templates_parent_template_id_fkey
        FOREIGN KEY (parent_template_id)
        REFERENCES public.agent_blueprints(id)
        ON DELETE SET NULL;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_agent_templates_parent_template
ON public.agent_templates (parent_template_id);

COMMENT ON TABLE public.agent_blueprints IS
'Reusable teaching blueprints with pedagogical logic and model config.';

COMMENT ON COLUMN public.agent_blueprints.logic_template IS
'Pedagogical rule set merged into agent prompt at runtime.';
