-- Add visitor_id column to site_analytics for unique visitor tracking
ALTER TABLE public.site_analytics 
ADD COLUMN IF NOT EXISTS visitor_id text;