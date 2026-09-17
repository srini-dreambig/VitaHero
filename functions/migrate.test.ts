// Schema migration, against a real Postgres.
//
// The failure this guards against took the whole worker down and reported
// nothing useful: 115 statements, each its own outbound request, against a
// Cloudflare subrequest budget of 50. Structure was never the problem — the
// SQL was fine — so a test that only ever built a schema from scratch and
// counted no round trips could not see it. These do.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import pg from "pg";
import type { Sql } from "./common";
import { serialQuery } from "./pgserial";
import { migrate, SCHEMA_VERSION } from "./migrate";
import { ensureStageASchema } from "./schools";
import { ensureCampSchema } from "./camps";
import { ensureReferralSchema } from "./referrals";
import { ensureLifecycleSchema } from "./lifecycle";
import { ensureMediaSchema } from "./media";
import { ensureMessageSchema } from "./messages";
import { ensureLibrarySchema, seedLibraryIfEmpty } from "./library";
import { ensureBillingSchema } from "./billing";
import { ensureSymptomSchema } from "./symptoms";

const URL = process.env.TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;

function URL2(base: string, db: string): string {
  const u = new globalThis.URL(base);
  u.pathname = "/" + db;
  return u.toString();
}

let client: pg.Client;
let sql: Sql;
/** Every statement the driver was actually asked to send. */
let sent: string[] = [];

function countingShim(c: pg.Client): Sql {
  const send = serialQuery(c);
  const q = (s: string) => '"' + s.replace(/"/g, '""') + '"';
  const fn: any = (strings: TemplateStringsArray | string, ...values: unknown[]) => {
    // The real @neondatabase/serverless v1 driver REJECTS this call. A test
    // double that accepted it is why 248 green tests coexisted with a worker
    // that died on its very first statement: every `${sql(SCHEMA)}` threw
    // "can now be called only as a tagged-template function", the catch around
    // schema init turned it into a generic message, and no test could see it
    // because no test ran the real driver. Fail here the way production does.
    if (typeof strings === "string") {
      throw new Error(
        "sql(identifier) is not supported by the Neon driver \u2014 " +
        "use a literal schema name in the template instead"
      );
    }
    let text = "";
    const params: unknown[] = [];
    for (let i = 0; i < strings.length; i++) {
      text += strings[i];
      if (i < values.length) {
        const v = values[i] as { __ident?: string };
        if (v && typeof v === "object" && v.__ident) text += q(v.__ident);
        else { params.push(values[i]); text += "$" + params.length; }
      }
    }
    sent.push(text);
    return send(text, params);
  };
  fn.query = (text: string, params: unknown[] = []) => {
    sent.push(text);
    return send(text, params);
  };
  return fn as Sql;
}

// Deliberately WITHOUT a `transaction` method, so this measures the
// worst case: a driver with no batching at all.
const DDL = [
  ensureStageASchema, ensureCampSchema, ensureReferralSchema, ensureLifecycleSchema,
  ensureMediaSchema, ensureMessageSchema, ensureLibrarySchema, ensureBillingSchema,
  ensureSymptomSchema,
];
const SEEDS = [seedLibraryIfEmpty];

/** The legacy tables the modules above join against. */
async function legacy(s: Sql) {
  await s`CREATE SCHEMA IF NOT EXISTS vita_hero`;
  await s`CREATE TABLE IF NOT EXISTS vita_hero.profiles (
    id TEXT PRIMARY KEY, user_id TEXT, phone TEXT, name TEXT NOT NULL DEFAULT '',
    email TEXT, session_token TEXT, auth_provider TEXT, role TEXT DEFAULT 'PARENT',
    provisioned BOOLEAN DEFAULT false, school_id TEXT, locale_code TEXT DEFAULT 'en')`;
  await s`CREATE TABLE IF NOT EXISTS vita_hero.kids (
    id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, name TEXT NOT NULL, age INT DEFAULT 0,
    gender TEXT DEFAULT '', school TEXT DEFAULT '', grade TEXT DEFAULT '',
    height_cm DOUBLE PRECISION DEFAULT 0, weight_kg DOUBLE PRECISION DEFAULT 0,
    dental TEXT DEFAULT 'GOOD', eyesight TEXT DEFAULT 'GOOD', nutrition TEXT DEFAULT 'GOOD',
    student_ref TEXT, source TEXT DEFAULT 'PARENT')`;
  await s`CREATE TABLE IF NOT EXISTS vita_hero.schools (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, city TEXT DEFAULT '',
    partner_code TEXT NOT NULL UNIQUE, active BOOLEAN DEFAULT true)`;
  await s`CREATE TABLE IF NOT EXISTS vita_hero.school_camps (
    id TEXT PRIMARY KEY, school_id TEXT NOT NULL, title TEXT NOT NULL, date TEXT NOT NULL,
    status TEXT DEFAULT 'UPCOMING', checks JSONB DEFAULT '[]'::jsonb,
    grades JSONB DEFAULT '[]'::jsonb, active BOOLEAN DEFAULT true)`;
  await s`CREATE TABLE IF NOT EXISTS vita_hero.school_enrollments (
    id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, school_id TEXT NOT NULL,
    kid_id TEXT, status TEXT DEFAULT 'ACTIVE', UNIQUE (profile_id, school_id))`;
}

beforeAll(async () => {
  if (!URL) return;
  const admin = new pg.Client({ connectionString: URL });
  await admin.connect();
  await admin.query("DROP DATABASE IF EXISTS vh_test_migrate");
  await admin.query("CREATE DATABASE vh_test_migrate");
  await admin.end();
  client = new pg.Client({ connectionString: URL2(URL, "vh_test_migrate") });
  await client.connect();
  sql = countingShim(client);
  await client.query("DROP SCHEMA IF EXISTS vita_hero CASCADE");
  sent = [];
  await legacy(sql);
});
afterAll(async () => { if (client) await client.end(); });

suite("schema migration", () => {
  let firstRun = 0;

  test("a fresh database is migrated, and we know what that cost", async () => {
    sent = [];
    const r = await migrate(sql, DDL, SEEDS);
    firstRun = sent.length;
    expect(r.migrated).toBe(true);
    expect(r.version).toBe(SCHEMA_VERSION);
    expect(firstRun).toBeGreaterThan(20);
  });

  // The actual regression. A worker gets 50 subrequests; a cold start on an
  // already-migrated database must cost about one, not a hundred and fifteen.
  test("a migrated database costs one round trip, not a hundred", async () => {
    sent = [];
    const r = await migrate(sql, DDL, SEEDS);
    expect(r.migrated).toBe(false);
    expect(sent.length).toBe(1);
    expect(sent[0]).toContain("schema_meta");
  });

  test("the version is recorded, so the next cold start can skip", async () => {
    const rows = await client.query("SELECT version FROM vita_hero.schema_meta WHERE id = 1");
    expect(rows.rows[0].version).toBe(SCHEMA_VERSION);
  });

  test("migrating again after a version bump re-runs, and stays idempotent", async () => {
    await client.query("UPDATE vita_hero.schema_meta SET version = 0 WHERE id = 1");
    sent = [];
    const r = await migrate(sql, DDL, SEEDS);
    expect(r.migrated).toBe(true);
    // Re-running every statement against a database that already has them must
    // not throw — that is what makes a version bump safe to deploy.
    const rows = await client.query("SELECT version FROM vita_hero.schema_meta WHERE id = 1");
    expect(rows.rows[0].version).toBe(SCHEMA_VERSION);
  });

  test("seeding runs once and does not duplicate on a second migration", async () => {
    const before = await client.query("SELECT COUNT(*)::int AS n FROM vita_hero.library_articles");
    await client.query("UPDATE vita_hero.schema_meta SET version = 0 WHERE id = 1");
    await migrate(sql, DDL, SEEDS);
    const after = await client.query("SELECT COUNT(*)::int AS n FROM vita_hero.library_articles");
    expect(after.rows[0].n).toBe(before.rows[0].n);
    expect(after.rows[0].n).toBeGreaterThan(0);
  });

  test("existing data survives a migration", async () => {
    await client.query(
      `INSERT INTO vita_hero.kids (id, profile_id, name, student_ref)
       VALUES ('k_keep', 'ph_1', 'Existing Child', 'sid_keep')
       ON CONFLICT (id) DO NOTHING`
    );
    await client.query("UPDATE vita_hero.schema_meta SET version = 0 WHERE id = 1");
    await migrate(sql, DDL, SEEDS);
    const rows = await client.query("SELECT name FROM vita_hero.kids WHERE id = 'k_keep'");
    expect(rows.rows[0].name).toBe("Existing Child");
  });

  test("a driver that can batch is used for batching", async () => {
    // The Neon HTTP driver sends a whole transaction as one request. Prove
    // migrate() reaches for it, because that is what keeps the first run under
    // the subrequest budget too.
    const batches: number[] = [];
    const batching: any = (...args: unknown[]) => (sql as any)(...args);
    batching.query = (t: string, p: unknown[] = []) => ({ __q: t, __p: p });
    batching.transaction = async (queries: Array<{ __q: string; __p: unknown[] }>) => {
      batches.push(queries.length);
      for (const q of queries) await client.query(q.__q, q.__p);
      return [];
    };
    await client.query("UPDATE vita_hero.schema_meta SET version = 0 WHERE id = 1");
    await migrate(batching as Sql, DDL, SEEDS);
    expect(batches.length).toBeGreaterThan(0);
    // Far fewer requests than statements — the whole point.
    const total = batches.reduce((a, b) => a + b, 0);
    expect(batches.length).toBeLessThan(total / 5);
  });
});

// A static guard, not a behavioural one.
//
// `sql(SCHEMA)` typechecks, reads fine, and works against every test double we
// had — and throws on the first call against the real driver. The only cheap
// way to keep it out is to look for it.
describe("driver compatibility", () => {
  test("no source file calls sql() as a plain function", async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const offenders: string[] = [];
    for (const f of readdirSync(".")) {
      if (!f.endsWith(".ts") || f.endsWith(".test.ts")) continue;
      // Comments and string literals mention the pattern on purpose; only
      // real code counts.
      const src = readFileSync(f, "utf8")
        .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
        .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/[^\n]*/g, "");
      // sql("x") or sql(IDENT) — anything but a tagged template or .query()
      for (const h of src.match(/\bsql\((?!\s*\))[^)]*\)/g) || []) {
        offenders.push(`${f}: ${h}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

// ── what the seed steps cost, and what they must not do ──
//
// The DDL is batched, so the expensive part of a first request was never the
// schema — it was the seeds, which run after the batch with the real driver,
// one outbound subrequest each. Cloudflare allows 50 on the free plan, and the
// route still has its own queries to make afterwards.
describe("seeding a fresh database", () => {
  /** An `Sql` that records statements and answers reads with given rows. */
  function fakeSql(reads: Array<{ match: RegExp; rows: Record<string, unknown>[] }> = []) {
    const statements: Array<{ text: string; params: unknown[] }> = [];
    const answer = (text: string, params: unknown[]) => {
      statements.push({ text, params });
      for (const r of reads) if (r.match.test(text)) return Promise.resolve(r.rows);
      return Promise.resolve([] as Record<string, unknown>[]);
    };
    const fn: any = (strings: TemplateStringsArray | string, ...values: unknown[]) => {
      if (typeof strings === "string") throw new Error("sql(identifier) is not supported by the Neon driver");
      let text = "";
      const params: unknown[] = [];
      for (let i = 0; i < strings.length; i++) {
        text += strings[i];
        if (i < values.length) { params.push(values[i]); text += "$" + params.length; }
      }
      return answer(text, params);
    };
    fn.query = (text: string, params: unknown[] = []) => answer(text, params);
    fn.statements = statements;
    return fn;
  }

  test("the library is one statement, not one per article and locale", async () => {
    const { seedLibraryIfEmpty } = await import("./library");
    const sql = fakeSql();
    await seedLibraryIfEmpty(sql);
    const inserts = sql.statements.filter((s: { text: string }) =>
      /INSERT INTO vita_hero\.library_articles/.test(s.text));
    expect(inserts.length).toBe(1);
    // Six articles really are in there; they were not lost in the batching.
    expect(inserts[0].params.length % 10).toBe(0);
    expect(inserts[0].params.length / 10).toBeGreaterThanOrEqual(6);
  });

  test("a school ops deleted does not come back", async () => {
    // The real failure this moved for. In the DDL path the COUNT below was
    // handed an empty result, so the guard never fired, and the inserts landed
    // every time the schema version moved. DO NOTHING hid that only while the
    // demo rows still existed — once ops deleted one, the next migration put it
    // straight back.
    const { seedPartnerSchools } = await import("./index");
    const populated = fakeSql([
      { match: /COUNT\(\*\)::int AS c FROM vita_hero\.schools/, rows: [{ c: 3 }] },
    ]);
    await seedPartnerSchools(populated);
    expect(populated.statements.length).toBe(1);
    expect(populated.statements.some((s: { text: string }) => /INSERT INTO/.test(s.text))).toBe(false);
  });

  test("but an empty database still gets its demo schools, in two statements", async () => {
    const { seedPartnerSchools } = await import("./index");
    const empty = fakeSql([
      { match: /COUNT\(\*\)::int AS c FROM vita_hero\.schools/, rows: [{ c: 0 }] },
    ]);
    await seedPartnerSchools(empty);
    const inserts = empty.statements.filter((s: { text: string }) => /INSERT INTO/.test(s.text));
    expect(inserts.length).toBe(2);
    expect(inserts[0].text).toContain("vita_hero.schools");
    expect(inserts[1].text).toContain("vita_hero.school_camps");
    // Four schools of seven columns, six camps of twelve.
    expect(inserts[0].params.length).toBe(4 * 7);
    expect(inserts[1].params.length).toBe(6 * 12);
    // The camps carry their hospital on the insert, so nothing has to go back
    // over the same six ids afterwards to patch it in.
    expect(inserts[1].params).toContain("hosp_rainbow");
  });

  test("a seed step that reads is not run against the recorder", async () => {
    // migrate() hands the DDL a recorder whose reads come back empty. Any step
    // that decides something from a read has to be a seed, or its guard is
    // decoration. seedPartnerSchools was in the DDL path with exactly that
    // problem, so the shape is worth asserting rather than remembering.
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("index.ts", "utf8");
    const ensureSchema = src.slice(
      src.indexOf("async function ensureSchema("),
      src.indexOf("async function seedDoctorsIfEmpty(")
    );
    expect(ensureSchema).not.toContain("seedPartnerSchools(sql)");
    expect(src).toContain("const SEED_STEPS = [seedDoctorsIfEmpty, seedPartnerSchools, seedLibraryIfEmpty]");
  });
});
