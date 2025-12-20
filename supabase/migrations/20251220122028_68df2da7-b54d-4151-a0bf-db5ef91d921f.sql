-- Add new fields for product detail page
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS condition text,
ADD COLUMN IF NOT EXISTS material text,
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS slug text;

-- Create unique index on slug for URL-based lookups
CREATE UNIQUE INDEX IF NOT EXISTS products_slug_unique ON public.products(slug) WHERE slug IS NOT NULL;