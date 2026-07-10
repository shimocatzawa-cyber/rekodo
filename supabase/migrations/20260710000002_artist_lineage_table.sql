-- Band membership and lineage edges — populated by Claude via /api/constellation/artist-lineage
-- source = parent band/group, target = member/solo/spinoff
-- query_artist = the artist name we queried for (for cache lookup)

CREATE TABLE IF NOT EXISTS public.artist_lineage (
  id            bigserial PRIMARY KEY,
  query_artist  text        NOT NULL,
  source        text        NOT NULL,
  target        text        NOT NULL,
  note          text,
  created_at    timestamptz DEFAULT now(),
  UNIQUE (query_artist, source, target)
);

CREATE INDEX idx_al_query ON public.artist_lineage (lower(query_artist));
CREATE INDEX idx_al_source ON public.artist_lineage (lower(source));
CREATE INDEX idx_al_target ON public.artist_lineage (lower(target));

ALTER TABLE public.artist_lineage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON public.artist_lineage
  FOR SELECT USING (true);

CREATE POLICY "Service write" ON public.artist_lineage
  FOR ALL USING (auth.role() = 'service_role');
