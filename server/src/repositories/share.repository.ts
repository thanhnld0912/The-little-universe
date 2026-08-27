import type { Queryable } from '../db/query.js';
import { queryOne } from '../db/query.js';

/** The row exactly as Postgres returns it. Mapping happens in the service. */
export interface ShareRow {
  id: string;
  slug: string;
  kind: string;
  subject_id: string;
  payload: unknown;
  note: string | null;
  created_at: Date;
}

export interface InsertShareInput {
  slug: string;
  kind: string;
  subjectId: string;
  /** Server-built. Never anything a client sent. */
  payload: unknown;
  /** The sender's own words, for a secret message. NULL for every other kind. */
  note: string | null;
}

const COLUMNS = `id, slug, kind, subject_id, payload, note, created_at`;

export async function insertShare(db: Queryable, input: InsertShareInput): Promise<ShareRow> {
  const row = await queryOne<ShareRow>(
    db,
    `INSERT INTO shares (slug, kind, subject_id, payload, note)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${COLUMNS}`,
    [input.slug, input.kind, input.subjectId, input.payload, input.note],
  );

  // A plain INSERT ... RETURNING always yields a row or throws, so this is a
  // type narrowing rather than a case that happens.
  if (!row) throw new Error('Inserting a share returned no row.');
  return row;
}

/**
 * Reads a share by its public slug.
 *
 * NOT scoped to a subject, and that is the entire point: a share is meant to be
 * readable by someone who is not the sender. The slug is the only credential,
 * which is why it is generated with a cryptographic random source.
 */
export async function findShareBySlug(db: Queryable, slug: string): Promise<ShareRow | undefined> {
  return queryOne<ShareRow>(db, `SELECT ${COLUMNS} FROM shares WHERE slug = $1`, [slug]);
}

/** How many shares this subject has created in the last day. Feeds the cap. */
export async function countRecentShares(db: Queryable, subjectId: string): Promise<number> {
  const row = await queryOne<{ count: string }>(
    db,
    `SELECT count(*)::text AS count
       FROM shares
      WHERE subject_id = $1
        AND created_at > now() - interval '1 day'`,
    [subjectId],
  );
  // `count(*)` is a bigint, which pg returns as a string to avoid losing
  // precision. Parsing it here keeps that detail out of the service.
  return row ? Number.parseInt(row.count, 10) : 0;
}
