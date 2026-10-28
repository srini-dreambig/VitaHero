// A check is recorded in full, or declared not done with a reason.
//
// A camp's heights went missing without anybody noticing: the forms drop a
// check nobody touched, and the server took whatever arrived. These pin the
// three places that now refuse a gap — a half-filled check, a check left out
// of the save, and a signature over a child with a check still outstanding.

import { afterAll, beforeAll, expect, test, describe } from "bun:test";
import pg from "pg";
import type { Sql } from "./common";
import { serialQuery } from "./pgserial";
import type { Actor } from "./schools";
import { SCHEMA_STEPS } from "./index";
import { migrate } from "./migrate";
import { missingRequired } from "./clinical";
import { listParticipants, releaseCamp, reviewParticipant, reviewQueue, saveScreening, setAttendance } from "./camps";

describe("the fields each check needs", () => {
  test("height without weight is not a height and weight check", () => {
    expect(missingRequired("Height & weight", { heightCm: 120 }))
      .toBe("Height & weight: Weight (kg) is required");
  });
  test("a number outside what a child can measure is refused", () => {
    expect(missingRequired("Height & weight", { heightCm: 1200, weightKg: 20 }))
      .toMatch(/Height \(cm\) must be a number from 40 to 200/);
  });
  test("one eye is not a vision check", () => {
    expect(missingRequired("Vision", { rightAcuity: "6/6" })).toMatch(/Left eye acuity is required/);
  });
  test("a complete check passes", () => {
    expect(missingRequired("Dental", { cariesCount: 0, gums: "Healthy", hygiene: "Good" })).toBe("");
  });
});

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

const DOC: Actor = { profileId: "ph_9100000001", name: "Dr Rao", role: "PHYSICIAN", schoolId: "sch_q" };
const CAMP = "sc_req";
const ASHA = "k_asha";
const RAVI = "k_ravi";
const PARENT = "ph_par";

const hw = { checkType: "Height & weight", detail: { heightCm: 132, weightKg: 28 } };
const vision = { checkType: "Vision", detail: { leftAcuity: "6/6", rightAcuity: "6/6" } };
const dental = { checkType: "Dental", detail: { cariesCount: 0, gums: "Healthy", hygiene: "Good" } };

suite("a camp's checks are recorded in full", () => {
  beforeAll(async () => {
    if (!URL) return;
    const admin = new pg.Client({ connectionString: URL });
    await admin.connect();
    await admin.query("DROP DATABASE IF EXISTS vh_required");
    await admin.query("CREATE DATABASE vh_required");
    await admin.end();
    client = new pg.Client({ connectionString: URL2(URL, "vh_required") });
    await client.connect();
    sql = neonShim(client);
    await migrate(sql, SCHEMA_STEPS, []);

    await sql`INSERT INTO vita_hero.schools (id, name, city, partner_code)
              VALUES ('sch_q', 'Lotus School', 'Hyderabad', 'LS-Q')`;
    await sql`INSERT INTO vita_hero.school_camps (id, school_id, title, date, status, checks)
              VALUES (${CAMP}, 'sch_q', 'Annual camp', '2026-08-01', 'SCHEDULED',
                      ${JSON.stringify(["Height & weight", "Vision", "Dental"])}::jsonb)`;
    await sql`INSERT INTO vita_hero.profiles (id, phone, name, role, provisioned, school_id)
              VALUES (${PARENT}, '+919100000009', 'Parent', 'PARENT', true, 'sch_q'),
                     (${DOC.profileId}, '+919100000001', 'Dr Rao', 'PHYSICIAN', true, 'sch_q')`;
    for (const [id, name] of [[ASHA, "Asha"], [RAVI, "Ravi"]]) {
      await sql`INSERT INTO vita_hero.kids (id, profile_id, name, school_id, grade, age, gender)
                VALUES (${id}, ${PARENT}, ${name}, 'sch_q', '5', 10, 'F')`;
      await sql`INSERT INTO vita_hero.camp_participants
                  (id, camp_id, school_id, kid_id, profile_id, consent_status, consent_checks,
                   attendance, status)
                VALUES (${"cp_" + id}, ${CAMP}, 'sch_q', ${id}, ${PARENT}, 'GRANTED', '[]'::jsonb,
                        'UNKNOWN', 'NOT_SCREENED')`;
      await setAttendance(sql, DOC, CAMP, id, "PRESENT").catch(() => {});
    }
    await sql`INSERT INTO vita_hero.camp_staff (id, camp_id, profile_id, staff_role, active)
              VALUES ('cst_doc', ${CAMP}, ${DOC.profileId}, 'PHYSICIAN', true)`;
  });
  afterAll(async () => { if (client) await client.end(); });

  test("a height without a weight is refused", async () => {
    await expect(saveScreening(sql, DOC, CAMP, ASHA, {
      findings: [{ checkType: "Height & weight", detail: { heightCm: 132 } }, vision, dental],
    })).rejects.toThrow(/Weight \(kg\) is required/);
  });

  test("leaving a consented check out of the save is refused, by name", async () => {
    await expect(saveScreening(sql, DOC, CAMP, ASHA, { findings: [vision, dental] }))
      .rejects.toThrow(/Still to record: Height & weight/);
  });

  test("a check marked not done needs the reason", async () => {
    await expect(saveScreening(sql, DOC, CAMP, ASHA, {
      findings: [{ checkType: "Height & weight", flag: "NOT_MEASURED" }, vision, dental],
    })).rejects.toThrow(/Say why "Height & weight" could not be done/);
  });

  test("with the reason, a check not done is a complete record", async () => {
    const r = await saveScreening(sql, DOC, CAMP, ASHA, {
      findings: [
        { checkType: "Height & weight", flag: "NOT_MEASURED", note: "Child in a leg cast" },
        vision, dental,
      ],
    });
    expect(r.saved.length).toBe(3);
  });

  test("correcting one check later does not mean typing the others again", async () => {
    const r = await saveScreening(sql, DOC, CAMP, ASHA, { findings: [hw] });
    expect(r.saved.map((s: { checkType: string }) => s.checkType)).toEqual(["Height & weight"]);
  });

  test("a check not done keeps what was seen: decay found is still an ALERT", async () => {
    // The child would not sit for gums and hygiene, but four decayed teeth
    // were counted. "Not measured" would release that as nothing flagged.
    const r = await saveScreening(sql, DOC, CAMP, ASHA, {
      findings: [{ checkType: "Dental", detail: { cariesCount: 4 }, flag: "NOT_MEASURED", note: "Child refused the rest" }],
    });
    expect(r.saved[0].flag).toBe("ALERT");
    const [row] = await sql`SELECT flag, detail, screener_note FROM vita_hero.camp_findings
                            WHERE camp_id = ${CAMP} AND kid_id = ${ASHA} AND check_type = 'Dental'`;
    expect(row.flag).toBe("ALERT");
    expect(row.detail.notDone).toBe(true);
    expect(row.screener_note).toBe("Child refused the rest");
    await saveScreening(sql, DOC, CAMP, ASHA, { findings: [dental] });
  });

  test("a physician cannot sign off a child with a check never recorded", async () => {
    // How the old data looks: consent covered one check when the save went in,
    // or a client of the time dropped the rest. Either way a gap reaches review.
    await sql`UPDATE vita_hero.camp_participants SET consent_checks = '["Vision"]'::jsonb
              WHERE camp_id = ${CAMP} AND kid_id = ${RAVI}`;
    await saveScreening(sql, DOC, CAMP, RAVI, { findings: [vision] });
    await sql`UPDATE vita_hero.camp_participants SET consent_checks = '[]'::jsonb
              WHERE camp_id = ${CAMP} AND kid_id = ${RAVI}`;

    await expect(reviewParticipant(sql, DOC, CAMP, RAVI, {
      approve: true, recommendation: "All well.",
    })).rejects.toThrow(/Not yet recorded for this child: Height & weight, Dental/);
  });

  test("two children whose ids start alike are both saved", async () => {
    // Roster ids are built from admission numbers, so a class reads
    // k_sid-gv-2026-0401_…, k_sid-gv-2026-0403_…; the second save used to collide.
    for (const id of ["k_sid-gv-2026-0401_aaaa", "k_sid-gv-2026-0403_bbbb"]) {
      await sql`INSERT INTO vita_hero.kids (id, profile_id, name, school_id, grade, age, gender)
                VALUES (${id}, ${PARENT}, 'Twin', 'sch_q', '4', 9, 'M')`;
      await sql`INSERT INTO vita_hero.camp_participants
                  (id, camp_id, school_id, kid_id, profile_id, consent_status, consent_checks,
                   attendance, status)
                VALUES (${"cp_" + id}, ${CAMP}, 'sch_q', ${id}, ${PARENT}, 'GRANTED', '[]'::jsonb,
                        'UNKNOWN', 'NOT_SCREENED')`;
      const r = await saveScreening(sql, DOC, CAMP, id, { findings: [hw, vision, dental] });
      expect(r.saved.length).toBe(3);
    }
  });

  test("once everything is recorded, the signature goes through", async () => {
    await saveScreening(sql, DOC, CAMP, RAVI, { findings: [hw, dental] });
    await reviewParticipant(sql, DOC, CAMP, RAVI, { approve: true, recommendation: "All well." });
    const p = await sql`SELECT status FROM vita_hero.camp_participants
                        WHERE camp_id = ${CAMP} AND kid_id = ${RAVI}`;
    expect(p[0].status).toBe("APPROVED");
  });

  test("releasing two children whose ids start alike follows up both", async () => {
    // The release opened a referral and a growth point per child under a cut
    // id, so the second child collided and the whole release failed.
    const twins = ["k_sid-gv-2026-0401_aaaa", "k_sid-gv-2026-0403_bbbb"];
    for (const id of twins) {
      await reviewParticipant(sql, DOC, CAMP, id, {
        approve: true, urgency: "ROUTINE", recommendation: "See an eye doctor.",
        findings: [{ checkType: "Vision", flag: "WATCH" }],
      });
    }
    await sql`DELETE FROM vita_hero.camp_participants
              WHERE camp_id = ${CAMP} AND status <> 'APPROVED'`;
    await releaseCamp(sql, DOC, CAMP, async () => ({ ok: true, reason: "" }));
    const refs = await sql`SELECT kid_id FROM vita_hero.referrals
                           WHERE camp_id = ${CAMP} AND kid_id LIKE 'k_sid-gv-%' ORDER BY kid_id`;
    expect(refs.map((r) => r.kid_id)).toEqual(twins);
    const growth = await sql`SELECT kid_id, height FROM vita_hero.growth_points
                             WHERE kid_id LIKE 'k_sid-gv-%' ORDER BY kid_id`;
    expect(growth.map((g) => g.kid_id)).toEqual(twins);
  });

  test("the dentist saving does not mark the child done for the eye doctor", async () => {
    // Each specialist screens the same child for their own check. The child's
    // status flips to SCREENED on the first save; the second doctor's list
    // used to read that and show Done before they had seen the child.
    const camp = "sc_spec";
    const kid = "k_meera";
    const DENT: Actor = { profileId: "ph_dent", name: "Dr Dent", role: "PHYSICIAN", schoolId: "sch_q" };
    const EYE: Actor = { profileId: "ph_eye", name: "Dr Eye", role: "PHYSICIAN", schoolId: "sch_q" };
    await sql`INSERT INTO vita_hero.school_camps (id, school_id, title, date, status, checks)
              VALUES (${camp}, 'sch_q', 'Specialist camp', '2026-08-02', 'SCHEDULED',
                      ${JSON.stringify(["Vision", "Dental"])}::jsonb)`;
    await sql`INSERT INTO vita_hero.profiles (id, phone, name, role, provisioned, school_id)
              VALUES ('ph_dent', '+919100000021', 'Dr Dent', 'PHYSICIAN', true, 'sch_q'),
                     ('ph_eye', '+919100000022', 'Dr Eye', 'PHYSICIAN', true, 'sch_q')`;
    await sql`INSERT INTO vita_hero.doctors (id, name, specialty)
              VALUES ('doc_dent', 'Dr Dent', 'Dentistry'), ('doc_eye', 'Dr Eye', 'Ophthalmology')`;
    await sql`INSERT INTO vita_hero.camp_staff (id, camp_id, profile_id, staff_role, active, doctor_id)
              VALUES ('cst_dent', ${camp}, 'ph_dent', 'PHYSICIAN', true, 'doc_dent'),
                     ('cst_eye', ${camp}, 'ph_eye', 'PHYSICIAN', true, 'doc_eye')`;
    await sql`INSERT INTO vita_hero.kids (id, profile_id, name, school_id, grade, section, age, gender)
              VALUES (${kid}, ${PARENT}, 'Meera', 'sch_q', '3', 'B', 8, 'F')`;
    await sql`INSERT INTO vita_hero.camp_participants
                (id, camp_id, school_id, kid_id, profile_id, consent_status, consent_checks,
                 attendance, status)
              VALUES ('cp_meera', ${camp}, 'sch_q', ${kid}, ${PARENT}, 'GRANTED', '[]'::jsonb,
                      'PRESENT', 'NOT_SCREENED')`;

    const row = async (who: Actor) =>
      (await listParticipants(sql, who, camp, {})).participants.find((p) => p.kidId === kid)!;
    expect((await row(DENT)).screeningState).toBe("TODO");
    expect((await row(DENT)).myChecks).toEqual(["Dental"]);
    expect((await row(EYE)).myChecks).toEqual(["Vision"]);

    await saveScreening(sql, DENT, camp, kid, { findings: [dental] });
    // In the queue, but named as waiting for the eye doctor.
    const q = (await reviewQueue(sql, DENT, camp)).queue.find((x) => x.kidId === kid)!;
    expect(q.waitingFor).toEqual(["Vision"]);
    const afterDent = await row(DENT);
    const forEye = await row(EYE);
    expect(afterDent.screeningState).toBe("DONE");
    expect(forEye.status).toBe("SCREENED");
    expect(forEye.screeningState).toBe("TODO");
    expect(forEye.myOutstanding).toEqual(["Vision"]);
    expect(forEye.checksDone).toBe(1);
    expect(forEye.checksTotal).toBe(2);

    await saveScreening(sql, EYE, camp, kid, { findings: [vision] });
    expect((await row(EYE)).screeningState).toBe("DONE");
    expect((await row(EYE)).checksDone).toBe(2);
    expect((await reviewQueue(sql, DENT, camp)).queue.find((x) => x.kidId === kid)!.waitingFor).toEqual([]);

    // The dentist may sign off, but not overrule the eye doctor's finding.
    await expect(reviewParticipant(sql, DENT, camp, kid, {
      approve: true, recommendation: "All well.", findings: [{ checkType: "Vision", flag: "GOOD" }],
    })).rejects.toThrow(/recorded by another specialty/);
    await reviewParticipant(sql, DENT, camp, kid, {
      approve: true, recommendation: "All well.", findings: [{ checkType: "Dental", flag: "GOOD" }],
    });
  });
});
