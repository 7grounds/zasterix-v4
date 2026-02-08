-- Enable RLS and allow anon reads for universal_history
ALTER TABLE public.universal_history ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON TABLE public.universal_history TO anon;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'universal_history'
      AND policyname = 'anon_read_universal_history'
  ) THEN
    CREATE POLICY anon_read_universal_history
      ON public.universal_history
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END
$$;

-- Seed entries for the Vault feed
INSERT INTO public.universal_history (payload, created_at)
VALUES
  (
    '{"type":"management_log","agent_name":"System","summary":"System Initialized","details":"Bootstrap completed for Zasterix Vault."}'::jsonb,
    now()
  ),
  (
    '{"type":"management_log","agent_name":"Resource-Controller","summary":"Portfolio Connection Stable","details":"Realtime sync operational."}'::jsonb,
    now()
  ),
  (
    '{"type":"management_log","agent_name":"Registrar","summary":"Zasterix Vault Active","details":"Boardroom feed is live and logging."}'::jsonb,
    now()
  );
