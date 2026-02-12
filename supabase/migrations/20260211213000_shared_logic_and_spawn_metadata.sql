CREATE TABLE IF NOT EXISTS public.shared_logic (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
    logic_key text NOT NULL,
    logic_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organization_id, logic_key)
);

CREATE INDEX IF NOT EXISTS idx_shared_logic_org_key
ON public.shared_logic (organization_id, logic_key);

CREATE INDEX IF NOT EXISTS idx_shared_logic_active
ON public.shared_logic (is_active);

ALTER TABLE public.agent_templates
ADD COLUMN IF NOT EXISTS shared_logic_id uuid REFERENCES public.shared_logic(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS spawn_metadata jsonb,
ADD COLUMN IF NOT EXISTS produced_by text;

COMMENT ON TABLE public.shared_logic IS
'Company-wide shared standards consumed by produced Zasterix agents.';

COMMENT ON COLUMN public.agent_templates.shared_logic_id IS
'Reference to shared logic profile used by this generated agent.';

COMMENT ON COLUMN public.agent_templates.spawn_metadata IS
'Metadata about L3 spawn source, discipline and insight trace.';
