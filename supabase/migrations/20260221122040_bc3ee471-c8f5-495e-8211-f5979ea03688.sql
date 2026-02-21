
-- Create story_views table
CREATE TABLE public.story_views (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  story_id uuid NOT NULL REFERENCES public.style_guides(id) ON DELETE CASCADE,
  viewed_at timestamp with time zone NOT NULL DEFAULT now(),
  ip_hash text,
  user_agent_hash text
);

-- Indexes for performance
CREATE INDEX idx_story_views_story_id ON public.story_views (story_id);
CREATE INDEX idx_story_views_viewed_at ON public.story_views (viewed_at);
CREATE INDEX idx_story_views_antispam ON public.story_views (story_id, ip_hash, viewed_at);

-- RLS
ALTER TABLE public.story_views ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (edge function uses service role, but allow anon insert too)
CREATE POLICY "Service role only write" ON public.story_views FOR ALL USING (false);

-- Admins can read
CREATE POLICY "Admins can view story views" ON public.story_views FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
