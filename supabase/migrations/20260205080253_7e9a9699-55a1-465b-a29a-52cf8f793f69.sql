-- Add color field to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS color text;

-- Add Swedish translation field for color
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS color_sv text;