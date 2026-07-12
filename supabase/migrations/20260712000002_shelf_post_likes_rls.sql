ALTER TABLE shelf_post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read shelf post likes"
  ON shelf_post_likes FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can like shelf posts"
  ON shelf_post_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike their own shelf post likes"
  ON shelf_post_likes FOR DELETE
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON shelf_post_likes TO authenticated;
