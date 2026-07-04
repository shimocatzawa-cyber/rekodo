CREATE OR REPLACE FUNCTION public.star_sign_breakdown()
RETURNS TABLE(star_sign text, count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(star_sign, 'Not set') AS star_sign,
    COUNT(*)                        AS count
  FROM profiles
  WHERE (role IS NULL OR role != 'admin')
    AND is_test = false
  GROUP BY 1
  ORDER BY count DESC;
$$;

GRANT EXECUTE ON FUNCTION public.star_sign_breakdown() TO service_role;
