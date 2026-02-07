-- Add boolean field to mark products as part of "This Week's Edit"
ALTER TABLE public.products 
ADD COLUMN in_weekly_edit boolean NOT NULL DEFAULT false;

-- Add index for efficient querying
CREATE INDEX idx_products_weekly_edit ON public.products(in_weekly_edit) WHERE in_weekly_edit = true;

-- Add comment for clarity
COMMENT ON COLUMN public.products.in_weekly_edit IS 'When true, product appears in This Week''s Edit curated collection and on the homepage';