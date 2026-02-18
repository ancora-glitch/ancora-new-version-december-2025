
-- Add subcategory column to products table
ALTER TABLE public.products ADD COLUMN subcategory text;

-- Add a check constraint for valid subcategory values (only when set)
-- Using a trigger instead of CHECK for flexibility
CREATE OR REPLACE FUNCTION public.validate_product_subcategory()
RETURNS TRIGGER AS $$
BEGIN
  -- If subcategory is set, validate it's a known value
  IF NEW.subcategory IS NOT NULL AND NEW.subcategory NOT IN ('outerwear', 'tops', 'bottoms', 'dresses') THEN
    RAISE EXCEPTION 'Invalid subcategory: %. Must be one of: outerwear, tops, bottoms, dresses', NEW.subcategory;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER validate_product_subcategory_trigger
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.validate_product_subcategory();
