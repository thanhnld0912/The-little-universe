-- 002_astronomy_snapshot.sql
-- Records the astronomical facts a reading was written from.
--
-- WHY STORE SOMETHING RECOMPUTABLE
--
-- The astronomy context is deterministic: the same date always yields the same
-- values from the same library version. It is therefore redundant *today*.
-- It is stored anyway because the reading's TEXT was generated from it, and
-- text and facts have to keep agreeing:
--
--   * upgrading `astronomy-engine` may shift a value slightly, and a reading
--     that says "under a waxing gibbous moon" must not later be recomputed as
--     a first quarter;
--   * changing the sampling convention (currently local noon) would move
--     values near a phase or sign boundary;
--   * a stored snapshot lets an old reading be explained without having to
--     reconstruct which library version produced it.
--
-- One JSONB column rather than a spread of typed columns: nothing queries
-- inside it, the shape is owned and validated in TypeScript, and adding a
-- field later then needs no migration at all.
--
-- NULLABLE, deliberately. Rows written before this migration were generated
-- without astronomy and stay exactly as they are; they remain valid and
-- continue to be served. Only new rows carry a snapshot.

ALTER TABLE daily_predictions
  ADD COLUMN astronomy jsonb;

ALTER TABLE weekly_predictions
  ADD COLUMN astronomy jsonb;

COMMENT ON COLUMN daily_predictions.astronomy IS
  'Deterministic astronomy context this reading was generated from. NULL for rows created before 002.';

COMMENT ON COLUMN weekly_predictions.astronomy IS
  'Deterministic astronomy context for the start of the week. NULL for rows created before 002.';
