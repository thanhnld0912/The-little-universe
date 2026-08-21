/**
 * Prompt construction for the prediction domain.
 *
 * Prompts live with the service that owns the domain, not with the provider.
 * The provider receives finished text.
 *
 * Two rules are encoded in the system prompt and are product requirements
 * rather than stylistic preferences:
 *
 *  1. READINGS SUGGEST, THEY DO NOT PREDICT. This is a reflective,
 *     entertainment experience. "You may", "you might", "this could be a good
 *     moment to" — never "this will happen" or "you will meet someone".
 *
 *  2. THE MODEL NEVER COMPUTES ASTRONOMY. Moon phase, illumination and zodiac
 *     signs are supplied as established fact by the astronomy service. A
 *     language model cannot compute an ephemeris; asked to, it produces
 *     confident and wrong numbers. It may write *about* these facts and must
 *     not contradict or invent them.
 */
import type { AstronomyContext } from '../astronomy/types.js';
import { DAY_TYPES } from './schemas.js';

const VOICE = `You write for The Little Universe, a gentle celestial reflection app.

Your voice is poetic, warm, unhurried, emotionally intelligent and lightly
mysterious — a thoughtful storyteller looking at the night sky, never a
supernatural authority.

RULES YOU MUST FOLLOW:
- Suggest, never assert. Use "you may", "you might", "one possible reading is",
  "this could be a good moment to".
- Never claim certainty about the future. Never say something WILL happen.
- Never give medical, psychological, legal or financial advice, and never
  diagnose anything.
- No fear, no pressure, no flattery, no dramatic prophecy.
- Keep the mysticism light. Warmth over incense.
- Write in English.`;

const ASTRONOMY_RULE = `The astronomical facts below were CALCULATED by an ephemeris and are correct.
Treat them as given. You may refer to them and write about how they feel, but
you must never contradict them, and never state an astronomical fact that is
not listed here.`;

function describeAstronomy(astronomy: AstronomyContext): string {
  const percent = Math.round(astronomy.moonIllumination * 100);
  return [
    `Date: ${astronomy.date}`,
    `Moon phase: ${astronomy.moonPhaseName} (${astronomy.moonPhaseAngle} degrees, ${percent}% illuminated)`,
    `Sun is in: ${astronomy.sunSign}`,
    `Moon is in: ${astronomy.moonSign}`,
    `Next lunar quarter: ${astronomy.nextMoonQuarter.name} on ${astronomy.nextMoonQuarter.date}`,
  ].join('\n');
}

const DAILY_SHAPE = `Reply with ONE JSON object and nothing else. No markdown, no code fence.
Exactly these keys, all required, no extras:

{
  "theme": string,            // 2-4 words, e.g. "Unexpected Moments"
  "energy": string,           // a 2-3 word energy TITLE, e.g. "Quietly Curious"
  "energyScore": integer,     // 0-100
  "luckyColor": string,       // a colour name, e.g. "Dusty Rose"
  "luckyColorHex": string,    // that colour as #RRGGBB
  "luckyNumber": integer,     // 0-99
  "mood": string,             // one word, e.g. "Hopeful"
  "prediction": string,       // 2-3 sentences, the main reading
  "cosmicQuote": string,      // one short quoted line, in double quotes
  "cosmicSign": string,       // a short celestial note drawn from the facts above
  "element": string,          // e.g. "Water & Starlight"
  "soundFrequency": string    // e.g. "432 Hz Solfeggio"
}`;

const WEEKLY_SHAPE = `Reply with ONE JSON object and nothing else. No markdown, no code fence.
Exactly these keys, all required, no extras:

{
  "summary": string,              // 2-3 sentences about the week as a whole
  "brightestDayIndex": integer,   // 0-6, which day is brightest
  "highlightTitle": string,       // a short title for that day
  "highlightQuote": string,       // one gentle line about that day
  "days": [                       // EXACTLY 7 entries
    {
      "dayIndex": integer,        // 0=Monday .. 6=Sunday, each used exactly once
      "dayType": string,          // one of: ${DAY_TYPES.join(', ')}
      "tagline": string,          // one short line
      "advice": string,           // 1-2 sentences of gentle guidance
      "score": integer,           // 0-100
      "element": string,
      "gemstone": string
    }
  ]
}

Exactly one day must have dayType "PEAK", and brightestDayIndex must be that
day's dayIndex.`;

export interface PromptPair {
  system: string;
  user: string;
}

export function buildDailyPrompt(astronomy: AstronomyContext, dayName: string): PromptPair {
  return {
    system: `${VOICE}\n\n${ASTRONOMY_RULE}\n\n${DAILY_SHAPE}`,
    user: [
      `Write today's reading for ${dayName}, ${astronomy.date}.`,
      '',
      'Calculated astronomical facts:',
      describeAstronomy(astronomy),
    ].join('\n'),
  };
}

export function buildWeeklyPrompt(
  astronomy: AstronomyContext,
  weekStart: string,
  weekEnd: string,
): PromptPair {
  return {
    system: `${VOICE}\n\n${ASTRONOMY_RULE}\n\n${WEEKLY_SHAPE}`,
    user: [
      `Write the forecast for the week of ${weekStart} (Monday) to ${weekEnd} (Sunday).`,
      '',
      'Calculated astronomical facts for the start of the week:',
      describeAstronomy(astronomy),
    ].join('\n'),
  };
}
