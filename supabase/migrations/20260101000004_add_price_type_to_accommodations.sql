-- Add price_type to accommodations (per_night or total)
ALTER TABLE accommodations
  ADD COLUMN IF NOT EXISTS price_type text NOT NULL DEFAULT 'per_night'
  CHECK (price_type IN ('per_night', 'total'));
