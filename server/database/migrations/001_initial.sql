-- 001_initial.sql
-- Foundation: accounts, cached predictions, the tarot deck, and the two
-- reading-history tables.
--
-- Scope note: this migration creates CORE TABLES only.
--   002_seed_tarot.sql  seeds the 78-card deck into tarot_cards
--   003_sharing.sql     adds shared_readings and secret_messages
--
-- Design rules applied throughout (from the Lumiere retrospective):
--   * No triggers, no generated columns, no computed logic in SQL. Date and
--     week arithmetic lives in TypeScript (src/utils/dates.ts) in exactly one
--     place, so the two can never drift apart.
--   * Decorative / presentational fields are NULLABLE. Only a value the
--     application genuinely cannot operate without is NOT NULL - a NOT NULL
--     column that a generator cannot always supply forces a migration across
--     every layer later.
--   * Closed value sets are enforced with CHECK constraints, because the
--     frontend switches on those exact strings and silently degrades on an
--     unexpected one.
--   * gen_random_uuid() is core PostgreSQL from v13 onward; no extension is
--     required, which keeps this schema portable across providers.

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL,
  password_hash text NOT NULL,
  display_name  text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_format_check CHECK (position('@' IN email) > 1)
);

-- Case-insensitive uniqueness without depending on the citext extension.
-- The application also lowercases on write; this index is the safety net.
CREATE UNIQUE INDEX users_email_lower_key ON users (lower(email));

-- ---------------------------------------------------------------------------
-- daily_predictions
--
-- One row per calendar date - enforced by the UNIQUE constraint on `date`,
-- which is what makes "generate once, then serve from cache" correct even if
-- two cold serverless instances race on the same first request of the day.
--
-- `energy` is the human-readable energy TITLE ("Quietly Curious"), which the
-- UI renders as the card heading; `energy_score` is the separate 0-100 number
-- rendered as a percentage. They are not two views of the same value.
-- ---------------------------------------------------------------------------
CREATE TABLE daily_predictions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date            date NOT NULL UNIQUE,
  theme           text NOT NULL,
  energy          text NOT NULL,
  energy_score    smallint NOT NULL,
  lucky_color     text NOT NULL,
  lucky_color_hex text,
  lucky_number    smallint NOT NULL,
  mood            text NOT NULL,
  prediction_text text NOT NULL,

  -- Rendered by TodayView; optional so a provider that omits them still
  -- produces a usable row rather than failing the whole request.
  cosmic_quote    text,
  cosmic_sign     text,
  element         text,
  sound_frequency text,

  model           text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT daily_predictions_energy_score_check
    CHECK (energy_score BETWEEN 0 AND 100),
  CONSTRAINT daily_predictions_lucky_number_check
    CHECK (lucky_number BETWEEN 0 AND 99),
  CONSTRAINT daily_predictions_lucky_color_hex_check
    CHECK (lucky_color_hex IS NULL OR lucky_color_hex ~ '^#[0-9A-Fa-f]{6}$')
);

-- ---------------------------------------------------------------------------
-- weekly_predictions
--
-- One row per ISO week, keyed by its Monday.
-- ---------------------------------------------------------------------------
CREATE TABLE weekly_predictions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start      date NOT NULL UNIQUE,
  week_end        date NOT NULL,
  summary         text NOT NULL,
  brightest_day   text NOT NULL,

  -- The large highlighted card in ThisWeekView.
  highlight_title text,
  highlight_quote text,

  model           text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),

  -- Invariant assertions, not computations: the application still derives
  -- these dates itself, and these constraints catch it if it derives them
  -- wrongly.
  CONSTRAINT weekly_predictions_starts_monday_check
    CHECK (EXTRACT(ISODOW FROM week_start) = 1),
  CONSTRAINT weekly_predictions_span_check
    CHECK (week_end = week_start + 6)
);

-- ---------------------------------------------------------------------------
-- weekly_prediction_days
--
-- Exactly seven rows per weekly_prediction, Monday through Sunday. The
-- "exactly seven" invariant cannot be expressed as a row-level constraint, so
-- it is enforced in the service layer on write AND re-checked on read; the
-- UNIQUE constraint below covers the duplicate-date half of it.
--
-- ThisWeekView indexes this list positionally (slot 4 is the large Friday
-- card) and switches on `day_type` to choose an icon - an unrecognised value
-- degrades silently to a generic icon, hence the CHECK.
-- ---------------------------------------------------------------------------
CREATE TABLE weekly_prediction_days (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  weekly_prediction_id  uuid NOT NULL
                          REFERENCES weekly_predictions(id) ON DELETE CASCADE,
  day_date              date NOT NULL,
  day_name              text NOT NULL,
  short_name            text NOT NULL,
  day_type              text NOT NULL,
  tagline               text NOT NULL,
  prediction_text       text NOT NULL,
  score                 smallint NOT NULL,
  is_peak               boolean NOT NULL DEFAULT false,

  element               text,
  gemstone              text,
  tags                  text[],

  -- Reserved. The current UI renders neither per-day field, so nothing
  -- generates them; they are nullable rather than filled with invented values.
  energy                text,
  mood                  text,

  created_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT weekly_prediction_days_unique_day
    UNIQUE (weekly_prediction_id, day_date),
  CONSTRAINT weekly_prediction_days_score_check
    CHECK (score BETWEEN 0 AND 100),
  CONSTRAINT weekly_prediction_days_type_check
    CHECK (day_type IN ('QUIET', 'FLOW', 'PIVOT', 'CLARITY', 'PEAK', 'REST', 'REFLECT'))
);

CREATE INDEX weekly_prediction_days_parent_idx
  ON weekly_prediction_days (weekly_prediction_id, day_date);

-- ---------------------------------------------------------------------------
-- tarot_cards
--
-- Reference data, seeded by 002_seed_tarot.sql. The AI never invents card
-- facts; it only interprets the row loaded from here.
--
-- image_url is nullable on purpose: the frontend draws its card artwork as
-- inline SVG and loads no images at all. The three card backs are positional
-- (CARD I / II / III), not per-card, so a full 78-card deck is compatible with
-- the three-card spread the UI presents.
-- ---------------------------------------------------------------------------
CREATE TABLE tarot_cards (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             text NOT NULL UNIQUE,
  name             text NOT NULL,
  arcana           text NOT NULL,
  suit             text,
  number           smallint,
  numeral          text,
  archetype        text NOT NULL,
  keywords         text[] NOT NULL,
  element          text,
  upright_meaning  text NOT NULL,
  reversed_meaning text NOT NULL,
  image_url        text,
  created_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tarot_cards_arcana_check
    CHECK (arcana IN ('major', 'minor')),
  CONSTRAINT tarot_cards_suit_check
    CHECK (suit IS NULL OR suit IN ('wands', 'cups', 'swords', 'pentacles')),
  -- A major arcana card has no suit; a minor arcana card must have one.
  CONSTRAINT tarot_cards_arcana_suit_check
    CHECK ((arcana = 'major' AND suit IS NULL) OR (arcana = 'minor' AND suit IS NOT NULL)),
  CONSTRAINT tarot_cards_keywords_check
    CHECK (cardinality(keywords) > 0)
);

CREATE INDEX tarot_cards_arcana_idx ON tarot_cards (arcana, suit, number);

-- ---------------------------------------------------------------------------
-- tarot_readings
--
-- user_id is nullable: reading tarot never requires an account. ON DELETE SET
-- NULL keeps a shared reading resolvable after its author deletes their
-- account, without keeping the link to them.
-- ---------------------------------------------------------------------------
CREATE TABLE tarot_readings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid REFERENCES users(id) ON DELETE SET NULL,
  card_id        uuid NOT NULL REFERENCES tarot_cards(id) ON DELETE RESTRICT,
  question       text,
  position       text,
  orientation    text NOT NULL,
  interpretation jsonb NOT NULL,
  model          text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tarot_readings_orientation_check
    CHECK (orientation IN ('upright', 'reversed')),
  CONSTRAINT tarot_readings_position_check
    CHECK (position IS NULL OR position IN ('CARD I', 'CARD II', 'CARD III'))
);

CREATE INDEX tarot_readings_user_idx
  ON tarot_readings (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- ai_messages
--
-- The generated letter is stored as jsonb because the UI renders it as several
-- distinct blocks (title, subtitle, whisper, affirmation, ritual, frequency),
-- not as one body of text. Its shape is validated by Zod before it is written,
-- so the jsonb is structured data, not a dumping ground.
-- ---------------------------------------------------------------------------
CREATE TABLE ai_messages (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid REFERENCES users(id) ON DELETE SET NULL,
  mood              text,
  user_input        text,
  generated_message jsonb NOT NULL,
  model             text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_messages_user_idx
  ON ai_messages (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;
