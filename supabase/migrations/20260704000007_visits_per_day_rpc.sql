CREATE OR REPLACE FUNCTION visits_per_day()
RETURNS TABLE(date text, unique_visitors bigint)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    to_char(
      (created_at AT TIME ZONE 'Australia/Sydney')::date,
      'YYYY-MM-DD'
    ) AS date,
    COUNT(DISTINCT user_id) AS unique_visitors
  FROM page_views
  WHERE
    created_at >= NOW() - INTERVAL '8 days'
    AND user_id IS NOT NULL
  GROUP BY 1
  ORDER BY 1;
$$;

GRANT EXECUTE ON FUNCTION visits_per_day() TO service_role;
