// Emptying the programme, against a real Postgres.
//
// The case that prompted this: somebody emptied the programme, the console
// said "Removed 50 records", and the hospitals and doctors were all still
// there. Nothing was broken — the directory was excluded on purpose and said
// so in a panel headed "What stays" — but a decision that quiet is
// indistinguishable from a bug, and the person emptying the programme is
// entitled to decide rather than be told.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import pg from "pg";
import type { Sql } from "./common";
import { serialQuery } from "./pgserial";
import type { Actor } from "./schools";
import { SCHEMA_STEPS } from "./index";
import { migrate } from "./migrate";
import { previewReset, resetProgramme, RESET_PHRASE } from "./reset";

const URL = process.env.TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;
function URL2(base: string, db: string): string {
  const u = new globalThis.URL(base);
  u.pathname = "/" + db;
  return u.toString();
}

let client: pg.Client;
let sql: Sql;

function neonShim(c: pg.Client): Sql {
  const send = serialQuery(c);
  const fn: any = (strings: TemplateStringsArray | string, ...values: unknown[]) => {
    if (typeof strings === "string") throw new Error("sql(identifier) is not supported");
    let text = "";
    const params: unknown[] = [];
    for (let i = 0; i < strings.length; i++) {
      text += strings[i];
      if (i < values.length) { params.push(values[i]); text += "$" + params.length; }
    }
    return send(text, params);
  };
  fn.query = (t: string, p: unknown[]) => send(t, p);
  return fn as Sql;
}

const OPS: Actor = { profileId: "ph_ops", name: "Ops", role: "SUPERADMIN", schoolId: null };
const HEAD: Actor = { profileId: "ph_head", name: "Head", role: "SCHOOL_ADMIN", schoolId: "sch_1" };

/**
 * Something of every kind, so what survives a reset is visible.
 *
 * Idempotent, because the operations profile is meant to survive a reset —
 * calling this again after one would otherwise collide with the row whose
 * survival is the point.
 */
async function fill(s: Sql) {
  await s`INSERT INTO vita_hero.schools (id, name, city, partner_code)
          VALUES ('sch_1', 'Silver Oaks', 'Hyderabad', 'SO-1')
          ON CONFLICT DO NOTHING`;
  await s`INSERT INTO vita_hero.school_camps (id, school_id, title, date, status)
          VALUES ('sc_1', 'sch_1', 'Annual camp', '2026-08-01', 'RELEASED')
          ON CONFLICT DO NOTHING`;
  await s`INSERT INTO vita_hero.kids (id, profile_id, name)
          VALUES ('k_1', 'ph_par', 'Aarav Sharma')
          ON CONFLICT DO NOTHING`;
  await s`INSERT INTO vita_hero.profiles (id, phone, name, role)
          VALUES ('ph_par', '+919876543210', 'Rahul Sharma', 'PARENT')
          ON CONFLICT DO NOTHING`;
  await s`INSERT INTO vita_hero.profiles (id, phone, name, role)
          VALUES ('ph_head', '+919800000001', 'Asha Rao', 'SCHOOL_ADMIN')
          ON CONFLICT DO NOTHING`;
  // The one that must survive: whoever is running this.
  await s`INSERT INTO vita_hero.profiles (id, phone, name, role)
          VALUES ('ph_ops', '+919000000001', 'Ops', 'SUPERADMIN')
          ON CONFLICT DO NOTHING`;
  await s`INSERT INTO vita_hero.camp_findings (id, camp_id, kid_id, check_type, flag)
          VALUES ('cf_1', 'sc_1', 'k_1', 'Vision', 'WATCH')
          ON CONFLICT DO NOTHING`;
  await s`INSERT INTO vita_hero.hospitals (id, name, city)
          VALUES ('h_1', 'KIMS Hospital', 'Hyderabad')
          ON CONFLICT DO NOTHING`;
  await s`INSERT INTO vita_hero.doctors (id, name, specialty, phone)
          VALUES ('d_1', 'Dr Test Batch1', 'Paediatrics', '+919111111111')
          ON CONFLICT DO NOTHING`;
  await s`INSERT INTO vita_hero.library_articles (id, slug, locale, title, summary, body)
          VALUES ('la_1', 'vision', 'en', 'Squinting', 'What WATCH means', 'Body')
          ON CONFLICT DO NOTHING`;
}

const count = async (s: Sql, t: string, where = "") => {
  const r = await s.query(`SELECT COUNT(*)::int AS c FROM vita_hero.${t} ${where}`, []);
  return Number(r[0]?.c) || 0;
};

suite("emptying the programme", () => {
  beforeAll(async () => {
    if (!URL) return;
    const admin = new pg.Client({ connectionString: URL });
    await admin.connect();
    await admin.query("DROP DATABASE IF EXISTS vh_reset");
    await admin.query("CREATE DATABASE vh_reset");
    await admin.end();
    client = new pg.Client({ connectionString: URL2(URL, "vh_reset") });
    await client.connect();
    sql = neonShim(client);
    await migrate(sql, SCHEMA_STEPS, []);
  });
  afterAll(async () => { if (client) await client.end(); });

  test("the preview counts the directory and the library separately", async () => {
    await fill(sql);
    const p = await previewReset(sql, OPS);
    expect(p.counts.schools).toBe(1);
    expect(p.counts.children).toBe(1);
    expect(p.counts.guardians).toBe(1);
    // Not folded into the total, because they are a choice and the total is
    // what goes no matter what.
    expect(p.optional.directory.hospitals).toBe(1);
    expect(p.optional.directory.doctors).toBe(1);
    expect(p.optional.library.articles).toBe(1);
    expect(p.phrase).toBe(RESET_PHRASE);
  });

  test("the words have to be right, and nothing goes without them", async () => {
    await expect(resetProgramme(sql, OPS, "delete")).rejects.toThrow(/DELETE EVERYTHING/);
    await expect(resetProgramme(sql, OPS, "")).rejects.toThrow(/DELETE EVERYTHING/);
    expect(await count(sql, "schools")).toBe(1);
  });

  test("a school administrator cannot do this at all", async () => {
    await expect(previewReset(sql, HEAD)).rejects.toThrow(/operations/i);
    await expect(resetProgramme(sql, HEAD, RESET_PHRASE)).rejects.toThrow(/operations/i);
    expect(await count(sql, "schools")).toBe(1);
  });

  test("unticking the directory keeps it, and says so", async () => {
    const r = await resetProgramme(sql, OPS, RESET_PHRASE, { directory: false, library: false });
    expect(await count(sql, "schools")).toBe(0);
    expect(await count(sql, "kids")).toBe(0);
    expect(await count(sql, "camp_findings")).toBe(0);
    // Kept, because that is what was asked for — and reported, so nobody has
    // to wonder whether it failed.
    expect(await count(sql, "hospitals")).toBe(1);
    expect(await count(sql, "doctors")).toBe(1);
    expect(await count(sql, "library_articles")).toBe(1);
    expect(r.kept.directory).toBe(true);
    expect(r.kept.library).toBe(true);
  });

  test("by default it takes the directory and the library too", async () => {
    await fill(sql);
    expect(await count(sql, "hospitals")).toBeGreaterThan(0);

    // No options at all: the caller opts out, not in.
    const r = await resetProgramme(sql, OPS, RESET_PHRASE);
    expect(await count(sql, "hospitals")).toBe(0);
    expect(await count(sql, "doctors")).toBe(0);
    expect(await count(sql, "library_articles")).toBe(0);
    expect(r.kept.directory).toBe(false);
    expect(r.removed.hospitals).toBeGreaterThan(0);
    expect(r.removed.doctors).toBeGreaterThan(0);
  });

  test("the operations sign-in survives, and no other kind does", async () => {
    const ops = await count(sql, "profiles", "WHERE role = 'SUPERADMIN'");
    const rest = await count(sql, "profiles",
      "WHERE role IN ('PARENT','SCHOOL_ADMIN','SCREENER','PHYSICIAN','REVOKED')");
    // Otherwise whoever ran this is locked out halfway through and cannot see
    // whether it worked.
    expect(ops).toBe(1);
    expect(rest).toBe(0);
  });

  test("the phrase is not case-sensitive, but it is exact", async () => {
    await fill(sql);
    await expect(resetProgramme(sql, OPS, "delete everything please"))
      .rejects.toThrow(/DELETE EVERYTHING/);
    const r = await resetProgramme(sql, OPS, "  delete everything  ");
    expect(r.total).toBeGreaterThan(0);
    expect(await count(sql, "schools")).toBe(0);
  });

  test("running it on an empty programme is a no-op, not an error", async () => {
    const r = await resetProgramme(sql, OPS, RESET_PHRASE);
    expect(r.total).toBe(0);
    const p = await previewReset(sql, OPS);
    expect(p.total).toBe(0);
  });
});
