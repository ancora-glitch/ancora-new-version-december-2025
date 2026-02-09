
-- Create retry jobs table for rate-limited Tradera imports
CREATE TABLE public.tradera_retry_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_ref TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'tradera',
  status TEXT NOT NULL DEFAULT 'pending',
  retry_after TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '1 hour'),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 8,
  last_error TEXT,
  -- Store the search item payload so we can create the AIS item on success
  item_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT unique_retry_source UNIQUE (source_ref, source_type)
);

-- Enable RLS
ALTER TABLE public.tradera_retry_jobs ENABLE ROW LEVEL SECURITY;

-- Service role only (edge functions use service role key)
CREATE POLICY "Service role only" ON public.tradera_retry_jobs
  FOR ALL USING (false);

-- Admins can view retry jobs for observability
CREATE POLICY "Admins can view retry jobs" ON public.tradera_retry_jobs
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Index for efficient polling of pending jobs
CREATE INDEX idx_retry_jobs_pending ON public.tradera_retry_jobs (status, retry_after)
  WHERE status = 'pending';

-- Trigger for updated_at
CREATE TRIGGER update_tradera_retry_jobs_updated_at
  BEFORE UPDATE ON public.tradera_retry_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
