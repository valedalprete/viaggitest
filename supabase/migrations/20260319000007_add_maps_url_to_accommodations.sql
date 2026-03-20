-- Add maps_url to accommodations
ALTER TABLE accommodations
  ADD COLUMN IF NOT EXISTS maps_url text;
