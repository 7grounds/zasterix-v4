ALTER TABLE public.agent_templates
ADD COLUMN IF NOT EXISTS level integer;

UPDATE public.agent_templates
SET level = 0
WHERE level IS NULL;

ALTER TABLE public.agent_templates
ALTER COLUMN level SET DEFAULT 0;

ALTER TABLE public.agent_templates
ALTER COLUMN level SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_templates_level
ON public.agent_templates (level);

WITH ranked_names AS (
  SELECT
    id,
    name,
    row_number() OVER (PARTITION BY name ORDER BY created_at, id) AS row_num
  FROM public.agent_blueprints
)
UPDATE public.agent_blueprints AS blueprints
SET name = blueprints.name || ' #' || (ranked_names.row_num - 1)::text
FROM ranked_names
WHERE blueprints.id = ranked_names.id
  AND ranked_names.row_num > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_blueprints_name_unique
ON public.agent_blueprints (name);

DO $$
DECLARE
  zasterix_org_id uuid := NULL;
  tourism_blueprint_id uuid;
  default_model_config jsonb := '{"provider":"groq","model":"llama-3.1-8b-instant","temperature":0.2}'::jsonb;
  default_validation_library jsonb := '["transfer-check","case-application","reflection-check","mini-quiz"]'::jsonb;
  differentiation_keywords jsonb := '["alpin-authenticity","b2b-hospitality"]'::jsonb;
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

  INSERT INTO public.agent_blueprints (
    name,
    logic_template,
    ai_model_config,
    validation_library
  )
  VALUES (
    'Tourismus Berner Oberland',
    jsonb_build_object(
      'domain', 'tourismus-berner-oberland',
      'differentiation_keywords', differentiation_keywords
    ),
    default_model_config,
    default_validation_library
  )
  ON CONFLICT (name) DO UPDATE
  SET logic_template = jsonb_set(
      COALESCE(public.agent_blueprints.logic_template, '{}'::jsonb) || jsonb_build_object('domain', 'tourismus-berner-oberland'),
      '{differentiation_keywords}',
      differentiation_keywords,
      true
    ),
    ai_model_config = COALESCE(public.agent_blueprints.ai_model_config, EXCLUDED.ai_model_config),
    validation_library = COALESCE(public.agent_blueprints.validation_library, EXCLUDED.validation_library)
  RETURNING id INTO tourism_blueprint_id;

  UPDATE public.agent_templates
  SET
    description = 'L3 Management-Agent fuer strategische Prioritaeten im Tourismus Berner Oberland.',
    level = 3,
    system_prompt = 'Du bist der Zasterix Manager (L3) fuer Tourismus Berner Oberland. Priorisiere klare Management-Entscheidungen und B2B-Hospitality.',
    category = 'Management',
    icon = 'compass',
    search_keywords = ARRAY['tourismus-bo', 'management', 'alpin-authenticity', 'b2b-hospitality'],
    parent_template_id = tourism_blueprint_id,
    ai_model_config = default_model_config,
    produced_by = 'migration:tourismus-berner-oberland'
  WHERE name = 'Zasterix Manager (L3)'
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
      'Zasterix Manager (L3)',
      'L3 Management-Agent fuer strategische Prioritaeten im Tourismus Berner Oberland.',
      3,
      'Du bist der Zasterix Manager (L3) fuer Tourismus Berner Oberland. Priorisiere klare Management-Entscheidungen und B2B-Hospitality.',
      zasterix_org_id,
      'Management',
      'compass',
      ARRAY['tourismus-bo', 'management', 'alpin-authenticity', 'b2b-hospitality'],
      tourism_blueprint_id,
      default_model_config,
      'migration:tourismus-berner-oberland'
    );
  END IF;

  UPDATE public.agent_templates
  SET
    description = 'L2 Agent fuer Erlebnisdesign und Angebotskuratierung im Berner Oberland.',
    level = 2,
    system_prompt = 'Du bist Experience Curator BO (L2). Entwirf alpine, authentische Erlebnisse mit klarer Positionierung.',
    category = 'Experience',
    icon = 'mountain',
    search_keywords = ARRAY['tourismus-bo', 'experience-curation', 'alpin-authenticity', 'guest-journey'],
    parent_template_id = tourism_blueprint_id,
    ai_model_config = default_model_config,
    produced_by = 'migration:tourismus-berner-oberland'
  WHERE name = 'Experience Curator BO (L2)'
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
      'Experience Curator BO (L2)',
      'L2 Agent fuer Erlebnisdesign und Angebotskuratierung im Berner Oberland.',
      2,
      'Du bist Experience Curator BO (L2). Entwirf alpine, authentische Erlebnisse mit klarer Positionierung.',
      zasterix_org_id,
      'Experience',
      'mountain',
      ARRAY['tourismus-bo', 'experience-curation', 'alpin-authenticity', 'guest-journey'],
      tourism_blueprint_id,
      default_model_config,
      'migration:tourismus-berner-oberland'
    );
  END IF;

  UPDATE public.agent_templates
  SET
    description = 'L2 Integrations-Agent fuer Hotelnetzwerke, Partner und B2B-Hospitality-Orchestrierung.',
    level = 2,
    system_prompt = 'Du bist Hotel-Hub-Integrator (L2). Verbinde Hotels, Partner und Prozesse fuer ein stabiles B2B-Hospitality-Setup.',
    category = 'Hospitality',
    icon = 'hotel',
    search_keywords = ARRAY['tourismus-bo', 'hotel-integration', 'b2b-hospitality', 'partner-sync'],
    parent_template_id = tourism_blueprint_id,
    ai_model_config = default_model_config,
    produced_by = 'migration:tourismus-berner-oberland'
  WHERE name = 'Hotel-Hub-Integrator (L2)'
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
      'Hotel-Hub-Integrator (L2)',
      'L2 Integrations-Agent fuer Hotelnetzwerke, Partner und B2B-Hospitality-Orchestrierung.',
      2,
      'Du bist Hotel-Hub-Integrator (L2). Verbinde Hotels, Partner und Prozesse fuer ein stabiles B2B-Hospitality-Setup.',
      zasterix_org_id,
      'Hospitality',
      'hotel',
      ARRAY['tourismus-bo', 'hotel-integration', 'b2b-hospitality', 'partner-sync'],
      tourism_blueprint_id,
      default_model_config,
      'migration:tourismus-berner-oberland'
    );
  END IF;
END
$$;
