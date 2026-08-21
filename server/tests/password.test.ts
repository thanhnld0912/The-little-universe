import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_PASSWORD_BYTES,
  hashPassword,
  passwordByteLength,
  spendComparisonTime,
  verifyPassword,
} from '../src/utils/password.js';

test('a hash is not the password, and is salted', async () => {
  const password = 'a-quiet-constellation';
  const first = await hashPassword(password);
  const second = await hashPassword(password);

  assert.notEqual(first, password);
  assert.ok(!first.includes(password), 'the plaintext must not appear inside the hash');
  // Distinct salts mean identical passwords produce different hashes, so the
  // stored values do not reveal which accounts share a password.
  assert.notEqual(first, second);
  assert.match(first, /^\$2[aby]\$\d{2}\$/, 'expected a bcrypt hash');
});

test('the correct password verifies and an incorrect one does not', async () => {
  const hash = await hashPassword('a-quiet-constellation');
  assert.equal(await verifyPassword('a-quiet-constellation', hash), true);
  assert.equal(await verifyPassword('a-quiet-constellatio', hash), false);
  assert.equal(await verifyPassword('A-Quiet-Constellation', hash), false);
  assert.equal(await verifyPassword('', hash), false);
});

test('a malformed stored hash reads as "no match" rather than throwing', async () => {
  // A thrown exception here would be distinguishable from a wrong password,
  // and would surface as a 500 instead of a clean 401.
  assert.equal(await verifyPassword('anything', 'not-a-bcrypt-hash'), false);
  assert.equal(await verifyPassword('anything', ''), false);
});

test('password length is measured in bytes, not characters', () => {
  assert.equal(passwordByteLength('abcd'), 4);
  // Four characters, but well over four bytes — the reason the limit cannot
  // be expressed with `.length`.
  assert.equal(passwordByteLength('🌙🌙🌙🌙'), 16);
});

test('a password longer than bcrypt can see is refused, not silently truncated', async () => {
  const overLong = 'x'.repeat(MAX_PASSWORD_BYTES + 1);
  await assert.rejects(() => hashPassword(overLong), /maximum supported length/);
});

test('a password at exactly the limit is accepted', async () => {
  const atLimit = 'x'.repeat(MAX_PASSWORD_BYTES);
  const hash = await hashPassword(atLimit);
  assert.equal(await verifyPassword(atLimit, hash), true);
});

test('the enumeration guard performs real work', async () => {
  // It must actually cost time; a no-op would leave the timing gap it exists
  // to close. The bound is generous so the test is not flaky on a slow or
  // contended machine — it is asserting "not instant", not a precise duration.
  const started = process.hrtime.bigint();
  await spendComparisonTime();
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  assert.ok(elapsedMs > 5, `expected measurable work, took ${elapsedMs.toFixed(1)}ms`);
});
