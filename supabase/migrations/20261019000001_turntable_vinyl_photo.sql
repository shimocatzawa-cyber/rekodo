ALTER TABLE turntable_posts
  ADD COLUMN IF NOT EXISTS vinyl_photo_url TEXT;

-- Create public storage bucket for turntable photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('turntable-photos', 'turntable-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access
CREATE POLICY IF NOT EXISTS "turntable_photos_public_read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'turntable-photos');

-- Authenticated users can upload (admin check is enforced in the API route)
CREATE POLICY IF NOT EXISTS "turntable_photos_auth_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'turntable-photos');

-- Authenticated users can delete their uploads
CREATE POLICY IF NOT EXISTS "turntable_photos_auth_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'turntable-photos');
