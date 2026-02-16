
ALTER TABLE public.cron_runs
  ADD COLUMN IF NOT EXISTS started_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS finished_at timestamp with time zone;
