-- Accent-insensitive collection search
-- Fixes: ilike '%diabate%' failing to match stored 'Diabaté'

CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION search_user_collection(
  p_query text,
  p_limit int DEFAULT 80
)
RETURNS TABLE (
  id         uuid,
  discogs_id text,
  artist     text,
  album      text,
  year       int,
  genre      text,
  cover_url  text,
  label      text
)
LANGUAGE sql
STABLE
AS $$
  SELECT r.id, r.discogs_id, r.artist, r.album, r.year, r.genre, r.cover_url, r.label
  FROM   public.records r
  JOIN   public.user_records ur ON ur.record_id = r.id AND ur.user_id = auth.uid()
  WHERE  unaccent(r.artist) ILIKE '%' || unaccent(p_query) || '%'
     OR  unaccent(r.album)  ILIKE '%' || unaccent(p_query) || '%'
  LIMIT  p_limit;
$$;

GRANT EXECUTE ON FUNCTION search_user_collection(text, int) TO authenticated;
