CREATE TABLE collection_photo_likes (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  photo_owner_id uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  liker_id       uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at     timestamptz DEFAULT now() NOT NULL,
  UNIQUE (photo_owner_id, liker_id)
);

ALTER TABLE collection_photo_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read photo likes"
  ON collection_photo_likes FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can like"
  ON collection_photo_likes FOR INSERT
  WITH CHECK (auth.uid() = liker_id);

CREATE POLICY "Users can unlike their own likes"
  ON collection_photo_likes FOR DELETE
  USING (auth.uid() = liker_id);

GRANT SELECT, INSERT, DELETE ON collection_photo_likes TO authenticated;
