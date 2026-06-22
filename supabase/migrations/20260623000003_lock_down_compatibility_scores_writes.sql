-- compatibility_scores previously allowed any authenticated user to
-- insert/update/delete arbitrary rows (see 20260623000002), because the
-- collectors/matches route wrote cache entries through the viewer's own
-- RLS-scoped session. That route has been changed to write via the service
-- role client instead (the cache is keyed by the profile being viewed, not
-- the viewer, so it was never really "their" row to write under RLS anyway).
-- With the application no longer relying on client-side writes, drop the
-- permissive policies entirely — only the service role (which bypasses RLS)
-- can write now. Public read access is unchanged.

DROP POLICY IF EXISTS "Authenticated users can insert scores" ON public.compatibility_scores;
DROP POLICY IF EXISTS "Authenticated users can update scores" ON public.compatibility_scores;
DROP POLICY IF EXISTS "Authenticated users can delete scores" ON public.compatibility_scores;
