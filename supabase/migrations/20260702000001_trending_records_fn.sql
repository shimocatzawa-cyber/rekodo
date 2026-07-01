-- Aggregate trending records in the DB rather than reading every row into JS.
-- Replaces the paginated full-table scan in /api/community/trending.
CREATE OR REPLACE FUNCTION get_trending_records(limit_count int DEFAULT 40)
RETURNS TABLE(record_id uuid, collector_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT record_id, COUNT(*) AS collector_count
  FROM user_records
  GROUP BY record_id
  HAVING COUNT(*) > 1
  ORDER BY collector_count DESC
  LIMIT limit_count;
$$;

GRANT EXECUTE ON FUNCTION get_trending_records(int) TO service_role;
