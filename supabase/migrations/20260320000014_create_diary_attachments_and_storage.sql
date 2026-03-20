-- Diary photo attachments

CREATE TABLE IF NOT EXISTS public.diary_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  diary_entry_id uuid NOT NULL REFERENCES public.diary_entries(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL,
  storage_path text NOT NULL UNIQUE,
  file_name text,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_diary_attachments_trip_id ON public.diary_attachments(trip_id);
CREATE INDEX IF NOT EXISTS idx_diary_attachments_diary_entry_id ON public.diary_attachments(diary_entry_id);
CREATE INDEX IF NOT EXISTS idx_diary_attachments_uploaded_by ON public.diary_attachments(uploaded_by);

ALTER TABLE public.diary_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "diary_attachments_select_visible_entries" ON public.diary_attachments;
CREATE POLICY "diary_attachments_select_visible_entries"
ON public.diary_attachments
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.diary_entries de
    JOIN public.trip_members tm ON tm.trip_id = de.trip_id
    WHERE de.id = diary_attachments.diary_entry_id
      AND tm.user_id = auth.uid()
      AND (
        de.visibility = 'public'
        OR de.user_id = auth.uid()
      )
  )
);

DROP POLICY IF EXISTS "diary_attachments_insert_own_entry" ON public.diary_attachments;
CREATE POLICY "diary_attachments_insert_own_entry"
ON public.diary_attachments
FOR INSERT
WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.diary_entries de
    WHERE de.id = diary_attachments.diary_entry_id
      AND de.trip_id = diary_attachments.trip_id
      AND de.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "diary_attachments_delete_uploader" ON public.diary_attachments;
CREATE POLICY "diary_attachments_delete_uploader"
ON public.diary_attachments
FOR DELETE
USING (
  uploaded_by = auth.uid()
);

-- Private bucket dedicated to diary images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trip-diary',
  'trip-diary',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- name format: {trip_id}/{diary_entry_id}/{user_id}/{file}
DROP POLICY IF EXISTS "trip_diary_select_visible_entries" ON storage.objects;
CREATE POLICY "trip_diary_select_visible_entries"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'trip-diary'
  AND EXISTS (
    SELECT 1
    FROM public.diary_attachments da
    JOIN public.diary_entries de ON de.id = da.diary_entry_id
    JOIN public.trip_members tm ON tm.trip_id = de.trip_id
    WHERE da.storage_path = name
      AND tm.user_id = auth.uid()
      AND (
        de.visibility = 'public'
        OR de.user_id = auth.uid()
      )
  )
);

DROP POLICY IF EXISTS "trip_diary_insert_own_entry" ON storage.objects;
CREATE POLICY "trip_diary_insert_own_entry"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'trip-diary'
  AND split_part(name, '/', 3) = auth.uid()::text
  AND EXISTS (
    SELECT 1
    FROM public.trip_members tm
    WHERE tm.trip_id::text = split_part(name, '/', 1)
      AND tm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "trip_diary_delete_owner" ON storage.objects;
CREATE POLICY "trip_diary_delete_owner"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'trip-diary'
  AND split_part(name, '/', 3) = auth.uid()::text
);
