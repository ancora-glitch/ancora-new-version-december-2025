CREATE OR REPLACE FUNCTION public.setup_cron_vault(p_service_key text, p_supabase_url text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Unschedule existing jobs
  BEGIN PERFORM cron.unschedule('tradera-sync-job'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('tradera-retry-import-job'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM cron.unschedule('ebay-availability-job'); EXCEPTION WHEN OTHERS THEN NULL; END;

  -- tradera-sync: once daily at 03:00 UTC
  PERFORM cron.schedule(
    'tradera-sync-job',
    '0 3 * * *',
    format(
      $cmd$SELECT net.http_post(
        url := '%s/functions/v1/tradera-sync',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer %s"}'::jsonb,
        body := '{}'::jsonb
      ) AS request_id;$cmd$,
      p_supabase_url, p_service_key
    )
  );

  -- tradera-retry-import: every 30 min (quota guard in function)
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

  -- ebay-availability: once daily at 03:15 UTC (staggered from tradera-sync)
  PERFORM cron.schedule(
    'ebay-availability-job',
    '15 3 * * *',
    format(
      $cmd$SELECT net.http_post(
        url := '%s/functions/v1/ebay-availability',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer %s"}'::jsonb,
        body := '{}'::jsonb
      ) AS request_id;$cmd$,
      p_supabase_url, p_service_key
    )
  );

  RETURN jsonb_build_object('status', 'ok', 'message', 'Cron jobs re-registered: tradera-sync daily 03:00, retry every 30m, ebay-availability daily 03:15');
END;
$function$;