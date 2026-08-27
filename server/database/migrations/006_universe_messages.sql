-- ---------------------------------------------------------------------------
-- 006_universe_messages
--
-- The "message from the universe" the message view asks for.
--
-- Keyed by (subject, date, mood, prompt) so it behaves like the rest of the
-- app: asking the same thing twice returns what you were already given and
-- generates nothing, while a different mood or different words is a different
-- request and produces a new message. Two people asking the same thing on the
-- same day still get different messages, because the subject is part of the
-- generation seed as well as the key.
--
-- `prompt` is NOT NULL with '' meaning "they wrote nothing", rather than
-- nullable. That is not a style choice: in SQL two NULLs are not equal, so a
-- nullable column would let the same person create unlimited duplicate rows for
-- the promptless case and the cache would never hit. The API still omits the
-- field entirely rather than returning '' to the client.
-- ---------------------------------------------------------------------------

CREATE TABLE universe_messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Same shape as the predictions tables: 'user:<uuid>' or 'visitor:<uuid>'.
  subject_id       text NOT NULL,
  date             date NOT NULL,

  mood             text NOT NULL,
  -- Their own words, verbatim. '' when they wrote none. See the note above.
  prompt           text NOT NULL DEFAULT '',

  title            text NOT NULL,
  subtitle         text NOT NULL,
  whisper          text NOT NULL,
  affirmation      text NOT NULL,
  action_guidance  text NOT NULL,
  lucky_number     smallint NOT NULL,
  cosmic_energy    text NOT NULL,

  -- Calculated from the sky, not written by the model.
  celestial_sign   text NOT NULL,

  model            text NOT NULL,
  astronomy        jsonb NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT universe_messages_subject_id_check
    CHECK (
      subject_id ~ '^(user|visitor):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ),

  -- The closed set the view offers. An unrecognised mood cannot be stored and
  -- then fail to render.
  CONSTRAINT universe_messages_mood_check
    CHECK (mood IN ('quiet', 'romantic', 'hopeful', 'restless', 'peaceful', 'mystical')),

  CONSTRAINT universe_messages_lucky_number_check
    CHECK (lucky_number BETWEEN 0 AND 99),

  -- Matches the limit the API enforces, so an oversized prompt is refused by
  -- the database too rather than only by validation.
  CONSTRAINT universe_messages_prompt_length_check
    CHECK (char_length(prompt) <= 200),

  CONSTRAINT universe_messages_subject_request_key
    UNIQUE (subject_id, date, mood, prompt)
);

-- History for a signed-in account, newest first.
CREATE INDEX universe_messages_subject_created_idx
  ON universe_messages (subject_id, created_at DESC);
