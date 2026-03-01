
-- Helper to check if a cron job exists (callable via RPC from edge functions)
CREATE OR REPLACE FUNCTION public.check_cron_job_exists(p_job_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM cron.job WHERE jobname = p_job_name AND active = true) INTO v_exists;
  RETURN v_exists;
END;
$$;
