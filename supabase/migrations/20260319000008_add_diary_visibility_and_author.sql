-- Diary entries: one page per user per day + public/private visibility
ALTER TABLE diary_entries
  ADD COLUMN IF NOT EXISTS author_name text,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public';

-- Backfill safety
UPDATE diary_entries
SET visibility = 'public'
WHERE visibility IS NULL OR visibility NOT IN ('public', 'private');

-- Constrain accepted values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'diary_entries_visibility_check'
      AND conrelid = 'diary_entries'::regclass
  ) THEN
    ALTER TABLE diary_entries
      ADD CONSTRAINT diary_entries_visibility_check
      CHECK (visibility IN ('public', 'private'));
  END IF;
END $$;

-- Replace old uniqueness (trip_id + day_date) with per-user uniqueness
ALTER TABLE diary_entries DROP CONSTRAINT IF EXISTS diary_entries_trip_id_day_date_key;
DROP INDEX IF EXISTS diary_entries_trip_id_day_date_key;
DROP INDEX IF EXISTS diary_entries_trip_id_day_date_idx;

CREATE UNIQUE INDEX IF NOT EXISTS diary_entries_trip_day_user_unique
  ON diary_entries (trip_id, day_date, user_id);

CREATE INDEX IF NOT EXISTS diary_entries_trip_day_idx
  ON diary_entries (trip_id, day_date);

-- Enforce privacy for reads even with existing permissive policies
DROP POLICY IF EXISTS diary_entries_private_visibility_select ON diary_entries;
CREATE POLICY diary_entries_private_visibility_select
  ON diary_entries
  AS RESTRICTIVE
  FOR SELECT
  USING (
    visibility = 'public' OR user_id = auth.uid()
  );
