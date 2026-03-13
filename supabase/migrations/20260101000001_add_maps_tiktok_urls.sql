-- Add maps_url and tiktok_url to restaurants and places
-- Make name nullable (only links required)

ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS maps_url text,
  ADD COLUMN IF NOT EXISTS tiktok_url text,
  ALTER COLUMN name DROP NOT NULL;

ALTER TABLE places
  ADD COLUMN IF NOT EXISTS maps_url text,
  ADD COLUMN IF NOT EXISTS tiktok_url text,
  ALTER COLUMN name DROP NOT NULL;
