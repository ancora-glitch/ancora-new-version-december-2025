
-- Add structured product-like fields to ancora_import_items
ALTER TABLE public.ancora_import_items
  ADD COLUMN IF NOT EXISTS brand_text text,
  ADD COLUMN IF NOT EXISTS size_text text,
  ADD COLUMN IF NOT EXISTS color_text text,
  ADD COLUMN IF NOT EXISTS material_text text,
  ADD COLUMN IF NOT EXISTS condition_text text,
  ADD COLUMN IF NOT EXISTS primary_image text,
  ADD COLUMN IF NOT EXISTS marketplace text,
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id);

-- Add index on marketplace for filtering
CREATE INDEX IF NOT EXISTS idx_ais_marketplace ON public.ancora_import_items(marketplace);
