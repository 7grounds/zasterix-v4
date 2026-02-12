ALTER TABLE public.agent_blueprints
ADD COLUMN IF NOT EXISTS validation_library jsonb NOT NULL DEFAULT '["transfer-check","case-application","reflection-check","mini-quiz"]'::jsonb;

COMMENT ON COLUMN public.agent_blueprints.validation_library IS
'Validation strategy options used to gate module unlocks in user_progress.';

UPDATE public.agent_blueprints
SET validation_library = '["transfer-check","case-application","reflection-check","mini-quiz"]'::jsonb
WHERE id = 'edb53205-a3d0-47ba-a921-df7b768b22c6'
  AND (
    validation_library IS NULL
    OR jsonb_typeof(validation_library) <> 'array'
    OR jsonb_array_length(validation_library) = 0
  );
