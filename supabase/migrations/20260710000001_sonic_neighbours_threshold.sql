-- Lower the sonic neighbours match threshold from 2 to 1.
-- With the SKIP_STYLES_SET now only filtering generic terms, collections that
-- have meaningful niche styles (lo-fi, post-punk, noise rock, etc.) in only
-- one dominant genre cluster would get no results at count >= 2.

CREATE OR REPLACE FUNCTION public.get_sonic_neighbours(
  p_styles         text[],
  p_exclude_artists text[]  DEFAULT '{}',
  p_limit          int      DEFAULT 40
)
RETURNS TABLE (
  artist        text,
  shared_styles text[],
  match_count   bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.artist,
    array_agg(DISTINCT s ORDER BY s)    AS shared_styles,
    count(DISTINCT s)                   AS match_count
  FROM  public.records r
  CROSS JOIN UNNEST(r.styles) AS s
  WHERE r.styles && p_styles
    AND s = ANY(p_styles)
    AND (
      array_length(p_exclude_artists, 1) IS NULL
      OR NOT (r.artist = ANY(p_exclude_artists))
    )
  GROUP BY r.artist
  HAVING count(DISTINCT s) >= 1
  ORDER BY match_count DESC, r.artist
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.get_sonic_neighbours(text[], text[], int)
  TO anon, authenticated, service_role;
