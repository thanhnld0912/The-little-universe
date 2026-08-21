import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';
import { extractBearerToken, signAccessToken, verifyAccessToken } from '../src/utils/jwt.js';

const USER_ID = '3f1c9a52-9b0e-4c2f-9a7d-2b8e5c1d4a60';

function decodePayload(token: string): Record<string, unknown> {
  const segment = token.split('.')[1];
  assert.ok(segment, 'token should have a payload segment');
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as Record<string, unknown>;
}

test('a signed token round-trips to the same subject', () => {
  const token = signAccessToken(USER_ID);
  assert.equal(verifyAccessToken(token).sub, USER_ID);
});

test('the header declares HS256', () => {
  const segment = signAccessToken(USER_ID).split('.')[0];
  assert.ok(segment);
  const header = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as {
    alg: string;
  };
  assert.equal(header.alg, 'HS256');
});

test('the payload carries identity and nothing else', () => {
  const payload = decodePayload(signAccessToken(USER_ID));

  // A JWT is signed, not encrypted — every key here is readable by anyone
  // holding the token.
  assert.deepEqual(Object.keys(payload).sort(), ['aud', 'exp', 'iat', 'iss', 'sub']);
  assert.equal(payload['sub'], USER_ID);
});

test('the payload never contains credentials or personal data', () => {
  const serialised = JSON.stringify(decodePayload(signAccessToken(USER_ID))).toLowerCase();
  for (const forbidden of ['password', 'hash', '$2a$', '$2b$', 'email', '@', 'secret']) {
    assert.ok(!serialised.includes(forbidden), `token payload must not contain "${forbidden}"`);
  }
});

test('a token signed with a different secret is rejected', () => {
  const forged = jwt.sign({}, 'a-different-secret-of-adequate-length', {
    algorithm: 'HS256',
    subject: USER_ID,
    issuer: 'the-little-universe',
    audience: 'the-little-universe:web',
    expiresIn: '1h',
  });
  assert.throws(() => verifyAccessToken(forged), /not valid/);
});

test('an unsigned "alg: none" token is rejected', () => {
  // The classic algorithm-confusion attack: the token's own header asks to be
  // verified with no signature at all. Pinning `algorithms: ['HS256']` on
  // verification is what refuses it.
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: USER_ID,
      iss: 'the-little-universe',
      aud: 'the-little-universe:web',
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString('base64url');

  assert.throws(() => verifyAccessToken(`${header}.${payload}.`), /not valid/);
});

test('an expired token is rejected', () => {
  const expired = jwt.sign({}, env.JWT_SECRET, {
    algorithm: 'HS256',
    subject: USER_ID,
    issuer: 'the-little-universe',
    audience: 'the-little-universe:web',
    expiresIn: '-1s',
  });
  assert.throws(() => verifyAccessToken(expired), /not valid/);
});

test('a token issued for another audience or issuer is rejected', () => {
  const wrongAudience = jwt.sign({}, env.JWT_SECRET, {
    algorithm: 'HS256',
    subject: USER_ID,
    issuer: 'the-little-universe',
    audience: 'some-other-app',
    expiresIn: '1h',
  });
  assert.throws(() => verifyAccessToken(wrongAudience), /not valid/);

  const wrongIssuer = jwt.sign({}, env.JWT_SECRET, {
    algorithm: 'HS256',
    subject: USER_ID,
    issuer: 'somebody-else',
    audience: 'the-little-universe:web',
    expiresIn: '1h',
  });
  assert.throws(() => verifyAccessToken(wrongIssuer), /not valid/);
});

test('a token with no subject is rejected', () => {
  const noSubject = jwt.sign({}, env.JWT_SECRET, {
    algorithm: 'HS256',
    issuer: 'the-little-universe',
    audience: 'the-little-universe:web',
    expiresIn: '1h',
  });
  assert.throws(() => verifyAccessToken(noSubject), /not valid/);
});

test('garbage is rejected without throwing something unexpected', () => {
  for (const value of ['', 'abc', 'a.b.c', '...', 'null']) {
    assert.throws(() => verifyAccessToken(value), /not valid/, `should reject ${JSON.stringify(value)}`);
  }
});

test('every rejection reports the same message', () => {
  // Distinct messages would tell an attacker whether a token was merely
  // expired (so the format and secret were right) or entirely forged.
  const messages = new Set<string>();
  const candidates = [
    'garbage',
    jwt.sign({}, env.JWT_SECRET, {
      algorithm: 'HS256',
      subject: USER_ID,
      issuer: 'the-little-universe',
      audience: 'the-little-universe:web',
      expiresIn: '-1s',
    }),
    jwt.sign({}, 'another-secret-that-is-long-enough', {
      algorithm: 'HS256',
      subject: USER_ID,
      expiresIn: '1h',
    }),
  ];

  for (const candidate of candidates) {
    try {
      verifyAccessToken(candidate);
      assert.fail('should not verify');
    } catch (error) {
      messages.add((error as Error).message);
    }
  }
  assert.equal(messages.size, 1, `expected one shared message, saw ${[...messages].join(' | ')}`);
});

// --- Authorization header parsing -----------------------------------------
test('a bearer token is extracted from a well-formed header', () => {
  assert.equal(extractBearerToken('Bearer abc.def.ghi'), 'abc.def.ghi');
  assert.equal(extractBearerToken('  Bearer abc.def.ghi  '), 'abc.def.ghi');
});

test('an absent header yields undefined rather than an error', () => {
  assert.equal(extractBearerToken(undefined), undefined);
});

test('a malformed Authorization header is reported, not ignored', () => {
  for (const header of ['Bearer', 'Bearer   ', 'Token abc', 'abc.def.ghi', 'bearer abc']) {
    assert.throws(() => extractBearerToken(header), /Bearer/, `should reject ${JSON.stringify(header)}`);
  }
});
