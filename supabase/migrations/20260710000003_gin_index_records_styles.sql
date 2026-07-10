-- GIN index on records.styles for fast array overlap queries.
-- get_sonic_neighbours uses `r.styles && p_styles` which hits every row
-- without this index; with it the query drops from a full table scan to
-- an index scan on the matching style tags.
CREATE INDEX IF NOT EXISTS idx_records_styles_gin
  ON public.records USING gin (styles);
