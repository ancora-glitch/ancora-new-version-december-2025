-- Add author column to style_guides table
ALTER TABLE public.style_guides
ADD COLUMN IF NOT EXISTS author TEXT;