CREATE OR REPLACE FUNCTION public.validate_product_subcategory()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.subcategory IS NOT NULL AND NEW.subcategory NOT IN ('outerwear', 'tops', 'dresses', 'knitwear', 'shirts', 'blazers', 'skirts', 'jeans', 'trousers', 'shorts') THEN
    RAISE EXCEPTION 'Invalid subcategory: %. Must be one of: outerwear, tops, dresses, knitwear, shirts, blazers, skirts, jeans, trousers, shorts', NEW.subcategory;
  END IF;
  RETURN NEW;
END;
$function$