-- Live location sharing per trip collaborator

CREATE TABLE IF NOT EXISTS public.trip_live_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  lat double precision,
  lon double precision,
  accuracy_m double precision,
  sharing_enabled boolean NOT NULL DEFAULT false,
  last_shared_at timestamptz,
  expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS trip_live_locations_trip_user_unique
  ON public.trip_live_locations(trip_id, user_id);

CREATE INDEX IF NOT EXISTS trip_live_locations_trip_idx
  ON public.trip_live_locations(trip_id);

CREATE INDEX IF NOT EXISTS trip_live_locations_expires_idx
  ON public.trip_live_locations(expires_at);

ALTER TABLE public.trip_live_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trip_live_locations_select_members ON public.trip_live_locations;
CREATE POLICY trip_live_locations_select_members
  ON public.trip_live_locations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.trip_members tm
      WHERE tm.trip_id = trip_live_locations.trip_id
        AND tm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS trip_live_locations_insert_self ON public.trip_live_locations;
CREATE POLICY trip_live_locations_insert_self
  ON public.trip_live_locations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.trip_members tm
      WHERE tm.trip_id = trip_live_locations.trip_id
        AND tm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS trip_live_locations_update_self ON public.trip_live_locations;
CREATE POLICY trip_live_locations_update_self
  ON public.trip_live_locations
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.trip_members tm
      WHERE tm.trip_id = trip_live_locations.trip_id
        AND tm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
  );

DROP POLICY IF EXISTS trip_live_locations_delete_self_or_manager ON public.trip_live_locations;
CREATE POLICY trip_live_locations_delete_self_or_manager
  ON public.trip_live_locations
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.trip_members tm
      WHERE tm.trip_id = trip_live_locations.trip_id
        AND tm.user_id = auth.uid()
        AND tm.role IN ('owner', 'editor')
    )
  );
