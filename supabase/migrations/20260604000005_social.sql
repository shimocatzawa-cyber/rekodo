-- Social features: compatibility scores + follows

-- ── compatibility_scores ──────────────────────────────────────────────────────
-- user_id_a = the profile being analysed (whose matches we computed)
-- user_id_b = a matched collector
-- Score is directional: computing A's matches populates (A, B) rows.

CREATE TABLE IF NOT EXISTS public.compatibility_scores (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id_a     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id_b     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score         numeric(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
  shared_tags   text[]       NOT NULL DEFAULT '{}',
  calculated_at timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT no_self_score  CHECK (user_id_a <> user_id_b),
  CONSTRAINT unique_pair    UNIQUE (user_id_a, user_id_b)
);

ALTER TABLE public.compatibility_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scores are publicly readable"
  ON public.compatibility_scores FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert scores"
  ON public.compatibility_scores FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update scores"
  ON public.compatibility_scores FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete scores"
  ON public.compatibility_scores FOR DELETE
  USING (auth.role() = 'authenticated');

-- ── follows ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.follows (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT no_self_follow CHECK (follower_id <> following_id),
  UNIQUE (follower_id, following_id)
);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Follows are publicly readable"
  ON public.follows FOR SELECT USING (true);

CREATE POLICY "Users can follow others"
  ON public.follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow"
  ON public.follows FOR DELETE
  USING (auth.uid() = follower_id);
