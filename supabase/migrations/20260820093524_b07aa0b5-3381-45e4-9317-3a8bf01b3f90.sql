CREATE OR REPLACE FUNCTION public.get_product_popularity(rolling_days integer DEFAULT 30)
RETURNS TABLE(product_id uuid, click_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    (metadata->>'product_id')::uuid AS product_id,
    COUNT(*) AS click_count
  FROM public.site_analytics
  WHERE event_type = 'product_click'
    AND created_at >= now() - (rolling_days || ' days')::interval
    AND metadata->>'product_id' IS NOT NULL
    AND metadata->>'product_id' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  GROUP BY metadata->>'product_id';
$$;