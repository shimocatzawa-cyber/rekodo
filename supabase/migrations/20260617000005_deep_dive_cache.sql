CREATE TABLE IF NOT EXISTS public.deep_dive_cache (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist       text NOT NULL,
  section      text NOT NULL,
  data         jsonb NOT NULL,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (artist, section)
);

ALTER TABLE public.deep_dive_cache ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read cached data
CREATE POLICY "Authenticated users can read deep_dive_cache"
  ON public.deep_dive_cache FOR SELECT
  TO authenticated
  USING (true);

-- Service role handles writes (upserts from the API route)
