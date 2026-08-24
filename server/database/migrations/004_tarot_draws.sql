-- 004_tarot_draws.sql
-- Server-authoritative tarot draws.
--
-- THE SECURITY MODEL LIVES HERE
--
-- A client must never be able to say "I drew The Sun" and have the backend
-- interpret that card. So the server decides the card and the orientation,
-- writes that decision down, and hands back only an unguessable draw id. The
-- interpret endpoint accepts nothing but that id and re-reads the decision
-- from these tables. A forged card is therefore not expressible in the API at
-- all, rather than being rejected by a validation rule that someone could
-- later forget to apply.
--
-- The UNIQUE constraints are the database's own guarantee that one card cannot
-- appear twice in a single draw. Application logic also prevents it; that is
-- not a reason to leave the constraint out, because only the constraint holds
-- under a concurrent write or a future code path that forgets.

CREATE TABLE tarot_draws (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Nullable: reading tarot never requires an account. ON DELETE SET NULL so
  -- a deleted account does not cascade away readings that may be shared.
  user_id     uuid REFERENCES users(id) ON DELETE SET NULL,

  -- Only 'single' for now. A wider set is a deliberate future migration, not
  -- a value the API can be tricked into accepting today: the database refuses
  -- any spread this version cannot actually serve.
  spread      text NOT NULL,

  question    text,
  created_at  timestamptz NOT NULL DEFAULT now(),

  -- Unredeemed draws do not live forever. Enforced on read; no background
  -- worker and no cron are introduced for cleanup.
  expires_at  timestamptz NOT NULL,

  CONSTRAINT tarot_draws_spread_check CHECK (spread IN ('single')),
  CONSTRAINT tarot_draws_expiry_check CHECK (expires_at > created_at)
);

CREATE INDEX tarot_draws_user_idx
  ON tarot_draws (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE TABLE tarot_draw_cards (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id       uuid NOT NULL REFERENCES tarot_draws(id) ON DELETE CASCADE,

  -- RESTRICT, not CASCADE: a card is reference data. If something ever tries
  -- to delete a card that a reading depends on, that should fail loudly rather
  -- than quietly erase the reading's subject.
  card_id       uuid NOT NULL REFERENCES tarot_cards(id) ON DELETE RESTRICT,

  -- 0-based slot. The range allows the three-card spread a later phase may
  -- add; the single-card service only ever writes position 0.
  position      smallint NOT NULL,

  -- The label the frontend renders, e.g. 'CARD I'.
  position_name text NOT NULL,

  -- Decided by the server at draw time and NEVER recomputed. Draw, interpret
  -- and history must all report the same orientation.
  orientation   text NOT NULL,

  -- Set once the draw has been interpreted. Its presence is what makes
  -- interpretation idempotent.
  reading_id    uuid REFERENCES tarot_readings(id) ON DELETE SET NULL,

  CONSTRAINT tarot_draw_cards_orientation_check
    CHECK (orientation IN ('upright', 'reversed')),
  CONSTRAINT tarot_draw_cards_position_check
    CHECK (position BETWEEN 0 AND 2),
  CONSTRAINT tarot_draw_cards_position_name_check
    CHECK (position_name IN ('CARD I', 'CARD II', 'CARD III')),

  -- One card per slot.
  CONSTRAINT tarot_draw_cards_unique_position UNIQUE (draw_id, position),
  -- And no card twice in the same draw.
  CONSTRAINT tarot_draw_cards_unique_card UNIQUE (draw_id, card_id)
);

CREATE INDEX tarot_draw_cards_draw_idx ON tarot_draw_cards (draw_id);

COMMENT ON TABLE tarot_draws IS
  'Server-decided draws. The client receives only the opaque id and never selects a card.';
COMMENT ON COLUMN tarot_draw_cards.orientation IS
  'Fixed at draw time. Never re-randomised during interpretation or history.';
