/**
 * The provider used for local development, automated tests, CI and any
 * deployment without an API key. `AI_PROVIDER=mock` is the default and must
 * work with no credentials of any kind.
 *
 * Two properties matter more than the prose:
 *
 *  1. DETERMINISM. Output depends only on the seed it is given, so the same
 *     date always yields the same reading. A test can assert an exact value,
 *     and a developer restarting the server sees a stable page.
 *
 *  2. IDENTICAL SHAPE. It emits exactly what a real provider must emit, and is
 *     validated by the same Zod schemas with no exemption. If the mock would
 *     not survive validation, neither would OpenAI, and the failure shows up
 *     here rather than on the day a key is first configured.
 *
 * The writing follows the product's voice rule: readings suggest and invite
 * ("may", "might", "could"), and never assert that something will happen.
 */
import type { AIProvider, AIRequest } from './AIProvider.js';
import { DAY_TYPES, type DayType } from './schemas.js';

/**
 * A small deterministic hash. Not cryptographic and not trying to be — it just
 * has to spread nearby seeds across different options and give the same answer
 * every time. `Math.random()` would break determinism; a seed-derived value
 * keeps it.
 */
function hash(seed: string): number {
  let value = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return Math.abs(value);
}

function pick<T>(options: readonly T[], seed: string, salt = ''): T {
  const chosen = options[hash(`${seed}:${salt}`) % options.length];
  if (chosen === undefined) throw new Error('pick() called with an empty list');
  return chosen;
}

/** Stable per seed, kept in a pleasant band rather than uniform over 0-100. */
function score(seed: string, salt: string, low: number, high: number): number {
  return low + (hash(`${seed}:${salt}`) % (high - low + 1));
}

const ENERGIES = [
  'Quietly Curious',
  'Luminous Serenity',
  'Radiant Intuition',
  'Velvet Softness',
  'Gently Electric',
  'Slow Golden Light',
] as const;

const THEMES = [
  'Unexpected Moments',
  'Gentle Breakthroughs',
  'Subtle Synchronicities',
  'Sacred Rest',
  'Small Beginnings',
  'Quiet Courage',
] as const;

const MOODS = ['Hopeful', 'Peaceful', 'Mystical', 'Quiet', 'Tender', 'Curious'] as const;

const COLORS = [
  { name: 'Dusty Rose', hex: '#DCAEAE' },
  { name: 'Celestial Indigo', hex: '#818CF8' },
  { name: 'Golden Sand', hex: '#E5C98D' },
  { name: 'Sage Mist', hex: '#A7F3D0' },
  { name: 'Faded Lilac', hex: '#C4B5FD' },
  { name: 'Deep Harbour', hex: '#7DD3FC' },
] as const;

const SIGNS = [
  'Moon in Pisces',
  'Venus in Libra',
  'Mercury in Virgo',
  'Sun in Leo',
  'Moon in Cancer',
  'Neptune in Aries',
] as const;

const ELEMENTS = [
  'Water & Starlight',
  'Air & Quiet Fire',
  'Earth & Velvet',
  'Ether & Light',
  'Silver Wind',
  'Lunar Mist',
] as const;

const FREQUENCIES = [
  '432 Hz Solfeggio',
  '528 Hz Resonance',
  '396 Hz Grounding',
  '639 Hz Connection',
] as const;

const WHISPERS = [
  'Today may be quieter than you expect, but the small moments could be the ones worth keeping. There might be a shift waiting in something very ordinary.',
  'You may notice something you have walked past a hundred times. This could be a good moment to let a small thing hold your attention a little longer.',
  'Something you have been carrying might feel lighter today, not because it changed, but because you have. You may find you have more room than you thought.',
  'This could be a gentle day for beginning rather than finishing. One possible interpretation of this restlessness is that you are nearly ready.',
  'You might find that patience is its own kind of progress today. What is quiet is not always what is still.',
  'A small kindness may find its way back to you today. You could let yourself receive it without explaining why you deserve it.',
] as const;

const QUOTES = [
  '"Your universe changes a little every day."',
  '"Small light is still light."',
  '"What is quiet is not always what is still."',
  '"You are allowed to arrive slowly."',
  '"Even the moon is only ever partly visible."',
] as const;

const GEMSTONES = [
  'Moonstone',
  'Aquamarine',
  'Citrine',
  'Lapis Lazuli',
  'Sunstone',
  'Amethyst',
  'Selenite',
] as const;

const TAGLINES: Record<DayType, readonly string[]> = {
  QUIET: ['A gentle start. Observing may serve you better than acting.'],
  FLOW: ['Momentum gathers. Small tasks might find their rhythm.'],
  PIVOT: ['The week turns. This could be a moment to realign.'],
  CLARITY: ['Insight may arrive quietly. A good day for complex thought.'],
  PEAK: ['Your brightest day.'],
  REST: ['Withdrawing to recharge could be the kindest choice.'],
  REFLECT: ["Integrating the week's lessons. Prepare gently."],
};

const ADVICE: Record<DayType, readonly string[]> = {
  QUIET: [
    'You might let your thoughts settle before making any large commitment. There is no prize for deciding first.',
  ],
  FLOW: [
    'What felt heavy earlier may move with surprising ease today. This could be a good moment to use that.',
  ],
  PIVOT: [
    'A midweek turning point may be worth noticing. You could check your direction without judging where you have been.',
  ],
  CLARITY: [
    'The mental fog may lift a little. Something you have been circling could resolve in a single quiet moment.',
  ],
  PEAK: [
    'This may be a day to stay open to what you did not plan. Warmth, company and small serendipities could all find you easily.',
  ],
  REST: [
    'You might turn down the volume of the world today. Rest is not something you have to earn first.',
  ],
  REFLECT: [
    'You could look back at the week with more generosity than you feel it deserves. Then let it close.',
  ],
};

/**
 * The seven day types laid out Monday to Sunday. Exactly one PEAK, which the
 * schema requires and which the weekly summary refers to. The peak sits on
 * Friday because the current UI renders the fifth slot as its highlighted
 * card; that coupling is a frontend limitation recorded for Phase 8, not a
 * property of the data model, which allows any day to be the brightest.
 */
const WEEK_SHAPE: readonly DayType[] = [
  'QUIET',
  'FLOW',
  'PIVOT',
  'CLARITY',
  'PEAK',
  'REST',
  'REFLECT',
];

export class MockAIProvider implements AIProvider {
  readonly name = 'mock';

  /**
   * Dispatches on `task` to fabricate output of the right shape.
   *
   * The mock has to know what it is imitating — that is inherent to being a
   * mock. The INTERFACE does not, and neither will the OpenAI and Gemini
   * providers, which pass `system` and `user` straight through to a model.
   *
   * An unknown task THROWS rather than returning something empty. A silent
   * blank reading is exactly the kind of plausible-looking failure this
   * codebase refuses everywhere else.
   */
  async generate(request: AIRequest): Promise<unknown> {
    // The seed carries determinism without the provider learning any domain
    // shape from it: it is just an opaque string.
    const seed = request.seed ?? request.task;

    switch (request.task) {
      case 'daily':
        return this.daily(seed);
      case 'weekly':
        return this.weekly(seed);
      default:
        throw new Error(
          `MockAIProvider has no output for task ${JSON.stringify(request.task)}`,
        );
    }
  }

  private daily(seed: string): unknown {
    const color = pick(COLORS, seed, 'color');

    return {
      theme: pick(THEMES, seed, 'theme'),
      energy: pick(ENERGIES, seed, 'energy'),
      energyScore: score(seed, 'score', 72, 98),
      luckyColor: color.name,
      luckyColorHex: color.hex,
      luckyNumber: score(seed, 'lucky', 1, 33),
      mood: pick(MOODS, seed, 'mood'),
      prediction: pick(WHISPERS, seed, 'whisper'),
      cosmicQuote: pick(QUOTES, seed, 'quote'),
      cosmicSign: pick(SIGNS, seed, 'sign'),
      element: pick(ELEMENTS, seed, 'element'),
      soundFrequency: pick(FREQUENCIES, seed, 'frequency'),
    };
  }

  private weekly(seed: string): unknown {
    const brightestDayIndex = WEEK_SHAPE.indexOf('PEAK');

    const days = WEEK_SHAPE.map((dayType, dayIndex) => ({
      dayIndex,
      dayType,
      tagline: pick(TAGLINES[dayType], seed, `tagline:${dayIndex}`),
      advice: pick(ADVICE[dayType], seed, `advice:${dayIndex}`),
      score:
        dayType === 'PEAK'
          ? score(seed, `score:${dayIndex}`, 92, 99)
          : score(seed, `score:${dayIndex}`, 62, 90),
      element: pick(ELEMENTS, seed, `element:${dayIndex}`),
      gemstone: pick(GEMSTONES, seed, `gemstone:${dayIndex}`),
    }));

    return {
      summary:
        'A subtle alignment of energies. The week may begin softly and gather warmth toward its middle; you might find the quieter days are the ones that hold the most.',
      brightestDayIndex,
      highlightTitle: 'Your brightest day',
      highlightQuote: 'Something unexpectedly lovely may happen.',
      days,
    };
  }
}

/** Exposed so a test can assert the mock covers every declared day type. */
export const MOCK_WEEK_SHAPE = WEEK_SHAPE;
export const ALL_DAY_TYPES = DAY_TYPES;
