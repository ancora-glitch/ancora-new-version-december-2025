
-- Create enum for story status
CREATE TYPE public.story_status AS ENUM ('draft', 'published', 'archived');

-- Add columns to style_guides
ALTER TABLE public.style_guides
  ADD COLUMN status public.story_status NOT NULL DEFAULT 'draft',
  ADD COLUMN published_at timestamp with time zone,
  ADD COLUMN unpublished_at timestamp with time zone;

-- Set all existing stories to published (they are currently visible)
UPDATE public.style_guides
SET status = 'published', published_at = created_at;
