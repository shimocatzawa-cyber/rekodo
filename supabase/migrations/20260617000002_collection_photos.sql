-- Create collection_photos table (safe if already exists)
CREATE TABLE IF NOT EXISTS public.collection_photos (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  storage_path   TEXT        NOT NULL,
  display_order  INTEGER     NOT NULL DEFAULT 1,
  created_at     TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT collection_photos_user_id_display_order_key UNIQUE (user_id, display_order)
);

ALTER TABLE public.collection_photos ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.collection_photos TO service_role;
GRANT ALL ON public.collection_photos TO authenticated;

DO $$ BEGIN
  CREATE POLICY "collection_photos_select" ON public.collection_photos
    FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "collection_photos_insert" ON public.collection_photos
    FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "collection_photos_update" ON public.collection_photos
    FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "collection_photos_delete" ON public.collection_photos
    FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('collection-photos', 'collection-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage object policies
DO $$ BEGIN
  CREATE POLICY "collection_photos_storage_select" ON storage.objects
    FOR SELECT USING (bucket_id = 'collection-photos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "collection_photos_storage_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'collection-photos' AND
      (storage.foldername(name))[1] = auth.uid()::text
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "collection_photos_storage_update" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
      bucket_id = 'collection-photos' AND
      (storage.foldername(name))[1] = auth.uid()::text
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "collection_photos_storage_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (
      bucket_id = 'collection-photos' AND
      (storage.foldername(name))[1] = auth.uid()::text
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
