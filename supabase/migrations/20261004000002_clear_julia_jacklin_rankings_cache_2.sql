-- Clear Julia Jacklin rankings cache — contained hallucinated "Soft Rage (2024)"
-- which does not exist in her Discogs catalogue. Fixed by adding "rank ONLY from
-- this list" to the allUnverified prompt path to prevent Claude adding albums
-- from training data that aren't in the Discogs catalogue.
DELETE FROM public.deep_dive_cache
WHERE artist ILIKE 'julia jacklin'
  AND section = 'rankings';
