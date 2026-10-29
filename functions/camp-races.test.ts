// Two clinicians doing the same thing at the same moment. Each of these was
// found by a load test against a copy of the database, not by reading the
// code: every request answered, and the camp was still wrong afterwards.
//
// Each side runs on its own connection, so the statements really do
// interleave; on one connection the shim would serialise them and the race
// could never happen. Every race runs on several children at once, because a
// single pair can win by luck.

import { afterAll, beforeAll, expect, test, describe } from "bun:test";
import pg from "pg";
import type { Sql } from "./common";
import { serialQuery } from "./pgserial";
import type { Actor } from "./schools";
import { SCHEMA_STEPS } from "./index";
import { migrate } from "./migrate";
import { releaseCamp, requestConsent, reviewParticipant, saveScreening } from "./camps";
import { nudgeReferrals } from "./referrals";

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

// Two general physicians: each covers every check, so each can approve alone.
const RAO: Actor = { profileId: "ph_9300000001", name: "Dr Rao", role: "PHYSICIAN", schoolId: "sch_r" };
const IYER: Actor = { profileId: "ph_9300000002", name: "Dr Iyer", role: "PHYSICIAN", schoolId: "sch_r" };
const HEAD: Actor = { profileId: "ph_race_head", name: "Head", role: "SCHOOL_ADMIN", schoolId: "sch_r" };
const CAMP = "sc_race";
const N = 8;
const kid = (i: number) => `k_race_${i}`;
const parent = (i: number) => `ph_race_p${i}`;
const vision = (acuity: string) => ({ checkType: "Vision", detail: { leftAcuity: acuity, rightAcuity: acuity } });

suite("two clinicians at once", () => {
  beforeAll(async () => {
    if (!URL) return;
    const admin = new pg.Client({ connectionString: URL });
    await admin.connect();
    await admin.query("DROP DATABASE IF EXISTS vh_camp_races");
    await admin.query("CREATE DATABASE vh_camp_races");
    await admin.end();
    sqlA = neonShim(await connect("vh_camp_races"));
    sqlB = neonShim(await connect("vh_camp_races"));
    const sql = sqlA;
    await migrate(sql, SCHEMA_STEPS, []);
    // Both sides touch every table once, so neither starts a race cold.
    for (const s of [sqlA, sqlB]) {
      for (const t of ["schools", "school_camps", "camp_staff", "profiles", "kids", "camp_participants",
                       "camp_findings", "camp_signoffs", "consent_log", "referrals"]) {
        await s.query(`SELECT 1 FROM vita_hero.${t} LIMIT 1`, []);
      }
    }

    await sql`INSERT INTO vita_hero.schools (id, name, city, partner_code)
              VALUES ('sch_r', 'River Side', 'Hyderabad', 'RS-R')`;
    await sql`INSERT INTO vita_hero.school_camps (id, school_id, title, date, status, checks)
              VALUES (${CAMP}, 'sch_r', 'Annual camp', '2026-08-01', 'IN_PROGRESS',
                      ${JSON.stringify(["Vision"])}::jsonb)`;
    await sql`INSERT INTO vita_hero.profiles (id, phone, name, role, provisioned, school_id)
              VALUES (${RAO.profileId}, '+919300000001', 'Dr Rao', 'PHYSICIAN', true, 'sch_r'),
                     (${IYER.profileId}, '+919300000002', 'Dr Iyer', 'PHYSICIAN', true, 'sch_r')`;
    for (const a of [RAO, IYER]) {
      await sql`INSERT INTO vita_hero.camp_staff (id, camp_id, profile_id, staff_role, active)
                VALUES (${"cst_" + a.profileId}, ${CAMP}, ${a.profileId}, 'PHYSICIAN', true)`;
    }
    for (let i = 0; i < N; i++) {
      await sql`INSERT INTO vita_hero.profiles (id, phone, name, role, provisioned, school_id)
                VALUES (${parent(i)}, ${"+91931000000" + i}, 'Parent', 'PARENT', true, 'sch_r')`;
      await sql`INSERT INTO vita_hero.kids (id, profile_id, name, school_id, grade, age, gender)
                VALUES (${kid(i)}, ${parent(i)}, ${"Child " + i}, 'sch_r', '5', 10, 'F')`;
      await sql`INSERT INTO vita_hero.camp_participants
                  (id, camp_id, school_id, kid_id, profile_id, consent_status, consent_checks,
                   attendance, status)
                VALUES (${"cp_" + kid(i)}, ${CAMP}, 'sch_r', ${kid(i)}, ${parent(i)}, 'GRANTED',
                        '["Vision"]'::jsonb, 'UNKNOWN', 'NOT_SCREENED')`;
    }
  });
  afterAll(async () => { for (const c of clients) await c.end(); });

  test("saving the same check at once updates it instead of failing", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: N }, (_, i) => [
        saveScreening(sqlA, RAO, CAMP, kid(i), { findings: [vision("6/6")] }),
        saveScreening(sqlB, IYER, CAMP, kid(i), { findings: [vision("6/9")] }),
      ]).flat()
    );
    expect(results.filter((r) => r.status === "rejected").map((r: any) => String(r.reason))).toEqual([]);

    const rows = await sqlA`
      SELECT kid_id, COUNT(*)::int AS n FROM vita_hero.camp_findings
      WHERE camp_id = ${CAMP} AND check_type = 'Vision' GROUP BY kid_id`;
    expect(rows.length).toBe(N);
    expect(rows.every((r) => r.n === 1)).toBe(true);
  });

  test("approving the same child at once leaves the child approved", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: N }, (_, i) => [
        reviewParticipant(sqlA, RAO, CAMP, kid(i), { recommendation: "All well" }),
        reviewParticipant(sqlB, IYER, CAMP, kid(i), { recommendation: "All well" }),
      ]).flat()
    );
    expect(results.filter((r) => r.status === "rejected").map((r: any) => String(r.reason))).toEqual([]);

    const rows = await sqlA`
      SELECT kid_id, status FROM vita_hero.camp_participants WHERE camp_id = ${CAMP} ORDER BY kid_id`;
    expect(rows.map((r) => r.status)).toEqual(Array(N).fill("APPROVED"));
    // And somebody answers for the check: it is not left signed by nobody.
    const held = await sqlA`
      SELECT kid_id FROM vita_hero.camp_signoffs
      WHERE camp_id = ${CAMP} AND checks ? 'Vision' GROUP BY kid_id`;
    expect(held.length).toBe(N);
  });

  test("releasing the camp twice at once texts each family once", async () => {
    const texted: string[] = [];
    // Slow enough that both releases are sending at the same time.
    const send = async (to: string) => {
      texted.push(to);
      await new Promise((r) => setTimeout(r, 20));
      return { ok: true };
    };
    const results = await Promise.allSettled([
      releaseCamp(sqlA, RAO, CAMP, send),
      releaseCamp(sqlB, IYER, CAMP, send),
    ]);
    expect(results.filter((r) => r.status === "rejected").map((r: any) => String(r.reason))).toEqual([]);

    expect(texted.length).toBe(N);
    expect(new Set(texted).size).toBe(N);
    const logged = await sqlA`
      SELECT COUNT(*)::int AS n FROM vita_hero.consent_log
      WHERE camp_id = ${CAMP} AND action = 'RESULT_NOTIFIED'`;
    expect(logged[0].n).toBe(N);
  });

  test("a text that did not go is tried again by the next release", async () => {
    await sqlA`UPDATE vita_hero.camp_participants SET status = 'APPROVED' WHERE kid_id = ${kid(0)}`;
    await sqlA`DELETE FROM vita_hero.consent_log WHERE kid_id = ${kid(0)}`;
    await sqlA`UPDATE vita_hero.camp_participants SET result_notified_at = NULL WHERE kid_id = ${kid(0)}`;

    const failed: string[] = [];
    await releaseCamp(sqlA, RAO, CAMP, async (to) => { failed.push(to); return { ok: false }; }, { kidIds: [kid(0)] });
    expect(failed.length).toBe(1);
    const claim = await sqlA`
      SELECT result_notified_at FROM vita_hero.camp_participants WHERE kid_id = ${kid(0)}`;
    expect(claim[0].result_notified_at).toBeNull();

    await sqlA`UPDATE vita_hero.camp_participants SET status = 'APPROVED' WHERE kid_id = ${kid(0)}`;
    const sent: string[] = [];
    await releaseCamp(sqlA, RAO, CAMP, async (to) => { sent.push(to); return { ok: true }; }, { kidIds: [kid(0)] });
    expect(sent.length).toBe(1);
  });

  // The same shape as the release: who to text was read, the texts went, and
  // only then was it written down. Two clicks a moment apart texted twice.
  // Slow enough to cover the first query a connection makes on a table,
  // which loads its catalog and once let one side finish before the other
  // had read anything.
  const slowSender = (texted: string[]) => async (to: string) => {
    texted.push(to);
    await new Promise((r) => setTimeout(r, 150));
    return { ok: true };
  };

  test("two clinicians flagging the same child urgent text the family once", async () => {
    const camp = "sc_race_urgent";
    await sqlA`INSERT INTO vita_hero.school_camps (id, school_id, title, date, status, checks)
               VALUES (${camp}, 'sch_r', 'Second camp', '2026-08-02', 'IN_PROGRESS',
                       ${JSON.stringify(["Vision"])}::jsonb)`;
    for (const a of [RAO, IYER]) {
      await sqlA`INSERT INTO vita_hero.camp_staff (id, camp_id, profile_id, staff_role, active)
                 VALUES (${"cst_u_" + a.profileId}, ${camp}, ${a.profileId}, 'PHYSICIAN', true)`;
    }
    for (let i = 0; i < N; i++) {
      await sqlA`INSERT INTO vita_hero.camp_participants
                   (id, camp_id, school_id, kid_id, profile_id, consent_status, consent_checks,
                    attendance, status)
                 VALUES (${"cpu_" + kid(i)}, ${camp}, 'sch_r', ${kid(i)}, ${parent(i)}, 'GRANTED',
                         '["Vision"]'::jsonb, 'UNKNOWN', 'NOT_SCREENED')`;
      await saveScreening(sqlA, RAO, camp, kid(i), { findings: [vision("6/60")] });
    }

    const texted: string[] = [];
    const results = await Promise.allSettled(
      Array.from({ length: N }, (_, i) => [
        reviewParticipant(sqlA, RAO, camp, kid(i), { urgency: "URGENT", recommendation: "See an eye doctor" }, slowSender(texted)),
        reviewParticipant(sqlB, IYER, camp, kid(i), { urgency: "URGENT", recommendation: "See an eye doctor" }, slowSender(texted)),
      ]).flat()
    );
    expect(results.filter((r) => r.status === "rejected").map((r: any) => String(r.reason))).toEqual([]);
    expect(texted.length).toBe(N);
    const logged = await sqlA`
      SELECT COUNT(*)::int AS n FROM vita_hero.consent_log
      WHERE camp_id = ${camp} AND action = 'URGENT_ESCALATED'`;
    expect(logged[0].n).toBe(N);
  });

  test("two consent reminders at once text each guardian once", async () => {
    const camp = "sc_race_consent";
    await sqlA`INSERT INTO vita_hero.school_camps (id, school_id, title, date, status, checks)
               VALUES (${camp}, 'sch_r', 'Third camp', '2026-08-03', 'SCHEDULED',
                       ${JSON.stringify(["Vision"])}::jsonb)`;
    for (let i = 0; i < N; i++) {
      await sqlA`INSERT INTO vita_hero.camp_participants
                   (id, camp_id, school_id, kid_id, profile_id, consent_status, attendance, status)
                 VALUES (${"cpc_" + kid(i)}, ${camp}, 'sch_r', ${kid(i)}, ${parent(i)}, 'PENDING',
                         'UNKNOWN', 'NOT_SCREENED')`;
    }

    const texted: string[] = [];
    const results = await Promise.allSettled([
      requestConsent(sqlA, HEAD, camp, slowSender(texted), "https://app.test"),
      requestConsent(sqlB, HEAD, camp, slowSender(texted), "https://app.test"),
    ]);
    expect(results.filter((r) => r.status === "rejected").map((r: any) => String(r.reason))).toEqual([]);
    expect(texted.length).toBe(N);
    expect(new Set(texted).size).toBe(N);

    // A reminder that failed is not counted, and the guardian is due again.
    await sqlA`UPDATE vita_hero.camp_participants SET consent_reminded_at = NULL, consent_reminder_count = 0
               WHERE camp_id = ${camp}`;
    await requestConsent(sqlA, HEAD, camp, async () => ({ ok: false }), "https://app.test");
    const after = await sqlA`
      SELECT COUNT(*)::int AS n FROM vita_hero.camp_participants
      WHERE camp_id = ${camp} AND consent_reminded_at IS NULL AND consent_reminder_count = 0`;
    expect(after[0].n).toBe(N);
  });

  test("two referral nudges at once text each family once", async () => {
    for (let i = 0; i < N; i++) {
      await sqlA`INSERT INTO vita_hero.referrals
                   (id, camp_id, kid_id, profile_id, school_id, check_type, specialty, status, due_by)
                 VALUES (${"ref_race_" + i}, ${CAMP}, ${kid(i)}, ${parent(i)}, 'sch_r', 'Vision',
                         'Ophthalmology', 'OPEN', '2099-01-01')`;
    }

    const texted: string[] = [];
    const results = await Promise.allSettled([
      nudgeReferrals(sqlA, HEAD, "sch_r", slowSender(texted)),
      nudgeReferrals(sqlB, HEAD, "sch_r", slowSender(texted)),
    ]);
    expect(results.filter((r) => r.status === "rejected").map((r: any) => String(r.reason))).toEqual([]);
    expect(texted.length).toBe(N);
    const counts = await sqlA`
      SELECT nudge_count FROM vita_hero.referrals WHERE id LIKE 'ref_race_%'`;
    expect(counts.every((r) => r.nudge_count === 1)).toBe(true);
  });
});
