-- ---------------------------------------------------------------------------
-- 005_per_subject_predictions
--
-- Gives every visitor their own reading.
--
-- Until now `daily_predictions.date` and `weekly_predictions.week_start` were
-- UNIQUE on their own, so the whole site shared one reading per day and one per
-- week. That was a deliberate cost control, but it means every visitor sees
-- identical text. The cache key becomes (subject, date) instead of (date).
--
-- A "subject" is whoever the reading belongs to:
--   'user:<uuid>'     a signed-in account, so readings follow it across devices
--   'visitor:<uuid>'  an anonymous visitor, identified by a server-issued cookie
--   'shared:global'   reserved for the rows that existed before this migration
--
-- The CHECK constraint fails closed: a malformed or client-invented subject is
-- refused by the database, not merely by the application.
--
-- Existing rows are preserved rather than deleted. They are reassigned to
-- 'shared:global', which no live request can ever produce, so they become inert
-- history instead of being served to someone they were not generated for.
-- ---------------------------------------------------------------------------

-- --- daily -----------------------------------------------------------------

ALTER TABLE daily_predictions ADD COLUMN subject_id text;

UPDATE daily_predictions SET subject_id = 'shared:global' WHERE subject_id IS NULL;

ALTER TABLE daily_predictions ALTER COLUMN subject_id SET NOT NULL;

ALTER TABLE daily_predictions
  ADD CONSTRAINT daily_predictions_subject_id_check
  CHECK (
    subject_id = 'shared:global'
    OR subject_id ~ '^(user|visitor):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

-- One reading per subject per date. Dropping the old site-wide UNIQUE(date) is
-- the whole point: two subjects must be able to hold the same date.
ALTER TABLE daily_predictions DROP CONSTRAINT daily_predictions_date_key;

ALTER TABLE daily_predictions
  ADD CONSTRAINT daily_predictions_subject_date_key UNIQUE (subject_id, date);

-- --- weekly ----------------------------------------------------------------

ALTER TABLE weekly_predictions ADD COLUMN subject_id text;

UPDATE weekly_predictions SET subject_id = 'shared:global' WHERE subject_id IS NULL;

ALTER TABLE weekly_predictions ALTER COLUMN subject_id SET NOT NULL;

ALTER TABLE weekly_predictions
  ADD CONSTRAINT weekly_predictions_subject_id_check
  CHECK (
    subject_id = 'shared:global'
    OR subject_id ~ '^(user|visitor):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

ALTER TABLE weekly_predictions DROP CONSTRAINT weekly_predictions_week_start_key;

ALTER TABLE weekly_predictions
  ADD CONSTRAINT weekly_predictions_subject_week_key UNIQUE (subject_id, week_start);

-- `weekly_prediction_days` needs no subject column: it is reached only through
-- its parent week, which already carries one, and its UNIQUE (weekly_prediction_id,
-- day_date) still forbids two rows for the same day of the same week.
