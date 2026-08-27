-- ---------------------------------------------------------------------------
-- 007_shares
--
-- A share is a link you can send to someone who is not you.
--
-- Two things live here because they are mechanically the same feature: sharing
-- a reading you received, and writing a secret message of your own. Both are
-- "durable content behind an unguessable URL, readable by anyone holding it".
--
-- THE PAYLOAD IS A SNAPSHOT, NOT A REFERENCE. What you shared is what the
-- recipient sees, permanently, even if the source row is later removed and even
-- though the reading it came from is keyed to one subject and one day. A
-- reference would also mean the reader endpoint had to reach across four other
-- tables and reason about whose row it was allowed to return; a snapshot has no
-- such question to get wrong.
--
-- THE SERVER BUILDS THE PAYLOAD. There is deliberately no path by which a
-- client supplies it. If there were, anyone could publish arbitrary text on
-- this domain under the app's name — a phishing and impersonation vector, not
-- a theoretical one. `note` is the single exception and is the ONE field a
-- person writes, which is why it is a separate column with its own length
-- limit rather than another key inside the payload.
-- ---------------------------------------------------------------------------

CREATE TABLE shares (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The public identifier, and the only secret protecting the content. Random
  -- and long enough not to be enumerable; see share.service.ts. It is NOT the
  -- primary key, so an internal id is never exposed and never has to be.
  slug        text NOT NULL UNIQUE,

  kind        text NOT NULL,

  -- Who created it. Same shape as everywhere else: 'user:<uuid>' or
  -- 'visitor:<uuid>'. Never returned to a reader — it identifies the sender,
  -- and a share is not a signed statement about who they are.
  subject_id  text NOT NULL,

  -- The server-built snapshot. '{}' for a secret message, which has none.
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- The sender's own words. The only human-supplied content in this table.
  note        text,

  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT shares_kind_check
    CHECK (kind IN ('daily', 'weekly', 'tarot', 'message', 'secret')),

  CONSTRAINT shares_subject_id_check
    CHECK (
      subject_id ~ '^(user|visitor):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    ),

  -- base64url, 16 characters == 96 bits of randomness. Constrained here as
  -- well as in code so a shortened or predictable slug cannot be introduced by
  -- a future caller that forgets to use the generator.
  CONSTRAINT shares_slug_format_check
    CHECK (slug ~ '^[A-Za-z0-9_-]{16,43}$'),

  -- A note belongs to a secret message and to nothing else. Stated as a
  -- constraint because it is the rule that keeps human-written text from
  -- appearing on a share that presents itself as a generated reading.
  CONSTRAINT shares_note_kind_check
    CHECK (
      (kind = 'secret' AND note IS NOT NULL AND char_length(btrim(note)) > 0)
      OR (kind <> 'secret' AND note IS NULL)
    ),

  -- Matches the limit validation enforces, so an oversized note is refused by
  -- the database too rather than only by the API.
  CONSTRAINT shares_note_length_check
    CHECK (note IS NULL OR char_length(note) <= 500)
);

-- Supports the per-sender rate cap, which counts a subject's recent shares.
-- Without it that count is a sequential scan on every single share created.
CREATE INDEX shares_subject_created_idx
  ON shares (subject_id, created_at DESC);
