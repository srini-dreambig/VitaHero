// What a camp day costs when it comes back from the hall.
//
// A screener works offline: the console holds every capture in a local queue
// and posts the whole queue in one request when there is signal again. That
// request is the single most important write in the product — it is a morning's
// screening for a whole school — and on Cloudflare every statement it runs is
// an outbound subrequest, with 50 allowed on the free plan and 1000 on the
// paid one.
//
// So the number that matters is not how long the sync takes but how many
// statements it sends, and whether that number grows with the number of
// children. This measures it against a real database with a real camp on it.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import pg from "pg";
import type { Sql } from "./common";
import { serialQuery } from "./pgserial";
import { ensureStageASchema, type Actor } from "./schools";
import { ensureCampSchema, saveScreeningBulk } from "./camps";
import { ensureReferralSchema } from "./referrals";

const URL = process.env.TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;
function URL2(b: string, d: string) { const u = new globalThis.URL(b); u.pathname = "/" + d; return u.toString(); }

const SCHOOL = "sch_sync";
const CAMP = "cmp_sync";
const CHILDREN = 200;
const SCREENER: Actor = { profileId: "ph_scr_sync", name: "Nurse Latha", role: "SCREENER", schoolId: SCHOOL };

let client: pg.Client;
let sql: Sql;
let counted: Sql;
let statements = 0;

function shim(c: pg.Client): Sql {
  const send = serialQuery(c);
  const fn: any = (strings: TemplateStringsArray | string, ...values: unknown[]) => {
    if (typeof strings === "string") throw new Error("no");
    let text = ""; const params: unknown[] = [];
    for (let i = 0; i < strings.length; i++) {
      text += strings[i];
      if (i < values.length) { params.push(values[i]); text += "$" + params.length; }
    }
    return send(text, params);
  };
  fn.query = (t: string, p: unknown[] = []) => send(t, p);
  return fn as Sql;
}

/** What the console's queue looks like after a morning in a school hall. */
function queueOf(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    kidId: `k_sync_${i}`,
    attendance: i % 25 === 0 ? "ABSENT" : "PRESENT",
    findings: i % 25 === 0 ? [] : [
      { checkType: "Height & weight", detail: { heightCm: 120 + (i % 12), weightKg: 23 + (i % 6) } },
      { checkType: "Vision", detail: { leftAcuity: "6/6", rightAcuity: i % 11 === 0 ? "6/18" : "6/6" } },
      { checkType: "Dental", detail: { caries: i % 9 === 0, gums: "NORMAL" } },
    ],
  }));
}

suite("syncing a camp day back from the hall", () => {
  beforeAll(async () => {
    if (!URL) return;
    const admin = new pg.Client({ connectionString: URL });
    await admin.connect();
    await admin.query("DROP DATABASE IF EXISTS vh_sync");
    await admin.query("CREATE DATABASE vh_sync");
    await admin.end();
    client = new pg.Client({ connectionString: URL2(URL, "vh_sync") });
    await client.connect();
    sql = shim(client);

    await client.query("CREATE SCHEMA vita_hero");
    await client.query(`CREATE TABLE vita_hero.profiles (
      id TEXT PRIMARY KEY, user_id TEXT, phone TEXT, name TEXT DEFAULT '', email TEXT,
      session_token TEXT, auth_provider TEXT, role TEXT DEFAULT 'PARENT',
      provisioned BOOLEAN DEFAULT false, school_id TEXT, is_logged_in BOOLEAN DEFAULT false,
      onboarding_complete BOOLEAN DEFAULT false, created_by TEXT DEFAULT '',
      invited_at TIMESTAMPTZ, invite_count INT DEFAULT 0, locale_code TEXT DEFAULT 'en')`);
    await client.query(`CREATE TABLE vita_hero.kids (
      id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, user_id TEXT, name TEXT NOT NULL,
      age INT DEFAULT 0, gender TEXT DEFAULT '', school TEXT DEFAULT '', grade TEXT DEFAULT '',
      height_cm DOUBLE PRECISION DEFAULT 0, weight_kg DOUBLE PRECISION DEFAULT 0,
      overall_score INT DEFAULT 80, dental TEXT DEFAULT 'GOOD', eyesight TEXT DEFAULT 'GOOD',
      nutrition TEXT DEFAULT 'GOOD', last_checkup TEXT DEFAULT '', student_ref TEXT,
      source TEXT DEFAULT 'PARENT')`);
    await client.query(`CREATE TABLE vita_hero.schools (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, city TEXT DEFAULT '', district TEXT DEFAULT '',
      partner_code TEXT NOT NULL UNIQUE, contact_email TEXT DEFAULT '', description TEXT DEFAULT '',
      active BOOLEAN DEFAULT true)`);
    await client.query(`CREATE TABLE vita_hero.school_camps (
      id TEXT PRIMARY KEY, school_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT DEFAULT '',
      date TEXT NOT NULL, time TEXT DEFAULT '', status TEXT DEFAULT 'DRAFT',
      checks JSONB DEFAULT '[]'::jsonb, grades JSONB DEFAULT '[]'::jsonb, capacity INT DEFAULT 200,
      registered_count INT DEFAULT 0, result_summary TEXT, active BOOLEAN DEFAULT true)`);
    await ensureStageASchema(sql);
    await ensureCampSchema(sql);
    await ensureReferralSchema(sql);

    await sql`INSERT INTO vita_hero.schools (id, name, partner_code) VALUES (${SCHOOL}, 'Sync School', 'SYNC-1')`;
    await sql`
      INSERT INTO vita_hero.school_camps (id, school_id, title, date, status, checks, grades)
      VALUES (${CAMP}, ${SCHOOL}, 'Annual', '2026-09-10', 'ACTIVE',
              '["Height & weight","Dental","Vision"]'::jsonb, '["Class 4"]'::jsonb)
    `;
    await sql`
      INSERT INTO vita_hero.profiles (id, name, phone, role, school_id, provisioned)
      VALUES (${SCREENER.profileId}, 'Nurse Latha', '+919800000901', 'SCREENER', ${SCHOOL}, true)
    `;
    await sql`
      INSERT INTO vita_hero.camp_staff (id, camp_id, profile_id, staff_role, active)
      VALUES ('cs_sync', ${CAMP}, ${SCREENER.profileId}, 'SCREENER', true)
    `;

    for (let i = 0; i < CHILDREN; i++) {
      const pid = `ph_sync_${Math.floor(i / 2)}`;
      const kid = `k_sync_${i}`;
      await sql`
        INSERT INTO vita_hero.profiles (id, name, phone, role, provisioned)
        VALUES (${pid}, ${"Guardian " + i}, ${"+9198111" + String(10000 + i).slice(0, 5)}, 'PARENT', true)
        ON CONFLICT (id) DO NOTHING
      `;
      await sql`
        INSERT INTO vita_hero.kids (id, profile_id, name, age, grade, school_id, source)
        VALUES (${kid}, ${pid}, ${"Child " + i}, 9, 'Class 4', ${SCHOOL}, 'ADMIN')
      `;
      await sql`
        INSERT INTO vita_hero.camp_participants
          (id, camp_id, school_id, kid_id, profile_id, status, urgency, consent_status, attendance)
        VALUES (${"cp_sync_" + i}, ${CAMP}, ${SCHOOL}, ${kid}, ${pid}, 'NOT_SCREENED',
                'NONE', 'GRANTED', 'UNKNOWN')
      `;
    }

    const inner = sql as unknown as ((...a: unknown[]) => unknown) & { query: (t: string, p: unknown[]) => unknown };
    const wrapper: any = (...args: unknown[]) => { statements++; return (inner as any)(...args); };
    wrapper.query = (t: string, p: unknown[] = []) => { statements++; return inner.query(t, p); };
    counted = wrapper as Sql;
  }, 180_000);

  afterAll(async () => { if (client) await client.end(); });

  test(`a queue of ${CHILDREN} children is accepted`, async () => {
    statements = 0;
    const r = await saveScreeningBulk(counted, SCREENER, CAMP, queueOf(CHILDREN));
    expect(r.rejected).toEqual([]);
    expect(r.applied).toBe(CHILDREN);
  }, 180_000);

  test("without one round of statements per child", () => {
    // The platform allows 1000 subrequests on the paid plan and 50 on the free
    // one. A loop that runs eleven statements a child sends 2200 for this camp
    // and is cut off long before it finishes — so a full school's screening
    // could not be synced at all, while the handful of children in a demo went
    // through fine. The ceiling is far below the platform's and far above what
    // a batched write needs.
    console.log(`    ${CHILDREN} children synced in ${statements} statements`);
    expect(statements).toBeLessThan(60);
  });

  test("every child's findings are actually there", async () => {
    const absent = Math.ceil(CHILDREN / 25);
    const f = await client.query(
      "SELECT COUNT(*)::int n FROM vita_hero.camp_findings WHERE camp_id=$1", [CAMP]);
    expect(f.rows[0].n).toBe((CHILDREN - absent) * 3);

    const present = await client.query(
      "SELECT COUNT(*)::int n FROM vita_hero.camp_participants WHERE camp_id=$1 AND attendance='PRESENT'", [CAMP]);
    expect(present.rows[0].n).toBe(CHILDREN - absent);

    const screened = await client.query(
      "SELECT COUNT(*)::int n FROM vita_hero.camp_participants WHERE camp_id=$1 AND status='SCREENED'", [CAMP]);
    expect(screened.rows[0].n).toBe(CHILDREN - absent);
  });

  test("sending the same queue again changes nothing", async () => {
    // A sync that times out after the server applied it is retried by the
    // screener, so the second send must be a no-op rather than a duplicate.
    const before = await client.query(
      "SELECT COUNT(*)::int n FROM vita_hero.camp_findings WHERE camp_id=$1", [CAMP]);
    const r = await saveScreeningBulk(sql, SCREENER, CAMP, queueOf(CHILDREN));
    expect(r.rejected).toEqual([]);
    const after = await client.query(
      "SELECT COUNT(*)::int n FROM vita_hero.camp_findings WHERE camp_id=$1", [CAMP]);
    expect(after.rows[0].n).toBe(before.rows[0].n);
  }, 180_000);
});
