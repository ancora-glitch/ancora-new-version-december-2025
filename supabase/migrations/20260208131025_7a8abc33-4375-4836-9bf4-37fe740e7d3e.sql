-- Add affiliate availability tracking fields to products table

-- Add affiliate_status column
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS affiliate_status text DEFAULT 'unknown' 
CHECK (affiliate_status IN ('active', 'sold', 'unavailable', 'unknown'));

-- Add affiliate_last_checked_at timestamp
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS affiliate_last_checked_at timestamp with time zone;

-- Add affiliate_checked_via column
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS affiliate_checked_via text 
CHECK (affiliate_checked_via IS NULL OR affiliate_checked_via IN ('ebay', 'tradera'));

-- Add affiliate_auto_handling boolean (default true - auto-unpublish enabled)
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS affiliate_auto_handling boolean DEFAULT true;

-- Add unpublished_reason to track why a product was unpublished
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS unpublished_reason text;

-- Add index for efficient querying of products needing availability checks
CREATE INDEX IF NOT EXISTS idx_products_affiliate_check 
ON public.products (marketplace, status, affiliate_last_checked_at) 
WHERE status IN ('active', 'published');

-- Add comment for documentation
COMMENT ON COLUMN public.products.affiliate_status IS 'Current availability status from affiliate source: active, sold, unavailable, unknown';
COMMENT ON COLUMN public.products.affiliate_auto_handling IS 'If true, product is auto-unpublished when affiliate becomes unavailable';
COMMENT ON COLUMN public.products.unpublished_reason IS 'Reason for unpublishing: affiliate_unavailable, manual, etc.';