// What a camp's results do between the doctor's form and the parent's screen.
//
// Each of these was a way a result went wrong without anybody seeing it fail:
// a save lost because the history card was filled, a changed result reaching a
// parent unreviewed, the reviewing doctor's words hidden behind the rule's, a
// failed text counted as sent, and a child who was never seen shown as "a
// doctor is still checking this" for ever.

import { afterAll, beforeAll, expect, test, describe } from "bun:test";
import pg from "pg";
import type { Sql } from "./common";
import { serialQuery } from "./pgserial";
import type { Actor } from "./schools";
import { SCHEMA_STEPS } from "./index";
import { migrate } from "./migrate";
import {
  getCamp, guardianCampResult, releaseCamp, reviewParticipant, saveScreening, setAttendance,
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

const OPS: Actor = { profileId: "ph_ops", name: "Ops", role: "SUPERADMIN", schoolId: null };
const DOC: Actor = { profileId: "ph_9100000001", name: "Dr Rao", role: "PHYSICIAN", schoolId: "sch_r" };
const CAMP = "sc_res";
const SEEN = "k_seen";
const AWAY = "k_away";
const PARENT = "ph_par";

const vision = { checkType: "Vision", detail: { leftAcuity: "6/6", rightAcuity: "6/6" } };

suite("a camp's results, from the doctor's form to the parent", () => {
  beforeAll(async () => {
    if (!URL) return;
    const admin = new pg.Client({ connectionString: URL });
    await admin.connect();
    await admin.query("DROP DATABASE IF EXISTS vh_camp_results");
    await admin.query("CREATE DATABASE vh_camp_results");
    await admin.end();
    client = new pg.Client({ connectionString: URL2(URL, "vh_camp_results") });
    await client.connect();
    sql = neonShim(client);
    await migrate(sql, SCHEMA_STEPS, []);

    await sql`INSERT INTO vita_hero.schools (id, name, city, partner_code)
              VALUES ('sch_r', 'Rose Valley', 'Hyderabad', 'RV-R')`;
    await sql`INSERT INTO vita_hero.school_camps (id, school_id, title, date, status, checks)
              VALUES (${CAMP}, 'sch_r', 'Annual camp', '2026-08-01', 'SCHEDULED',
                      ${JSON.stringify(["Vision", "Dental"])}::jsonb)`;
    await sql`INSERT INTO vita_hero.profiles (id, phone, name, role, provisioned, school_id)
              VALUES (${PARENT}, '+919100000009', 'Parent', 'PARENT', true, 'sch_r'),
                     (${DOC.profileId}, '+919100000001', 'Dr Rao', 'PHYSICIAN', true, 'sch_r')`;
    for (const [id, name] of [[SEEN, "Asha"], [AWAY, "Ravi"]]) {
      await sql`INSERT INTO vita_hero.kids (id, profile_id, name, school_id, grade, age, gender)
                VALUES (${id}, ${PARENT}, ${name}, 'sch_r', '5', 10, 'F')`;
      await sql`INSERT INTO vita_hero.camp_participants
                  (id, camp_id, school_id, kid_id, profile_id, consent_status, consent_checks,
                   attendance, status)
                VALUES (${"cp_" + id}, ${CAMP}, 'sch_r', ${id}, ${PARENT}, 'GRANTED', '[]'::jsonb,
                        'UNKNOWN', 'NOT_SCREENED')`;
    }
    await sql`INSERT INTO vita_hero.camp_staff (id, camp_id, profile_id, staff_role, active)
              VALUES ('cst_doc', ${CAMP}, ${DOC.profileId}, 'PHYSICIAN', true)`;
  });
  afterAll(async () => { if (client) await client.end(); });

  test("the history and lab card goes with the examination instead of losing the save", async () => {
    const r = await saveScreening(sql, DOC, CAMP, SEEN, {
      findings: [
        vision,
        { checkType: "Systemic", detail: { drugAllergies: "Penicillin" } },
        { checkType: "Investigations", detail: { generalLabs: "CBP" } },
      ],
    });
    expect(r.saved.length).toBe(1);
    const rows = await sql`SELECT check_type, detail FROM vita_hero.camp_findings
                           WHERE camp_id = ${CAMP} AND kid_id = ${SEEN}`;
    expect(rows.map((x) => x.check_type)).toEqual(["Vision"]);
    expect((rows[0].detail as any).history).toEqual({ drugAllergies: "Penicillin" });
    expect((rows[0].detail as any).investigations).toEqual({ generalLabs: "CBP" });
  });

  test("history alone is refused with a reason the doctor can act on", async () => {
    await expect(saveScreening(sql, DOC, CAMP, SEEN, {
      findings: [{ checkType: "Systemic", detail: { drugAllergies: "Penicillin" } }],
    })).rejects.toThrow(/at least one examination/i);
  });

  test("a result changed after sign-off goes back to the doctor", async () => {
    await reviewParticipant(sql, DOC, CAMP, SEEN, {
      recommendation: "Recheck in a year",
      findings: [{ checkType: "Vision", flag: "WATCH", note: "Squints at the board; recheck" }],
    });
    let p = await sql`SELECT status FROM vita_hero.camp_participants
                      WHERE camp_id = ${CAMP} AND kid_id = ${SEEN}`;
    expect(p[0].status).toBe("APPROVED");

    await saveScreening(sql, DOC, CAMP, SEEN, { findings: [vision] });
    p = await sql`SELECT status FROM vita_hero.camp_participants
                  WHERE camp_id = ${CAMP} AND kid_id = ${SEEN}`;
    expect(p[0].status).toBe("SCREENED");

    await reviewParticipant(sql, DOC, CAMP, SEEN, {
      recommendation: "Recheck in a year",
      findings: [{ checkType: "Vision", flag: "WATCH", note: "Squints at the board; recheck" }],
    });
  });

  test("the console is shown the review stage", async () => {
    const c = await getCamp(sql, OPS, CAMP);
    expect(c.can.viewClinical).toBe(true);
  });

  test("a child who was away is told so, not kept waiting", async () => {
    await setAttendance(sql, DOC, CAMP, AWAY, "ABSENT");
    const r = await guardianCampResult(sql, PARENT, CAMP, AWAY);
    expect(r.status).toBe("NOT_SCREENED");
  });

  test("a failed text is not counted as sent", async () => {
    const r = await releaseCamp(sql, DOC, CAMP, async () => ({ ok: false, reason: "provider down" }));
    expect((r as any).notified).toBe(0);
  });

  test("the parent reads the reviewing doctor's words", async () => {
    const r = await guardianCampResult(sql, PARENT, CAMP, SEEN) as any;
    expect(r.status).toBe("RELEASED");
    expect(r.findings[0].note).toBe("Squints at the board; recheck");
  });
});
