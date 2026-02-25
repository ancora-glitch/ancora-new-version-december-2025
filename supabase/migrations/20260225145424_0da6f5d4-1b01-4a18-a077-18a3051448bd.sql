
-- Add _original columns for Tradera field normalization audit trail
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS condition_original text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS material_original text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS color_original text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS brand_original text;
