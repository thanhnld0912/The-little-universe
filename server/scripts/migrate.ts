/**
 * Migration runner.
 *
 *   npm run db:migrate            apply every pending migration, in order
 *   npm run db:migrate -- --yes   required confirmation for a non-local database
 *   npm run db:migrate:status     report only; touches nothing
 *
 * Behaviour:
 *   - migrations are plain .sql files in database/migrations, applied in
 *     filename order;
 *   - each file runs inside its OWN transaction together with the bookkeeping
 *     insert, so a failure leaves no half-applied migration and no false record;
 *   - the first SQL error aborts the run with a non-zero exit code. Errors are
 *     never swallowed and later migrations are never attempted;
 *   - the sha256 of every applied file is stored and re-checked. Editing a
 *     migration that has already run is reported as drift, not ignored;
 *   - applying to anything other than localhost requires `--yes`. Lumiere
 *     lesson section 0: never run a migration against a shared database
 *     without an explicit, deliberate confirmation.
 */
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PoolClient } from 'pg';

const MIGRATIONS_DIR = path.resolve(
  fileURLToPath(new URL('../database/migrations', import.meta.url)),
);

interface MigrationFile {
  version: string;
  name: string;
  sql: string;
  checksum: string;
}

interface AppliedRow {
  version: string;
  name: string;
  checksum: string;
  applied_at: Date;
}

const CREATE_BOOKKEEPING_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version     text PRIMARY KEY,
    name        text NOT NULL,
    checksum    text NOT NULL,
    applied_at  timestamptz NOT NULL DEFAULT now()
  )
`;

function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

async function loadMigrations(): Promise<MigrationFile[]> {
  const entries = await readdir(MIGRATIONS_DIR);
  const sqlFiles = entries.filter((entry) => entry.endsWith('.sql')).sort();

  const migrations: MigrationFile[] = [];
  for (const fileName of sqlFiles) {
    const match = /^(\d+)_(.+)\.sql$/.exec(fileName);
    const version = match?.[1];
    const name = match?.[2];
    if (version === undefined || name === undefined) {
      throw new Error(
        `Migration file "${fileName}" does not follow the required <number>_<name>.sql pattern.`,
      );
    }
    const sql = await readFile(path.join(MIGRATIONS_DIR, fileName), 'utf8');
    migrations.push({ version, name, sql, checksum: sha256(sql) });
  }

  const seen = new Set<string>();
  for (const migration of migrations) {
    if (seen.has(migration.version)) {
      throw new Error(`Duplicate migration version "${migration.version}".`);
    }
    seen.add(migration.version);
  }

  return migrations;
}

/** Reports drift between what is recorded as applied and what is on disk. */
function verifyApplied(migrations: MigrationFile[], applied: Map<string, AppliedRow>): string[] {
  const problems: string[] = [];
  const onDisk = new Set(migrations.map((migration) => migration.version));

  for (const migration of migrations) {
    const record = applied.get(migration.version);
    if (record && record.checksum !== migration.checksum) {
      problems.push(
        `${migration.version}_${migration.name}.sql was modified after it was applied ` +
          `(recorded ${record.checksum.slice(0, 12)}, on disk ${migration.checksum.slice(0, 12)}). ` +
          `Write a new migration instead of editing an applied one.`,
      );
    }
  }

  for (const version of applied.keys()) {
    if (!onDisk.has(version)) {
      problems.push(
        `Version ${version} is recorded as applied but no matching file exists on disk.`,
      );
    }
  }

  return problems;
}

function describeTarget(connectionString: string): {
  host: string;
  database: string;
  isLocal: boolean;
} {
  try {
    const url = new URL(connectionString);
    const host = url.hostname;
    return {
      host,
      database: url.pathname.replace(/^\//, '') || '(default)',
      isLocal: host === 'localhost' || host === '127.0.0.1' || host === '::1',
    };
  } catch {
    return { host: '(unparseable)', database: '(unknown)', isLocal: false };
  }
}

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const statusOnly = args.has('--status');
  const confirmed = args.has('--yes') || process.env['MIGRATE_CONFIRM'] === '1';

  const { env } = await import('../src/config/env.js');
  const { getPool, closePool } = await import('../src/db/pool.js');

  const target = describeTarget(env.DATABASE_URL);
  // Host and database name only - the password is never printed.
  console.log(`[migrate] target: ${target.host}/${target.database}  (NODE_ENV=${env.NODE_ENV})`);

  const migrations = await loadMigrations();
  const client: PoolClient = await getPool().connect();

  try {
    await client.query(CREATE_BOOKKEEPING_TABLE);

    const result = await client.query<AppliedRow>(
      'SELECT version, name, checksum, applied_at FROM schema_migrations ORDER BY version',
    );
    const applied = new Map(result.rows.map((row) => [row.version, row]));

    const problems = verifyApplied(migrations, applied);
    if (problems.length > 0) {
      console.error('[migrate] migration state is inconsistent:');
      for (const problem of problems) console.error(`  - ${problem}`);
      process.exitCode = 1;
      return;
    }

    const pending = migrations.filter((migration) => !applied.has(migration.version));

    console.log(`[migrate] ${applied.size} applied, ${pending.length} pending`);
    for (const migration of migrations) {
      const mark = applied.has(migration.version) ? 'applied' : 'PENDING';
      console.log(`  [${mark}] ${migration.version}_${migration.name}.sql`);
    }

    if (statusOnly) return;
    if (pending.length === 0) {
      console.log('[migrate] nothing to do.');
      return;
    }

    if (!target.isLocal && !confirmed) {
      console.error(
        `\n[migrate] refusing to apply ${pending.length} migration(s) to a non-local database.` +
          `\n[migrate] target: ${target.host}/${target.database}` +
          `\n[migrate] re-run with --yes once you are sure this is the intended database.\n`,
      );
      process.exitCode = 1;
      return;
    }

    for (const migration of pending) {
      const label = `${migration.version}_${migration.name}.sql`;
      process.stdout.write(`[migrate] applying ${label} ... `);
      try {
        await client.query('BEGIN');
        await client.query(migration.sql);
        await client.query(
          'INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3)',
          [migration.version, migration.name, migration.checksum],
        );
        await client.query('COMMIT');
        console.log('ok');
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        console.log('FAILED');
        console.error(`\n[migrate] ${label} failed and was rolled back.`);
        console.error(`[migrate] ${(error as Error).message}`);
        console.error('[migrate] stopping - no further migrations were attempted.\n');
        process.exitCode = 1;
        return;
      }
    }

    console.log(`[migrate] done - ${pending.length} migration(s) applied.`);
  } finally {
    client.release();
    await closePool();
  }
}

main().catch((error: unknown) => {
  if (error instanceof Error && error.name === 'EnvironmentError') {
    console.error(`\n[migrate] ${error.message}\n`);
  } else {
    console.error('[migrate] unexpected failure:', error);
  }
  process.exit(1);
});
