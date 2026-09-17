// What the query planner does at the size of a real programme.
//
// Not a benchmark — timings on a laptop mean little. This asserts the *shape*
// of the plan: that the hottest queries reach their rows through an index
// rather than reading the whole table. A sequential scan is linear, so one that
// is survivable at forty thousand guardians is four times worse at a hundred
// and sixty, on a serverless database billed for the compute it burns.
//
// The authentication lookup is the one that matters most: it runs on every
// authenticated request the app makes, and opening the app makes about eight.
//
// Skipped unless TEST_DATABASE_URL points at a throwaway database.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import pg from "pg";

const URL = process.env.TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;

/** Swap the database name in a connection string. `URL` above shadows the global. */
function URL2(base: string, db: string): string {
  const u = new globalThis.URL(base);
  u.pathname = "/" + db;
  return u.toString();
}

let c: pg.Client;

/** Rows to create. Enough that the planner stops preferring a scan. */
const GUARDIANS = 40_000;
const CHILDREN = 60_000;

suite("the planner at programme scale", () => {
  beforeAll(async () => {
    if (!URL) return;
    const admin = new pg.Client({ connectionString: URL });
    await admin.connect();
    await admin.query("DROP DATABASE IF EXISTS vh_planner");
    await admin.query("CREATE DATABASE vh_planner");
    await admin.end();
    c = new pg.Client({ connectionString: URL2(URL, "vh_planner") });
    await c.connect();

    await c.query("CREATE SCHEMA vita_hero");
    await c.query(`CREATE TABLE vita_hero.profiles (
      id TEXT PRIMARY KEY, user_id TEXT, phone TEXT, name TEXT DEFAULT '', email TEXT,
      session_token TEXT, role TEXT DEFAULT 'PARENT', school_id TEXT)`);
    await c.query(`CREATE TABLE vita_hero.kids (
      id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, name TEXT, age INT,
      school_id TEXT, grade TEXT)`);
    await c.query(`CREATE TABLE vita_hero.meal_items (
      id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, kid_id TEXT NOT NULL,
      time_slot TEXT, name TEXT)`);
    await c.query(`CREATE TABLE vita_hero.growth_points (
      id TEXT PRIMARY KEY, kid_id TEXT NOT NULL, label TEXT,
      recorded_at TIMESTAMPTZ DEFAULT NOW())`);
    await c.query(`CREATE TABLE vita_hero.appointments (
      id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, doctor_id TEXT, date TEXT, time TEXT)`);

    // The same statements the worker ships, copied deliberately: if one is
    // renamed there and not here, this suite stops covering it and says so by
    // failing on the plan.
    for (const ddl of [
      `CREATE INDEX profiles_session_token ON vita_hero.profiles(session_token) WHERE session_token IS NOT NULL`,
      `CREATE INDEX kids_profile ON vita_hero.kids(profile_id)`,
      `CREATE INDEX kids_school_grade ON vita_hero.kids(school_id, grade)`,
      `CREATE INDEX meal_items_profile ON vita_hero.meal_items(profile_id)`,
      `CREATE INDEX growth_points_kid ON vita_hero.growth_points(kid_id)`,
      `CREATE INDEX appointments_profile ON vita_hero.appointments(profile_id)`,
      `CREATE INDEX appointments_slot ON vita_hero.appointments(doctor_id, date, time)`,
    ]) await c.query(ddl);

    await c.query(`INSERT INTO vita_hero.profiles (id, phone, name, session_token)
      SELECT 'ph_'||g, '+9198'||lpad(g::text,8,'0'), 'Guardian '||g, md5(g::text)||md5((g+1)::text)
      FROM generate_series(1, ${GUARDIANS}) g`);
    await c.query(`INSERT INTO vita_hero.kids (id, profile_id, name, age, school_id, grade)
      SELECT 'k_'||g, 'ph_'||((g % ${GUARDIANS})+1), 'Child '||g, 8+(g%8),
             'sch_'||((g % 60)+1), 'Class '||((g % 10)+1)
      FROM generate_series(1, ${CHILDREN}) g`);
    await c.query(`INSERT INTO vita_hero.meal_items (id, profile_id, kid_id, time_slot, name)
      SELECT 'ml_'||g, 'ph_'||((g % ${GUARDIANS})+1), 'k_'||((g % ${CHILDREN})+1), 'Breakfast', 'Idli'
      FROM generate_series(1, 240000) g`);
    await c.query(`INSERT INTO vita_hero.growth_points (id, kid_id, label)
      SELECT 'gp_'||g, 'k_'||((g % ${CHILDREN})+1), '2026' FROM generate_series(1, 120000) g`);
    // Spread across doctors, days and slots. Giving every row the same date and
    // time would make the clash predicate match five percent of the table, and
    // the planner would rightly scan for a LIMIT 1 — which would be a fact
    // about the fixture, not about the index.
    await c.query(`INSERT INTO vita_hero.appointments (id, profile_id, doctor_id, date, time)
      SELECT 'a_'||g, 'ph_'||((g % ${GUARDIANS})+1), 'd'||(g%40),
             '2026-'||lpad((10+(g%3))::text,2,'0')||'-'||lpad(((g/40)%28+1)::text,2,'0'),
             lpad((9+(g%8))::text,2,'0')||':00'
      FROM generate_series(1, 30000) g`);
    await c.query("ANALYZE");
  }, 120_000);
  afterAll(async () => { if (c) await c.end(); });

  /** True when the plan reads a whole table rather than seeking into it. */
  async function scansWholeTable(q: string, params: unknown[]): Promise<boolean> {
    const plan = await c.query(`EXPLAIN (FORMAT JSON) ${q}`, params as never[]);
    return /"Node Type":"Seq Scan"/.test(JSON.stringify(plan.rows[0]["QUERY PLAN"][0]));
  }

  test("authenticating a request does not read every profile", async () => {
    expect(await scansWholeTable(
      "SELECT id, user_id, name, role, school_id FROM vita_hero.profiles WHERE session_token = $1 LIMIT 1",
      ["0".repeat(64)],
    )).toBe(false);
  });

  test("a parent's children do not read every child", async () => {
    expect(await scansWholeTable(
      "SELECT * FROM vita_hero.kids WHERE profile_id = $1 ORDER BY name", ["ph_20000"],
    )).toBe(false);
  });

  test("a parent's meals do not read every meal", async () => {
    expect(await scansWholeTable(
      "SELECT * FROM vita_hero.meal_items WHERE profile_id = $1", ["ph_20000"],
    )).toBe(false);
  });

  test("one child's growth points do not read every point", async () => {
    expect(await scansWholeTable(
      "SELECT * FROM vita_hero.growth_points WHERE kid_id = $1 ORDER BY recorded_at", ["k_20000"],
    )).toBe(false);
  });

  test("a parent's appointments do not read every appointment", async () => {
    expect(await scansWholeTable(
      "SELECT * FROM vita_hero.appointments WHERE profile_id = $1", ["ph_20000"],
    )).toBe(false);
  });

  test("the booking clash check does not read every appointment", async () => {
    expect(await scansWholeTable(
      "SELECT id FROM vita_hero.appointments WHERE doctor_id = $1 AND date = $2 AND time = $3 LIMIT 1",
      ["d5", "2026-10-05", "11:00"],
    )).toBe(false);
  });

  test("building a camp roster does not read every child in the district", async () => {
    expect(await scansWholeTable(
      "SELECT k.id, k.profile_id FROM vita_hero.kids k WHERE k.school_id = $1 AND k.grade = ANY($2)",
      ["sch_30", ["Class 4"]],
    )).toBe(false);
  });

  test("every index the worker ships for these paths is present here", async () => {
    // Guards the copy above: an index renamed in index.ts and not here would
    // otherwise leave this suite testing a shape production no longer has.
    const { readFileSync } = await import("node:fs");
    const worker = readFileSync("index.ts", "utf8");
    const mine = (await c.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'vita_hero'`
    )).rows.map((r) => r.indexname as string);
    for (const name of mine) {
      if (name.endsWith("_pkey")) continue;
      expect(worker).toContain(name);
    }
  });
});
