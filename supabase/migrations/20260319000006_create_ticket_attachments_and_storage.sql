-- Ticket/photo attachments shared across trip participants
-- Modules: flights, transports, places

-- Attachment tables
CREATE TABLE IF NOT EXISTS public.flight_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  flight_id uuid NOT NULL REFERENCES public.flights(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL,
  storage_path text NOT NULL UNIQUE,
  file_name text,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.transport_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  transport_id uuid NOT NULL REFERENCES public.transports(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL,
  storage_path text NOT NULL UNIQUE,
  file_name text,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.place_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  place_id uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL,
  storage_path text NOT NULL UNIQUE,
  file_name text,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flight_attachments_trip_id ON public.flight_attachments(trip_id);
CREATE INDEX IF NOT EXISTS idx_flight_attachments_flight_id ON public.flight_attachments(flight_id);
CREATE INDEX IF NOT EXISTS idx_flight_attachments_uploaded_by ON public.flight_attachments(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_transport_attachments_trip_id ON public.transport_attachments(trip_id);
CREATE INDEX IF NOT EXISTS idx_transport_attachments_transport_id ON public.transport_attachments(transport_id);
CREATE INDEX IF NOT EXISTS idx_transport_attachments_uploaded_by ON public.transport_attachments(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_place_attachments_trip_id ON public.place_attachments(trip_id);
CREATE INDEX IF NOT EXISTS idx_place_attachments_place_id ON public.place_attachments(place_id);
CREATE INDEX IF NOT EXISTS idx_place_attachments_uploaded_by ON public.place_attachments(uploaded_by);

ALTER TABLE public.flight_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_attachments ENABLE ROW LEVEL SECURITY;

-- RLS: flight_attachments
DROP POLICY IF EXISTS "flight_attachments_select_members" ON public.flight_attachments;
CREATE POLICY "flight_attachments_select_members"
ON public.flight_attachments
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.trip_members tm
    WHERE tm.trip_id = flight_attachments.trip_id
      AND tm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "flight_attachments_insert_members" ON public.flight_attachments;
CREATE POLICY "flight_attachments_insert_members"
ON public.flight_attachments
FOR INSERT
WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.trip_members tm
    WHERE tm.trip_id = flight_attachments.trip_id
      AND tm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "flight_attachments_delete_uploader_or_editors" ON public.flight_attachments;
CREATE POLICY "flight_attachments_delete_uploader_or_editors"
ON public.flight_attachments
FOR DELETE
USING (
  uploaded_by = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.trip_members tm
    WHERE tm.trip_id = flight_attachments.trip_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'editor')
  )
);

-- RLS: transport_attachments
DROP POLICY IF EXISTS "transport_attachments_select_members" ON public.transport_attachments;
CREATE POLICY "transport_attachments_select_members"
ON public.transport_attachments
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.trip_members tm
    WHERE tm.trip_id = transport_attachments.trip_id
      AND tm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "transport_attachments_insert_members" ON public.transport_attachments;
CREATE POLICY "transport_attachments_insert_members"
ON public.transport_attachments
FOR INSERT
WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.trip_members tm
    WHERE tm.trip_id = transport_attachments.trip_id
      AND tm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "transport_attachments_delete_uploader_or_editors" ON public.transport_attachments;
CREATE POLICY "transport_attachments_delete_uploader_or_editors"
ON public.transport_attachments
FOR DELETE
USING (
  uploaded_by = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.trip_members tm
    WHERE tm.trip_id = transport_attachments.trip_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'editor')
  )
);

-- RLS: place_attachments
DROP POLICY IF EXISTS "place_attachments_select_members" ON public.place_attachments;
CREATE POLICY "place_attachments_select_members"
ON public.place_attachments
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.trip_members tm
    WHERE tm.trip_id = place_attachments.trip_id
      AND tm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "place_attachments_insert_members" ON public.place_attachments;
CREATE POLICY "place_attachments_insert_members"
ON public.place_attachments
FOR INSERT
WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.trip_members tm
    WHERE tm.trip_id = place_attachments.trip_id
      AND tm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "place_attachments_delete_uploader_or_editors" ON public.place_attachments;
CREATE POLICY "place_attachments_delete_uploader_or_editors"
ON public.place_attachments
FOR DELETE
USING (
  uploaded_by = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.trip_members tm
    WHERE tm.trip_id = place_attachments.trip_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'editor')
  )
);

-- Private bucket for ticket photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trip-tickets',
  'trip-tickets',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- Storage object policies
DROP POLICY IF EXISTS "trip_tickets_select_members" ON storage.objects;
CREATE POLICY "trip_tickets_select_members"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'trip-tickets'
  AND EXISTS (
    SELECT 1
    FROM public.trip_members tm
    WHERE tm.trip_id::text = split_part(name, '/', 1)
      AND tm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "trip_tickets_insert_own_path" ON storage.objects;
CREATE POLICY "trip_tickets_insert_own_path"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'trip-tickets'
  AND split_part(name, '/', 4) = auth.uid()::text
  AND EXISTS (
    SELECT 1
    FROM public.trip_members tm
    WHERE tm.trip_id::text = split_part(name, '/', 1)
      AND tm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "trip_tickets_delete_uploader_or_editors" ON storage.objects;
CREATE POLICY "trip_tickets_delete_uploader_or_editors"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'trip-tickets'
  AND (
    split_part(name, '/', 4) = auth.uid()::text
    OR EXISTS (
      SELECT 1
      FROM public.trip_members tm
      WHERE tm.trip_id::text = split_part(name, '/', 1)
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'editor')
    )
  )
);