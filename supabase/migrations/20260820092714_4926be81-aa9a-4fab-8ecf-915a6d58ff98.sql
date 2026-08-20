CREATE INDEX IF NOT EXISTS idx_site_analytics_product_click_popularity
ON public.site_analytics ((metadata->>'product_id'), created_at)
WHERE event_type = 'product_click';

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
  GROUP BY metadata->>'product_id';
$$;

GRANT EXECUTE ON FUNCTION public.get_product_popularity(integer) TO anon, authenticated;