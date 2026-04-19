CREATE OR REPLACE FUNCTION public.get_unique_visitors(
  p_start timestamptz DEFAULT NULL,
  p_end timestamptz DEFAULT NULL,
  p_bot_threshold integer DEFAULT 200
)
RETURNS TABLE(day date, unique_visitors bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH per_visitor_day AS (
    SELECT
      (created_at AT TIME ZONE 'UTC')::date AS d,
      visitor_id,
      COUNT(*) AS events
    FROM public.site_analytics
    WHERE visitor_id IS NOT NULL
      AND (p_start IS NULL OR created_at >= p_start)
      AND (p_end   IS NULL OR created_at <  p_end)
    GROUP BY 1, 2
  )
  SELECT d AS day, COUNT(*)::bigint AS unique_visitors
  FROM per_visitor_day
  WHERE events <= p_bot_threshold
  GROUP BY d
  ORDER BY d;
$$;

REVOKE ALL ON FUNCTION public.get_unique_visitors(timestamptz, timestamptz, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_unique_visitors(timestamptz, timestamptz, integer) TO authenticated;