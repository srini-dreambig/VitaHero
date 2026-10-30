// A class's paper consent slips, keyed in at once.
//
// The one rule that matters: only children still waiting change. A guardian
// who answered in the app has answered, and a bulk click must never turn
// their "no" into a "yes". The rest is the audit trail (one log row per child
// actually changed) and two people entering the same pile at the same moment.

import { afterAll, beforeAll, expect, test, describe } from "bun:test";
import pg from "pg";
import type { Sql } from "./common";
import { serialQuery } from "./pgserial";
import type { Actor } from "./schools";
import { SCHEMA_STEPS } from "./index";
import { migrate } from "./migrate";
import { BULK_CONSENT_LIMIT, recordConsentBulk } from "./camps";

const URL = process.env.TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;
function URL2(base: string, db: string): string {
  const u = new globalThis.URL(base);
  u.pathname = "/" + db;
  return u.toString();
}

const clients: pg.Client[] = [];
let sqlA: Sql;
let sqlB: Sql;

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

async function connect(db: string): Promise<pg.Client> {
  const c = new pg.Client({ connectionString: URL2(URL!, db) });
  await c.connect();
  clients.push(c);
  return c;
}

const OPS: Actor = { profileId: "ph_bulk_ops", name: "Ops", role: "ADMIN", schoolId: null };
const HEAD: Actor = { profileId: "ph_bulk_head", name: "Head", role: "SCHOOL_ADMIN", schoolId: "sch_b" };
const OTHER_HEAD: Actor = { profileId: "ph_bulk_other", name: "Other", role: "SCHOOL_ADMIN", schoolId: "sch_x" };
const NURSE: Actor = { profileId: "ph_bulk_nurse", name: "Nurse", role: "SCREENER", schoolId: "sch_b" };
const CAMP = "sc_bulk";
const PHOTO_CAMP = "sc_bulk_photo";
const RACE_CAMP = "sc_bulk_race";

async function child(sql: Sql, camp: string, id: string, grade: string, section: string,
                     consent = "PENDING", status = "NOT_SCREENED") {
  const parent = "ph_p_" + id;
  await sql`INSERT INTO vita_hero.profiles (id, phone, name, role, provisioned, school_id)
            VALUES (${parent}, ${"+91" + (9400000000 + Math.floor(Math.random() * 99999999))},
                    'Parent', 'PARENT', true, 'sch_b')
            ON CONFLICT (id) DO NOTHING`;
  await sql`INSERT INTO vita_hero.kids (id, profile_id, name, school_id, grade, section, age, gender)
            VALUES (${id}, ${parent}, ${"Child " + id}, 'sch_b', ${grade}, ${section}, 10, 'F')
            ON CONFLICT (id) DO NOTHING`;
  await sql`INSERT INTO vita_hero.camp_participants
              (id, camp_id, school_id, kid_id, profile_id, consent_status, consent_checks, attendance, status)
            VALUES (${"cp_" + camp + "_" + id}, ${camp}, 'sch_b', ${id}, ${parent}, ${consent},
                    '[]'::jsonb, 'UNKNOWN', ${status})`;
}

async function state(sql: Sql, camp: string, kid: string) {
  const r = await sql`
    SELECT consent_status, consent_photos, consent_source, consent_recorded_by
    FROM vita_hero.camp_participants WHERE camp_id = ${camp} AND kid_id = ${kid}`;
  return r[0];
}

async function logs(sql: Sql, camp: string) {
  return await sql`SELECT kid_id, action, source, actor_id FROM vita_hero.consent_log
                   WHERE camp_id = ${camp} ORDER BY kid_id`;
}

suite("bulk paper consent", () => {
  beforeAll(async () => {
    if (!URL) return;
    const admin = new pg.Client({ connectionString: URL });
    await admin.connect();
    await admin.query("DROP DATABASE IF EXISTS vh_consent_bulk");
    await admin.query("CREATE DATABASE vh_consent_bulk");
    await admin.end();
    sqlA = neonShim(await connect("vh_consent_bulk"));
    sqlB = neonShim(await connect("vh_consent_bulk"));
    const sql = sqlA;
    await migrate(sql, SCHEMA_STEPS, []);
    for (const s of [sqlA, sqlB]) {
      for (const t of ["school_camps", "camp_participants", "consent_log", "camp_staff"]) {
        await s.query(`SELECT 1 FROM vita_hero.${t} LIMIT 1`, []);
      }
    }

    await sql`INSERT INTO vita_hero.schools (id, name, city, partner_code)
              VALUES ('sch_b', 'Banyan', 'Hyderabad', 'BN-B'), ('sch_x', 'Elsewhere', 'Pune', 'EL-X')`;
    for (const [id, photos] of [[CAMP, false], [PHOTO_CAMP, true], [RACE_CAMP, false]] as const) {
      await sql`INSERT INTO vita_hero.school_camps (id, school_id, title, date, status, checks, photos_enabled)
                VALUES (${id}, 'sch_b', 'Annual camp', '2026-08-01', 'SCHEDULED',
                        ${JSON.stringify(["Vision"])}::jsonb, ${photos})`;
    }
    await sql`INSERT INTO vita_hero.camp_staff (id, camp_id, profile_id, staff_role, active)
              VALUES ('cst_nurse', ${CAMP}, ${NURSE.profileId}, 'SCREENER', true)`;

    await child(sql, CAMP, "k5a1", "5", "A");
    await child(sql, CAMP, "k5a2", "5", "A");
    await child(sql, CAMP, "k5b1", "5", "B");
    await child(sql, CAMP, "k5a_app_yes", "5", "A", "GRANTED");
    await child(sql, CAMP, "k5a_app_no", "5", "A", "DECLINED");
    await child(sql, CAMP, "k5a_screened", "5", "A", "PENDING", "SCREENED");
    await child(sql, CAMP, "k6a1", "6", "A");
    await child(sql, PHOTO_CAMP, "kp1", "5", "A");
    await child(sql, PHOTO_CAMP, "kp2", "5", "A");
    for (let i = 0; i < 12; i++) await child(sql, RACE_CAMP, "kr" + i, "7", "A");
  });
  afterAll(async () => { for (const c of clients) await c.end(); });

  test("changes only the pending children and says why the rest were left", async () => {
    const r = await recordConsentBulk(sqlA, HEAD, CAMP, {
      decision: "PAPER",
      kidIds: ["k5a1", "k5a2", "k5a_app_yes", "k5a_app_no", "k5a_screened", "nobody", "k5a1"],
    });
    expect(r.updated).toBe(2);
    expect(r.kidIds.sort()).toEqual(["k5a1", "k5a2"]);
    expect(r.skipped).toEqual({ alreadyAnswered: 2, alreadyScreened: 1, notOnCamp: 1 });

    const a = await state(sqlA, CAMP, "k5a1");
    expect(a.consent_status).toBe("PAPER");
    expect(a.consent_source).toBe("PAPER");
    expect(a.consent_recorded_by).toBe(HEAD.profileId);
    // A guardian's own answer stands — above all their "no".
    expect((await state(sqlA, CAMP, "k5a_app_no")).consent_status).toBe("DECLINED");
    expect((await state(sqlA, CAMP, "k5a_app_yes")).consent_status).toBe("GRANTED");
    expect((await state(sqlA, CAMP, "k5a_screened")).consent_status).toBe("PENDING");
    // Children not ticked are not touched.
    expect((await state(sqlA, CAMP, "k5b1")).consent_status).toBe("PENDING");
    expect((await state(sqlA, CAMP, "k6a1")).consent_status).toBe("PENDING");

    const l = await logs(sqlA, CAMP);
    expect(l.map((x) => x.kid_id)).toEqual(["k5a1", "k5a2"]);
    expect(l.every((x) => x.action === "PAPER" && x.source === "PAPER" && x.actor_id === HEAD.profileId)).toBe(true);
  });

  test("a second entry of the same slips changes nothing and logs nothing", async () => {
    const r = await recordConsentBulk(sqlA, HEAD, CAMP, { decision: "DECLINED", kidIds: ["k5a1", "k5a2"] });
    expect(r.updated).toBe(0);
    expect(r.skipped.alreadyAnswered).toBe(2);
    expect((await state(sqlA, CAMP, "k5a1")).consent_status).toBe("PAPER");
    expect((await logs(sqlA, CAMP)).length).toBe(2);
  });

  test("declined clears photographs, and photographs need the camp to ask", async () => {
    const d = await recordConsentBulk(sqlA, OPS, CAMP, { decision: "declined", kidIds: ["k5b1"], consentPhotos: true });
    expect(d.updated).toBe(1);
    expect(d.consentPhotos).toBe(false);
    expect((await state(sqlA, CAMP, "k5b1")).consent_status).toBe("DECLINED");

    // Photographs are off for this camp, so a stray tick cannot switch them on.
    const off = await recordConsentBulk(sqlA, HEAD, CAMP, { decision: "PAPER", kidIds: ["k6a1"], consentPhotos: true });
    expect(off.consentPhotos).toBe(false);
    expect((await state(sqlA, CAMP, "k6a1")).consent_photos).toBe(false);

    const on = await recordConsentBulk(sqlA, HEAD, PHOTO_CAMP, { decision: "PAPER", kidIds: ["kp1"], consentPhotos: true });
    expect(on.consentPhotos).toBe(true);
    expect((await state(sqlA, PHOTO_CAMP, "kp1")).consent_photos).toBe(true);
    const plain = await recordConsentBulk(sqlA, HEAD, PHOTO_CAMP, { decision: "PAPER", kidIds: ["kp2"] });
    expect(plain.consentPhotos).toBe(false);
  });

  test("only ops and that school's administrator may do it", async () => {
    await expect(recordConsentBulk(sqlA, OTHER_HEAD, CAMP, { decision: "PAPER", kidIds: ["k6a1"] }))
      .rejects.toMatchObject({ status: 403 });
    await expect(recordConsentBulk(sqlA, NURSE, CAMP, { decision: "PAPER", kidIds: ["k6a1"] }))
      .rejects.toMatchObject({ status: 403 });
  });

  test("refuses a bad decision, an empty list and an oversized one", async () => {
    await expect(recordConsentBulk(sqlA, HEAD, CAMP, { decision: "GRANTED", kidIds: ["k6a1"] }))
      .rejects.toMatchObject({ status: 400, code: "BAD_DECISION" });
    await expect(recordConsentBulk(sqlA, HEAD, CAMP, { decision: "PAPER", kidIds: [] }))
      .rejects.toMatchObject({ status: 400, code: "NO_CHILDREN" });
    const many = Array.from({ length: BULK_CONSENT_LIMIT + 1 }, (_, i) => "x" + i);
    await expect(recordConsentBulk(sqlA, HEAD, CAMP, { decision: "PAPER", kidIds: many }))
      .rejects.toMatchObject({ status: 400, code: "TOO_MANY" });
  });

  test("two people entering the same pile at once write and log each child once", async () => {
    const ids = Array.from({ length: 12 }, (_, i) => "kr" + i);
    const [a, b] = await Promise.all([
      recordConsentBulk(sqlA, HEAD, RACE_CAMP, { decision: "PAPER", kidIds: ids }),
      recordConsentBulk(sqlB, OPS, RACE_CAMP, { decision: "PAPER", kidIds: [...ids].reverse() }),
    ]);
    expect(a.updated + b.updated).toBe(12);
    const l = await logs(sqlA, RACE_CAMP);
    expect(l.length).toBe(12);
    expect(new Set(l.map((x) => x.kid_id)).size).toBe(12);
  });
});
