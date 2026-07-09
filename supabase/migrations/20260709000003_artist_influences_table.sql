-- Artist influences table — populated by the Claude pipeline in /api/admin/build-influences
-- source_artist influenced target_artist (or vice-versa for type="influenced")

CREATE TABLE IF NOT EXISTS public.artist_influences (
  id              bigserial PRIMARY KEY,
  source_artist   text        NOT NULL,
  target_artist   text        NOT NULL,
  type            text        NOT NULL CHECK (type IN ('influenced_by', 'influenced')),
  note            text,
  via             text        DEFAULT 'claude',
  confidence      smallint    DEFAULT 80,  -- 0-100
  created_at      timestamptz DEFAULT now(),
  UNIQUE (source_artist, target_artist, type)
);

CREATE INDEX idx_ai_source ON public.artist_influences (lower(source_artist));
CREATE INDEX idx_ai_target ON public.artist_influences (lower(target_artist));

-- Allow read access to anyone (no personal data)
ALTER TABLE public.artist_influences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read" ON public.artist_influences
  FOR SELECT USING (true);

CREATE POLICY "Service write" ON public.artist_influences
  FOR ALL USING (auth.role() = 'service_role');
