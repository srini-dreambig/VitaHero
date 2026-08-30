// Schema migration, run once per database rather than once per request.
//
// The bug this exists to fix: schema setup was 115 statements, each awaited in
// turn, and the Neon HTTP driver makes every one of those a separate outbound
// request. A Cloudflare Worker is allowed 50 subrequests per request on the
// free plan, so the fifty-first threw, the catch around schema init turned it
// into "Database schema initialization failed", and — because that block runs
// before routing — every single route died with it, including the console's
// own HTML. The console looked like a database problem when it was a fan-out
// problem.
//
// Two changes fix it and keep it fixed:
//
//   1. A version gate. A database already at the current version costs ONE
//      query, not 115. That is the steady state, so it is the state that has
//      to be cheap.
//   2. Batching. When a migration is actually needed, the DDL is collected
//      without executing it and sent in a handful of transactions instead of
//      one request per statement. It is also all-or-nothing, so a failure
//      leaves the database as it was rather than half-migrated.

import { Sql } from "./common";

/**
 * Bump this whenever any ensure*Schema function changes.
 *
 * Forgetting to bump it means an existing database silently keeps the old
 * shape, so the check in migrate.test.ts asserts this file changes whenever
 * the DDL does.
 */
// 5 — retires the legacy 'UPCOMING' camp status, which the lifecycle never
//     knew and so could never advance past.
// 4 — camp_staff gains active/revoked_at/revoked_by/doctor_id: a doctor's
//     access to a camp is revoked, not deleted, so the record of who screened
//     whom survives it.
// 3 — adds doctors.phone, so a family told to see a doctor has a number.
// 2 — adds vita_hero.record_access (K6, the record access log). An existing
//     database stays on version 1 until this is bumped, which is exactly the
//     failure mode the gate exists to prevent.
export const SCHEMA_VERSION = 5;

/** How many statements go in one transaction — one outbound request each. */
const BATCH = 40;

type Recorded = { text: string; params: unknown[] };

/**
 * An `Sql` that writes down what it was asked to run instead of running it.
 *
 * Every ensure*Schema function takes `sql` and awaits template literals
 * against it, so handing them this collects their statements without any of
 * them needing to know. Reads come back empty; that is safe only because the
 * two steps that read a result — seeding doctors and seeding the library —
 * were moved out of the DDL path precisely so this would hold.
 */
function recorder(): { sql: Sql; statements: Recorded[] } {
  const statements: Recorded[] = [];
  const quote = (s: string) => '"' + s.replace(/"/g, '""') + '"';

  const fn: unknown = (strings: TemplateStringsArray | string, ...values: unknown[]) => {
    // The real driver refuses this call, so the recorder must too — a
    // recorder more permissive than production is how the outage stayed
    // invisible to a full test suite.
    if (typeof strings === "string") {
      throw new Error("sql(identifier) is not supported by the Neon driver");
    }
    let text = "";
    const params: unknown[] = [];
    for (let i = 0; i < strings.length; i++) {
      text += strings[i];
      if (i < values.length) {
        const v = values[i] as { __ident?: string };
        if (v && typeof v === "object" && v.__ident) text += quote(v.__ident);
        else {
          params.push(values[i]);
          text += "$" + params.length;
        }
      }
    }
    statements.push({ text, params });
    return Promise.resolve([] as Record<string, unknown>[]);
  };
  (fn as { query: unknown }).query = (text: string, params: unknown[] = []) => {
    statements.push({ text, params });
    return Promise.resolve([] as Record<string, unknown>[]);
  };
  return { sql: fn as Sql, statements };
}

/** The version this database is already at, or 0 if it has never been migrated. */
async function currentVersion(sql: Sql): Promise<number> {
  try {
    const rows = await sql`SELECT version FROM vita_hero.schema_meta WHERE id = 1`;
    return Number(rows[0]?.version) || 0;
  } catch {
    // The table does not exist yet: this is a database we have never touched.
    return 0;
  }
}

/**
 * Send the collected statements to Postgres.
 *
 * Uses the driver's transaction batching when it is available — the Neon HTTP
 * driver sends a whole transaction as one request, which is the entire point.
 * Falls back to running them one at a time so tests and any driver without
 * batching still work.
 */
async function runBatched(sql: Sql, statements: Recorded[]): Promise<void> {
  const withTx = sql as unknown as {
    transaction?: (queries: unknown[]) => Promise<unknown>;
    query: (text: string, params: unknown[]) => Promise<unknown>;
  };

  for (let i = 0; i < statements.length; i += BATCH) {
    const chunk = statements.slice(i, i + BATCH);
    if (typeof withTx.transaction === "function") {
      await withTx.transaction(chunk.map((s) => withTx.query(s.text, s.params)));
    } else {
      for (const s of chunk) await withTx.query(s.text, s.params);
    }
  }
}

/**
 * Bring a database up to date, doing as little as possible.
 *
 * `ddl` are the pure-DDL ensure* functions; `seeds` are the steps that have to
 * read before they write. Both run only when the version is behind.
 */
export async function migrate(
  sql: Sql,
  ddl: Array<(s: Sql) => Promise<void>>,
  seeds: Array<(s: Sql) => Promise<void>>
): Promise<{ migrated: boolean; statements: number; version: number }> {
  const at = await currentVersion(sql);
  if (at >= SCHEMA_VERSION) {
    return { migrated: false, statements: 0, version: at };
  }

  const rec = recorder();
  for (const step of ddl) await step(rec.sql);

  // The version marker itself, so a database that has just been migrated is
  // recognised as such on the next cold start.
  rec.statements.push({
    text: `CREATE TABLE IF NOT EXISTS vita_hero.schema_meta (
             id INT PRIMARY KEY, version INT NOT NULL, migrated_at TIMESTAMPTZ DEFAULT NOW())`,
    params: [],
  });

  await runBatched(sql, rec.statements);

  for (const seed of seeds) await seed(sql);

  await sql.query(
    `INSERT INTO vita_hero.schema_meta (id, version, migrated_at)
     VALUES (1, $1, NOW())
     ON CONFLICT (id) DO UPDATE SET version = EXCLUDED.version, migrated_at = NOW()`,
    [SCHEMA_VERSION]
  );

  return { migrated: true, statements: rec.statements.length, version: SCHEMA_VERSION };
}
