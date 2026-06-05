-- gig_cache: stores Ticketmaster API results per (artist, city) for 24h
CREATE TABLE IF NOT EXISTS public.gig_cache (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  cache_key  TEXT        NOT NULL UNIQUE,   -- "{artist_lc}:{city_lc}"
  results    JSONB       NOT NULL DEFAULT '[]',
  cached_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gig_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read gig cache"
  ON public.gig_cache FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert gig cache"
  ON public.gig_cache FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update gig cache"
  ON public.gig_cache FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
