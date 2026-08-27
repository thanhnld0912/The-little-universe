/**
 * The visitor cookie, over real HTTP.
 *
 * The per-subject service tests prove that different subjects get different
 * readings. These prove the other half: that an ordinary browser actually
 * becomes a distinct subject without doing anything, and stays the same one on
 * the next request.
 *
 * Without this, "everyone is different" could be true in the service and still
 * false on the website.
 */
import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { startTestServer, type TestServer } from './helpers/testServer.js';
import { reservedRouteDate } from './helpers/countingProvider.js';
import { closePool, getPool } from '../src/db/pool.js';

const VISITOR_COOKIE = 'tlu_visitor';

let api: TestServer;
const USED_DATES: string[] = [];

/** Pulls the visitor id out of a Set-Cookie header, or undefined if none was set. */
function issuedVisitorId(headers: Headers): string | undefined {
  const setCookie = headers.get('set-cookie');
  if (!setCookie) return undefined;
  const match = new RegExp(`${VISITOR_COOKIE}=([^;]+)`).exec(setCookie);
  return match?.[1];
}

function claimDate(offset: number): string {
  const date = reservedRouteDate(offset);
  USED_DATES.push(date);
  return date;
}

before(async () => {
  api = await startTestServer();
});

after(async () => {
  if (USED_DATES.length > 0) {
    await getPool().query('DELETE FROM daily_predictions WHERE date = ANY($1::date[])', [
      USED_DATES,
    ]);
  }
  await api.close();
  await closePool();
});

test('a first-time visitor is issued a cookie', async () => {
  const date = claimDate(40);
  const response = await api.request('GET', `/api/predictions/daily?date=${date}`);

  assert.equal(response.status, 200);

  const visitorId = issuedVisitorId(response.headers);
  assert.ok(visitorId, 'the response must set a visitor cookie');
  assert.match(
    visitorId,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    'the issued id is a uuid, matching what the database CHECK will accept',
  );

  const setCookie = response.headers.get('set-cookie') ?? '';
  assert.match(setCookie, /HttpOnly/i, 'not readable from page scripts');
  assert.match(setCookie, /SameSite=Lax/i);
});

test('two fresh browsers get different cookies and different readings', async () => {
  const date = claimDate(41);

  const first = await api.request('GET', `/api/predictions/daily?date=${date}`);
  const second = await api.request('GET', `/api/predictions/daily?date=${date}`);

  const firstId = issuedVisitorId(first.headers);
  const secondId = issuedVisitorId(second.headers);
  assert.ok(firstId && secondId);
  assert.notEqual(firstId, secondId, 'each cookieless caller is a new visitor');

  assert.notDeepEqual(
    first.body.data,
    second.body.data,
    'two different browsers must not see the same reading',
  );
});

test('sending the cookie back returns the same reading and issues no new cookie', async () => {
  const date = claimDate(42);

  const first = await api.request('GET', `/api/predictions/daily?date=${date}`);
  const visitorId = issuedVisitorId(first.headers);
  assert.ok(visitorId);

  const repeat = await api.request('GET', `/api/predictions/daily?date=${date}`, {
    headers: { Cookie: `${VISITOR_COOKIE}=${visitorId}` },
  });

  assert.equal(repeat.status, 200);
  assert.deepEqual(repeat.body.data, first.body.data, 'a refresh re-reads the same reading');
  assert.equal(
    issuedVisitorId(repeat.headers),
    undefined,
    'an existing valid cookie is reused, not replaced',
  );
});

test('a tampered cookie is replaced rather than trusted', async () => {
  const date = claimDate(43);

  const response = await api.request('GET', `/api/predictions/daily?date=${date}`, {
    headers: { Cookie: `${VISITOR_COOKIE}=not-a-uuid; other=value` },
  });

  assert.equal(response.status, 200, 'a bad cookie must not break the request');

  const issued = issuedVisitorId(response.headers);
  assert.ok(issued, 'a fresh id is issued to replace the invalid one');
  assert.notEqual(issued, 'not-a-uuid');
});

test('the weekly route issues and honours the same cookie', async () => {
  const first = await api.request('GET', '/api/predictions/weekly');
  assert.equal(first.status, 200);

  const visitorId = issuedVisitorId(first.headers);
  assert.ok(visitorId);

  const repeat = await api.request('GET', '/api/predictions/weekly', {
    headers: { Cookie: `${VISITOR_COOKIE}=${visitorId}` },
  });

  assert.deepEqual(repeat.body.data, first.body.data);
  assert.equal(issuedVisitorId(repeat.headers), undefined);
});
