/**
 * Tarot over HTTP, and the forgery model.
 *
 * The central claim of this phase is that a client cannot choose its own card.
 * These tests attempt each of the eight documented attacks against the real
 * middleware chain and assert that none of them work.
 */
import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { startTestServer, testEmail, type TestServer } from './helpers/testServer.js';

let api: TestServer;
const CREATED_DRAWS: string[] = [];

interface DrawBody {
  drawId: string;
  cards: {
    position: number;
    positionName: string;
    orientation: string;
    meaning: string;
    card: { id: string; name: string; slug: string };
  }[];
  interpreted: boolean;
}

before(async () => {
  api = await startTestServer();
});

after(async () => {
  const { getPool, closePool } = await import('../src/db/pool.js');
  if (CREATED_DRAWS.length > 0) {
    await getPool().query(
      `DELETE FROM tarot_readings WHERE id IN (
         SELECT reading_id FROM tarot_draw_cards
          WHERE draw_id = ANY($1::uuid[]) AND reading_id IS NOT NULL)`,
      [CREATED_DRAWS],
    );
    await getPool().query('DELETE FROM tarot_draws WHERE id = ANY($1::uuid[])', [CREATED_DRAWS]);
  }
  await getPool().query(`DELETE FROM users WHERE email LIKE 'phase5b-%@tests.invalid'`);
  await closePool();
  await api.close();
});

async function drawCard(options: { token?: string; body?: unknown } = {}): Promise<DrawBody> {
  const response = await api.request('POST', '/api/tarot/draw', {
    body: options.body ?? {},
    ...(options.token === undefined ? {} : { token: options.token }),
  });
  assert.equal(response.status, 201, response.raw);
  const data = response.body.data as DrawBody;
  CREATED_DRAWS.push(data.drawId);
  return data;
}

async function register(label: string): Promise<{ token: string; id: string }> {
  const response = await api.request('POST', '/api/auth/register', {
    body: { email: testEmail(label).replace('phase3-', 'phase5b-'), password: 'a-quiet-constellation-77' },
  });
  assert.equal(response.status, 201, response.raw);
  const data = response.body.data as { token: string; user: { id: string } };
  return { token: data.token, id: data.user.id };
}

// --- the deck -----------------------------------------------------------------
test('GET /api/tarot/cards returns the whole deck without meanings', async () => {
  const response = await api.request('GET', '/api/tarot/cards');
  assert.equal(response.status, 200, response.raw);

  const data = response.body.data as { cards: Record<string, unknown>[] };
  assert.equal(data.cards.length, 78);

  const raw = response.raw.toLowerCase();
  assert.ok(!raw.includes('upright_meaning'), 'no raw column names');
  assert.ok(!raw.includes('uprightmeaning'), 'the listing must not carry meanings');
});

// --- draw ---------------------------------------------------------------------
test('POST /api/tarot/draw works anonymously and returns one card', async () => {
  const draw = await drawCard();

  assert.match(draw.drawId, /^[0-9a-f-]{36}$/);
  assert.equal(draw.cards.length, 1);
  assert.equal(draw.cards[0]?.positionName, 'CARD I');
  assert.ok(['upright', 'reversed'].includes(draw.cards[0]?.orientation ?? ''));
  assert.equal(draw.interpreted, false);
});

test('a question is optional and is echoed back when given', async () => {
  const withQuestion = await api.request('POST', '/api/tarot/draw', {
    body: { question: 'What should I pay attention to?' },
  });
  assert.equal(withQuestion.status, 201, withQuestion.raw);
  const data = withQuestion.body.data as { drawId: string; question: string };
  CREATED_DRAWS.push(data.drawId);
  assert.equal(data.question, 'What should I pay attention to?');
});

// --- ATTACK 1: a forged card id ------------------------------------------------
test('ATTACK: sending a cardId in the draw request is rejected outright', async () => {
  const response = await api.request('POST', '/api/tarot/draw', {
    body: { cardId: '00000000-0000-4000-8000-000000000000' },
  });

  // Rejected, NOT silently ignored. A silent drop would pass a test today and
  // become a vulnerability the moment someone added the field to the schema.
  assert.equal(response.status, 400, response.raw);
  assert.equal(response.body.error?.code, 'VALIDATION_ERROR');
});

// --- ATTACK 2: a forged card name ----------------------------------------------
test('ATTACK: sending a card name is rejected outright', async () => {
  for (const body of [{ cardName: 'The Sun' }, { card: 'the-sun' }, { slug: 'the-sun' }]) {
    const response = await api.request('POST', '/api/tarot/draw', { body });
    assert.equal(response.status, 400, `${JSON.stringify(body)}: ${response.raw}`);
  }
});

// --- ATTACK 3: a forged orientation --------------------------------------------
test('ATTACK: sending an orientation is rejected outright', async () => {
  const response = await api.request('POST', '/api/tarot/draw', {
    body: { orientation: 'upright' },
  });
  assert.equal(response.status, 400, response.raw);
});

// --- ATTACK 4: changing orientation at interpret time --------------------------
test('ATTACK: extra fields on interpret are rejected, and orientation cannot be changed', async () => {
  const draw = await drawCard();
  const drawn = draw.cards[0];
  assert.ok(drawn);

  const flipped = drawn.orientation === 'upright' ? 'reversed' : 'upright';
  const forged = await api.request('POST', '/api/tarot/interpret', {
    body: { drawId: draw.drawId, orientation: flipped, cardId: '00000000-0000-4000-8000-000000000000' },
  });
  assert.equal(forged.status, 400, forged.raw);

  // And the honest call still reports the orientation the SERVER chose.
  const honest = await api.request('POST', '/api/tarot/interpret', {
    body: { drawId: draw.drawId },
  });
  assert.equal(honest.status, 200, honest.raw);
  const data = honest.body.data as DrawBody;
  assert.equal(data.cards[0]?.orientation, drawn.orientation);
  assert.equal(data.cards[0]?.card.id, drawn.card.id);
});

// --- ATTACK 5: another user's draw ----------------------------------------------
test('ATTACK: one account cannot interpret or read another account\'s draw', async () => {
  const owner = await register('owner');
  const intruder = await register('intruder');

  const draw = await drawCard({ token: owner.token });

  // Interpreting it as someone else.
  const stolen = await api.request('POST', '/api/tarot/interpret', {
    body: { drawId: draw.drawId },
    token: intruder.token,
  });
  assert.equal(stolen.status, 404, stolen.raw);
  assert.equal(stolen.body.error?.code, 'NOT_FOUND');

  // And anonymously.
  const anonymous = await api.request('POST', '/api/tarot/interpret', {
    body: { drawId: draw.drawId },
  });
  assert.equal(anonymous.status, 404, anonymous.raw);

  // Reading it in history as someone else.
  const peeked = await api.request('GET', `/api/tarot/history/${draw.drawId}`, {
    token: intruder.token,
  });
  assert.equal(peeked.status, 404, peeked.raw);

  // The owner still can.
  const mine = await api.request('GET', `/api/tarot/history/${draw.drawId}`, {
    token: owner.token,
  });
  assert.equal(mine.status, 200, mine.raw);
});

test('a draw that belongs to someone else is reported as missing, not forbidden', async () => {
  // 403 would confirm the draw exists. 404 discloses nothing.
  const owner = await register('privacy');
  const draw = await drawCard({ token: owner.token });

  const response = await api.request('GET', `/api/tarot/history/${draw.drawId}`);
  assert.equal(response.status, 404);
  assert.equal(response.body.error?.code, 'NOT_FOUND');
  assert.ok(!response.raw.toLowerCase().includes('forbidden'));
});

// --- ATTACK 6: substituting a draw id ------------------------------------------
test('ATTACK: swapping in another draw id returns that draw, never the requested card', async () => {
  const first = await drawCard();
  const second = await drawCard();

  const response = await api.request('POST', '/api/tarot/interpret', {
    body: { drawId: second.drawId },
  });
  assert.equal(response.status, 200, response.raw);

  const data = response.body.data as DrawBody;
  // The card follows the draw id, and cannot be steered by anything else.
  assert.equal(data.cards[0]?.card.id, second.cards[0]?.card.id);
  assert.notEqual(data.drawId, first.drawId);
});

test('a malformed or unknown drawId is refused', async () => {
  const malformed = await api.request('POST', '/api/tarot/interpret', {
    body: { drawId: 'not-a-uuid' },
  });
  assert.equal(malformed.status, 400, malformed.raw);

  const unknown = await api.request('POST', '/api/tarot/interpret', {
    body: { drawId: '00000000-0000-4000-8000-000000000000' },
  });
  assert.equal(unknown.status, 404, unknown.raw);
});

test('an interpret request with no drawId is refused', async () => {
  const response = await api.request('POST', '/api/tarot/interpret', { body: {} });
  assert.equal(response.status, 400, response.raw);
});

// --- ATTACK 7: duplicate cards in one draw --------------------------------------
test('ATTACK: the database refuses two of the same card in one draw', async () => {
  const { getPool } = await import('../src/db/pool.js');
  const draw = await drawCard();
  const drawn = draw.cards[0];
  assert.ok(drawn);

  // Attempted directly against the database, bypassing every application
  // check, because the constraint is the guarantee that actually matters.
  await assert.rejects(
    () =>
      getPool().query(
        `INSERT INTO tarot_draw_cards (draw_id, card_id, position, position_name, orientation)
         VALUES ($1, $2, 1, 'CARD II', 'upright')`,
        [draw.drawId, drawn.card.id],
      ),
    /tarot_draw_cards_unique_card/,
    'the same card must not appear twice in one draw',
  );
});

test('the database refuses two cards in the same position', async () => {
  const { getPool } = await import('../src/db/pool.js');
  const draw = await drawCard();

  const other = await getPool().query<{ id: string }>(
    'SELECT id FROM tarot_cards WHERE id <> $1 LIMIT 1',
    [draw.cards[0]?.card.id],
  );

  await assert.rejects(
    () =>
      getPool().query(
        `INSERT INTO tarot_draw_cards (draw_id, card_id, position, position_name, orientation)
         VALUES ($1, $2, 0, 'CARD I', 'upright')`,
        [draw.drawId, other.rows[0]?.id],
      ),
    /tarot_draw_cards_unique_position/,
  );
});

test('the database refuses an invalid orientation, position or spread', async () => {
  const { getPool } = await import('../src/db/pool.js');
  const draw = await drawCard();

  await assert.rejects(
    () =>
      getPool().query(
        `INSERT INTO tarot_draw_cards (draw_id, card_id, position, position_name, orientation)
         VALUES ($1, (SELECT id FROM tarot_cards LIMIT 1), 1, 'CARD II', 'sideways')`,
        [draw.drawId],
      ),
    /tarot_draw_cards_orientation_check/,
  );

  await assert.rejects(
    () =>
      getPool().query(
        `INSERT INTO tarot_draw_cards (draw_id, card_id, position, position_name, orientation)
         VALUES ($1, (SELECT id FROM tarot_cards LIMIT 1), 9, 'CARD II', 'upright')`,
        [draw.drawId],
      ),
    /tarot_draw_cards_position_check/,
  );

  await assert.rejects(
    () =>
      getPool().query(
        `INSERT INTO tarot_draws (spread, expires_at) VALUES ('celtic-cross', now() + interval '1 day')`,
      ),
    /tarot_draws_spread_check/,
    'a spread this version cannot serve must be refused by the database',
  );
});

// --- ATTACK 8: repeated interpretation ------------------------------------------
test('ATTACK: repeated interpretation returns the same reading and generates once', async () => {
  const draw = await drawCard();

  const first = await api.request('POST', '/api/tarot/interpret', { body: { drawId: draw.drawId } });
  assert.equal(first.status, 200, first.raw);

  const second = await api.request('POST', '/api/tarot/interpret', { body: { drawId: draw.drawId } });
  const third = await api.request('POST', '/api/tarot/interpret', { body: { drawId: draw.drawId } });

  assert.equal(second.raw, first.raw, 'byte-identical, so no new generation happened');
  assert.equal(third.raw, first.raw);

  const { getPool } = await import('../src/db/pool.js');
  const rows = await getPool().query(
    `SELECT r.id FROM tarot_readings r
       JOIN tarot_draw_cards c ON c.reading_id = r.id
      WHERE c.draw_id = $1`,
    [draw.drawId],
  );
  assert.equal(rows.rowCount, 1, 'exactly one reading row');
});

// --- history --------------------------------------------------------------------
test('history requires an account', async () => {
  const response = await api.request('GET', '/api/tarot/history');
  assert.equal(response.status, 401, response.raw);
  assert.equal(response.body.error?.code, 'UNAUTHORIZED');
});

test('history returns the signed-in user\'s own draws', async () => {
  const user = await register('history');
  const draw = await drawCard({ token: user.token });

  const response = await api.request('GET', '/api/tarot/history', { token: user.token });
  assert.equal(response.status, 200, response.raw);

  const data = response.body.data as { readings: { drawId: string }[] };
  assert.ok(data.readings.some((entry) => entry.drawId === draw.drawId));
});

test('an anonymous draw is readable by its opaque id', async () => {
  const draw = await drawCard();
  const response = await api.request('GET', `/api/tarot/history/${draw.drawId}`);
  assert.equal(response.status, 200, response.raw);
  assert.equal((response.body.data as DrawBody).drawId, draw.drawId);
});

// --- leakage ----------------------------------------------------------------------
test('no tarot response exposes credentials or internals', async () => {
  const user = await register('leak');
  const draw = await drawCard({ token: user.token });
  await api.request('POST', '/api/tarot/interpret', { body: { drawId: draw.drawId }, token: user.token });

  const responses = [
    await api.request('GET', '/api/tarot/cards'),
    await api.request('POST', '/api/tarot/draw', { body: {} }),
    await api.request('POST', '/api/tarot/interpret', { body: { drawId: draw.drawId }, token: user.token }),
    await api.request('GET', '/api/tarot/history', { token: user.token }),
    await api.request('GET', `/api/tarot/history/${draw.drawId}`, { token: user.token }),
  ];
  const created = (responses[1]?.body.data as DrawBody | undefined)?.drawId;
  if (created) CREATED_DRAWS.push(created);

  for (const response of responses) {
    const raw = response.raw.toLowerCase();
    for (const leak of [
      'password',
      'password_hash',
      'jwt_secret',
      'database_url',
      'sslmode',
      'postgres',
      'neon',
      'select ',
      'insert into',
      'sqlstate',
      'stack',
      'user_id',
    ]) {
      assert.ok(!raw.includes(leak), `response must not contain "${leak}"`);
    }
  }
});
