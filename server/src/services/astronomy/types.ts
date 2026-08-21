/**
 * Deterministic astronomical facts for one calendar day.
 *
 * THIS IS FACT, NOT INTERPRETATION. Every field is computed from an ephemeris
 * and would be the same whoever asked. It is handed to the AI as given input
 * so the model can write *about* the sky without ever being asked what the sky
 * is doing — a language model has no way to compute a moon phase, and asking
 * it to would produce confident, plausible, wrong numbers.
 *
 * Kept deliberately small. Houses, ascendants, natal charts, eclipses, rise and
 * set times and planetary aspects are all computable but none of them earn
 * their place in a daily reflective reading yet.
 */

/** The eight conventional lunar phase names, in cycle order from new moon. */
export const MOON_PHASE_NAMES = [
  'New Moon',
  'Waxing Crescent',
  'First Quarter',
  'Waxing Gibbous',
  'Full Moon',
  'Waning Gibbous',
  'Last Quarter',
  'Waning Crescent',
] as const;

export type MoonPhaseName = (typeof MOON_PHASE_NAMES)[number];

/** Tropical zodiac signs, in order from 0 degrees ecliptic longitude. */
export const ZODIAC_SIGNS = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
] as const;

export type ZodiacSign = (typeof ZODIAC_SIGNS)[number];

/** The four quarter phases the ephemeris searches for. */
export const MOON_QUARTER_NAMES = [
  'New Moon',
  'First Quarter',
  'Full Moon',
  'Last Quarter',
] as const;

export type MoonQuarterName = (typeof MOON_QUARTER_NAMES)[number];

export interface AstronomyContext {
  /** The calendar date these facts describe, 'YYYY-MM-DD'. */
  date: string;

  /**
   * Ecliptic longitude of the Moon relative to the Sun, 0-360 degrees.
   * 0 = new, 90 = first quarter, 180 = full, 270 = last quarter.
   */
  moonPhaseAngle: number;

  /** The conventional name for that angle. */
  moonPhaseName: MoonPhaseName;

  /** Fraction of the Moon's disc that is sunlit, 0-1. */
  moonIllumination: number;

  /** Tropical sign the Sun occupies. */
  sunSign: ZodiacSign;

  /** Tropical sign the Moon occupies. */
  moonSign: ZodiacSign;

  /** The next quarter phase at or after this date. */
  nextMoonQuarter: {
    name: MoonQuarterName;
    /** 'YYYY-MM-DD' in the application timezone. */
    date: string;
  };
}
