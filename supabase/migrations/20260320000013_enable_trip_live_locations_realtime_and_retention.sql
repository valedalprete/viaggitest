-- Realtime + retention helpers for live locations

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'trip_live_locations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_live_locations;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.prune_trip_live_locations()
RETURNS void
LANGUAGE sql
AS $$
  DELETE FROM public.trip_live_locations
  WHERE expires_at IS NOT NULL
    AND expires_at < now();
$$;
