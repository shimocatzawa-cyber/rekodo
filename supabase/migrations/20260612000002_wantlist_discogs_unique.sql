-- Unique constraint required for CSV import upsert ON CONFLICT (list_id, discogs_release_id)
ALTER TABLE public.list_items
  ADD CONSTRAINT list_items_list_id_discogs_release_id_key
  UNIQUE (list_id, discogs_release_id);
