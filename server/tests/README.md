# Test notes

## Why the suite runs with `--test-concurrency=1`

Most of these files are **integration tests against one shared Neon database**,
not unit tests. Node's test runner parallelises across files by default (one
process per CPU — 12 here for 15 files), which meant a dozen processes were
concurrently inserting into and deleting from the same tables.

That produced two tests that hung for ~50 minutes each while every file passed
when run on its own. The `after()` hooks are the sharp edge: several of them run
broad statements such as

```sql
DELETE FROM users WHERE email LIKE 'phase5b-%@tests.invalid'
```

and `tarot_draws.user_id` references `users` with `ON DELETE SET NULL`, so that
delete takes write locks on draw rows another file may be holding — including
under the `SELECT … FOR UPDATE` that makes interpretation idempotent.

Serialising the files removes the contention entirely. It is slower (the suite
takes several minutes, dominated by ~250 ms Neon round trips) and it is the
honest fix: the alternative is a schema-per-worker harness, which is real
infrastructure this project does not otherwise need.

**A test that passes alone and hangs in the suite is a failing test.** It was
found only by running everything together, which is why the full suite is the
gate rather than per-file runs.

## Running one file while developing

```bash
npm run test:file -- tests/tarot.draw.test.ts
```

## Test data

Every file cleans up after itself, scoped to values it created:

| File | Creates | Cleans up by |
|---|---|---|
| `auth.routes` | users | `email LIKE 'phase3-%@tests.invalid'` |
| `tarot.routes` | users, draws | `email LIKE 'phase5b-%@tests.invalid'`, tracked draw ids |
| `tarot.draw` | draws, readings, users | tracked draw ids, `@tests.invalid` users |
| `prediction.*` | predictions | tracked dates (2030) / weeks |
| `predictions.routes` | predictions | tracked dates (today + ~300 days) |

`.invalid` is the reserved TLD (RFC 2606), so no address here can ever be real.
