
ALTER TABLE public.cron_runs
  ADD COLUMN duration_ms integer,
  ADD COLUMN items_processed integer,
  ADD COLUMN checked_count integer,
  ADD COLUMN sold_marked integer;
