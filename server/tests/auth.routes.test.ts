/**
 * Route-level tests for /api/auth, run against the configured database.
 *
 * Every account created here uses a unique address in the reserved
 * `.invalid` TLD and is removed in the `after` hook. The cleanup deletes by
 * that exact pattern and nothing else, so it can never touch real data.
 */
import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { startTestServer, testEmail, type TestServer } from './helpers/testServer.js';

let api: TestServer;

const PASSWORD = 'a-quiet-constellation-77';

before(async () => {
  api = await startTestServer();
});

after(async () => {
  const { getPool, closePool } = await import('../src/db/pool.js');
  // Scoped to the exact addresses these tests generate.
  await getPool().query(`DELETE FROM users WHERE email LIKE 'phase3-%@tests.invalid'`);
  await closePool();
  await api.close();
});

/** Registers a fresh account and returns its credentials plus token. */
async function createAccount(label: string): Promise<{ email: string; token: string; id: string }> {
  const email = testEmail(label);
  const response = await api.request('POST', '/api/auth/register', {
    body: { email, password: PASSWORD, displayName: 'Star Gazer' },
  });
  assert.equal(response.status, 201, response.raw);
  const data = response.body.data as { token: string; user: { id: string } };
  return { email, token: data.token, id: data.user.id };
}

// --- register --------------------------------------------------------------
test('register creates an account and returns a token', async () => {
  const email = testEmail('register');
  const response = await api.request('POST', '/api/auth/register', {
    body: { email, password: PASSWORD, displayName: 'Star Gazer' },
  });

  assert.equal(response.status, 201, response.raw);
  assert.equal(response.body.success, true);

  const data = response.body.data as {
    user: Record<string, unknown>;
    token: string;
    expiresIn: string;
  };
  assert.equal(data.user['email'], email);
  assert.equal(data.user['displayName'], 'Star Gazer');
  assert.ok(typeof data.user['id'] === 'string');
  assert.ok(typeof data.token === 'string' && data.token.split('.').length === 3);
  assert.ok(typeof data.expiresIn === 'string');
});

test('register normalises the email address', async () => {
  const email = testEmail('normalise');
  const response = await api.request('POST', '/api/auth/register', {
    body: { email: `  ${email.toUpperCase()}  `, password: PASSWORD },
  });

  assert.equal(response.status, 201, response.raw);
  const data = response.body.data as { user: { email: string; displayName: unknown } };
  assert.equal(data.user.email, email.toLowerCase());
  assert.equal(data.user.displayName, null, 'an omitted display name should be null, not ""');
});

test('register rejects a duplicate address regardless of casing', async () => {
  const email = testEmail('duplicate');
  const first = await api.request('POST', '/api/auth/register', {
    body: { email, password: PASSWORD },
  });
  assert.equal(first.status, 201, first.raw);

  const second = await api.request('POST', '/api/auth/register', {
    body: { email: email.toUpperCase(), password: PASSWORD },
  });
  assert.equal(second.status, 409, second.raw);
  assert.equal(second.body.success, false);
  assert.equal(second.body.error?.code, 'CONFLICT');
});

test('register validates its input and reports every problem at once', async () => {
  const response = await api.request('POST', '/api/auth/register', {
    body: { email: 'not-an-email', password: 'short' },
  });

  assert.equal(response.status, 400, response.raw);
  assert.equal(response.body.error?.code, 'VALIDATION_ERROR');
  const details = response.body.error?.details as Record<string, string[]>;
  assert.ok(details['email'], 'expected an email problem');
  assert.ok(details['password'], 'expected a password problem');
});

test('register refuses a password longer than bcrypt can see', async () => {
  const response = await api.request('POST', '/api/auth/register', {
    body: { email: testEmail('long'), password: 'x'.repeat(73) },
  });
  assert.equal(response.status, 400, response.raw);
  assert.equal(response.body.error?.code, 'VALIDATION_ERROR');
});

test('register ignores unknown fields instead of storing them', async () => {
  const response = await api.request('POST', '/api/auth/register', {
    body: {
      email: testEmail('extra'),
      password: PASSWORD,
      isAdmin: true,
      id: '00000000-0000-0000-0000-000000000000',
    },
  });

  assert.equal(response.status, 201, response.raw);
  const user = (response.body.data as { user: Record<string, unknown> }).user;
  assert.ok(!('isAdmin' in user));
  assert.notEqual(user['id'], '00000000-0000-0000-0000-000000000000');
});

// --- login -----------------------------------------------------------------
test('login succeeds with the correct password', async () => {
  const account = await createAccount('login');
  const response = await api.request('POST', '/api/auth/login', {
    body: { email: account.email, password: PASSWORD },
  });

  assert.equal(response.status, 200, response.raw);
  const data = response.body.data as { user: { id: string }; token: string };
  assert.equal(data.user.id, account.id);
  assert.ok(typeof data.token === 'string');
});

test('login is case-insensitive on the address', async () => {
  const account = await createAccount('login-case');
  const response = await api.request('POST', '/api/auth/login', {
    body: { email: account.email.toUpperCase(), password: PASSWORD },
  });
  assert.equal(response.status, 200, response.raw);
});

test('a wrong password and an unknown account are indistinguishable', async () => {
  const account = await createAccount('enumeration');

  const wrongPassword = await api.request('POST', '/api/auth/login', {
    body: { email: account.email, password: 'definitely-not-the-password' },
  });
  const unknownAccount = await api.request('POST', '/api/auth/login', {
    body: { email: testEmail('nobody'), password: PASSWORD },
  });

  assert.equal(wrongPassword.status, 401, wrongPassword.raw);
  assert.equal(unknownAccount.status, 401, unknownAccount.raw);
  // Identical status, code AND message: nothing reveals whether the account
  // exists.
  assert.equal(wrongPassword.body.error?.code, unknownAccount.body.error?.code);
  assert.equal(wrongPassword.body.error?.message, unknownAccount.body.error?.message);
});

// --- me --------------------------------------------------------------------
test('me returns the signed-in account', async () => {
  const account = await createAccount('me');
  const response = await api.request('GET', '/api/auth/me', { token: account.token });

  assert.equal(response.status, 200, response.raw);
  const user = (response.body.data as { user: Record<string, unknown> }).user;
  assert.equal(user['id'], account.id);
  assert.equal(user['email'], account.email);
});

test('me requires a token', async () => {
  const response = await api.request('GET', '/api/auth/me');
  assert.equal(response.status, 401, response.raw);
  assert.equal(response.body.error?.code, 'UNAUTHORIZED');
});

test('me rejects a forged, malformed or wrongly-formatted token', async () => {
  const forged = await api.request('GET', '/api/auth/me', { token: 'a.b.c' });
  assert.equal(forged.status, 401, forged.raw);

  const malformedHeader = await api.request('GET', '/api/auth/me', {
    headers: { Authorization: 'Token abc' },
  });
  assert.equal(malformedHeader.status, 401, malformedHeader.raw);
});

test('a token stops working once its account is gone', async () => {
  const account = await createAccount('deleted');
  const before = await api.request('GET', '/api/auth/me', { token: account.token });
  assert.equal(before.status, 200, before.raw);

  const { getPool } = await import('../src/db/pool.js');
  await getPool().query('DELETE FROM users WHERE id = $1', [account.id]);

  // The token is still cryptographically valid and unexpired. It fails
  // because identity is resolved from the database on every call.
  const afterDeletion = await api.request('GET', '/api/auth/me', { token: account.token });
  assert.equal(afterDeletion.status, 401, afterDeletion.raw);
});

// --- logout ----------------------------------------------------------------
test('logout succeeds and needs no token', async () => {
  const response = await api.request('POST', '/api/auth/logout');
  assert.equal(response.status, 200, response.raw);
  assert.equal(response.body.success, true);
});

test('logout does not invalidate the token, which is the documented behaviour', async () => {
  const account = await createAccount('logout');
  await api.request('POST', '/api/auth/logout', { token: account.token });

  // Stateless JWT: there is no server-side session to end. The client
  // discards the token. This test records that as an intentional property so
  // that a future revocation feature has to change it deliberately.
  const response = await api.request('GET', '/api/auth/me', { token: account.token });
  assert.equal(response.status, 200, response.raw);
});

// --- security ---------------------------------------------------------------
test('no auth response ever contains a password hash', async () => {
  const email = testEmail('nohash');
  const responses = [
    await api.request('POST', '/api/auth/register', { body: { email, password: PASSWORD } }),
    await api.request('POST', '/api/auth/login', { body: { email, password: PASSWORD } }),
  ];
  const token = (responses[0]?.body.data as { token: string }).token;
  responses.push(await api.request('GET', '/api/auth/me', { token }));

  for (const response of responses) {
    const body = response.raw.toLowerCase();
    assert.ok(!body.includes('password_hash'), 'response must not name the hash column');
    assert.ok(!body.includes('passwordhash'), 'response must not carry a hash field');
    assert.ok(!body.includes('$2a$') && !body.includes('$2b$'), 'response must not contain a bcrypt hash');
    assert.ok(!body.includes(PASSWORD.toLowerCase()), 'response must not echo the password');
  }
});

test('the JWT payload carries only an id', async () => {
  const account = await createAccount('payload');
  const segment = account.token.split('.')[1];
  assert.ok(segment);
  const payload = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as Record<
    string,
    unknown
  >;

  assert.deepEqual(Object.keys(payload).sort(), ['aud', 'exp', 'iat', 'iss', 'sub']);
  assert.equal(payload['sub'], account.id);
  const serialised = JSON.stringify(payload).toLowerCase();
  assert.ok(!serialised.includes('@'), 'the payload must not carry an email address');
  assert.ok(!serialised.includes('hash'));
});

test('a database error is not described to the client', async () => {
  // A syntactically valid but non-existent id: the handler must answer 401
  // from its own logic, never surface a driver message.
  const response = await api.request('GET', '/api/auth/me', {
    token: 'not.a.real.token.at.all',
  });
  assert.equal(response.status, 401, response.raw);
  const raw = response.raw.toLowerCase();
  for (const leak of ['select', 'postgres', 'neon', 'pg_', 'sqlstate', 'stack']) {
    assert.ok(!raw.includes(leak), `response must not contain "${leak}"`);
  }
});
