
-- Translation budget tracking table
CREATE TABLE public.translation_usage (
  day_utc DATE NOT NULL PRIMARY KEY DEFAULT CURRENT_DATE,
  items_used INTEGER NOT NULL DEFAULT 0,
  chars_used INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: service-role only
ALTER TABLE public.translation_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only"
  ON public.translation_usage
  FOR ALL
  USING (false);

-- Admin read access
CREATE POLICY "Admins can view translation usage"
  ON public.translation_usage
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));
