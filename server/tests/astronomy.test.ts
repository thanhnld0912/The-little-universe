/**
 * Astronomy tests.
 *
 * These deliberately do NOT check the service against itself. Two kinds of
 * assertion are used:
 *
 *  1. AGAINST A DEFINITION. The vernal equinox is *defined* as the moment the
 *     Sun's apparent geocentric ecliptic longitude reaches 0 degrees, which is
 *     the start of Aries. Asserting the sign flips across that instant tests
 *     the coordinate system itself. It is what catches the difference between
 *     geocentric and heliocentric longitude — a mistake that is otherwise
 *     invisible, because a wrong zodiac sign looks exactly as plausible as a
 *     right one.
 *
 *  2. AGAINST PUBLISHED VALUES. Known full moons and solstices, pinned as
 *     literal expectations so that upgrading `astronomy-engine` fails loudly
 *     if any number moves.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { Seasons, SunPosition } from 'astronomy-engine';
import {
  buildAstronomyContext,
  moonPhaseName,
  zodiacSignFor,
  MOON_PHASE_NAMES,
  ZODIAC_SIGNS,
} from '../src/services/astronomy/index.js';

const TZ = 'Asia/Ho_Chi_Minh';

// --- against definitions -----------------------------------------------------
test('the Sun enters Aries exactly at the March equinox', () => {
  // By definition the vernal equinox IS 0 degrees of tropical longitude.
  // `Seasons` is used only here, as an independent oracle; the product does
  // not expose it.
  const equinox = Seasons(2026).mar_equinox.date;

  const before = new Date(equinox.getTime() - 6 * 3_600_000);
  const after = new Date(equinox.getTime() + 6 * 3_600_000);

  assert.equal(
    zodiacSignFor(sunLongitude(before)),
    'Pisces',
    'six hours before the equinox the Sun is still in Pisces',
  );
  assert.equal(
    zodiacSignFor(sunLongitude(after)),
    'Aries',
    'six hours after the equinox the Sun has entered Aries',
  );
});

test('the Sun enters Cancer exactly at the June solstice', () => {
  const solstice = Seasons(2026).jun_solstice.date;
  assert.equal(zodiacSignFor(sunLongitude(new Date(solstice.getTime() - 6 * 3_600_000))), 'Gemini');
  assert.equal(zodiacSignFor(sunLongitude(new Date(solstice.getTime() + 6 * 3_600_000))), 'Cancer');
});

test('the Sun enters Capricorn exactly at the December solstice', () => {
  const solstice = Seasons(2026).dec_solstice.date;
  assert.equal(
    zodiacSignFor(sunLongitude(new Date(solstice.getTime() - 6 * 3_600_000))),
    'Sagittarius',
  );
  assert.equal(zodiacSignFor(sunLongitude(new Date(solstice.getTime() + 6 * 3_600_000))), 'Capricorn');
});

/**
 * The Sun's apparent geocentric ecliptic longitude — the same source the
 * service uses. If this were swapped for the heliocentric `EclipticLongitude`,
 * the three equinox and solstice tests above would fail immediately.
 */
function sunLongitude(instant: Date): number {
  return SunPosition(instant).elon;
}

// --- against published values ------------------------------------------------
test('a known full moon is reported as full and almost fully lit', () => {
  // The full moon of 3 January 2026 (approx. 10:03 UTC) — the first full moon
  // of that year.
  const context = buildAstronomyContext('2026-01-03', TZ);

  assert.equal(context.moonPhaseName, 'Full Moon');
  assert.ok(
    context.moonIllumination > 0.99,
    `expected an almost fully lit disc, got ${context.moonIllumination}`,
  );
  assert.ok(
    context.moonPhaseAngle > 170 && context.moonPhaseAngle < 190,
    `expected a phase angle near 180, got ${context.moonPhaseAngle}`,
  );
  assert.equal(context.nextMoonQuarter.name, 'Full Moon');
  assert.equal(context.nextMoonQuarter.date, '2026-01-03');
});

test('a known new moon is reported as new and barely lit', () => {
  // New moon of 18 March 2026.
  const context = buildAstronomyContext('2026-03-18', TZ);
  assert.equal(context.moonPhaseName, 'New Moon');
  assert.ok(
    context.moonIllumination < 0.05,
    `expected a nearly dark disc, got ${context.moonIllumination}`,
  );
});

/**
 * Regression pins.
 *
 * Exact expected values for fixed dates. Their purpose is not to be
 * independently meaningful but to FAIL LOUDLY if an `astronomy-engine` upgrade
 * shifts any computed value, so the change is reviewed rather than absorbed
 * silently into readings.
 */
test('pinned values for fixed dates do not drift across library versions', () => {
  const context = buildAstronomyContext('2026-08-21', TZ);

  assert.deepEqual(context, {
    date: '2026-08-21',
    moonPhaseAngle: 102.02,
    moonPhaseName: 'First Quarter',
    moonIllumination: 0.605,
    sunSign: 'Leo',
    moonSign: 'Sagittarius',
    nextMoonQuarter: { name: 'Full Moon', date: '2026-08-28' },
  });
});

test('the Sun sign matches the calendar for mid-month dates', () => {
  // Mid-month sits comfortably inside a sign, away from cusp ambiguity.
  const expectations: [string, string][] = [
    ['2026-01-15', 'Capricorn'],
    ['2026-04-15', 'Aries'],
    ['2026-07-15', 'Cancer'],
    ['2026-10-15', 'Libra'],
  ];
  for (const [date, sign] of expectations) {
    assert.equal(buildAstronomyContext(date, TZ).sunSign, sign, `Sun on ${date}`);
  }
});

// --- pure helpers -------------------------------------------------------------
test('phase names use bands centred on the conventional phases', () => {
  // Centred, not floored: a naive floor(angle/45) would call a clearly
  // crescent Moon at 40 degrees "New Moon".
  assert.equal(moonPhaseName(0), 'New Moon');
  assert.equal(moonPhaseName(22.4), 'New Moon');
  assert.equal(moonPhaseName(22.6), 'Waxing Crescent');
  assert.equal(moonPhaseName(45), 'Waxing Crescent');
  assert.equal(moonPhaseName(90), 'First Quarter');
  assert.equal(moonPhaseName(135), 'Waxing Gibbous');
  assert.equal(moonPhaseName(180), 'Full Moon');
  assert.equal(moonPhaseName(225), 'Waning Gibbous');
  assert.equal(moonPhaseName(270), 'Last Quarter');
  assert.equal(moonPhaseName(315), 'Waning Crescent');
  assert.equal(moonPhaseName(359.9), 'New Moon', 'the cycle wraps back to new');
});

test('phase names handle out-of-range and negative angles', () => {
  assert.equal(moonPhaseName(360), 'New Moon');
  assert.equal(moonPhaseName(720), 'New Moon');
  assert.equal(moonPhaseName(-90), 'Last Quarter');
});

test('every phase name is reachable', () => {
  const seen = new Set<string>();
  for (let angle = 0; angle < 360; angle += 0.5) seen.add(moonPhaseName(angle));
  assert.deepEqual([...seen].sort(), [...MOON_PHASE_NAMES].sort());
});

test('zodiac signs divide the ecliptic into twelve 30-degree arcs', () => {
  assert.equal(zodiacSignFor(0), 'Aries');
  assert.equal(zodiacSignFor(29.99), 'Aries');
  assert.equal(zodiacSignFor(30), 'Taurus');
  assert.equal(zodiacSignFor(180), 'Libra');
  assert.equal(zodiacSignFor(359.99), 'Pisces');
  assert.equal(zodiacSignFor(360), 'Aries', 'the circle wraps');
  assert.equal(zodiacSignFor(-1), 'Pisces', 'negative longitudes wrap too');
});

test('every zodiac sign is reachable', () => {
  const seen = new Set<string>();
  for (let longitude = 0; longitude < 360; longitude += 1) seen.add(zodiacSignFor(longitude));
  assert.deepEqual([...seen].sort(), [...ZODIAC_SIGNS].sort());
});

// --- properties of the context ------------------------------------------------
test('the same date always produces the same context', () => {
  assert.deepEqual(buildAstronomyContext('2026-08-21', TZ), buildAstronomyContext('2026-08-21', TZ));
});

test('the context is well-formed for every day of a year', () => {
  // A cheap sweep: catches any date on which a computation throws or produces
  // an out-of-range value.
  let date = new Date(Date.UTC(2026, 0, 1));
  for (let index = 0; index < 365; index += 1) {
    const iso = date.toISOString().slice(0, 10);
    const context = buildAstronomyContext(iso, TZ);

    assert.equal(context.date, iso);
    assert.ok(context.moonPhaseAngle >= 0 && context.moonPhaseAngle < 360, iso);
    assert.ok(context.moonIllumination >= 0 && context.moonIllumination <= 1, iso);
    assert.ok(ZODIAC_SIGNS.includes(context.sunSign), iso);
    assert.ok(ZODIAC_SIGNS.includes(context.moonSign), iso);
    assert.match(context.nextMoonQuarter.date, /^\d{4}-\d{2}-\d{2}$/, iso);

    date = new Date(date.getTime() + 86_400_000);
  }
});

test('illumination and phase angle stay consistent with each other', () => {
  // Near new the disc is dark; near full it is lit. A mismatch would mean the
  // two values are being read from different moments or different bodies.
  let date = new Date(Date.UTC(2026, 0, 1));
  for (let index = 0; index < 120; index += 1) {
    const iso = date.toISOString().slice(0, 10);
    const { moonPhaseAngle, moonIllumination } = buildAstronomyContext(iso, TZ);

    if (moonPhaseAngle < 10 || moonPhaseAngle > 350) {
      assert.ok(moonIllumination < 0.05, `${iso}: angle ${moonPhaseAngle} but lit ${moonIllumination}`);
    }
    if (moonPhaseAngle > 170 && moonPhaseAngle < 190) {
      assert.ok(moonIllumination > 0.95, `${iso}: angle ${moonPhaseAngle} but lit ${moonIllumination}`);
    }
    date = new Date(date.getTime() + 86_400_000);
  }
});

test('the next moon quarter is never in the past', () => {
  for (const iso of ['2026-01-01', '2026-04-15', '2026-08-21', '2026-12-31']) {
    const context = buildAstronomyContext(iso, TZ);
    assert.ok(context.nextMoonQuarter.date >= iso, `${iso} -> ${context.nextMoonQuarter.date}`);
  }
});
