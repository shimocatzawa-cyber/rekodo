-- Clear Julia Jacklin rankings cache so it regenerates with current prompt
-- (Soft Control and Shivers are singles, not studio albums)
DELETE FROM public.deep_dive_cache
WHERE artist ILIKE 'julia jacklin'
  AND section = 'rankings';
