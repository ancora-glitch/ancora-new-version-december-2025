-- Add 'pending_import' to the product_status enum
ALTER TYPE public.product_status ADD VALUE IF NOT EXISTS 'pending_import';

-- Add columns to track import retry state
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS tradera_item_id TEXT,
ADD COLUMN IF NOT EXISTS import_retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS import_queued_at TIMESTAMP WITH TIME ZONE;