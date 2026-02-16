
-- Add translation columns to ancora_import_items
ALTER TABLE public.ancora_import_items
  ADD COLUMN IF NOT EXISTS title_original TEXT,
  ADD COLUMN IF NOT EXISTS description_original TEXT,
  ADD COLUMN IF NOT EXISTS title_en TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT,
  ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'sv',
  ADD COLUMN IF NOT EXISTS translated_at TIMESTAMPTZ;

-- Add translation columns to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS name_original TEXT,
  ADD COLUMN IF NOT EXISTS description_original TEXT,
  ADD COLUMN IF NOT EXISTS name_en TEXT,
  ADD COLUMN IF NOT EXISTS description_en TEXT,
  ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'sv',
  ADD COLUMN IF NOT EXISTS translated_at TIMESTAMPTZ;
