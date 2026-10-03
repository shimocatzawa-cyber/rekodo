-- Clear Julia Jacklin rankings cache — contained singles "Body" and "Santafel"
-- which lacked Discogs format metadata so passed through the filter.
-- Fixed by fetching tracklist length alongside ratings: entries with ≤3 tracks
-- are removed as singles before Claude is called.
DELETE FROM public.deep_dive_cache
WHERE artist ILIKE 'julia jacklin'
  AND section = 'rankings';
