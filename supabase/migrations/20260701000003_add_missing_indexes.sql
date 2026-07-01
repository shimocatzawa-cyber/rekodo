-- Critical indexes missing from initial schema.
-- All queries on user-scoped tables filter by user_id; without these,
-- every query does a full sequential scan — the root cause of Disk IO exhaustion.
-- means no table lock, safe to run on a live database.

-- user_records: heaviest table — collection loads, syncs, and insights all filter by user_id
CREATE INDEX IF NOT EXISTS user_records_user_id_idx
  ON public.user_records (user_id);

-- user_records: collection page orders by created_at desc within a user's rows
CREATE INDEX IF NOT EXISTS user_records_user_id_created_at_idx
  ON public.user_records (user_id, created_at DESC);

-- user_records: record_id lookups used during sync (linking phase)
CREATE INDEX IF NOT EXISTS user_records_record_id_idx
  ON public.user_records (record_id);

-- library_wantlist: filtered by user_id on every wantlist page load
CREATE INDEX IF NOT EXISTS library_wantlist_user_id_idx
  ON public.library_wantlist (user_id);

-- library_recommendations: filtered by user_id
CREATE INDEX IF NOT EXISTS library_recommendations_user_id_idx
  ON public.library_recommendations (user_id);

-- compatibility_scores: queried by user_id_a and user_id_b pair lookups
CREATE INDEX IF NOT EXISTS compatibility_scores_user_id_a_idx
  ON public.compatibility_scores (user_id_a);

CREATE INDEX IF NOT EXISTS compatibility_scores_user_id_b_idx
  ON public.compatibility_scores (user_id_b);

-- collection_intelligence: one row per user, always filtered by user_id
CREATE INDEX IF NOT EXISTS collection_intelligence_user_id_idx
  ON public.collection_intelligence (user_id);

-- collection_photos: filtered by user_id
CREATE INDEX IF NOT EXISTS collection_photos_user_id_idx
  ON public.collection_photos (user_id);

-- discogs_tokens: looked up by user_id on every sync
CREATE INDEX IF NOT EXISTS discogs_tokens_user_id_idx
  ON public.discogs_tokens (user_id);
