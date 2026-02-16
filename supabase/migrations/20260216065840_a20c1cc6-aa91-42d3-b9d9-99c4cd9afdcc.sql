
-- Cron run log table
CREATE TABLE public.cron_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  ran_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'success',
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for fast "latest per job" query
CREATE INDEX idx_cron_runs_job_ran ON public.cron_runs (job_name, ran_at DESC);

-- RLS
ALTER TABLE public.cron_runs ENABLE ROW LEVEL SECURITY;

-- Admin read-only
CREATE POLICY "Admins can view cron runs"
  ON public.cron_runs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role can insert (edge functions use service client)
CREATE POLICY "Service role only write"
  ON public.cron_runs FOR ALL
  USING (false);
