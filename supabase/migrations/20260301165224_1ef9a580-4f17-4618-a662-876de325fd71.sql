
-- Replace setup_cron_vault to embed key directly in cron commands
-- (vault.secrets requires pgsodium permissions not available)
CREATE OR REPLACE FUNCTION public.setup_cron_vault(p_service_key text, p_supabase_url text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Unschedule existing jobs
  BEGIN PERFORM cron.unschedule('tradera-sync-job'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('tradera-retry-import-job'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('ebay-availability-job'); EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Re-register with key embedded directly in the command
  PERFORM cron.schedule(
    'tradera-sync-job',
    '0 */2 * * *',
    format(
      $cmd$SELECT net.http_post(
        url := '%s/functions/v1/tradera-sync',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer %s"}'::jsonb,
        body := '{}'::jsonb
      ) AS request_id;$cmd$,
      p_supabase_url, p_service_key
    )
  );

  PERFORM cron.schedule(
    'tradera-retry-import-job',
    '*/30 * * * *',
    format(
      $cmd$SELECT net.http_post(
        url := '%s/functions/v1/tradera-retry-import',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer %s"}'::jsonb,
        body := '{}'::jsonb
      ) AS request_id;$cmd$,
      p_supabase_url, p_service_key
    )
  );

  PERFORM cron.schedule(
    'ebay-availability-job',
    '0 */2 * * *',
    format(
      $cmd$SELECT net.http_post(
        url := '%s/functions/v1/ebay-availability',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer %s"}'::jsonb,
        body := '{}'::jsonb
      ) AS request_id;$cmd$,
      p_supabase_url, p_service_key
    )
  );

  RETURN jsonb_build_object('status', 'ok', 'message', 'Cron jobs re-registered with embedded auth key');
END;
$$;
