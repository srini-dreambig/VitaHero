// The gaps between what was asked for and what the platform did.
//
// Each test here is one promise that was not being kept: a parent booking a
// doctor someone else already had, the hospital never hearing about it, a
// streak that a mistaken tick could only ever raise, a printed report that
// did not exist, and a doctor at the camp who could not see the illnesses the
// family had logged.

import { afterAll, beforeAll, expect, test, describe } from "bun:test";
import pg from "pg";
import type { Sql } from "./common";
import { serialQuery } from "./pgserial";
import type { Actor } from "./schools";
import { SCHEMA_STEPS } from "./index";
import { migrate } from "./migrate";
import { bookAppointment, generateDoctorSlots } from "./booking";
import { recomputeStreak } from "./badges";
import { campHealthReport } from "./health-report";
import { getScreeningForm, reviewDetail, reviewParticipant, saveScreening } from "./camps";
import { recordSymptom, SYMPTOMS } from "./symptoms";
import { draftRecommendation, summariseForApp } from "./clinical";

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

const DOC: Actor = { profileId: "ph_9100000001", name: "Dr Rao", role: "PHYSICIAN", schoolId: "sch_g" };
const OFFICE: Actor = { profileId: "ph_office", name: "Office", role: "SCHOOL_ADMIN", schoolId: "sch_g" };
const STRANGER: Actor = { profileId: "ph_far", name: "Far", role: "SCHOOL_ADMIN", schoolId: "sch_far" };
const CAMP = "sc_gap";
const SIGNED = "k_signed";
const WAITING = "k_waiting";
const PARENT = "ph_par";
const OTHER_PARENT = "ph_par2";

const vision = { checkType: "Vision", detail: { leftAcuity: "6/6", rightAcuity: "6/6" } };

// No network: every text "sends", and is remembered.
const texts: Array<{ to: string; body: string }> = [];
const fakeSms = async (to: string, body: string) => {
  texts.push({ to, body });
  return { ok: true } as any;
};

function istDay(offsetDays: number, from = new Date()): string {
  const d = new Date(from.getTime() + 330 * 60_000 + offsetDays * 86_400_000);
  return d.toISOString().slice(0, 10);
}

describe("slots a parent is offered", () => {
  test("today is offered while there is still an hour to get there", () => {
    // Tuesday 27 Oct 2026, 10:30 in India.
    const slots = generateDoctorSlots("d1", new Set(), new Date("2026-10-27T05:00:00Z"));
    expect(slots[0]).toEqual({ date: "27 Oct 2026", time: "04:30 PM", label: "Today, 04:30 PM" });
    expect(slots.some((s) => s.label === "Today, 11:00 AM")).toBe(false);
  });

  test("Sunday is skipped and a late evening rolls to the next working day", () => {
    // Saturday 31 Oct 2026, 20:00 in India.
    const slots = generateDoctorSlots("d1", new Set(), new Date("2026-10-31T14:30:00Z"));
    expect(slots[0]).toEqual({ date: "02 Nov 2026", time: "10:00 AM", label: "Mon, 10:00 AM" });
    expect(slots.some((s) => s.date === "01 Nov 2026")).toBe(false);
  });

  test("a booked slot is not offered", () => {
    const now = new Date("2026-10-31T14:30:00Z");
    const slots = generateDoctorSlots("d1", new Set(["d1|02 Nov 2026|10:00 AM"]), now);
    expect(slots[0].time).toBe("11:00 AM");
  });
});

describe("what a draft says", () => {
  test("a flagged ear is named, not drafted as a normal check-up", () => {
    const text = draftRecommendation("Asha", summariseForApp([]), [{ checkType: "ENT", flag: "WATCH" }]);
    expect(text).toContain("ears, nose and throat");
  });
});

suite("the gaps, against a real database", () => {
  beforeAll(async () => {
    if (!URL) return;
    const admin = new pg.Client({ connectionString: URL });
    await admin.connect();
    await admin.query("DROP DATABASE IF EXISTS vh_gaps");
    await admin.query("CREATE DATABASE vh_gaps");
    await admin.end();
    client = new pg.Client({ connectionString: URL2(URL, "vh_gaps") });
    await client.connect();
    sql = neonShim(client);
    await migrate(sql, SCHEMA_STEPS, []);

    await sql`INSERT INTO vita_hero.schools (id, name, city, partner_code)
              VALUES ('sch_g', 'Green Park', 'Hyderabad', 'GP-G'),
                     ('sch_far', 'Far Away', 'Vizag', 'FA-F')`;
    await sql`INSERT INTO vita_hero.school_camps (id, school_id, title, date, status, checks)
              VALUES (${CAMP}, 'sch_g', 'Annual camp', '2026-08-01', 'SCHEDULED',
                      ${JSON.stringify(["Vision", "ENT"])}::jsonb)`;
    await sql`INSERT INTO vita_hero.profiles (id, phone, name, role, provisioned, school_id)
              VALUES (${PARENT}, '+919100000009', 'Meena', 'PARENT', true, 'sch_g'),
                     (${OTHER_PARENT}, '+919100000008', 'Kiran', 'PARENT', true, 'sch_g'),
                     (${DOC.profileId}, '+919100000001', 'Dr Rao', 'PHYSICIAN', true, 'sch_g'),
                     (${OFFICE.profileId}, '+919100000002', 'Office', 'SCHOOL_ADMIN', true, 'sch_g'),
                     (${STRANGER.profileId}, '+919100000003', 'Far', 'SCHOOL_ADMIN', true, 'sch_far')`;
    for (const [id, name] of [[SIGNED, "Asha"], [WAITING, "Ravi"]]) {
      await sql`INSERT INTO vita_hero.kids (id, profile_id, name, school_id, grade, age, gender)
                VALUES (${id}, ${PARENT}, ${name}, 'sch_g', '5', 10, 'F')`;
      await sql`INSERT INTO vita_hero.camp_participants
                  (id, camp_id, school_id, kid_id, profile_id, consent_status, consent_checks,
                   attendance, status)
                VALUES (${"cp_" + id}, ${CAMP}, 'sch_g', ${id}, ${PARENT}, 'GRANTED', '[]'::jsonb,
                        'PRESENT', 'NOT_SCREENED')`;
    }
    await sql`INSERT INTO vita_hero.camp_staff (id, camp_id, profile_id, staff_role, active)
              VALUES ('cst_doc', ${CAMP}, ${DOC.profileId}, 'PHYSICIAN', true)`;

    await sql`INSERT INTO vita_hero.hospitals (id, name, city, lat, lng, phone, is_camp_partner, active)
              VALUES ('h1', 'City Children''s', 'Hyderabad', 17.4, 78.4, '9100000123', true, true)`;
    await sql`INSERT INTO vita_hero.doctors (id, name, specialty, hospital, city, active, hospital_id, phone)
              VALUES ('d1', 'Dr Iyer', 'Pediatrics', 'City Children''s', 'Hyderabad', true, 'h1', '9100000124')`;
  });
  afterAll(async () => { if (client) await client.end(); });

  // ── booking ──

  const slot = { doctor_id: "d1", doctor_name: "Dr Iyer", specialty: "Pediatrics",
                 kid_name: "Asha", date: "02 Nov 2026", time: "10:00 AM" };

  test("a booking texts the doctor and the hospital, naming who booked", async () => {
    texts.length = 0;
    const r = await bookAppointment(sql, { profileId: PARENT, userId: null }, { id: "ap_1", ...slot }, fakeSms);
    expect(r.status).toBe(201);
    expect(r.status === 201 && r.notified).toBe(2);
    expect(texts.map((t) => t.to).sort()).toEqual(["+919100000123", "+919100000124"]);
    expect(texts[0].body).toContain("Meena");
  });

  test("the app resending the same booking is not a clash, and is not texted again", async () => {
    texts.length = 0;
    const r = await bookAppointment(sql, { profileId: PARENT, userId: null }, { id: "ap_1", ...slot }, fakeSms);
    expect(r.status).toBe(201);
    expect(r.status === 201 && r.notified).toBe(0);
    expect(texts.length).toBe(0);
  });

  test("a second parent cannot take a slot already booked", async () => {
    const r = await bookAppointment(sql, { profileId: OTHER_PARENT, userId: null }, { id: "ap_2", ...slot }, fakeSms);
    expect(r.status).toBe(409);
    expect(r.status === 409 && r.code).toBe("SLOT_TAKEN");
  });

  test("the database itself refuses a double booking", async () => {
    await expect(sql`INSERT INTO vita_hero.appointments
                       (id, profile_id, doctor_name, doctor_id, date, time)
                     VALUES ('ap_3', ${OTHER_PARENT}, 'Dr Iyer', 'd1', '02 Nov 2026', '10:00 AM')`)
      .rejects.toThrow();
  });

  // ── streaks ──

  test("a streak counts consecutive days, and an untick takes the day back", async () => {
    const now = new Date("2026-10-27T06:00:00Z");
    for (const day of ["2026-10-25", "2026-10-26", "2026-10-27"]) {
      await sql`INSERT INTO vita_hero.meal_items (id, profile_id, kid_id, name, eaten, day)
                VALUES (${"m_" + day}, ${PARENT}, ${SIGNED}, 'Idli', true, ${day})`;
    }
    let s = await recomputeStreak(sql, SIGNED, PARENT, now);
    expect(s.current_streak).toBe(3);
    expect(s.best_streak).toBe(3);

    await sql`UPDATE vita_hero.meal_items SET eaten = false WHERE id = 'm_2026-10-26'`;
    s = await recomputeStreak(sql, SIGNED, PARENT, now);
    expect(s.current_streak).toBe(1);
    expect(s.best_streak).toBe(3);
  });

  // ── what the doctor at the camp sees ──

  test("the camp doctor sees what the family logged; the school office does not", async () => {
    await recordSymptom(sql, PARENT, SIGNED, {
      symptom: SYMPTOMS[0], severity: "MILD", startedOn: istDay(-10), missedSchool: true,
    });
    const form: any = await getScreeningForm(sql, DOC, CAMP, SIGNED);
    expect(form.illnessHistory.events.length).toBe(1);
    expect(form.illnessHistory.caution).toMatch(/Reported by the family/);

    const office: any = await getScreeningForm(sql, OFFICE, CAMP, SIGNED).catch((e) => ({ refused: e }));
    expect(office.refused || office.illnessHistory === null).toBeTruthy();
  });

  // ── the printed report ──

  test("the printed report holds signed-off children only, with the doctor's words", async () => {
    await saveScreening(sql, DOC, CAMP, SIGNED, {
      findings: [vision, { checkType: "ENT", detail: { leftHearing: "Reduced", earExam: "Wax" } }],
    });
    await saveScreening(sql, DOC, CAMP, WAITING, { findings: [vision] });

    const detail: any = await reviewDetail(sql, DOC, CAMP, SIGNED);
    expect(detail.illnessHistory.events.length).toBe(1);

    await reviewParticipant(sql, DOC, CAMP, SIGNED, {
      recommendation: "See an ENT doctor about the left ear.",
      findings: [{ checkType: "ENT", flag: "WATCH", note: "Wax in the left ear; hearing reduced" }],
    });

    const html = await campHealthReport(sql, DOC, CAMP);
    expect(html).toContain("Asha");
    expect(html).not.toContain("Ravi");
    expect(html).toContain("Wax in the left ear; hearing reduced");
    expect(html).toContain("See an ENT doctor about the left ear.");
    expect(html).toContain("Dr Rao");

    const logged = await sql`SELECT COUNT(*)::int AS n FROM vita_hero.record_access
                             WHERE kid_id = ${SIGNED} AND surface = 'HEALTH_REPORT'`;
    expect(logged[0].n).toBe(1);
  });

  test("one child's report can be printed alone", async () => {
    const html = await campHealthReport(sql, DOC, CAMP, { kidId: WAITING });
    expect(html).not.toContain("Asha");
    expect(html).toMatch(/No child at this camp has a result a doctor has signed off yet/);
  });

  test("another school's office cannot print this camp's reports", async () => {
    await expect(campHealthReport(sql, STRANGER, CAMP)).rejects.toThrow();
  });
});
