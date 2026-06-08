-- ─── discogs_tokens ──────────────────────────────────────────────────────────
-- Stores Discogs OAuth 1.0a credentials per user so the background Edge
-- Function can sign requests without receiving tokens in the POST body.
-- No user-level RLS policies — only the service role can read or write.

CREATE TABLE IF NOT EXISTS discogs_tokens (
  user_id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token     TEXT NOT NULL,
  token_secret     TEXT NOT NULL,
  discogs_username TEXT NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE discogs_tokens ENABLE ROW LEVEL SECURITY;
-- No policies: service role bypasses RLS and is the only actor that reads/writes here.

-- ─── sync_queue ───────────────────────────────────────────────────────────────
-- One row per sync job. The Edge Function writes progress here; the SSE route
-- polls it and translates the state into the existing SSE event format.

CREATE TABLE IF NOT EXISTS sync_queue (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  phase            TEXT,           -- fetching | inserting | linking | conditions
  total_records    INTEGER DEFAULT 0,
  current_page     INTEGER DEFAULT 0,
  total_pages      INTEGER DEFAULT 0,
  progress_done    INTEGER DEFAULT 0,
  new_added        INTEGER DEFAULT 0,
  records_updated  INTEGER DEFAULT 0,
  error_message    TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS sync_queue_user_id_idx ON sync_queue(user_id);
CREATE INDEX IF NOT EXISTS sync_queue_status_idx  ON sync_queue(status);

ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sync jobs" ON sync_queue
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sync jobs" ON sync_queue
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Service role bypasses RLS for updates (progress writes from Edge Function).
CREATE POLICY "Service role can update sync jobs" ON sync_queue
  FOR UPDATE USING (true);
