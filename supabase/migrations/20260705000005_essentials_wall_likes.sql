CREATE TABLE essentials_wall_likes (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  essentials_owner_id uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  liker_id            uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at          timestamptz DEFAULT now() NOT NULL,
  UNIQUE (essentials_owner_id, liker_id)
);

ALTER TABLE essentials_wall_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read essentials wall likes"
  ON essentials_wall_likes FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can like essentials wall"
  ON essentials_wall_likes FOR INSERT
  WITH CHECK (auth.uid() = liker_id);

CREATE POLICY "Users can unlike their own essentials wall like"
  ON essentials_wall_likes FOR DELETE
  USING (auth.uid() = liker_id);

GRANT SELECT, INSERT, DELETE ON essentials_wall_likes TO authenticated;
