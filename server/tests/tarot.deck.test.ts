/**
 * The 78-card deck, as data.
 *
 * The seed is a content artifact, so it is verified as content: shape,
 * completeness, and the absence of placeholder or deterministic wording. A
 * card that shipped with an empty meaning or a "TODO" would look fine in an
 * API response and be worthless to a reader.
 */
import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { getPool, closePool } from '../src/db/pool.js';
import { queryAll, queryOne } from '../src/db/query.js';
import { listCards } from '../src/services/tarot.service.js';

after(async () => {
  await closePool();
});

async function count(sql: string, params: unknown[] = []): Promise<number> {
  const row = await queryOne<{ c: string }>(getPool(), sql, params);
  return Number(row?.c ?? -1);
}

test('the deck contains exactly 78 cards', async () => {
  assert.equal(await count('SELECT count(*)::text AS c FROM tarot_cards'), 78);
});

test('22 major arcana and 56 minor arcana', async () => {
  assert.equal(await count(`SELECT count(*)::text AS c FROM tarot_cards WHERE arcana='major'`), 22);
  assert.equal(await count(`SELECT count(*)::text AS c FROM tarot_cards WHERE arcana='minor'`), 56);
});

test('each suit has exactly 14 cards', async () => {
  const rows = await queryAll<{ suit: string; c: string }>(
    getPool(),
    `SELECT suit, count(*)::text AS c FROM tarot_cards WHERE arcana='minor' GROUP BY suit ORDER BY suit`,
  );
  assert.deepEqual(
    rows.map((row) => [row.suit, Number(row.c)]),
    [
      ['cups', 14],
      ['pentacles', 14],
      ['swords', 14],
      ['wands', 14],
    ],
  );
});

test('each suit runs Ace through King with no gaps', async () => {
  for (const suit of ['cups', 'pentacles', 'swords', 'wands']) {
    const rows = await queryAll<{ number: number }>(
      getPool(),
      `SELECT number FROM tarot_cards WHERE suit=$1 ORDER BY number`,
      [suit],
    );
    assert.deepEqual(
      rows.map((row) => row.number),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
      `${suit} should run 1..14`,
    );
  }
});

test('the major arcana runs 0 through 21 with no gaps', async () => {
  const rows = await queryAll<{ number: number }>(
    getPool(),
    `SELECT number FROM tarot_cards WHERE arcana='major' ORDER BY number`,
  );
  assert.deepEqual(
    rows.map((row) => row.number),
    Array.from({ length: 22 }, (_unused, index) => index),
  );
});

test('no duplicate slugs, names, or suit/number pairs', async () => {
  assert.equal(await count('SELECT count(DISTINCT slug)::text AS c FROM tarot_cards'), 78);
  assert.equal(await count('SELECT count(DISTINCT name)::text AS c FROM tarot_cards'), 78);
  assert.equal(
    await count(
      `SELECT count(*)::text AS c FROM
        (SELECT suit, number FROM tarot_cards GROUP BY suit, number HAVING count(*) > 1) t`,
    ),
    0,
  );
});

test('every card has real content in every required field', async () => {
  assert.equal(
    await count(
      `SELECT count(*)::text AS c FROM tarot_cards
        WHERE upright_meaning IS NULL OR btrim(upright_meaning) = ''
           OR reversed_meaning IS NULL OR btrim(reversed_meaning) = ''
           OR archetype IS NULL OR btrim(archetype) = ''
           OR name IS NULL OR btrim(name) = ''`,
    ),
    0,
    'no null or empty required field',
  );
});

test('every card has at least three non-empty keywords', async () => {
  assert.equal(
    await count('SELECT count(*)::text AS c FROM tarot_cards WHERE cardinality(keywords) < 3'),
    0,
  );
  assert.equal(
    await count(
      `SELECT count(*)::text AS c FROM tarot_cards
        WHERE EXISTS (SELECT 1 FROM unnest(keywords) k WHERE btrim(k) = '')`,
    ),
    0,
    'no empty keyword strings',
  );
});

test('no placeholder text survived into the deck', async () => {
  assert.equal(
    await count(
      `SELECT count(*)::text AS c FROM tarot_cards
        WHERE upright_meaning ILIKE '%todo%' OR reversed_meaning ILIKE '%todo%'
           OR upright_meaning ILIKE '%lorem%' OR reversed_meaning ILIKE '%lorem%'
           OR upright_meaning ILIKE '%placeholder%' OR archetype ILIKE '%todo%'
           OR upright_meaning ILIKE '%tbd%'`,
    ),
    0,
  );
});

test('no meaning claims certainty about the future', async () => {
  // The product rule, enforced against the content itself rather than trusted.
  assert.equal(
    await count(
      `SELECT count(*)::text AS c FROM tarot_cards
        WHERE upright_meaning ILIKE '%will definitely%' OR reversed_meaning ILIKE '%will definitely%'
           OR upright_meaning ILIKE '%you are destined%' OR reversed_meaning ILIKE '%you are destined%'
           OR upright_meaning ILIKE '%guarantee%' OR reversed_meaning ILIKE '%guarantee%'
           OR upright_meaning ILIKE '%is your soulmate%'`,
    ),
    0,
  );
});

test('meanings are substantial, not one-word stubs', async () => {
  const short = await queryAll<{ name: string }>(
    getPool(),
    `SELECT name FROM tarot_cards
      WHERE length(upright_meaning) < 60 OR length(reversed_meaning) < 60`,
  );
  assert.deepEqual(short, [], 'every meaning should be a real sentence or two');
});

test('image_url is null for every card, as decided for the MVP', async () => {
  assert.equal(
    await count('SELECT count(*)::text AS c FROM tarot_cards WHERE image_url IS NOT NULL'),
    0,
  );
});

test('major arcana carry no suit and minor arcana always do', async () => {
  assert.equal(
    await count(
      `SELECT count(*)::text AS c FROM tarot_cards
        WHERE (arcana='major' AND suit IS NOT NULL) OR (arcana='minor' AND suit IS NULL)`,
    ),
    0,
  );
});

// --- what the API exposes -----------------------------------------------------
test('the cards endpoint never exposes both meanings', async () => {
  const cards = await listCards();
  assert.equal(cards.length, 78);

  for (const card of cards) {
    // Meanings are not part of the card listing at all. They reach a client
    // only through a draw, and then only the orientation that was drawn.
    assert.ok(!('uprightMeaning' in card), 'the deck listing must not carry meanings');
    assert.ok(!('reversedMeaning' in card));
    assert.ok(!('upright_meaning' in card), 'no raw column names leak into the DTO');
  }
});

test('the card DTO is camelCase and complete', async () => {
  const cards = await listCards();
  const card = cards[0];
  assert.ok(card);
  assert.deepEqual(Object.keys(card).sort(), [
    'arcana',
    'archetype',
    'element',
    'id',
    'imageUrl',
    'keywords',
    'name',
    'number',
    'numeral',
    'slug',
    'suit',
  ]);
});
