-- Shared trip photos gallery (iPhone-like)

CREATE TABLE IF NOT EXISTS public.trip_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL,
  storage_path text NOT NULL UNIQUE,
  file_name text,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trip_photos_trip_id ON public.trip_photos(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_photos_uploaded_by ON public.trip_photos(uploaded_by);

ALTER TABLE public.trip_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trip_photos_select_members" ON public.trip_photos;
CREATE POLICY "trip_photos_select_members"
ON public.trip_photos
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.trip_members tm
    WHERE tm.trip_id = trip_photos.trip_id
      AND tm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "trip_photos_insert_members" ON public.trip_photos;
CREATE POLICY "trip_photos_insert_members"
ON public.trip_photos
FOR INSERT
WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.trip_members tm
    WHERE tm.trip_id = trip_photos.trip_id
      AND tm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "trip_photos_delete_only_uploader" ON public.trip_photos;
CREATE POLICY "trip_photos_delete_only_uploader"
ON public.trip_photos
FOR DELETE
USING (
  uploaded_by = auth.uid()
);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trip-photos',
  'trip-photos',
  false,
  15728640,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "trip_photos_storage_select_members" ON storage.objects;
CREATE POLICY "trip_photos_storage_select_members"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'trip-photos'
  AND EXISTS (
    SELECT 1
    FROM public.trip_members tm
    WHERE tm.trip_id::text = split_part(name, '/', 1)
      AND tm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "trip_photos_storage_insert_own_path" ON storage.objects;
CREATE POLICY "trip_photos_storage_insert_own_path"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'trip-photos'
  AND split_part(name, '/', 2) = auth.uid()::text
  AND EXISTS (
    SELECT 1
    FROM public.trip_members tm
    WHERE tm.trip_id::text = split_part(name, '/', 1)
      AND tm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "trip_photos_storage_delete_only_uploader" ON storage.objects;
CREATE POLICY "trip_photos_storage_delete_only_uploader"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'trip-photos'
  AND split_part(name, '/', 2) = auth.uid()::text
);
