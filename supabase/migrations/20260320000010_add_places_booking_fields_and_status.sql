-- Places: support booked/preferred flow for timeline inclusion
ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS booking_date date,
  ADD COLUMN IF NOT EXISTS booking_time time;

-- Normalize legacy status values
UPDATE public.places
SET status = 'wishlist'
WHERE status = 'chosen';

-- Update allowed status values
ALTER TABLE public.places DROP CONSTRAINT IF EXISTS places_status_check;
ALTER TABLE public.places
  ADD CONSTRAINT places_status_check
  CHECK (status = ANY (ARRAY['booked'::text, 'wishlist'::text, 'suggested'::text]));
