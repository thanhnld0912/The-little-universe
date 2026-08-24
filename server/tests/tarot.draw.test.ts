/**
 * Draw, interpretation, idempotency and the forgery model.
 *
 * These exercise the service directly so AI generations can be counted. The
 * HTTP-level forgery attempts live in tests/tarot.routes.test.ts.
 */
import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import {
  drawSingleCard,
  getHistoryEntry,
  interpretDraw,
  listHistory,
  selectCardIds,
  selectOrientation,
} from '../src/services/tarot.service.js';
import { createCountingProvider } from './helpers/countingProvider.js';
import { getPool, closePool } from '../src/db/pool.js';
import { queryAll, queryOne } from '../src/db/query.js';

const CREATED_DRAWS: string[] = [];

/** Draws and remembers the id so the row can be removed afterwards. */
async function draw(options: { userId?: string | null; question?: string | null } = {}) {
  const result = await drawSingleCard({
    userId: options.userId ?? null,
    question: options.question ?? null,
  });
  CREATED_DRAWS.push(result.drawId);
  return result;
}

after(async () => {
  if (CREATED_DRAWS.length > 0) {
    // Readings are detached by ON DELETE SET NULL, so remove them explicitly.
    await getPool().query(
      `DELETE FROM tarot_readings WHERE id IN (
         SELECT reading_id FROM tarot_draw_cards
          WHERE draw_id = ANY($1::uuid[]) AND reading_id IS NOT NULL)`,
      [CREATED_DRAWS],
    );
    await getPool().query('DELETE FROM tarot_draws WHERE id = ANY($1::uuid[])', [CREATED_DRAWS]);
  }
  await closePool();
});

// --- selection ---------------------------------------------------------------
test('card selection never repeats a card within one draw', () => {
  const deck = Array.from({ length: 78 }, (_unused, index) => `card-${index}`);
  for (let round = 0; round < 200; round += 1) {
    const picked = selectCardIds(deck, 3);
    assert.equal(picked.length, 3);
    assert.equal(new Set(picked).size, 3, 'a card must not appear twice in one selection');
  }
});

test('card selection always returns real cards from the deck', () => {
  const deck = Array.from({ length: 78 }, (_unused, index) => `card-${index}`);
  const valid = new Set(deck);
  for (let round = 0; round < 300; round += 1) {
    for (const id of selectCardIds(deck, 1)) {
      assert.ok(valid.has(id), `selection produced an id outside the deck: ${id}`);
    }
  }
});

test('card selection is not stuck on one card or one region of the deck', () => {
  // A sanity check, NOT a uniformity test. It is sized to catch a genuinely
  // broken selector — always index 0, always the same suit, an off-by-one that
  // can never reach the last card — while being far too loose to fail on
  // ordinary statistical noise.
  const deck = Array.from({ length: 78 }, (_unused, index) => `card-${index}`);
  const seen = new Set<string>();
  for (let round = 0; round < 2000; round += 1) {
    seen.add(selectCardIds(deck, 1)[0] as string);
  }
  assert.ok(seen.size > 60, `expected most of the deck across 2000 draws, saw ${seen.size}`);
  assert.ok(seen.has('card-0'), 'the first card must be reachable');
  assert.ok(seen.has('card-77'), 'the last card must be reachable — guards an off-by-one');
});

test('orientation is not stuck on one value', () => {
  const counts = { upright: 0, reversed: 0 };
  for (let round = 0; round < 1000; round += 1) counts[selectOrientation()] += 1;
  // Deliberately wide: this detects "always upright", not a biased coin.
  assert.ok(counts.upright > 200, `upright appeared ${counts.upright} times in 1000`);
  assert.ok(counts.reversed > 200, `reversed appeared ${counts.reversed} times in 1000`);
});

test('drawing more cards than the deck holds is refused', () => {
  assert.throws(() => selectCardIds(['a', 'b'], 3), /Cannot draw 3 cards/);
});

// --- drawing ------------------------------------------------------------------
test('a draw returns one card and an opaque draw id', async () => {
  const result = await draw();

  assert.match(result.drawId, /^[0-9a-f-]{36}$/);
  assert.equal(result.spread, 'single');
  assert.equal(result.cards.length, 1);
  assert.equal(result.interpreted, false);

  const drawn = result.cards[0];
  assert.ok(drawn);
  assert.equal(drawn.position, 0);
  assert.equal(drawn.positionName, 'CARD I');
  assert.ok(['upright', 'reversed'].includes(drawn.orientation));
  assert.ok(drawn.card.name.length > 0);
  assert.ok(drawn.meaning.length > 0);
});

test('the draw is persisted BEFORE the client is told anything', async () => {
  const result = await draw();

  // If the response arrived before the write, this row would not exist yet.
  const row = await queryOne<{ card_id: string; orientation: string; position: number }>(
    getPool(),
    'SELECT card_id, orientation, position FROM tarot_draw_cards WHERE draw_id = $1',
    [result.drawId],
  );

  assert.ok(row, 'the drawn card must already be in the database');
  assert.equal(row.card_id, result.cards[0]?.card.id);
  assert.equal(row.orientation, result.cards[0]?.orientation);
  assert.equal(row.position, 0);
});

test('the meaning returned matches the orientation drawn', async () => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const result = await draw();
    const drawn = result.cards[0];
    assert.ok(drawn);

    const card = await queryOne<{ upright_meaning: string; reversed_meaning: string }>(
      getPool(),
      'SELECT upright_meaning, reversed_meaning FROM tarot_cards WHERE id = $1',
      [drawn.card.id],
    );
    const expected =
      drawn.orientation === 'upright' ? card?.upright_meaning : card?.reversed_meaning;
    assert.equal(drawn.meaning, expected, `wrong meaning for ${drawn.orientation}`);
  }
});

test('a draw records the question when one is asked, and null when not', async () => {
  const asked = await draw({ question: 'Should I say something?' });
  assert.equal(asked.question, 'Should I say something?');

  const silent = await draw();
  assert.equal(silent.question, null, 'an absent question is null, never an empty string');
});

test('an anonymous draw has no user attached', async () => {
  const result = await draw();
  const row = await queryOne<{ user_id: string | null }>(
    getPool(),
    'SELECT user_id FROM tarot_draws WHERE id = $1',
    [result.drawId],
  );
  assert.equal(row?.user_id, null);
});

// --- interpretation -----------------------------------------------------------
test('interpretation reads the card from the draw, not from the caller', async () => {
  const drawn = await draw();
  const provider = createCountingProvider();

  const result = await interpretDraw({
    drawId: drawn.drawId,
    requesterId: null,
    provider,
  });

  assert.equal(provider.tarotCalls, 1);
  assert.equal(result.cards[0]?.card.id, drawn.cards[0]?.card.id, 'same card as drawn');
  assert.equal(result.cards[0]?.orientation, drawn.cards[0]?.orientation, 'same orientation');
  assert.equal(result.interpreted, true);

  assert.ok(result.reading.title.length > 0);
  assert.ok(result.reading.summary.length > 0);
  assert.ok(result.reading.interpretation.length > 0);
  assert.ok(result.reading.guidance.length > 0);
  assert.ok(result.reading.reflectionQuestion.length > 0);
});

test('IDEMPOTENT: a second interpretation performs ZERO additional AI generations', async () => {
  const drawn = await draw();
  const provider = createCountingProvider();

  const first = await interpretDraw({ drawId: drawn.drawId, requesterId: null, provider });
  assert.equal(provider.tarotCalls, 1, 'the first interpretation generates exactly once');

  const second = await interpretDraw({ drawId: drawn.drawId, requesterId: null, provider });

  // The requirement, stated exactly: still 1, not 2.
  assert.equal(provider.tarotCalls, 1, 'the second interpretation must not call the provider');
  assert.deepEqual(second.reading, first.reading, 'and must return the identical reading');

  const rows = await queryAll(
    getPool(),
    `SELECT r.id FROM tarot_readings r
       JOIN tarot_draw_cards c ON c.reading_id = r.id
      WHERE c.draw_id = $1`,
    [drawn.drawId],
  );
  assert.equal(rows.length, 1, 'exactly one reading row, never a duplicate');
});

test('repeated interpretation stays at one generation however many times it is called', async () => {
  const drawn = await draw();
  const provider = createCountingProvider();

  const first = await interpretDraw({ drawId: drawn.drawId, requesterId: null, provider });
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const repeat = await interpretDraw({ drawId: drawn.drawId, requesterId: null, provider });
    assert.deepEqual(repeat.reading, first.reading);
  }
  assert.equal(provider.tarotCalls, 1, 'five interpretations, one generation');
});

test('a fresh provider does not regenerate an already-interpreted draw', async () => {
  const drawn = await draw();
  const original = await interpretDraw({
    drawId: drawn.drawId,
    requesterId: null,
    provider: createCountingProvider(),
  });

  const cold = createCountingProvider();
  const again = await interpretDraw({ drawId: drawn.drawId, requesterId: null, provider: cold });

  assert.equal(cold.tarotCalls, 0, 'the reading lives in Postgres, not in process memory');
  assert.deepEqual(again.reading, original.reading);
});

test('concurrent interpretations produce exactly one reading', async () => {
  const drawn = await draw();
  const provider = createCountingProvider();

  const results = await Promise.all([
    interpretDraw({ drawId: drawn.drawId, requesterId: null, provider }),
    interpretDraw({ drawId: drawn.drawId, requesterId: null, provider }),
    interpretDraw({ drawId: drawn.drawId, requesterId: null, provider }),
  ]);

  const rows = await queryAll(
    getPool(),
    `SELECT r.id FROM tarot_readings r
       JOIN tarot_draw_cards c ON c.reading_id = r.id
      WHERE c.draw_id = $1`,
    [drawn.drawId],
  );
  assert.equal(rows.length, 1, 'the row lock must permit only one reading');

  for (const result of results) {
    assert.deepEqual(result.reading, results[0]?.reading, 'every caller sees the same reading');
  }
});

test('the orientation never changes between draw, interpret and history', async () => {
  const drawn = await draw();
  const original = drawn.cards[0]?.orientation;

  const interpreted = await interpretDraw({
    drawId: drawn.drawId,
    requesterId: null,
    provider: createCountingProvider(),
  });
  const history = await getHistoryEntry(drawn.drawId, null);

  assert.equal(interpreted.cards[0]?.orientation, original, 'interpret must not re-orient');
  assert.equal(history.cards[0]?.orientation, original, 'history must not re-orient');

  const stored = await queryOne<{ orientation: string }>(
    getPool(),
    'SELECT orientation FROM tarot_draw_cards WHERE draw_id = $1',
    [drawn.drawId],
  );
  assert.equal(stored?.orientation, original);
});

// --- failure paths -------------------------------------------------------------
test('an unknown draw id is not found', async () => {
  await assert.rejects(
    () =>
      interpretDraw({
        drawId: '00000000-0000-4000-8000-000000000000',
        requesterId: null,
        provider: createCountingProvider(),
      }),
    (error: unknown) => (error as { code?: string }).code === 'NOT_FOUND',
  );
});

/**
 * Expiry is exercised by advancing the CLOCK rather than by backdating the
 * row.
 *
 * The obvious approach — `UPDATE tarot_draws SET expires_at = now() - 1 hour`
 * — is refused by the `expires_at > created_at` CHECK constraint, which is
 * correct: a draw that was already expired when it was created is not a state
 * the system should be able to reach, in production or in a test. Passing a
 * later `now` tests the same rule without manufacturing an impossible row.
 */
const TWO_DAYS_MS = 48 * 60 * 60 * 1000;

test('an expired draw cannot be interpreted', async () => {
  const drawn = await draw();
  const provider = createCountingProvider();
  const later = new Date(Date.now() + TWO_DAYS_MS);

  await assert.rejects(
    () => interpretDraw({ drawId: drawn.drawId, requesterId: null, provider, now: later }),
    (error: unknown) => {
      const app = error as { code?: string; status?: number };
      assert.equal(app.code, 'CONFLICT');
      assert.equal(app.status, 409);
      return true;
    },
  );
  assert.equal(provider.tarotCalls, 0, 'an expired draw must not reach the provider');
});

test('an already-interpreted draw stays readable after it expires', async () => {
  // Expiry blocks NEW interpretation; it does not erase what already happened.
  const drawn = await draw();
  const provider = createCountingProvider();
  const original = await interpretDraw({ drawId: drawn.drawId, requesterId: null, provider });

  const later = new Date(Date.now() + TWO_DAYS_MS);
  const again = await interpretDraw({
    drawId: drawn.drawId,
    requesterId: null,
    provider,
    now: later,
  });

  assert.deepEqual(again.reading, original.reading);
  assert.equal(provider.tarotCalls, 1, 'still no second generation');

  const history = await getHistoryEntry(drawn.drawId, null);
  assert.ok('reading' in history, 'an expired draw keeps its reading in history');
});

test('the database refuses a draw that expires before it was created', async () => {
  // The constraint that shaped the two tests above, asserted directly.
  await assert.rejects(
    () =>
      getPool().query(
        `INSERT INTO tarot_draws (spread, expires_at, created_at)
         VALUES ('single', now() - interval '2 hours', now())`,
      ),
    /tarot_draws_expiry_check/,
  );
});

test('malformed AI output is rejected and no reading is stored', async () => {
  const drawn = await draw();
  const provider = createCountingProvider({ tarot: () => ({ title: 'incomplete' }) });

  await assert.rejects(
    () => interpretDraw({ drawId: drawn.drawId, requesterId: null, provider }),
    (error: unknown) => {
      const app = error as { code?: string; status?: number };
      assert.equal(app.code, 'UPSTREAM_ERROR');
      assert.equal(app.status, 502);
      return true;
    },
  );

  assert.equal(provider.tarotCalls, 2, 'retried exactly once, then a controlled failure');

  const row = await queryOne<{ reading_id: string | null }>(
    getPool(),
    'SELECT reading_id FROM tarot_draw_cards WHERE draw_id = $1',
    [drawn.drawId],
  );
  assert.equal(row?.reading_id, null, 'nothing invalid may be attached to the draw');
});

test('an invented extra field in AI output is rejected', async () => {
  const drawn = await draw();
  const provider = createCountingProvider({
    tarot: () => ({
      title: 'A Quiet Turning',
      summary: 'A summary.',
      interpretation: 'An interpretation of some length.',
      guidance: 'Some guidance.',
      reflectionQuestion: 'A question?',
      // The model must not be able to smuggle a card claim into the reading.
      cardName: 'The Sun',
    }),
  });

  await assert.rejects(
    () => interpretDraw({ drawId: drawn.drawId, requesterId: null, provider }),
    (error: unknown) => (error as { code?: string }).code === 'UPSTREAM_ERROR',
  );
});

test('a provider failure stores nothing and leaves the draw interpretable later', async () => {
  const drawn = await draw();

  const failing = createCountingProvider({
    tarot: () => {
      throw new Error('model host unreachable');
    },
  });
  await assert.rejects(
    () => interpretDraw({ drawId: drawn.drawId, requesterId: null, provider: failing }),
    (error: unknown) => (error as { code?: string }).code === 'UPSTREAM_ERROR',
  );

  const empty = await queryOne<{ reading_id: string | null }>(
    getPool(),
    'SELECT reading_id FROM tarot_draw_cards WHERE draw_id = $1',
    [drawn.drawId],
  );
  assert.equal(empty?.reading_id, null);

  // The earlier failure must not have poisoned the draw.
  const working = createCountingProvider();
  const result = await interpretDraw({ drawId: drawn.drawId, requesterId: null, provider: working });
  assert.ok(result.reading.title.length > 0);
  assert.equal(working.tarotCalls, 1);
});

// --- history ------------------------------------------------------------------
test('history lists only the requesting user\'s own draws', async () => {
  const { getPool: pool } = await import('../src/db/pool.js');
  const owner = await queryOne<{ id: string }>(
    pool(),
    `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
    [`tarot-history-${Date.now()}@tests.invalid`, 'x'.repeat(60)],
  );
  const other = await queryOne<{ id: string }>(
    pool(),
    `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
    [`tarot-other-${Date.now()}@tests.invalid`, 'x'.repeat(60)],
  );
  assert.ok(owner && other);

  const mine = await draw({ userId: owner.id, question: 'mine' });
  const theirs = await draw({ userId: other.id, question: 'theirs' });

  const history = await listHistory(owner.id);
  const ids = history.map((entry) => entry.drawId);

  assert.ok(ids.includes(mine.drawId), 'my own draw should appear');
  assert.ok(!ids.includes(theirs.drawId), 'another account\'s draw must never appear');

  await pool().query('DELETE FROM users WHERE id = ANY($1::uuid[])', [[owner.id, other.id]]);
});

test('history entries expose no credentials or internal fields', async () => {
  const user = await queryOne<{ id: string }>(
    getPool(),
    `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
    [`tarot-leak-${Date.now()}@tests.invalid`, 'x'.repeat(60)],
  );
  assert.ok(user);
  await draw({ userId: user.id });

  const history = await listHistory(user.id);
  const serialised = JSON.stringify(history).toLowerCase();

  for (const leak of ['password', 'hash', 'user_id', 'userid', 'token', 'secret', 'email']) {
    assert.ok(!serialised.includes(leak), `history must not contain "${leak}"`);
  }

  await getPool().query('DELETE FROM users WHERE id = $1', [user.id]);
});
