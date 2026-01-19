-- Create site_analytics table for tracking page views and clicks
CREATE TABLE public.site_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL CHECK (event_type IN ('page_view', 'click')),
  page_path text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.site_analytics ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert analytics events (for tracking)
CREATE POLICY "Anyone can insert analytics events"
ON public.site_analytics
FOR INSERT
WITH CHECK (true);

-- Only admins can view analytics data
CREATE POLICY "Only admins can view analytics"
ON public.site_analytics
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete analytics data
CREATE POLICY "Only admins can delete analytics"
ON public.site_analytics
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster queries
CREATE INDEX idx_site_analytics_event_type ON public.site_analytics(event_type);
CREATE INDEX idx_site_analytics_page_path ON public.site_analytics(page_path);
CREATE INDEX idx_site_analytics_created_at ON public.site_analytics(created_at DESC);