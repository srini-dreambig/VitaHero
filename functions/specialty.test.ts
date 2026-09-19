// A doctor screens for their own specialty, and is given nothing else.
//
// Reported: "Doctor sign in to the application he should be able to search the
// student name from the camp assigned only and start screening and adding the
// information based on doctor's speciality not all screens of all speciality
// doctors."
//
// Every clinician on a camp used to be handed every check the camp offered. An
// ophthalmologist opened a child and saw the dental form, the haemoglobin
// form and the growth form alongside their own — four forms for a person who
// came to do one, and three of them inviting a reading nobody took.
//
// The specialty field could not have fixed that on its own: it was free text
// nothing read, so "Ophthalmology", "ophthalmology" and "Eye specialist" were
// three specialties to a computer and one to everybody else. It is a chosen
// value now, from the list of checks the product actually has screens for.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import pg from "pg";
import type { Sql } from "./common";
import { serialQuery } from "./pgserial";
import type { Actor } from "./schools";
import { SCHEMA_STEPS } from "./index";
import { migrate } from "./migrate";
import { upsertDoctor } from "./directory";
import {
  assignDoctorToCamp, campPack, getScreeningForm, saveScreening, saveScreeningBulk,
} from "./camps";
import {
  DESIGNED_CHECKS, normaliseSpecialty, screeningChecksFor, specialtyOptions,
} from "./clinical";

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
// The eye doctor and the dentist, each signed in as themselves.
const EYE: Actor = { profileId: "ph_9000000001", name: "Dr Eye", role: "PHYSICIAN", schoolId: "sch_s" };
const TOOTH: Actor = { profileId: "ph_9000000002", name: "Dr Tooth", role: "PHYSICIAN", schoolId: "sch_s" };
// The school's own screener: a generalist, deliberately unscoped.
const SCREENER: Actor = { profileId: "ph_9000000003", name: "Screener", role: "SCREENER", schoolId: "sch_s" };

const CAMP = "sc_spec";
const KID = "k_spec";

// ── the pure rules, with no database in them ──
describe("what a specialty screens for", () => {
  test("every specialty offered has a name the server will accept", () => {
    for (const sp of specialtyOptions()) {
      expect(normaliseSpecialty(sp.name), sp.name).toBe(sp.name);
    }
  });

  test("the checks a specialty screens are real, designed checks", () => {
    for (const sp of specialtyOptions()) {
      for (const c of sp.checks) expect(DESIGNED_CHECKS).toContain(c as never);
    }
  });

  test("an eye doctor gets vision and nothing else", () => {
    expect(screeningChecksFor("Ophthalmology")).toEqual(["Vision"]);
    expect(screeningChecksFor("Dentistry")).toEqual(["Dental"]);
  });

  test("a generalist gets every check that has a screen", () => {
    expect(screeningChecksFor("General physician").sort())
      .toEqual([...DESIGNED_CHECKS].sort());
  });

  test("a specialty whose screen does not exist yet screens nothing", () => {
    // Dermatology maps to the Skin check, which is planned and not designed.
    // Nothing to record, rather than a Normal/Abnormal dropdown with a
    // clinical-sounding label.
    expect(screeningChecksFor("Dermatology")).toEqual([]);
    const derm = specialtyOptions().find((s) => s.name === "Dermatology")!;
    expect(derm.canScreen).toBe(false);
    expect(derm.planned).toContain("Skin");
  });

  test("the spellings people actually type are understood", () => {
    expect(normaliseSpecialty("ophthalmology")).toBe("Ophthalmology");
    expect(normaliseSpecialty("  Dental ")).toBe("Dentistry");
    expect(normaliseSpecialty("Pediatrics")).toBe("Paediatrics");
    // And an invented one is not quietly accepted, because the value decides
    // which form a doctor is handed.
    expect(normaliseSpecialty("Eye specialist")).toBe("");
    expect(normaliseSpecialty("Cardiology")).toBe("");
  });
});

// ── the same rules, through a camp, against Postgres ──
suite("a doctor's round at a camp", () => {
  beforeAll(async () => {
    if (!URL) return;
    const admin = new pg.Client({ connectionString: URL });
    await admin.connect();
    await admin.query("DROP DATABASE IF EXISTS vh_specialty");
    await admin.query("CREATE DATABASE vh_specialty");
    await admin.end();
    client = new pg.Client({ connectionString: URL2(URL, "vh_specialty") });
    await client.connect();
    sql = neonShim(client);
    await migrate(sql, SCHEMA_STEPS, []);

    await sql`INSERT INTO vita_hero.schools (id, name, city, partner_code)
              VALUES ('sch_s', 'Silver Oaks', 'Hyderabad', 'SO-S')`;
    // A camp offering all four designed checks: the case where handing every
    // clinician everything is most obviously wrong.
    await sql`INSERT INTO vita_hero.school_camps (id, school_id, title, date, status, checks)
              VALUES (${CAMP}, 'sch_s', 'Annual camp', '2026-08-01', 'SCHEDULED',
                      ${JSON.stringify([...DESIGNED_CHECKS])}::jsonb)`;
    await sql`INSERT INTO vita_hero.kids (id, profile_id, name, school_id, grade, age, gender)
              VALUES (${KID}, 'ph_par', 'Aarav Sharma', 'sch_s', '5', 10, 'M')`;
    await sql`INSERT INTO vita_hero.camp_participants
                (id, camp_id, school_id, kid_id, profile_id, consent_status, consent_checks,
                 attendance, status)
              VALUES ('cp_1', ${CAMP}, 'sch_s', ${KID}, 'ph_par', 'GRANTED', '[]'::jsonb,
                      'PRESENT', 'NOT_SCREENED')`;
    await sql`INSERT INTO vita_hero.profiles (id, phone, name, role, provisioned, school_id)
              VALUES ('ph_9000000003', '+919000000003', 'Screener', 'SCREENER', true, 'sch_s')`;
    await sql`INSERT INTO vita_hero.camp_staff (id, camp_id, profile_id, staff_role, active)
              VALUES ('cst_scr', ${CAMP}, 'ph_9000000003', 'SCREENER', true)`;

    const eye = await upsertDoctor(sql, OPS, {
      name: "Dr Eye", specialty: "Ophthalmology", phone: "9000000001" });
    const tooth = await upsertDoctor(sql, OPS, {
      name: "Dr Tooth", specialty: "Dentistry", phone: "9000000002" });
    await assignDoctorToCamp(sql, OPS, CAMP, eye.id);
    await assignDoctorToCamp(sql, OPS, CAMP, tooth.id);
  });
  afterAll(async () => { if (client) await client.end(); });

  test("the eye doctor opens a child and is given the vision form only", async () => {
    const f = await getScreeningForm(sql, EYE, CAMP, KID);
    expect(f.checks).toEqual(["Vision"]);
    expect(f.specialty).toBe("Ophthalmology");
    // Named, not hidden: the camp did not forget the dental check, it is
    // somebody else's to do.
    expect(f.otherSpecialties.sort()).toEqual(["Dental", "Haemoglobin", "Height & weight"]);
  });

  test("and the dentist, standing at the next table, sees the dental form only", async () => {
    const f = await getScreeningForm(sql, TOOTH, CAMP, KID);
    expect(f.checks).toEqual(["Dental"]);
    expect(f.specialty).toBe("Dentistry");
  });

  test("the school's own screener is a generalist and still sees everything", async () => {
    const f = await getScreeningForm(sql, SCREENER, CAMP, KID);
    expect(f.checks.sort()).toEqual([...DESIGNED_CHECKS].sort());
    expect(f.specialty).toBe("");
    expect(f.otherSpecialties).toEqual([]);
  });

  test("the eye doctor can record what is theirs", async () => {
    const r = await saveScreening(sql, EYE, CAMP, KID, {
      findings: [{ checkType: "Vision", detail: { leftEye: "6/6", rightEye: "6/6" } }],
    });
    expect(r.saved.length).toBe(1);
  });

  test("and cannot record the dentist's, however the request reaches the server", async () => {
    // The form hides it; this is the server refusing it anyway. The screening
    // form is offline-capable and posts a queue, so "the UI did not offer it"
    // was never a control: a stale pack on somebody's tablet carries the whole
    // camp's checks.
    await expect(saveScreening(sql, EYE, CAMP, KID, {
      findings: [{ checkType: "Dental", detail: { cavities: 2 } }],
    })).rejects.toThrow(/not part of Ophthalmology/i);
  });

  test("the offline queue is refused the same way, not just the live form", async () => {
    // A queue reports per child rather than throwing, so one bad capture does
    // not discard a whole day. The refusal still has to be there, and has to
    // name the reason: the console keeps only what was refused, and "could not
    // be saved" with no cause is a measurement lost.
    const r = await saveScreeningBulk(sql, EYE, CAMP, [
      { kidId: KID, findings: [{ checkType: "Dental", detail: { cavities: 2 } }] },
    ]);
    expect(r.applied).toBe(0);
    expect(r.rejected.length).toBe(1);
    expect(r.rejected[0].code).toBe("CHECK_NOT_MY_SPECIALTY");
    expect(r.rejected[0].reason).toMatch(/not part of Ophthalmology/i);
  });

  test("and the queue still takes what is theirs", async () => {
    const r = await saveScreeningBulk(sql, EYE, CAMP, [
      { kidId: KID, findings: [{ checkType: "Vision", detail: { leftEye: "6/9", rightEye: "6/6" } }] },
    ]);
    expect(r.rejected.length).toBe(0);
    expect(r.applied).toBe(1);
  });

  test("the downloaded pack carries the same round, so offline matches online", async () => {
    // Otherwise downloading a camp widens a doctor back out to every check,
    // and the sync rejects half a day's work after the children have gone home.
    const pack = await campPack(sql, EYE, CAMP);
    expect(pack.camp.specialty).toBe("Ophthalmology");
    expect(pack.participants[0].checks).toEqual(["Vision"]);
    expect(pack.camp.otherSpecialties.sort())
      .toEqual(["Dental", "Haemoglobin", "Height & weight"]);

    const generalist = await campPack(sql, SCREENER, CAMP);
    expect(generalist.participants[0].checks.sort()).toEqual([...DESIGNED_CHECKS].sort());
  });

  test("a doctor still only reaches the camps they are on", async () => {
    await sql`INSERT INTO vita_hero.school_camps (id, school_id, title, date, status, checks)
              VALUES ('sc_other', 'sch_s', 'Someone else''s camp', '2026-09-01', 'SCHEDULED',
                      ${JSON.stringify([...DESIGNED_CHECKS])}::jsonb)
              ON CONFLICT (id) DO NOTHING`;
    await expect(getScreeningForm(sql, EYE, "sc_other", KID))
      .rejects.toThrow(/not assigned to this camp/i);
  });

  test("a doctor whose specialty has no screen cannot be put on a camp at all", async () => {
    const derm = await upsertDoctor(sql, OPS, {
      name: "Dr Skin", specialty: "Dermatology", phone: "9000000004" });
    // Discovered here, in front of whoever is staffing the camp — not by the
    // doctor, in a school hall, holding an empty form.
    await expect(assignDoctorToCamp(sql, OPS, CAMP, derm.id))
      .rejects.toThrow(/no screening form for that yet/i);
  });

  test("an invented specialty never gets into the directory in the first place", async () => {
    await expect(upsertDoctor(sql, OPS, {
      name: "Dr Freehand", specialty: "Eye specialist", phone: "9000000005",
    })).rejects.toThrow(/not one of the specialties/i);
  });

  test("the specialties the console offers are the ones the server accepts", async () => {
    // Three copies of this list — the dropdown, the validator and the screening
    // forms — would drift within a release. The dropdown is served from here.
    const { listDoctors } = await import("./directory");
    const d = await listDoctors(sql, OPS, "");
    expect(d.specialties.map((s) => s.name)).toEqual(specialtyOptions().map((s) => s.name));
    const eye = d.doctors.find((x) => x.name === "Dr Eye")!;
    expect(eye.screens).toEqual(["Vision"]);
  });
});
