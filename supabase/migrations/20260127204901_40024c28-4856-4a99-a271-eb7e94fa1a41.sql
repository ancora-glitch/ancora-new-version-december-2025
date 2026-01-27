-- Add new enum values to product_status
ALTER TYPE public.product_status ADD VALUE IF NOT EXISTS 'published';
ALTER TYPE public.product_status ADD VALUE IF NOT EXISTS 'draft';