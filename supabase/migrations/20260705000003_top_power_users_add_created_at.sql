DROP FUNCTION IF EXISTS public.top_power_users();

CREATE FUNCTION public.top_power_users()
RETURNS TABLE(
  user_id uuid,
  username text,
  display_name text,
  subscription_tier text,
  created_at timestamptz,
  unique_days bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id                                                                        AS user_id,
    p.username,
    p.display_name,
    p.subscription_tier,
    p.created_at,
    COUNT(DISTINCT DATE(pv.created_at AT TIME ZONE 'Australia/Sydney'))         AS unique_days
  FROM page_views pv
  JOIN profiles p ON p.id = pv.user_id
  WHERE (p.role IS NULL OR p.role != 'admin')
    AND p.is_test = false
  GROUP BY p.id, p.username, p.display_name, p.subscription_tier, p.created_at
  ORDER BY unique_days DESC
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION public.top_power_users() TO service_role;
