/**
 * Sharing, over real HTTP, against the configured database.
 *
 * Two requirements drive almost every test here:
 *
 *  - A recipient who is not the sender can read the link, without an account
 *    and without being enrolled as a visitor of a site they may never use.
 *  - A caller cannot publish content it wrote. The server builds the snapshot;
 *    a client that could supply the text of a share could publish anything it
 *    liked on this domain under the app's name.
 *
 * Rows created here are deleted afterwards, scoped to the visitors used.
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
  const response = await api.request('GET', '/api/predictions/daily');
  assert.equal(response.status, 200, response.raw);
  return cookieFrom(response.headers);
}

async function share(cookie: string, body: unknown) {
  return api.request('POST', '/api/shares', { body, headers: { cookie } });
}

before(async () => {
  api = await startTestServer();
});

after(async () => {
  if (USED_SUBJECTS.length > 0) {
    const pool = getPool();
    await pool.query('DELETE FROM shares WHERE subject_id = ANY($1::text[])', [USED_SUBJECTS]);
    await pool.query('DELETE FROM daily_predictions WHERE subject_id = ANY($1::text[])', [
      USED_SUBJECTS,
    ]);
    await pool.query('DELETE FROM weekly_predictions WHERE subject_id = ANY($1::text[])', [
      USED_SUBJECTS,
    ]);
    await pool.query('DELETE FROM universe_messages WHERE subject_id = ANY($1::text[])', [
      USED_SUBJECTS,
    ]);
  }
  await api.close();
  await closePool();
});

// --- the core promise -------------------------------------------------------
test('a stranger can read what was shared', async () => {
  const sender = await newBrowser();
  const created = await share(sender, { kind: 'daily' });
  assert.equal(created.status, 201, created.raw);

  const slug = (created.body.data as { slug: string }).slug;

  // No cookie, no token, no prior contact with the site.
  const read = await api.request('GET', `/api/shares/${slug}`);
  assert.equal(read.status, 200, read.raw);

  const shared = read.body.data as { kind: string; content: { prediction: string } };
  assert.equal(shared.kind, 'daily');
  assert.ok(shared.content.prediction.length > 0, 'the reading itself must be present');
});

test('reading a share does not enrol the recipient as a visitor', async () => {
  // Opening a link someone sent must not quietly start tracking you. If the
  // subject middleware were mounted on this route it would set a cookie here.
  const sender = await newBrowser();
  const created = await share(sender, { kind: 'daily' });
  const slug = (created.body.data as { slug: string }).slug;

  const read = await api.request('GET', `/api/shares/${slug}`);
  assert.equal(read.headers.get('set-cookie'), null, 'a reader must not be given a cookie');
});

test('what the sender sees is what the recipient sees', async () => {
  const sender = await newBrowser();
  const own = await api.request('GET', '/api/predictions/daily', { headers: { cookie: sender } });
  const mine = own.body.data as { prediction: string; energy: string };

  const created = await share(sender, { kind: 'daily' });
  const slug = (created.body.data as { slug: string }).slug;
  const read = await api.request('GET', `/api/shares/${slug}`);
  const theirs = (read.body.data as { content: { prediction: string; energy: string } }).content;

  assert.equal(theirs.prediction, mine.prediction);
  assert.equal(theirs.energy, mine.energy);
});

test('two shares of the same reading are two different links', async () => {
  // Sharing is not idempotent, unlike the readings. Someone sending the same
  // reading to two people expects two links.
  const sender = await newBrowser();
  const first = await share(sender, { kind: 'daily' });
  const second = await share(sender, { kind: 'daily' });

  const a = (first.body.data as { slug: string }).slug;
  const b = (second.body.data as { slug: string }).slug;
  assert.notEqual(a, b);
});

// --- the sender's identity is not shared ------------------------------------
test('a share never reveals who created it', async () => {
  const sender = await newBrowser();
  const created = await share(sender, { kind: 'daily' });
  const slug = (created.body.data as { slug: string }).slug;

  const read = await api.request('GET', `/api/shares/${slug}`);
  // The whole response body, not just the fields the DTO declares: an id or a
  // subject added later would be caught here rather than shipping unnoticed.
  assert.ok(!/subject|visitor:|user:/i.test(read.raw), read.raw);
});

// --- the server writes the content ------------------------------------------
test('a caller cannot supply the text of a reading', async () => {
  const sender = await newBrowser();

  // The attack this prevents: publishing arbitrary text on this domain under
  // the app's name. `strictObject` rejects the extra field outright.
  const forged = await share(sender, {
    kind: 'daily',
    content: { prediction: 'Send 500 dollars to this address.' },
  });
  assert.equal(forged.status, 400, forged.raw);
  assert.equal(forged.body.error?.code, 'VALIDATION_ERROR');
});

test('a caller cannot share a reading that is not its own', async () => {
  const sender = await newBrowser();
  const other = await newBrowser();

  const message = await api.request('POST', '/api/messages', {
    body: { mood: 'quiet' },
    headers: { cookie: other },
  });
  const messageId = (message.body.data as { id: string }).id;

  // A real id, belonging to somebody else. The lookup is scoped to the caller,
  // so it is simply not found rather than found and refused.
  const stolen = await share(sender, { kind: 'message', messageId });
  assert.equal(stolen.status, 404, stolen.raw);
});

test('a share of an unknown draw is not found rather than an error', async () => {
  const sender = await newBrowser();
  const missing = await share(sender, {
    kind: 'tarot',
    drawId: '00000000-0000-4000-8000-000000000000',
  });
  assert.equal(missing.status, 404, missing.raw);
});

// --- secret messages --------------------------------------------------------
test('a secret message is delivered verbatim', async () => {
  const sender = await newBrowser();
  const note = 'I am proud of you, even on the days you cannot see it.';

  const created = await share(sender, { kind: 'secret', note });
  assert.equal(created.status, 201, created.raw);
  const slug = (created.body.data as { slug: string }).slug;

  const read = await api.request('GET', `/api/shares/${slug}`);
  const shared = read.body.data as { kind: string; note: string; content?: unknown };

  assert.equal(shared.kind, 'secret');
  assert.equal(shared.note, note);
  // A secret message has no reading attached, and absence is an absent field
  // rather than an empty object a client would render as present.
  assert.equal(shared.content, undefined);
});

test('a reading share carries no note', async () => {
  const sender = await newBrowser();
  const created = await share(sender, { kind: 'daily' });
  const slug = (created.body.data as { slug: string }).slug;

  const read = await api.request('GET', `/api/shares/${slug}`);
  assert.equal((read.body.data as { note?: string }).note, undefined);
});

test('a secret message is trimmed, and cannot be blank or oversized', async () => {
  const sender = await newBrowser();

  const blank = await share(sender, { kind: 'secret', note: '   ' });
  assert.equal(blank.status, 400, 'whitespace is not a message');

  const huge = await share(sender, { kind: 'secret', note: 'x'.repeat(501) });
  assert.equal(huge.status, 400);

  const padded = await share(sender, { kind: 'secret', note: '  hello  ' });
  const slug = (padded.body.data as { slug: string }).slug;
  const read = await api.request('GET', `/api/shares/${slug}`);
  assert.equal((read.body.data as { note: string }).note, 'hello');
});

test('a secret message cannot smuggle in a reading', async () => {
  const sender = await newBrowser();
  const forged = await share(sender, {
    kind: 'secret',
    note: 'hello',
    content: { prediction: 'not yours to write' },
  });
  assert.equal(forged.status, 400, forged.raw);
});

// --- what the endpoint refuses ----------------------------------------------
test('an unknown kind is rejected', async () => {
  const sender = await newBrowser();
  const bad = await share(sender, { kind: 'horoscope' });
  assert.equal(bad.status, 400, bad.raw);
});

test('a kind that needs an id cannot arrive without one', async () => {
  const sender = await newBrowser();
  assert.equal((await share(sender, { kind: 'tarot' })).status, 400);
  assert.equal((await share(sender, { kind: 'message' })).status, 400);
  // ...and an id that is not an id.
  assert.equal((await share(sender, { kind: 'tarot', drawId: 'the-sun' })).status, 400);
});

test('a kind that needs no id cannot carry one', async () => {
  // `{ kind: 'daily', drawId }` is rejected rather than silently ignored: a
  // rejection is visible in testing, a silent drop is not.
  const sender = await newBrowser();
  const extra = await share(sender, {
    kind: 'daily',
    drawId: '00000000-0000-4000-8000-000000000000',
  });
  assert.equal(extra.status, 400, extra.raw);
});

test('an unknown slug is not found, and says nothing about which slugs are real', async () => {
  const missing = await api.request('GET', '/api/shares/ZZZZZZZZZZZZZZZZ');
  const malformed = await api.request('GET', '/api/shares/nope');

  assert.equal(missing.status, 404);
  assert.equal(malformed.status, 404);
  // Identical answers: a reader learns nothing from the difference.
  assert.equal(missing.body.error?.code, malformed.body.error?.code);
  assert.equal(missing.body.error?.message, malformed.body.error?.message);
});

// --- the slug ---------------------------------------------------------------
test('slugs are long, opaque and not sequential', async () => {
  const sender = await newBrowser();
  const slugs: string[] = [];
  for (let i = 0; i < 5; i += 1) {
    const created = await share(sender, { kind: 'secret', note: `note ${i}` });
    slugs.push((created.body.data as { slug: string }).slug);
  }

  for (const slug of slugs) {
    assert.match(slug, /^[A-Za-z0-9_-]{16,43}$/, 'base64url, at least 96 bits');
  }
  assert.equal(new Set(slugs).size, slugs.length, 'no repeats');

  // Guessing must not be a strategy: consecutive slugs share no prefix.
  const [first, second] = slugs;
  assert.ok(first && second && first.slice(0, 8) !== second.slice(0, 8));
});
