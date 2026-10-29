// What a parent sees while their child's camp is still going on: each check
// as it is done, and nothing of what any check found until a doctor has
// signed it off. And a doctor can release one child without finishing the
// camp, which must not tell everyone else their child was missed.

import { afterAll, beforeAll, expect, test, describe } from "bun:test";
import pg from "pg";
import type { Sql } from "./common";
import { serialQuery } from "./pgserial";
import type { Actor } from "./schools";
import { SCHEMA_STEPS } from "./index";
import { migrate } from "./migrate";
import {
  guardianCampResult, releaseCamp, reviewParticipant, saveScreening,
} from "./camps";

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

const DOC: Actor = { profileId: "ph_9200000001", name: "Dr Rao", role: "PHYSICIAN", schoolId: "sch_p" };
// The eye doctor records Vision and nothing else, so a child's checks land
// one specialist at a time, which is what the parent watches.
const EYE: Actor = { profileId: "ph_9200000002", name: "Dr Iyer", role: "PHYSICIAN", schoolId: "sch_p" };
const CAMP = "sc_prog";
const ONE = "k_one";   // consented to Vision only
const TWO = "k_two";   // consented to everything
const PARENT = "ph_par_p";

const vision = { checkType: "Vision", detail: { leftAcuity: "6/6", rightAcuity: "6/6" } };
const states = (r: any) => Object.fromEntries(r.progress.checks.map((c: any) => [c.checkType, c.state]));

suite("a parent follows the camp live, and reads results only after sign-off", () => {
  beforeAll(async () => {
    if (!URL) return;
    const admin = new pg.Client({ connectionString: URL });
    await admin.connect();
    await admin.query("DROP DATABASE IF EXISTS vh_camp_progress");
    await admin.query("CREATE DATABASE vh_camp_progress");
    await admin.end();
    client = new pg.Client({ connectionString: URL2(URL, "vh_camp_progress") });
    await client.connect();
    sql = neonShim(client);
    await migrate(sql, SCHEMA_STEPS, []);

    await sql`INSERT INTO vita_hero.schools (id, name, city, partner_code)
              VALUES ('sch_p', 'Palm Grove', 'Hyderabad', 'PG-P')`;
    await sql`INSERT INTO vita_hero.school_camps (id, school_id, title, date, status, checks)
              VALUES (${CAMP}, 'sch_p', 'Annual camp', '2026-08-01', 'IN_PROGRESS',
                      ${JSON.stringify(["Vision", "Dental"])}::jsonb)`;
    await sql`INSERT INTO vita_hero.profiles (id, phone, name, role, provisioned, school_id)
              VALUES (${PARENT}, '+919200000009', 'Parent', 'PARENT', true, 'sch_p'),
                     (${DOC.profileId}, '+919200000001', 'Dr Rao', 'PHYSICIAN', true, 'sch_p'),
                     (${EYE.profileId}, '+919200000002', 'Dr Iyer', 'PHYSICIAN', true, 'sch_p')`;
    await sql`INSERT INTO vita_hero.doctors (id, name, specialty) VALUES ('doc_eye', 'Dr Iyer', 'Ophthalmology')`;
    for (const [id, name, checks] of [[ONE, "Asha", ["Vision"]], [TWO, "Ravi", []]] as const) {
      await sql`INSERT INTO vita_hero.kids (id, profile_id, name, school_id, grade, age, gender)
                VALUES (${id}, ${PARENT}, ${name}, 'sch_p', '5', 10, 'F')`;
      await sql`INSERT INTO vita_hero.camp_participants
                  (id, camp_id, school_id, kid_id, profile_id, consent_status, consent_checks,
                   attendance, status)
                VALUES (${"cp_" + id}, ${CAMP}, 'sch_p', ${id}, ${PARENT}, 'GRANTED',
                        ${JSON.stringify(checks)}::jsonb, 'UNKNOWN', 'NOT_SCREENED')`;
    }
    await sql`INSERT INTO vita_hero.camp_staff (id, camp_id, profile_id, staff_role, active)
              VALUES ('cst_doc_p', ${CAMP}, ${DOC.profileId}, 'PHYSICIAN', true)`;
    await sql`INSERT INTO vita_hero.camp_staff (id, camp_id, profile_id, staff_role, active, doctor_id)
              VALUES ('cst_eye_p', ${CAMP}, ${EYE.profileId}, 'PHYSICIAN', true, 'doc_eye')`;
  });
  afterAll(async () => { if (client) await client.end(); });

  test("before anything is done every agreed check is still to come", async () => {
    const r = await guardianCampResult(sql, PARENT, CAMP, ONE) as any;
    expect(r.status).toBe("PENDING");
    expect(r.progress.stage).toBe("WAITING");
    expect(states(r)).toEqual({ Vision: "PENDING", Dental: "NOT_CONSENTED" });
    expect(r.progress.total).toBe(1);
  });

  test("a check shows as done the moment it is saved, without what it found", async () => {
    await saveScreening(sql, EYE, CAMP, TWO, { findings: [vision] });
    const r = await guardianCampResult(sql, PARENT, CAMP, TWO) as any;
    expect(r.status).toBe("PENDING");
    expect(r.progress.stage).toBe("SCREENING");
    expect(states(r)).toEqual({ Vision: "DONE", Dental: "PENDING" });
    expect(r.progress.done).toBe(1);
    expect(r.findings).toBeUndefined();
    expect(JSON.stringify(r)).not.toContain("6/6");
  });

  test("with every agreed check done the parent is told a doctor has it", async () => {
    await saveScreening(sql, DOC, CAMP, ONE, { findings: [vision] });
    const r = await guardianCampResult(sql, PARENT, CAMP, ONE) as any;
    expect(r.progress.stage).toBe("WITH_DOCTOR");
    expect(r.findings).toBeUndefined();
  });

  test("one child can be released without closing the camp", async () => {
    await reviewParticipant(sql, DOC, CAMP, ONE, {
      recommendation: "All well",
      findings: [{ checkType: "Vision", flag: "GOOD", note: "Sees well" }],
    });
    const texted: string[] = [];
    await releaseCamp(sql, DOC, CAMP, async (to) => { texted.push(to); return { ok: true }; }, { kidIds: [ONE] });

    const one = await guardianCampResult(sql, PARENT, CAMP, ONE) as any;
    expect(one.status).toBe("RELEASED");
    expect(one.progress.stage).toBe("RELEASED");
    expect(one.findings.length).toBe(1);
    expect(texted.length).toBe(1);

    const camp = await sql`SELECT status FROM vita_hero.school_camps WHERE id = ${CAMP}`;
    expect(camp[0].status).toBe("IN_PROGRESS");
    // The other child is still being screened, not "was not checked".
    const two = await guardianCampResult(sql, PARENT, CAMP, TWO) as any;
    expect(two.status).toBe("PENDING");
    expect(two.progress.stage).toBe("SCREENING");
  });
});
