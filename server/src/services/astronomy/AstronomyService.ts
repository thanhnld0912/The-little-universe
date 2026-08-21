/**
 * Deterministic astronomy for the application.
 *
 * Pure computation: no network, no database, no AI, no clock of its own. Given
 * the same date and timezone it returns the same context forever, which is what
 * makes it testable against published astronomical values rather than against
 * itself.
 *
 * Powered by `astronomy-engine` (MIT, Don Cross) — pure JavaScript with no
 * dependencies and no ephemeris data files, so it works unchanged in a
 * serverless function. See THIRD_PARTY_NOTICES.md.
 */
import {
  Body,
  EclipticGeoMoon,
  Illumination,
  MoonPhase,
  SearchMoonQuarter,
  SunPosition,
} from 'astronomy-engine';
import { toZonedDate, zonedNoonInstant } from '../../utils/dates.js';
import { env } from '../../config/env.js';
import {
  MOON_PHASE_NAMES,
  MOON_QUARTER_NAMES,
  ZODIAC_SIGNS,
  type AstronomyContext,
  type MoonPhaseName,
  type MoonQuarterName,
  type ZodiacSign,
} from './types.js';

/**
 * Names the phase from its angle using eight 45-degree bands CENTRED on the
 * conventional phases.
 *
 * The offset of half a band matters: a naive `floor(angle / 45)` would call
 * everything from 0 to 45 degrees "New Moon", so a moon three days past new and
 * visibly crescent would still be reported as new. Centring means "New Moon"
 * spans 337.5-22.5 degrees, which matches what someone would actually see.
 */
export function moonPhaseName(angleDegrees: number): MoonPhaseName {
  const normalised = ((angleDegrees % 360) + 360) % 360;
  const band = Math.floor((normalised + 22.5) / 45) % 8;
  return MOON_PHASE_NAMES[band] as MoonPhaseName;
}

/**
 * The tropical sign occupied by a body at `longitude` degrees.
 *
 * Tropical, not sidereal: signs are measured from the vernal equinox, which is
 * exactly what `EclipticLongitude` returns, and is the convention Western
 * astrological writing assumes.
 */
export function zodiacSignFor(longitude: number): ZodiacSign {
  const normalised = ((longitude % 360) + 360) % 360;
  return ZODIAC_SIGNS[Math.floor(normalised / 30)] as ZodiacSign;
}

/** `astronomy-engine` numbers quarters 0-3 from the new moon. */
function quarterName(quarter: number): MoonQuarterName {
  const name = MOON_QUARTER_NAMES[quarter];
  if (!name) throw new Error(`Unexpected moon quarter index: ${quarter}`);
  return name;
}

/**
 * Builds the astronomical facts for one calendar day.
 *
 * Values are sampled at LOCAL NOON (see `zonedNoonInstant`) so that a day is
 * represented by its middle rather than by an edge that may sit on the far side
 * of a phase or sign boundary.
 */
export function buildAstronomyContext(
  date: string,
  timeZone: string = env.APP_TIMEZONE,
): AstronomyContext {
  const instant = zonedNoonInstant(date, timeZone);

  const phaseAngle = MoonPhase(instant);
  const illumination = Illumination(Body.Moon, instant);
  const nextQuarter = SearchMoonQuarter(instant);

  return {
    date,
    // Rounded to two decimals: this is stored and compared, and full float
    // precision would make snapshots noisy without being more informative.
    moonPhaseAngle: round2(phaseAngle),
    moonPhaseName: moonPhaseName(phaseAngle),
    moonIllumination: round4(illumination.phase_fraction),
    // GEOCENTRIC longitudes — the sky as seen from Earth, which is what a
    // zodiac sign means. `EclipticLongitude` is NOT the function for this: it
    // returns HELIOCENTRIC longitude (as seen from the Sun). It throws outright
    // for the Sun, but for the Moon it would quietly return a value roughly
    // opposite the true one, producing a wrong sign that looks entirely
    // plausible. Both of these return the true equinox of date, i.e. tropical.
    sunSign: zodiacSignFor(SunPosition(instant).elon),
    moonSign: zodiacSignFor(EclipticGeoMoon(instant).lon),
    nextMoonQuarter: {
      name: quarterName(nextQuarter.quarter),
      date: toZonedDate(nextQuarter.time.date, timeZone),
    },
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
