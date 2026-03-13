-- Ensure trips.user_id is always aligned with auth.uid() for authenticated inserts.
-- This prevents RLS failures when client payload omits/mismatches user_id.

CREATE OR REPLACE FUNCTION public.set_trip_user_id_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- For authenticated requests, force ownership to current user.
  IF auth.uid() IS NOT NULL THEN
    NEW.user_id := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_trip_user_id_on_insert ON public.trips;

CREATE TRIGGER set_trip_user_id_on_insert
BEFORE INSERT ON public.trips
FOR EACH ROW
EXECUTE FUNCTION public.set_trip_user_id_from_auth();
