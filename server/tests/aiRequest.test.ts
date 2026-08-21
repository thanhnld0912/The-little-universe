/**
 * The provider contract after the refactor to a single generic method.
 *
 * The point of the refactor is that the provider is domain-agnostic: it takes
 * text and returns whatever the model produced. These tests pin that property
 * so a later phase cannot quietly reintroduce per-feature methods.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { MockAIProvider } from '../src/services/ai/MockAIProvider.js';
import { buildDailyPrompt, buildWeeklyPrompt } from '../src/services/ai/prompts.js';
import { buildAstronomyContext } from '../src/services/astronomy/index.js';
import { testRequest } from './helpers/countingProvider.js';

const provider = new MockAIProvider();
const TZ = 'Asia/Ho_Chi_Minh';

test('the provider exposes exactly one generation method', () => {
  // Everything domain-specific — prompts, schemas, context assembly — belongs
  // to the services. If a `generateTarotReading` ever appears on a provider,
  // this fails.
  const surface = Object.getOwnPropertyNames(MockAIProvider.prototype).filter(
    (key) => key !== 'constructor',
  );
  assert.deepEqual(surface.filter((key) => !key.startsWith('_')).sort(), [
    'daily',
    'generate',
    'weekly',
  ]);

  // `daily` and `weekly` are private implementation detail of the MOCK.
  // The interface a service depends on is `generate` alone.
  const asInterface: { name: string; generate: unknown } = provider;
  assert.equal(typeof asInterface.generate, 'function');
});

test('an unknown task throws rather than returning something empty', async () => {
  // A blank object would validate as "missing every field" and be retried, then
  // surface as an upstream error — but silently returning {} for a task nobody
  // implemented is the kind of plausible failure this codebase refuses.
  await assert.rejects(
    () => provider.generate(testRequest('tarot', 'seed')),
    /no output for task/,
  );
});

test('the seed alone determines mock output', async () => {
  // Same seed, completely different prompt text: the mock must still produce
  // the same reading, which is what keeps tests and local development stable.
  const a = await provider.generate({
    task: 'daily',
    system: 'one system prompt',
    user: 'one user prompt',
    seed: '2026-08-21',
  });
  const b = await provider.generate({
    task: 'daily',
    system: 'a completely different system prompt',
    user: 'and a different user prompt',
    seed: '2026-08-21',
  });
  assert.deepEqual(a, b);
});

test('a request without a seed still produces valid output', async () => {
  const result = await provider.generate({ task: 'daily', system: 's', user: 'u' });
  assert.ok(result && typeof result === 'object');
});

// --- prompts -----------------------------------------------------------------
test('the daily prompt carries the calculated facts, not a request to compute them', () => {
  const astronomy = buildAstronomyContext('2026-08-21', TZ);
  const { system, user } = buildDailyPrompt(astronomy, 'Friday');

  // The facts are stated.
  assert.match(user, /First Quarter/);
  assert.match(user, /Leo/);
  assert.match(user, /Sagittarius/);
  assert.match(user, /2026-08-21/);

  // And the model is told they are established, not to be worked out.
  assert.match(system, /CALCULATED by an ephemeris/);
  assert.match(system, /never state an astronomical fact that is\s*\nnot listed here/);
});

test('the system prompt encodes the product voice rules', () => {
  const astronomy = buildAstronomyContext('2026-08-21', TZ);
  const { system } = buildDailyPrompt(astronomy, 'Friday');

  assert.match(system, /Suggest, never assert/);
  assert.match(system, /Never claim certainty about the future/);
  // The rule wraps across a line in the prompt, so match across whitespace.
  assert.match(system, /never\s+diagnose/i);
});

test('the weekly prompt states the seven-day contract and the single peak', () => {
  const astronomy = buildAstronomyContext('2026-08-17', TZ);
  const { system, user } = buildWeeklyPrompt(astronomy, '2026-08-17', '2026-08-23');

  assert.match(system, /EXACTLY 7 entries/);
  assert.match(system, /Exactly one day must have dayType "PEAK"/);
  assert.match(user, /2026-08-17/);
  assert.match(user, /2026-08-23/);
});

test('prompts never ask the model to calculate anything astronomical', () => {
  const astronomy = buildAstronomyContext('2026-08-21', TZ);
  for (const { system, user } of [
    buildDailyPrompt(astronomy, 'Friday'),
    buildWeeklyPrompt(astronomy, '2026-08-17', '2026-08-23'),
  ]) {
    const text = `${system}\n${user}`.toLowerCase();
    for (const forbidden of ['calculate the moon', 'work out the phase', 'determine the sign']) {
      assert.ok(!text.includes(forbidden), `prompt must not contain "${forbidden}"`);
    }
  }
});
