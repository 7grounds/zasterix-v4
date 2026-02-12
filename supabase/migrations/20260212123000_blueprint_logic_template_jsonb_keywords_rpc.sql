DO $$
DECLARE
    current_data_type text;
BEGIN
    SELECT data_type
    INTO current_data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agent_blueprints'
      AND column_name = 'logic_template';

    IF current_data_type = 'text' THEN
        ALTER TABLE public.agent_blueprints
        ALTER COLUMN logic_template TYPE jsonb
        USING CASE
            WHEN logic_template IS NULL OR btrim(logic_template) = '' THEN '{}'::jsonb
            ELSE jsonb_build_object('pedagogical_rules', logic_template)
        END;
    END IF;
END
$$;

ALTER TABLE public.agent_blueprints
ALTER COLUMN logic_template SET DEFAULT '{}'::jsonb;

UPDATE public.agent_blueprints
SET logic_template = jsonb_set(
    COALESCE(logic_template, '{}'::jsonb),
    '{differentiation_keywords}',
    COALESCE(logic_template->'differentiation_keywords', '[]'::jsonb),
    true
)
WHERE jsonb_typeof(COALESCE(logic_template, '{}'::jsonb)) = 'object';

CREATE OR REPLACE FUNCTION public.update_agent_blueprint_differentiation_keywords(
    p_keywords jsonb,
    p_blueprint_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.agent_blueprints
    SET logic_template = jsonb_set(
        COALESCE(logic_template, '{}'::jsonb),
        '{differentiation_keywords}',
        COALESCE(p_keywords, '[]'::jsonb),
        true
    )
    WHERE id = p_blueprint_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_agent_blueprint_differentiation_keywords(jsonb, uuid)
TO authenticated, service_role;
