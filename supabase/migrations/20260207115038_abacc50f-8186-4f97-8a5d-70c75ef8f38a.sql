-- Add affiliate_url column to ancora_import_items for storing partner purchase links
ALTER TABLE public.ancora_import_items
ADD COLUMN affiliate_url text NULL;