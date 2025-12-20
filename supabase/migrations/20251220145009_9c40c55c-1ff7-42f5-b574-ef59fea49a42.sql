-- Drop the existing default first
ALTER TABLE public.products 
ALTER COLUMN additional_images DROP DEFAULT;

-- Convert additional_images from text[] to jsonb
ALTER TABLE public.products 
ALTER COLUMN additional_images TYPE jsonb 
USING COALESCE(to_jsonb(additional_images), '[]'::jsonb);

-- Set new default value to empty JSON array
ALTER TABLE public.products 
ALTER COLUMN additional_images SET DEFAULT '[]'::jsonb;