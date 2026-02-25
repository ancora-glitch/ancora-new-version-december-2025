
-- 1. Create cron_job_state table for round-robin cursor tracking
CREATE TABLE public.cron_job_state (
  job_name TEXT PRIMARY KEY,
  cursor_value INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cron_job_state ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write (edge functions use service key)
CREATE POLICY "Service role only" ON public.cron_job_state FOR ALL USING (false);

-- Admins can view state
CREATE POLICY "Admins can view cron job state" ON public.cron_job_state FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed initial state
INSERT INTO public.cron_job_state (job_name, cursor_value) VALUES
  ('tradera_sync', 0),
  ('ebay_availability', 0);

-- 2. Add batch telemetry columns to cron_runs
ALTER TABLE public.cron_runs
  ADD COLUMN IF NOT EXISTS batch_size INTEGER,
  ADD COLUMN IF NOT EXISTS cursor_before INTEGER,
  ADD COLUMN IF NOT EXISTS cursor_after INTEGER;
