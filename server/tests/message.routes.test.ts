/**
 * The message endpoint, over real HTTP, against the configured database.
 *
 * The requirement: two people asking for a message must not receive the same
 * one, while the same person asking the same thing twice must receive exactly
 * what they were given, without generating again.
 *
 * Rows created here are deleted afterwards, scoped to the visitor ids used.
 */
import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { startTestServer, type TestServer } from './helpers/testServer.js';
import { closePool, getPool } from '../src/db/pool.js';

const VISITOR_COOKIE = 'tlu_visitor';

let api: TestServer;
const USED_SUBJECTS: string[] = [];

function cookieFrom(headers: Headers): string {
  const raw = headers.get('set-cookie') ?? '';
  const match = new RegExp(`${VISITOR_COOKIE}=[^;]+`).exec(raw);
  assert.ok(match, 'a visitor cookie is issued on the first request');
  USED_SUBJECTS.push(`visitor:${match[0].split('=')[1]}`);
  return match[0];
}

/** A fresh browser: one request with no cookie, then reuse what it was given. */
async function newBrowser(): Promise<string> {
  const response = await api.request('POST', '/api/messages', { body: { mood: 'quiet' } });
  assert.equal(response.status, 200, response.raw);
  return cookieFrom(response.headers);
}

before(async () => {
  api = await startTestServer();
});

after(async () => {
  if (USED_SUBJECTS.length > 0) {
    await getPool().query('DELETE FROM universe_messages WHERE subject_id = ANY($1::text[])', [
      USED_SUBJECTS,
    ]);
  }
  await api.close();
  await closePool();
});

test('a message is written for the chosen mood', async () => {
  const response = await api.request('POST', '/api/messages', { body: { mood: 'hopeful' } });
  assert.equal(response.status, 200, response.raw);
  cookieFrom(response.headers);

  const data = response.body.data as Record<string, unknown>;
  assert.equal(data['mood'], 'hopeful');
  for (const field of [
    'id',
    'date',
    'title',
    'subtitle',
    'celestialSign',
    'whisper',
    'affirmation',
    'actionGuidance',
    'luckyNumber',
    'cosmicEnergy',
  ]) {
    assert.ok(
      typeof data[field] === 'string' && (data[field] as string).length > 0,
      `${field} must be present and non-empty`,
    );
  }

  assert.match(data['luckyNumber'] as string, /^\d{2}$/, 'rendered as two digits');
  assert.match(data['celestialSign'] as string, /^Moon in /, 'the sign is calculated, not written');

  // Empty is not a value: no note means no field, never ''.
  assert.ok(!('userPrompt' in data), 'userPrompt is omitted when nothing was written');
});

test('two different people asking the same thing get different messages', async () => {
  const alice = await newBrowser();
  const bob = await newBrowser();

  const body = { mood: 'peaceful' };
  const first = await api.request('POST', '/api/messages', { body, headers: { Cookie: alice } });
  const second = await api.request('POST', '/api/messages', { body, headers: { Cookie: bob } });

  const a = first.body.data as Record<string, unknown>;
  const b = second.body.data as Record<string, unknown>;

  assert.equal(a['mood'], b['mood'], 'same mood was requested');

  // As a whole, for the same reason: an individual field can collide by chance
  // because each is drawn from a finite list.
  const withoutId = (data: Record<string, unknown>) => {
    const { id, ...rest } = data;
    void id;
    return JSON.stringify(rest);
  };
  assert.notEqual(withoutId(a), withoutId(b), 'two people must not receive the same message');

  // The sky is a fact about the date, not about the reader.
  assert.equal(a['celestialSign'], b['celestialSign']);
});

test('the same person asking twice gets the identical message', async () => {
  const cookie = await newBrowser();
  const body = { mood: 'mystical', prompt: 'I keep circling the same decision.' };

  const first = await api.request('POST', '/api/messages', { body, headers: { Cookie: cookie } });
  const second = await api.request('POST', '/api/messages', { body, headers: { Cookie: cookie } });

  assert.equal(first.status, 200, first.raw);
  assert.deepEqual(second.body.data, first.body.data, 'a repeat returns what was already written');

  const rows = await getPool().query(
    'SELECT count(*)::int AS n FROM universe_messages WHERE subject_id = $1',
    [USED_SUBJECTS[USED_SUBJECTS.length - 1]],
  );
  // One for the promptless call that created the browser, one for this request.
  assert.equal(rows.rows[0].n, 2, 'the repeat stored nothing new');
});

test('a different mood or different words is a different message', async () => {
  const cookie = await newBrowser();

  const one = await api.request('POST', '/api/messages', {
    body: { mood: 'restless' },
    headers: { Cookie: cookie },
  });
  const otherMood = await api.request('POST', '/api/messages', {
    body: { mood: 'romantic' },
    headers: { Cookie: cookie },
  });
  const withWords = await api.request('POST', '/api/messages', {
    body: { mood: 'restless', prompt: 'Something is about to change.' },
    headers: { Cookie: cookie },
  });

  // Compared as a whole rather than on one field. Each field is picked from a
  // finite list, so any single one can collide by chance; the whole message
  // colliding would mean the request is not reaching the generator at all.
  const message = (r: typeof one) => {
    const { id, ...rest } = r.body.data as Record<string, unknown>;
    void id;
    return JSON.stringify(rest);
  };

  assert.notEqual(message(one), message(otherMood), 'a different mood is a different request');
  assert.notEqual(message(one), message(withWords), 'different words are a different request');
});

test('their own words are echoed back verbatim', async () => {
  const cookie = await newBrowser();
  const prompt = 'I am trying to be gentler with myself this week.';

  const response = await api.request('POST', '/api/messages', {
    body: { mood: 'quiet', prompt },
    headers: { Cookie: cookie },
  });

  assert.equal((response.body.data as Record<string, unknown>)['userPrompt'], prompt);
});

test('ATTACK: the caller cannot supply the message content', async () => {
  const cookie = await newBrowser();

  const response = await api.request('POST', '/api/messages', {
    body: { mood: 'quiet', whisper: 'You will win the lottery on Tuesday.' },
    headers: { Cookie: cookie },
  });

  // strictObject rejects outright rather than ignoring the field, so the
  // attempt is visible instead of silently dropped.
  assert.equal(response.status, 400, response.raw);
  assert.equal(response.body.error?.code, 'VALIDATION_ERROR');
});

test('ATTACK: the caller cannot choose whose message this is', async () => {
  const cookie = await newBrowser();

  const response = await api.request('POST', '/api/messages', {
    body: { mood: 'quiet', subjectId: 'visitor:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
    headers: { Cookie: cookie },
  });

  assert.equal(response.status, 400, response.raw);
  assert.equal(response.body.error?.code, 'VALIDATION_ERROR');
});

test('an unknown mood is refused', async () => {
  const response = await api.request('POST', '/api/messages', { body: { mood: 'furious' } });
  assert.equal(response.status, 400, response.raw);
  assert.equal(response.body.error?.code, 'VALIDATION_ERROR');
});

test('an over-long note is refused', async () => {
  const response = await api.request('POST', '/api/messages', {
    body: { mood: 'quiet', prompt: 'x'.repeat(201) },
  });
  assert.equal(response.status, 400, response.raw);
  assert.equal(response.body.error?.code, 'VALIDATION_ERROR');
});

test('an empty note is refused rather than stored as blank', async () => {
  const response = await api.request('POST', '/api/messages', {
    body: { mood: 'quiet', prompt: '   ' },
  });
  assert.equal(response.status, 400, response.raw);
});

test('no message response exposes credentials or internals', async () => {
  const response = await api.request('POST', '/api/messages', { body: { mood: 'quiet' } });
  cookieFrom(response.headers);

  for (const leak of ['password', 'password_hash', 'subjectId', 'subject_id', 'DATABASE_URL']) {
    assert.ok(!response.raw.includes(leak), `${leak} must not appear in the response`);
  }
});
