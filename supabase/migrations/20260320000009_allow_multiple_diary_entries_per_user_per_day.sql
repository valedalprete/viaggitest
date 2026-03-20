-- Allow multiple diary pages per user in the same day
-- Previously we had a unique index on (trip_id, day_date, user_id)
-- that forced one single page per user/day.

DROP INDEX IF EXISTS diary_entries_trip_day_user_unique;

CREATE INDEX IF NOT EXISTS diary_entries_trip_day_user_idx
  ON diary_entries (trip_id, day_date, user_id);
