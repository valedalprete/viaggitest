-- Add booking_url to accommodations
ALTER TABLE accommodations
  ADD COLUMN IF NOT EXISTS booking_url text;
