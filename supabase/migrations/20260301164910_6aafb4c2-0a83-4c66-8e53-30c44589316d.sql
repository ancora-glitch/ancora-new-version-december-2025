
-- Function to store service role key in vault and re-register cron jobs
-- to read from vault at runtime (fixing current_setting not working on Lovable Cloud)
CREATE OR REPLACE FUNCTION public.setup_cron_vault(p_service_key text, p_supabase_url text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_existing_id uuid;
BEGIN
  -- 1. Upsert service role key into vault
  SELECT id INTO v_existing_id FROM vault.secrets WHERE name = 'service_role_key' LIMIT 1;
  IF v_existing_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_existing_id;
  END IF;
  INSERT INTO vault.secrets (name, secret) VALUES ('service_role_key', p_service_key);

  -- 2. Unschedule existing jobs (ignore errors if not found)
  BEGIN PERFORM cron.unschedule('tradera-sync-job'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('tradera-retry-import-job'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('ebay-availability-job'); EXCEPTION WHEN OTHERS THEN NULL; END;

  -- 3. Re-register with vault-based auth
  PERFORM cron.schedule(
    'tradera-sync-job',
    '0 */2 * * *',
    format(
      $cmd$SELECT net.http_post(
        url := '%s/functions/v1/tradera-sync',
        headers := format('{"Content-Type": "application/json", "Authorization": "Bearer %%s"}',
          (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'))::jsonb,
        body := '{}'::jsonb
      ) AS request_id;$cmd$,
      p_supabase_url
    )
  );

  PERFORM cron.schedule(
    'tradera-retry-import-job',
    '*/30 * * * *',
    format(
      $cmd$SELECT net.http_post(
        url := '%s/functions/v1/tradera-retry-import',
        headers := format('{"Content-Type": "application/json", "Authorization": "Bearer %%s"}',
          (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'))::jsonb,
        body := '{}'::jsonb
      ) AS request_id;$cmd$,
      p_supabase_url
    )
  );

  PERFORM cron.schedule(
    'ebay-availability-job',
    '0 */2 * * *',
    format(
      $cmd$SELECT net.http_post(
        url := '%s/functions/v1/ebay-availability',
        headers := format('{"Content-Type": "application/json", "Authorization": "Bearer %%s"}',
          (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key'))::jsonb,
        body := '{}'::jsonb
      ) AS request_id;$cmd$,
      p_supabase_url
    )
  );

  RETURN jsonb_build_object('status', 'ok', 'message', 'Vault key stored and cron jobs re-registered');
END;
$$;
