-- Add sort_order field to products table
ALTER TABLE public.products ADD COLUMN sort_order integer DEFAULT 0;

-- Set initial sort order based on created_at (newest first gets higher number, so oldest is 0)
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) - 1 AS rn
  FROM public.products
)
UPDATE public.products p
SET sort_order = o.rn
FROM ordered o
WHERE p.id = o.id;