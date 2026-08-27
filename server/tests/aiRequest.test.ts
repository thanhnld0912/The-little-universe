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
import type { AIProvider, AIRequest } from '../src/services/ai/AIProvider.js';
import { buildDailyPrompt, buildWeeklyPrompt } from '../src/services/ai/prompts.js';
import { buildAstronomyContext } from '../src/services/astronomy/index.js';
import { testRequest } from './helpers/countingProvider.js';

const provider = new MockAIProvider();
const TZ = 'Asia/Ho_Chi_Minh';

test('a provider needs nothing beyond name and generate', async () => {
  // The durable property, stated directly: an object with ONLY these two
  // members is a complete provider. If any service ever reaches for a
  // domain-specific method, this stops compiling and stops passing.
  //
  // An earlier version of this test enumerated MockAIProvider's prototype,
  // which broke the moment the mock grew a private `tarot` helper — it was
  // asserting the mock's shape rather than the interface's.
  const minimal: AIProvider = {
    name: 'minimal',
    async generate(request: AIRequest) {
      return { echoed: request.task };
    },
  };

  assert.deepEqual(Object.keys(minimal).sort(), ['generate', 'name']);
  assert.deepEqual(await minimal.generate(testRequest('daily', 'seed')), { echoed: 'daily' });
});

test('an unimplemented task throws rather than returning something empty', async () => {
  // A blank object would validate as "missing every field", be retried, and
  // surface as an upstream error — but silently returning {} for a task nobody
  // implemented is the kind of plausible failure this codebase refuses.
  // 'sharing' is a task no service asks for yet; 'message' now exists.
  await assert.rejects(
    () => provider.generate(testRequest('sharing', 'seed')),
    /no output for task/,
  );
});

test('every task the services actually use is implemented by the mock', async () => {
  // The complement of the test above: the tasks in use must NOT throw.
  for (const task of ['daily', 'weekly', 'tarot', 'message']) {
    const result = await provider.generate(testRequest(task, 'seed'));
    assert.ok(result && typeof result === 'object', `${task} should produce output`);
  }
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
