-- Add columns to store original Swedish text
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS name_sv TEXT,
ADD COLUMN IF NOT EXISTS description_sv TEXT,
ADD COLUMN IF NOT EXISTS condition_sv TEXT,
ADD COLUMN IF NOT EXISTS material_sv TEXT,
ADD COLUMN IF NOT EXISTS size_sv TEXT;