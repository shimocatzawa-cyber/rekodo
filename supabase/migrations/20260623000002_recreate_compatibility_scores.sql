-- compatibility_scores doesn't exist live at all, despite being created in
-- 20260604000005_social.sql — confirmed via direct query against the
-- production database (relation does not exist). That migration is marked
-- applied (it did create the sibling `follows` table, which does exist), so
-- this table was most likely dropped manually at some point afterward. The
-- entire Collectors > Matches feature (src/app/api/collectors/matches/route.ts)
-- has been silently broken in production since — every query against it
-- fails outright.
--
-- Recreated with the exact schema the route code expects (verified against
-- every read/write in that file): user_id_a/user_id_b/score/shared_tags/
-- calculated_at, cascading from profiles so account deletion still cleans
-- it up automatically.

CREATE TABLE IF NOT EXISTS public.compatibility_scores (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id_a     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id_b     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score         numeric(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
  shared_tags   text[]       NOT NULL DEFAULT '{}',
  calculated_at timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT no_self_score  CHECK (user_id_a <> user_id_b),
  CONSTRAINT unique_pair    UNIQUE (user_id_a, user_id_b)
);

ALTER TABLE public.compatibility_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Scores are publicly readable" ON public.compatibility_scores;
CREATE POLICY "Scores are publicly readable"
  ON public.compatibility_scores FOR SELECT USING (true);

-- INSERT/UPDATE/DELETE intentionally stay scoped to "any authenticated
-- user" rather than auth.uid() = user_id_a: the route caches a profile's
-- matches on behalf of whoever happens to view that profile, not just the
-- profile owner, so ownership-pinning would break the caching model itself.
-- Abuse surface is bounded — at worst a malicious write forces a
-- recomputation (bounded to 50 candidates, no external API calls) or
-- displays a fabricated score (0-100 only, checked) — not a data exposure.
DROP POLICY IF EXISTS "Authenticated users can insert scores" ON public.compatibility_scores;
CREATE POLICY "Authenticated users can insert scores"
  ON public.compatibility_scores FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can update scores" ON public.compatibility_scores;
CREATE POLICY "Authenticated users can update scores"
  ON public.compatibility_scores FOR UPDATE
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can delete scores" ON public.compatibility_scores;
CREATE POLICY "Authenticated users can delete scores"
  ON public.compatibility_scores FOR DELETE
  USING (auth.role() = 'authenticated');
