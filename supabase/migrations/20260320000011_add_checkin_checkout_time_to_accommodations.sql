-- Add optional check-in/check-out time to accommodations
ALTER TABLE public.accommodations
  ADD COLUMN IF NOT EXISTS checkin_time time,
  ADD COLUMN IF NOT EXISTS checkout_time time;