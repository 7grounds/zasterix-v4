CREATE TABLE IF NOT EXISTS public.projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
    name text NOT NULL,
    type text NOT NULL DEFAULT 'discussion',
    status text NOT NULL DEFAULT 'active',
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    current_discussion_step integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS name text,
ADD COLUMN IF NOT EXISTS type text,
ADD COLUMN IF NOT EXISTS status text,
ADD COLUMN IF NOT EXISTS metadata jsonb,
ADD COLUMN IF NOT EXISTS current_discussion_step integer,
ADD COLUMN IF NOT EXISTS created_at timestamptz,
ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE public.projects
SET
    name = COALESCE(name, 'Discussion Project'),
    type = COALESCE(type, 'discussion'),
    status = COALESCE(status, 'active'),
    metadata = COALESCE(metadata, '{}'::jsonb),
    current_discussion_step = COALESCE(current_discussion_step, 0),
    created_at = COALESCE(created_at, now()),
    updated_at = COALESCE(updated_at, now());

ALTER TABLE public.projects
ALTER COLUMN name SET NOT NULL,
ALTER COLUMN type SET NOT NULL,
ALTER COLUMN status SET NOT NULL,
ALTER COLUMN metadata SET NOT NULL,
ALTER COLUMN current_discussion_step SET NOT NULL,
ALTER COLUMN created_at SET NOT NULL,
ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE public.projects
ALTER COLUMN type SET DEFAULT 'discussion',
ALTER COLUMN status SET DEFAULT 'active',
ALTER COLUMN metadata SET DEFAULT '{}'::jsonb,
ALTER COLUMN current_discussion_step SET DEFAULT 0,
ALTER COLUMN created_at SET DEFAULT now(),
ALTER COLUMN updated_at SET DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_projects_org_type_status
ON public.projects (organization_id, type, status);

CREATE INDEX IF NOT EXISTS idx_universal_history_project_payload
ON public.universal_history ((payload->>'project_id'));

DO $$
DECLARE
    zasterix_org_id uuid := NULL;
    discussion_blueprint_id uuid;
    manager_template_id uuid;
    groq_config jsonb := '{"provider":"groq","model":"llama-3.1-8b-instant","temperature":0.2}'::jsonb;
    default_validation jsonb := '["transfer-check","case-application","reflection-check","mini-quiz"]'::jsonb;
    discussion_project_id uuid := '6e44f3ea-7d88-4fc8-b0ea-a1f41a7ec8df';
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.organizations
        WHERE id = '17b2f0fe-f89d-47b1-9fd4-aafe1a327388'
    ) THEN
        zasterix_org_id := '17b2f0fe-f89d-47b1-9fd4-aafe1a327388';
    ELSE
        SELECT id
        INTO zasterix_org_id
        FROM public.organizations
        WHERE slug = 'zasterix'
        ORDER BY created_at
        LIMIT 1;
    END IF;

    INSERT INTO public.agent_blueprints (name, logic_template, ai_model_config, validation_library)
    VALUES (
        'Tourismus Berner Oberland',
        jsonb_build_object(
            'domain', 'tourismus-berner-oberland',
            'differentiation_keywords', '["alpin-authenticity","b2b-hospitality"]'::jsonb
        ),
        groq_config,
        default_validation
    )
    ON CONFLICT (name) DO UPDATE
    SET logic_template = jsonb_set(
            COALESCE(public.agent_blueprints.logic_template, '{}'::jsonb),
            '{differentiation_keywords}',
            '["alpin-authenticity","b2b-hospitality"]'::jsonb,
            true
        )
    RETURNING id INTO discussion_blueprint_id;

    UPDATE public.agent_templates
    SET
        description = 'Diskussions-Manager fuer Tourismus Berner Oberland.',
        level = 3,
        system_prompt = 'Du bist Manager L3. Fuehre datengetriebene Diskussionen, halte Regeln strikt ein und fasse Ergebnisse kurz zusammen.',
        category = 'Discussion',
        icon = 'manager',
        search_keywords = ARRAY['discussion', 'manager-l3', 'tourismus-bo'],
        parent_template_id = discussion_blueprint_id,
        produced_by = 'migration:discussion-round'
    WHERE name = 'Manager L3'
      AND organization_id IS NOT DISTINCT FROM zasterix_org_id
    RETURNING id INTO manager_template_id;

    IF manager_template_id IS NULL THEN
        INSERT INTO public.agent_templates (
            name,
            description,
            level,
            system_prompt,
            organization_id,
            category,
            icon,
            search_keywords,
            parent_template_id,
            ai_model_config,
            produced_by
        )
        VALUES (
            'Manager L3',
            'Diskussions-Manager fuer Tourismus Berner Oberland.',
            3,
            'Du bist Manager L3. Fuehre datengetriebene Diskussionen, halte Regeln strikt ein und fasse Ergebnisse kurz zusammen.',
            zasterix_org_id,
            'Discussion',
            'manager',
            ARRAY['discussion', 'manager-l3', 'tourismus-bo'],
            discussion_blueprint_id,
            groq_config,
            'migration:discussion-round'
        )
        RETURNING id INTO manager_template_id;
    END IF;

    UPDATE public.agent_templates
    SET
        description = 'Spezialist fuer Hotel-Betriebslogik und B2B-Hospitality.',
        level = 2,
        system_prompt = 'Du bist Hotel Expert L2. Liefere taktische Perspektiven fuer Hotelbetrieb, Partnerprozesse und B2B-Hospitality.',
        category = 'Discussion',
        icon = 'hotel',
        search_keywords = ARRAY['discussion', 'hotel-expert-l2', 'b2b-hospitality'],
        parent_template_id = discussion_blueprint_id,
        ai_model_config = groq_config,
        produced_by = 'migration:discussion-round'
    WHERE name = 'Hotel Expert L2'
      AND organization_id IS NOT DISTINCT FROM zasterix_org_id;

    IF NOT FOUND THEN
        INSERT INTO public.agent_templates (
            name,
            description,
            level,
            system_prompt,
            organization_id,
            category,
            icon,
            search_keywords,
            parent_template_id,
            ai_model_config,
            produced_by
        )
        VALUES (
            'Hotel Expert L2',
            'Spezialist fuer Hotel-Betriebslogik und B2B-Hospitality.',
            2,
            'Du bist Hotel Expert L2. Liefere taktische Perspektiven fuer Hotelbetrieb, Partnerprozesse und B2B-Hospitality.',
            zasterix_org_id,
            'Discussion',
            'hotel',
            ARRAY['discussion', 'hotel-expert-l2', 'b2b-hospitality'],
            discussion_blueprint_id,
            groq_config,
            'migration:discussion-round'
        );
    END IF;

    UPDATE public.agent_templates
    SET
        description = 'Spezialist fuer alpine Guide-Expertise.',
        level = 2,
        system_prompt = 'Du bist Guide Expert L2. Gib praxisnahe alpine Guide- und Erlebnisempfehlungen mit Fokus auf Umsetzbarkeit.',
        category = 'Discussion',
        icon = 'guide',
        search_keywords = ARRAY['discussion', 'guide-expert-l2', 'alpin-authenticity'],
        parent_template_id = discussion_blueprint_id,
        ai_model_config = groq_config,
        produced_by = 'migration:discussion-round'
    WHERE name = 'Guide Expert L2'
      AND organization_id IS NOT DISTINCT FROM zasterix_org_id;

    IF NOT FOUND THEN
        INSERT INTO public.agent_templates (
            name,
            description,
            level,
            system_prompt,
            organization_id,
            category,
            icon,
            search_keywords,
            parent_template_id,
            ai_model_config,
            produced_by
        )
        VALUES (
            'Guide Expert L2',
            'Spezialist fuer alpine Guide-Expertise.',
            2,
            'Du bist Guide Expert L2. Gib praxisnahe alpine Guide- und Erlebnisempfehlungen mit Fokus auf Umsetzbarkeit.',
            zasterix_org_id,
            'Discussion',
            'guide',
            ARRAY['discussion', 'guide-expert-l2', 'alpin-authenticity'],
            discussion_blueprint_id,
            groq_config,
            'migration:discussion-round'
        );
    END IF;

    UPDATE public.agent_templates
    SET
        description = 'Spezialist fuer regionale Tourismusstrategie im Berner Oberland.',
        level = 2,
        system_prompt = 'Du bist Tourismus Expert L2. Priorisiere regionale Wirkung, Nachfragehebel und skalierbare Tourismusstrategien.',
        category = 'Discussion',
        icon = 'tourism',
        search_keywords = ARRAY['discussion', 'tourismus-expert-l2', 'destination-strategy'],
        parent_template_id = discussion_blueprint_id,
        ai_model_config = groq_config,
        produced_by = 'migration:discussion-round'
    WHERE name = 'Tourismus Expert L2'
      AND organization_id IS NOT DISTINCT FROM zasterix_org_id;

    IF NOT FOUND THEN
        INSERT INTO public.agent_templates (
            name,
            description,
            level,
            system_prompt,
            organization_id,
            category,
            icon,
            search_keywords,
            parent_template_id,
            ai_model_config,
            produced_by
        )
        VALUES (
            'Tourismus Expert L2',
            'Spezialist fuer regionale Tourismusstrategie im Berner Oberland.',
            2,
            'Du bist Tourismus Expert L2. Priorisiere regionale Wirkung, Nachfragehebel und skalierbare Tourismusstrategien.',
            zasterix_org_id,
            'Discussion',
            'tourism',
            ARRAY['discussion', 'tourismus-expert-l2', 'destination-strategy'],
            discussion_blueprint_id,
            groq_config,
            'migration:discussion-round'
        );
    END IF;

    INSERT INTO public.projects (
        id,
        organization_id,
        name,
        type,
        status,
        metadata,
        current_discussion_step
    )
    VALUES (
        discussion_project_id,
        zasterix_org_id,
        'Tourismus Berner Oberland Diskussion',
        'discussion',
        'active',
        jsonb_build_object(
            'rules',
            jsonb_build_array(
                'Fokus auf Umsetzung in 90 Tagen.',
                'Jeder Beitrag muss eine klare taktische Prioritaet enthalten.',
                'Jeder Agent darf maximal 3 Zeilen schreiben.'
            ),
            'speaker_order',
            jsonb_build_array(
                'manager_l3',
                'hotel_expert_l2',
                'guide_expert_l2',
                'tourismus_expert_l2',
                'user'
            ),
            'agent_names',
            jsonb_build_object(
                'manager_l3', 'Manager L3',
                'hotel_expert_l2', 'Hotel Expert L2',
                'guide_expert_l2', 'Guide Expert L2',
                'tourismus_expert_l2', 'Tourismus Expert L2'
            )
        ),
        0
    )
    ON CONFLICT (id) DO UPDATE
    SET
        organization_id = EXCLUDED.organization_id,
        name = EXCLUDED.name,
        type = EXCLUDED.type,
        status = 'active',
        metadata = EXCLUDED.metadata,
        current_discussion_step = 0,
        updated_at = now();
END
$$;
