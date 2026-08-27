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

/**
 * Several options per day type, not one.
 *
 * `pick` is seed-driven, so a single-element list would return the same string
 * for every seed and every reader would see an identical week however the
 * reading is keyed. The variety has to exist in the content for the seed to
 * have anything to choose between.
 */
const TAGLINES: Record<DayType, readonly string[]> = {
  QUIET: [
    'A gentle start. Observing may serve you better than acting.',
    'The week opens softly. There may be no need to hurry it.',
    'A slow beginning, which is still a beginning.',
  ],
  FLOW: [
    'Momentum gathers. Small tasks might find their rhythm.',
    'Things may move more easily than they did yesterday.',
    'A day that could carry you rather than ask to be carried.',
  ],
  PIVOT: [
    'The week turns. This could be a moment to realign.',
    'A hinge in the week. Small corrections may count for a lot.',
    'Direction may matter more than speed today.',
  ],
  CLARITY: [
    'Insight may arrive quietly. A good day for complex thought.',
    'Something blurred may come into focus.',
    'A clear-headed day, if you give it room.',
  ],
  PEAK: [
    'Your brightest day.',
    'The high point of the week.',
    'The week may be at its warmest here.',
  ],
  REST: [
    'Withdrawing to recharge could be the kindest choice.',
    'A day that may ask less of you than you expect.',
    'Quiet is not idleness. This could be a day for it.',
  ],
  REFLECT: [
    "Integrating the week's lessons. Prepare gently.",
    'A good day to look back before looking forward.',
    'The week closes. It may be worth closing it kindly.',
  ],
};

const ADVICE: Record<DayType, readonly string[]> = {
  QUIET: [
    'You might let your thoughts settle before making any large commitment. There is no prize for deciding first.',
    'Today could reward listening over speaking. What you notice now may be useful later in the week.',
    'You may not need to force anything into motion yet. Starting slowly is still starting.',
  ],
  FLOW: [
    'What felt heavy earlier may move with surprising ease today. This could be a good moment to use that.',
    'Momentum may be on your side. You might spend it on the thing you have been postponing.',
    'Small tasks could fall into place quickly today. Letting them may clear space for something larger.',
  ],
  PIVOT: [
    'A midweek turning point may be worth noticing. You could check your direction without judging where you have been.',
    'You might change your mind today without calling it a failure. Adjusting is not starting over.',
    'A small correction now could save a longer detour later. It may be worth pausing to make it.',
  ],
  CLARITY: [
    'The mental fog may lift a little. Something you have been circling could resolve in a single quiet moment.',
    'Today could be a good day for the thinking you have been avoiding. It may be less tangled than it looks.',
    'An answer you already half-know may finish arriving. You might simply let it.',
  ],
  PEAK: [
    'This may be a day to stay open to what you did not plan. Warmth, company and small serendipities could all find you easily.',
    'Whatever you have been building toward may be worth showing today. You might let yourself be seen doing it.',
    'Good things could arrive without being arranged. You may only need to be available to them.',
  ],
  REST: [
    'You might turn down the volume of the world today. Rest is not something you have to earn first.',
    'You could do considerably less today than you planned, and lose nothing by it.',
    'Today may be better spent recovering than proving. Both are work.',
  ],
  REFLECT: [
    'You could look back at the week with more generosity than you feel it deserves. Then let it close.',
    'You might notice what actually went well. It is easy to keep only the difficult parts.',
    'The week is ending. You may let it end without settling every open thing in it.',
  ],
};

/** Seed-picked as well, so the summary card is not identical for everyone. */
const WEEK_SUMMARIES: readonly string[] = [
  'A subtle alignment of energies. The week may begin softly and gather warmth toward its middle; you might find the quieter days are the ones that hold the most.',
  'A week that may reward patience early and momentum later. What feels slow at the start could simply be the beginning of something with a longer shape.',
  'The week may ask for less effort than you expect and more attention than you plan for. Its warmest stretch could arrive without announcing itself.',
  'An uneven but kind week. Some days may carry you and others may ask you to carry them, and both could be worth the same in the end.',
];

const HIGHLIGHT_TITLES: readonly string[] = [
  'Your brightest day',
  'The warmest point of your week',
  'Where the week opens up',
  "The week's high note",
];

const HIGHLIGHT_QUOTES: readonly string[] = [
  'Something unexpectedly lovely may happen.',
  'You might find the day meets you halfway.',
  'A small good thing could arrive without warning.',
  'The week may be quietly on your side here.',
];

/**
 * The seven day types laid out Monday to Sunday. Exactly one PEAK, which the
 * schema requires and which the weekly summary refers to.
 *
 * Friday is an arbitrary choice, NOT a constraint. The view used to read
 * `days[4]` and label it FRIDAY regardless of the data; it now finds the peak
 * by its `isPeak` flag, so a real provider may mark any day of the week and the
 * page follows it.
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
      case 'tarot':
        return this.tarot(seed);
      case 'message':
        return this.message(seed);
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
      summary: pick(WEEK_SUMMARIES, seed, 'summary'),
      brightestDayIndex,
      highlightTitle: pick(HIGHLIGHT_TITLES, seed, 'highlightTitle'),
      highlightQuote: pick(HIGHLIGHT_QUOTES, seed, 'highlightQuote'),
      days,
    };
  }

  /**
   * A tarot reading.
   *
   * Note that the mock does NOT name a card. The card, its orientation and its
   * meaning are settled by the service before the prompt is built; the reading
   * is written around them. A mock that invented a card name would be
   * imitating a provider we would not accept.
   */
  /**
   * The seed carries the mood, the person's own words and their subject, so two
   * people choosing the same mood on the same day still receive different
   * messages. Every list has several entries for the same reason the weekly
   * lists do: `pick` can only vary across what it is given.
   */
  private message(seed: string): unknown {
    return {
      title: pick(MESSAGE_TITLES, seed, 'title'),
      subtitle: pick(MESSAGE_SUBTITLES, seed, 'subtitle'),
      whisper: pick(MESSAGE_WHISPERS, seed, 'whisper'),
      affirmation: pick(MESSAGE_AFFIRMATIONS, seed, 'affirmation'),
      actionGuidance: pick(MESSAGE_GUIDANCE, seed, 'guidance'),
      luckyNumber: score(seed, 'lucky', 1, 99),
      cosmicEnergy: pick(MESSAGE_ENERGIES, seed, 'energy'),
    };
  }

  private tarot(seed: string): unknown {
    return {
      title: pick(TAROT_TITLES, seed, 'title'),
      summary: pick(TAROT_SUMMARIES, seed, 'summary'),
      interpretation:
        'The card you drew may be describing something already in motion rather than something ahead of you. ' +
        'One possible reading is that the situation has been asking for attention rather than for a decision. ' +
        'You might find that what looked like hesitation was actually a kind of care.',
      guidance: pick(TAROT_GUIDANCE, seed, 'guidance'),
      reflectionQuestion: pick(TAROT_QUESTIONS, seed, 'question'),
    };
  }
}

const TAROT_TITLES = [
  'A Quiet Turning',
  'What the Card Holds',
  'Something Beginning to Settle',
  'A Small Light Offered',
  'The Shape of This Moment',
] as const;

const TAROT_SUMMARIES = [
  'This card may be pointing at something you have already half-noticed.',
  'There may be less to decide here than it feels like from the inside.',
  'One possible reading is that a slow change has been underway for a while.',
  'This may be an invitation to look at the situation from a softer angle.',
] as const;

const TAROT_GUIDANCE = [
  'You might sit with this for a day before acting on it. Nothing here needs to be resolved tonight.',
  'This could be a good moment to say one true sentence out loud, even if only to yourself.',
  'You may find it useful to notice what you were hoping this card would say.',
  'Consider letting this be a question rather than an answer for now.',
] as const;

const TAROT_QUESTIONS = [
  'What would change if you trusted your own read on this?',
  'What are you protecting, and does it still need protecting?',
  'Where in this are you waiting for permission?',
  'What would the gentlest next step look like?',
] as const;

/** Exposed so a test can assert the mock covers every declared day type. */
export const MOCK_WEEK_SHAPE = WEEK_SHAPE;
export const ALL_DAY_TYPES = DAY_TYPES;

// --- message ---------------------------------------------------------------

const MESSAGE_TITLES = [
  'A Whisper of Soft Assurance',
  'A Thread of Starlight',
  'Something Quiet, Meant for You',
  'A Small Light, Left On',
  'A Note From a Patient Sky',
  'What the Evening Wanted to Say',
];

const MESSAGE_SUBTITLES = [
  'For the soul seeking stillness in a noisy world',
  'For a heart that has been carrying more than it says',
  'For someone standing at the edge of a change',
  'For the part of you that has been waiting to be asked',
  'For a week that asked a great deal of you',
  'For anyone who needed to hear something kind today',
];

const MESSAGE_WHISPERS = [
  'You have been carrying quiet questions that words cannot easily hold. Some of them may not need answering yet; they may only need to be allowed to stay. You are further along than the noise suggests.',
  'Something you have been circling may be closer to settled than it feels. You might find that the waiting was doing work you could not see from inside it.',
  'You may have been measuring yourself against a version of this week that never existed. What actually happened was enough, and it was done by someone who was tired.',
  'There may be more room here than you have been letting yourself use. Nothing is asking you to decide tonight, and nothing is lost by resting first.',
  'What feels like hesitation may turn out to have been care. You could let that be the reading of it, at least until morning.',
  'You may not need to explain yourself as carefully as you have been. The people who matter have already understood; the rest were never going to.',
  'The thing you keep meaning to start may not need a better plan, only a smaller first step. You could make it tiny enough to be embarrassing and still count it.',
  'You might be closer to the end of this stretch than the middle of it. It is hard to tell from inside, which is not a failure of yours.',
  'Something you decided a while ago may quietly no longer fit. You are allowed to notice that without treating it as a verdict on who you were.',
  'You may have been waiting for permission that was never going to arrive from outside. It might already be yours to give.',
  'What you are calling restlessness could as easily be readiness. You do not have to decide which tonight.',
  'There may be someone who would be glad to hear from you and is waiting for the same reason you are. One of you could go first.',
];

const MESSAGE_AFFIRMATIONS = [
  'I give myself permission to simply be. Silence is not empty; it is full of peace.',
  'I am allowed to move at the speed I actually have.',
  'I can hold an open question without needing to close it today.',
  'What I did with the day I was given was enough.',
  'I do not have to earn my own gentleness.',
  'I can change my mind and still be someone who keeps their word.',
];

const MESSAGE_GUIDANCE = [
  'Sit near a window for five minutes tonight without your phone. Let the day finish on its own.',
  'Write down the one thing you keep rehearsing, then close the notebook. It will still be there tomorrow, and smaller.',
  'Say the smaller, truer version of the thing to one person this week.',
  'Choose one task you have been carrying and let it be undone on purpose, rather than by accident.',
  'Make something warm to drink and let it be the whole activity for as long as it lasts.',
  'Step outside once after dark this week and find the moon before you go back in.',
];

const MESSAGE_ENERGIES = [
  'Serene Moonlight',
  'Quiet Tidewater',
  'Low Gold Light',
  'Still Air Before Rain',
  'Soft Harbour Dark',
  'Slow Turning Sky',
];
