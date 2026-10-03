-- Clear Eric's Trip rankings cache — was empty due to "Bootleg (LP, Comp)"
-- being the only format-verified entry, causing Claude to rank only from
-- a compilation. Fixed by adding \bcomp\b to the Discogs format filter.
DELETE FROM public.deep_dive_cache
WHERE artist ILIKE 'eric''s trip'
  AND section = 'rankings';
