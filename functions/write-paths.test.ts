// Every write the console and the app make, against a real Postgres.
//
// live-routes.test.ts swept the reads and found two statements Postgres
// refuses outright. It stopped at GET on purpose, because a sweep that fires
// every verb at every path is writing to the database it is auditing. This is
// the other half, done properly: real bodies, a real database, in an order a
// real programme would use.
//
// The trap here is worse than it was for the reads, and it is the same trap an
// empty list was. A write endpoint validates before it touches SQL, so a body
// this file gets wrong comes back 400 having never reached the statement it
// was meant to exercise — and the test passes, green, having audited nothing.
// A sweep like that is not weak evidence, it is false evidence.
//
// So the driver is instrumented. Every statement the worker issues during a
// request is recorded, and a route that never issued an INSERT, UPDATE or
// DELETE fails with what it answered instead. That is what makes a wrong body
// here show up as a failure rather than as a pass.

// What this does not cover, said plainly so the green tick cannot be read as
// more than it is:
//
//   * /api/auth/phone/send, /verify and /firebase-verify. Sign-in needs a real
//     SMS provider or Firebase, neither of which exists here.
//   * /api/ai-diet-tips, /api/ai-diet-tips/generate and /api/food-recognition.
//     All three need TOOLKIT_URL, and all three are written to degrade quietly
//     without it — so the path they take here is the one where they write
//     nothing on purpose.
//   * /api/auth/logout, which writes only to vita_hero.sessions, and sessions
//     are excluded from the write detector below for the reason given there.
//   * DELETE /api/appointments/:id and POST /api/leaderboard, which belong to
//     the older personal-tracking tables rather than to the school pathway.
//   * The invited_at stamp inside /api/admin/invites/send — see that row.
//
// Everything else the console or the app writes is here, with the body it
// really sends and the role that really sends it.

import { afterAll, beforeAll, describe, expect, test, mock } from "bun:test";
import pg from "pg";
import type { Sql } from "./common";
import { serialQuery } from "./pgserial";
import type { Actor } from "./schools";
import { SCHEMA_STEPS } from "./index";
import { migrate } from "./migrate";
import { createSchool, setClasses } from "./schools";
import { commitRoster } from "./roster";
import {
  createCamp, buildCampRoster, listParticipants, addStaffMember, assignCampStaff,
} from "./camps";
import { DESIGNED_CHECKS } from "./clinical";
import { setDieticianSchool, upsertDietician } from "./dietician";

const URL = process.env.TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;
function URL2(base: string, db: string): string {
  const u = new globalThis.URL(base);
  u.pathname = "/" + db;
  return u.toString();
}

let client: pg.Client;
let sql: Sql;
/** Every statement this request issued, so we can see whether a write ran. */
let sent: string[] = [];

function recordingShim(c: pg.Client): Sql {
  const send = serialQuery(c);
  const fn: any = (strings: TemplateStringsArray | string, ...values: unknown[]) => {
    if (typeof strings === "string") throw new Error("sql(identifier) is not supported");
    let text = "";
    const params: unknown[] = [];
    for (let i = 0; i < strings.length; i++) {
      text += strings[i];
      if (i < values.length) { params.push(values[i]); text += "$" + params.length; }
    }
    sent.push(text);
    return send(text, params);
  };
  fn.query = (t: string, p: unknown[]) => { sent.push(t); return send(t, p); };
  return fn as Sql;
}

let live: Sql | null = null;
mock.module("@neondatabase/serverless", () => ({
  neon: () => {
    const proxy: any = (s: TemplateStringsArray | string, ...v: unknown[]) => {
      if (!live) throw new Error("database not ready");
      return (live as any)(s, ...v);
    };
    proxy.query = (t: string, p: unknown[]) => {
      if (!live) throw new Error("database not ready");
      return live.query(t, p);
    };
    return proxy;
  },
}));
const { default: worker } = await import("./index");
const ENV = {
  DATABASE_URL: "postgres://live",
  ADMIN_API_KEY: "test-admin-key",
  TWILIO_ACCOUNT_SID: "",
  TWILIO_AUTH_TOKEN: "",
};

const OPS: Actor = { profileId: "ph_ops", name: "Ops", role: "SUPERADMIN", schoolId: null };
let ADMIN: Actor, DOC: Actor;
let schoolId = "", campId = "", kidId = "", guardianId = "", docProfile = "";
let guardianToken = "", docToken = "", dietToken = "", dietProfile = "";

/** A session row of the given surface, which is what clinical writes turn on. */
async function mint(profileId: string, surface: string): Promise<string> {
  const token = `tok_wr_${surface}_${profileId}_`.padEnd(40, "x");
  await sql`
    INSERT INTO vita_hero.sessions (token, profile_id, expires_at, device, surface)
    VALUES (${token}, ${profileId}, ${new Date(Date.now() + 86_400_000).toISOString()},
            'test', ${surface})`;
  await sql`UPDATE vita_hero.profiles SET session_token = ${token}, is_logged_in = true
            WHERE id = ${profileId}`;
  return token;
}

/**
 * A write that belongs to the handler, not to the plumbing.
 *
 * Every authenticated request slides its session's expiry, which is an UPDATE.
 * The first version of this counted that, so four clinical writes that answered
 * 403 — "you are not assigned to this camp", because the test had not assigned
 * them — were recorded as having written something. The check was measuring
 * the harness. Sessions and the access log are excluded now, and the status
 * assertion below is what actually carries the weight.
 */
const WROTE = /^\s*(INSERT|UPDATE|DELETE)\b/i;
const PLUMBING = /vita_hero\.(sessions|record_access|schema_meta)\b/i;

type As = "ops" | "guardian" | "doctor" | "dietician";
function headersFor(as: As): Record<string, string> {
  if (as === "ops") return { "X-Admin-Key": "test-admin-key", "Content-Type": "application/json" };
  const t = as === "guardian" ? guardianToken
    : as === "dietician" ? dietToken : docToken;
  return { Authorization: "Bearer " + t, "Content-Type": "application/json" };
}

/**
 * Fire one write and report what it did, not just what it answered.
 *
 * `wrote` is the whole point: it is true only when the worker actually issued
 * an INSERT, UPDATE or DELETE while handling this request. A 400 with wrote
 * false means this file's body was wrong and the route was never audited.
 */
async function fire(method: string, path: string, body: unknown, as: As) {
  sent = [];
  const res = await worker.fetch(
    new Request("https://api.test" + path, {
      method,
      headers: headersFor(as),
      body: method === "DELETE" && body === undefined ? undefined : JSON.stringify(body ?? {}),
    }),
    ENV as never,
  );
  const text = await res.text();
  return {
    status: res.status,
    body: text.slice(0, 300),
    wrote: sent.some((s) => WROTE.test(s) && !PLUMBING.test(s)),
  };
}

suite("every write reaches its own SQL, and none of it answers 500", () => {
  beforeAll(async () => {
    if (!URL) return;
    const admin = new pg.Client({ connectionString: URL });
    await admin.connect();
    await admin.query("DROP DATABASE IF EXISTS vh_writes");
    await admin.query("CREATE DATABASE vh_writes");
    await admin.end();
    client = new pg.Client({ connectionString: URL2(URL, "vh_writes") });
    await client.connect();
    sql = recordingShim(client);
    live = sql;
    await migrate(sql, SCHEMA_STEPS, []);

    const school = await createSchool(sql, OPS, {
      name: "Silver Oaks", city: "Hyderabad", checksOffered: [...DESIGNED_CHECKS],
    });
    schoolId = school.school.id;
    ADMIN = { profileId: "ph_head", name: "Asha", role: "SCHOOL_ADMIN", schoolId };
    const doc = await addStaffMember(sql, OPS, schoolId, {
      name: "Dr Rao", phone: "9123455001", role: "PHYSICIAN",
    });
    docProfile = doc.staff.profileId;
    DOC = { profileId: docProfile, name: "Dr Rao", role: "PHYSICIAN", schoolId };
    await setClasses(sql, OPS, schoolId, { grades: ["Class 5"], sections: ["A"] });
    await commitRoster(sql, ADMIN, schoolId, {
      rows: [{
        name: "Aarav Sharma", studentRef: "2026/0412", grade: "Class 5", section: "A",
        gender: "Male", dob: "2016-03-14", guardianName: "Rahul Sharma",
        guardianPhone: "9876543210",
      }],
    });
    const camp = await createCamp(sql, ADMIN, schoolId, {
      title: "Annual Health Camp", date: "2026-08-01", time: "09:00",
      venue: "School hall", checks: [...DESIGNED_CHECKS], grades: ["Class 5"],
    });
    campId = camp.camp.id;
    await buildCampRoster(sql, ADMIN, campId);
    // Without this every clinical write below answers "You are not assigned to
    // this camp" — correctly. It is also how the first run of this file found
    // that its own write-detector was broken: four 403s sailed past it.
    await assignCampStaff(sql, ADMIN, campId, { profileId: docProfile, role: "PHYSICIAN" });
    const parts = await listParticipants(sql, ADMIN, campId, {});
    kidId = parts.participants[0].kidId;
    const g = await sql`SELECT profile_id FROM vita_hero.kids WHERE id = ${kidId}`;
    guardianId = g[0].profile_id as string;

    // The clinical writes are app-surface only, which is a deliberate rule and
    // one a console-surface token would fail on for the right reason.
    // A dietician assigned to the school, because their whole surface is
    // scoped to schools rather than to camps and nothing they write reaches
    // SQL without that.
    const die = await upsertDietician(sql, OPS, { name: "Meera Iyer", phone: "9123499001" });
    dietProfile = die.profileId;
    await setDieticianSchool(sql, OPS, die.id, schoolId, true);

    guardianToken = await mint(guardianId, "app");
    docToken = await mint(docProfile, "app");
    dietToken = await mint(dietProfile, "app");
  });
  afterAll(async () => { if (client) await client.end(); });

  /**
   * The writes, in the order a programme performs them.
   *
   * Order is not decoration. Consent has to exist before attendance, attendance
   * before screening, screening before review — so a table shuffled into
   * alphabetical order would test a sequence of refusals rather than the
   * pathway. Every body here is the shape the console or the app actually
   * sends, which is why a wrong one shows up as "issued no write" below.
   */
  const WRITES: Array<{
    name: string; method: string; as: As;
    path: () => string | Promise<string>; body: () => unknown;
    /** Set with a reason where the row legitimately writes nothing we can see. */
    writes?: false; why?: string;
  }> = [
    { name: "the console asks a school for consent", method: "POST", as: "ops",
      path: () => `/api/admin/camps/${campId}/consent/request`, body: () => ({}) },
    { name: "a guardian answers the consent request", method: "POST", as: "guardian",
      path: () => "/api/camps/consent",
      body: () => ({ campId, kidId, decision: "GRANTED", consentPhotos: true }) },
    { name: "the console records a paper consent", method: "POST", as: "ops",
      path: () => `/api/admin/camps/${campId}/consent/record`,
      body: () => ({ kidId, decision: "PAPER" }) },
    { name: "photographs are switched on for the camp", method: "POST", as: "ops",
      path: () => `/api/admin/camps/${campId}/photos-enabled`, body: () => ({ enabled: true }) },
    { name: "a screener marks attendance", method: "POST", as: "doctor",
      path: () => `/api/admin/camps/${campId}/attendance`,
      body: () => ({ kidId, attendance: "PRESENT" }) },
    { name: "a screener records findings", method: "POST", as: "doctor",
      path: () => `/api/admin/camps/${campId}/screening/${kidId}`,
      body: () => ({ findings: [
        { checkType: "Height & weight", detail: { heightCm: 118, weightKg: 19 } },
        { checkType: "Vision", detail: { leftAcuity: "6/36", rightAcuity: "6/24" } },
      ] }) },
    // Before the review and the release, which is the order a camp runs in:
    // a handset that has been offline all morning syncs what it recorded, and
    // a released camp quite rightly takes nothing more. Placed after the
    // release, this answered 200 and wrote nothing.
    { name: "a screener syncs a batch of forms from a handset", method: "POST", as: "doctor",
      path: () => `/api/admin/camps/${campId}/screening-bulk`,
      body: () => ({ entries: [{ kidId, findings: [
        { checkType: "Haemoglobin", detail: { hb: 9.4 } }] }] }) },
    { name: "a physician signs a child off", method: "POST", as: "doctor",
      path: () => `/api/admin/camps/${campId}/review/${kidId}`,
      body: () => ({ recommendation: "Please see an eye specialist within the month.",
        urgency: "SOON", findings: [{ checkType: "Vision", flag: "ALERT" }] }) },
    { name: "a physician releases the camp", method: "POST", as: "doctor",
      path: () => `/api/admin/camps/${campId}/release`, body: () => ({}) },

    // ── the family's own writes ──
    { name: "a guardian answers the naming question", method: "POST", as: "guardian",
      path: () => "/api/me/hero-name-consent", body: () => ({ kidId, granted: true }) },
    { name: "a guardian answers the meal-photo question", method: "POST", as: "guardian",
      path: () => "/api/me/meal-photo-consent", body: () => ({ kidId, granted: true }) },
    { name: "a guardian logs an illness", method: "POST", as: "guardian",
      path: () => "/api/me/symptoms",
      body: () => ({ kidId, symptom: "Fever", severity: "MILD", startedOn: "2026-08-10" }) },
    { name: "a guardian asks the school a question", method: "POST", as: "guardian",
      path: () => "/api/me/questions",
      body: () => ({ notUrgentAcknowledged: true, schoolId, kidId,
        body: "Should Aarav wear glasses for reading as well?" }) },
    { name: "a guardian requests a correction", method: "POST", as: "guardian",
      path: () => "/api/me/correction",
      body: () => ({ kidId, field: "name", value: "Aarav Kumar Sharma", note: "Roster spelling" }) },
    { name: "a guardian marks a referral booked", method: "POST", as: "guardian",
      path: () => referral("booked"), body: () => ({}) },
    { name: "a guardian marks a referral attended", method: "POST", as: "guardian",
      path: () => referral("attended"), body: () => ({ note: "Seen" }) },
    { name: "a guardian marks notifications read", method: "POST", as: "guardian",
      path: () => "/api/notifications/read", body: () => ({ ids: ["n1"] }) },

    // ── the console's directory and programme writes ──
    { name: "the console adds a hospital", method: "POST", as: "ops",
      path: () => "/api/admin/hospitals",
      body: () => ({ name: "Apollo", city: "Hyderabad", area: "Jubilee Hills",
        phone: "9123400001" }) },
    { name: "the console adds a doctor", method: "POST", as: "ops",
      path: () => "/api/admin/doctors",
      body: () => ({ name: "Dr Iyer", specialty: "Ophthalmology", city: "Hyderabad",
        phone: "9123400002" }) },
    { name: "the console adds a dietician", method: "POST", as: "ops",
      path: () => "/api/admin/dieticians",
      body: () => ({ name: "Meera Rao", phone: "9123400003" }) },
    { name: "the console adds a school administrator", method: "POST", as: "ops",
      path: () => `/api/admin/schools/${schoolId}/admins`,
      body: () => ({ name: "Head Two", phone: "9123400004" }) },
    { name: "the console adds clinical staff", method: "POST", as: "ops",
      path: () => `/api/admin/schools/${schoolId}/staff`,
      body: () => ({ name: "Dr Singh", phone: "9123400005", role: "SCREENER" }) },
    { name: "the console adds one pupil to the roster", method: "POST", as: "ops",
      path: () => `/api/admin/schools/${schoolId}/roster/student`,
      body: () => ({ name: "Diya Sharma", studentRef: "2026/0413", grade: "Class 5",
        section: "A", gender: "Female", dob: "2016-05-02", guardianName: "Rahul Sharma",
        guardianPhone: "9876543210" }) },
    { name: "the console sets the classes", method: "POST", as: "ops",
      path: () => `/api/admin/schools/${schoolId}/classes`,
      body: () => ({ grades: ["Class 5", "Class 6"], sections: ["A", "B"] }) },
    { name: "the console schedules a camp", method: "POST", as: "ops",
      path: () => `/api/admin/schools/${schoolId}/camps`,
      body: () => ({ title: "Second Camp", date: "2026-11-01", time: "09:00",
        venue: "Hall", checks: [...DESIGNED_CHECKS], grades: ["Class 5"] }) },
    { name: "the console publishes a VitaHero", method: "POST", as: "ops",
      path: () => "/api/admin/hero",
      body: () => ({ schoolId, kidId, story: "Logged every meal for three weeks.",
        achievement: "Logged every meal", published: true }) },
    { name: "the console writes a library article", method: "POST", as: "ops",
      path: () => "/api/admin/library",
      body: () => ({ slug: "eye-care", locale: "en", title: "Looking after eyes",
        body: "Some advice about eyes that is long enough to be a real article.",
        tags: ["Vision"] }) },
    { name: "the console changes the question settings", method: "POST", as: "ops",
      path: () => "/api/admin/questions/settings",
      body: () => ({ schoolId, enabled: true }) },
    { name: "the console records a contract", method: "POST", as: "ops",
      path: () => "/api/admin/billing/contract",
      // A paid contract, not the default. FREE is the default shape and an
      // invoice against it is refused — correctly, and it made the invoice
      // row below look like a bug in the worker rather than in this body.
      body: () => ({ schoolId, shape: "PER_STUDENT_YEAR", ratePaise: 15000,
        academicYear: "2026-27", startsOn: "2026-04-01", endsOn: "2027-03-31" }) },
    { name: "the console raises an invoice", method: "POST", as: "ops",
      path: () => "/api/admin/billing/invoices",
      body: () => ({ schoolId, academicYear: "2026-27",
        periodStart: "2026-04-01", periodEnd: "2027-03-31" }) },
    { name: "the console renames a school", method: "PATCH", as: "ops",
      path: () => `/api/admin/schools/${schoolId}`,
      body: () => ({ name: "Silver Oaks International" }) },

    // ── the rest of the console's programme writes ──
    { name: "the console checks a roster file before committing it", method: "POST", as: "ops",
      path: () => `/api/admin/schools/${schoolId}/roster/validate`,
      body: () => ({ rows: [{ name: "Ishaan Rao", studentRef: "2026/0501",
        grade: "Class 5", section: "A", gender: "Male", dob: "2016-01-09",
        guardianName: "Priya Rao", guardianPhone: "9876500011" }] }),
      // Validation is the point: it reads the roster and reports, and a
      // preview that wrote to the table would not be a preview.
      writes: false, why: "a dry run by design" },
    { name: "the console commits a roster", method: "POST", as: "ops",
      path: () => `/api/admin/schools/${schoolId}/roster/commit`,
      body: () => ({ rows: [{ name: "Ishaan Rao", studentRef: "2026/0501",
        grade: "Class 5", section: "A", gender: "Male", dob: "2016-01-09",
        guardianName: "Priya Rao", guardianPhone: "9876500011" }] }) },
    { name: "the console rebuilds a camp's roster", method: "POST", as: "ops",
      path: () => `/api/admin/camps/${campId}/roster`, body: () => ({}) },
    { name: "the console assigns staff to a camp", method: "POST", as: "ops",
      path: () => `/api/admin/camps/${campId}/staff`,
      body: () => ({ profileId: docProfile, role: "SCREENER" }) },
    { name: "the console chases the families who have not answered", method: "POST", as: "ops",
      path: () => `/api/admin/invites/send`,
      body: () => ({ schoolId, onlyNotJoined: false }),
      // The only write here — stamping invited_at — is conditional on an SMS
      // actually going out, and no SMS provider is configured in tests. So the
      // route is audited as far as its queries and its refusals, and that one
      // UPDATE is not covered by anything here. Said plainly rather than left
      // looking green: covering it needs a sendable stub, which is a change to
      // how the worker builds its sender.
      writes: false, why: "the stamp needs an SMS to have been sent" },
    { name: "the console nudges an open referral", method: "POST", as: "ops",
      path: () => `/api/admin/schools/${schoolId}/referrals/nudge`, body: () => ({}) },

    // ── the family's remaining writes ──
    { name: "a guardian declines a referral", method: "POST", as: "guardian",
      path: () => referral("decline"), body: () => ({ reason: "Seen privately" }) },
    { name: "a guardian removes an illness entry", method: "DELETE", as: "guardian",
      path: () => lastSymptom(), body: () => undefined },
    // ── the dietician writes that were still unaudited ──
    { name: "a dietician writes a plan", method: "POST", as: "dietician",
      path: () => "/api/dietician/plan",
      body: () => ({ kidId, focus: "ANAEMIA",
        guidance: "Add a green leafy vegetable to lunch four days a week.",
        targets: [{ label: "Iron-rich meal", perWeek: 4 }] }) },
    { name: "a dietician writes an article", method: "POST", as: "dietician",
      path: () => "/api/dietician/articles",
      body: () => ({ slug: "iron-for-children", locale: "en",
        title: "Iron in an everyday plate",
        body: "A long enough article about iron to be a real one for a family to read.",
        tags: ["Haemoglobin"] }) },

    { name: "a guardian adds a co-parent", method: "POST", as: "guardian",
      path: () => "/api/co-parents",
      body: () => ({ id: "cop_test_1", name: "Priya Sharma", relation: "Mother",
        joined_date: "2026-08-01" }) },
  ];

  /**
   * The referral the release opened, looked up when the row runs.
   *
   * Not resolved up front: the release is itself one of the writes below, so
   * anything reading this before that row has run is reading an empty table.
   * The first version did exactly that and reported a working pathway as a
   * missing referral.
   */
  /** The illness entry the guardian logged earlier, to delete by its own id. */
  async function lastSymptom(): Promise<string> {
    const rows = await sql`
      SELECT id FROM vita_hero.symptom_events WHERE kid_id = ${kidId}
      ORDER BY created_at DESC LIMIT 1`;
    expect(rows.length, "the symptom write above should have left a row").toBeGreaterThan(0);
    return `/api/me/symptoms/${rows[0].id}`;
  }

  async function referral(action: string): Promise<string> {
    const rows = await sql`
      SELECT id FROM vita_hero.referrals WHERE kid_id = ${kidId} LIMIT 1`;
    expect(rows.length, "the release should have opened a referral for the ALERT")
      .toBeGreaterThan(0);
    return `/api/referrals/${rows[0].id}/${action}`;
  }

  for (const w of WRITES) {
    test(`${w.method} ${w.name}`, async () => {
      const path = await w.path();
      const r = await fire(w.method, path, w.body(), w.as);
      // Not "did not answer 500" — that passed four 403s. Every row in this
      // table is a step a real programme actually performs, with the body the
      // console or the app actually sends and the role that actually sends it,
      // so anything but success is either a broken route or a wrong row here.
      // Both are worth failing on.
      expect(r.status, `${w.method} ${path} -> ${r.status} ${r.body}`).toBeLessThan(300);
      if (w.writes === false) return;
      expect(
        r.wrote,
        `${w.method} ${path} answered ${r.status} without issuing any INSERT, ` +
        `UPDATE or DELETE — the body in this file is wrong and the route was ` +
        `never audited.\n${r.body}`,
      ).toBe(true);
    });
  }

/**
 * The writes that take something away.
 *
 * These get their own school and their own children, because a sweep that
 * archives, rolls over and then deletes the school the rest of the file is
 * standing on would report failures caused by its own tidying. Order matters
 * here too, and in the other direction: delete is last because nothing works
 * after it.
 *
 * /api/admin/reset is the one write in the product that erases a whole
 * programme, and it is driven here rather than trusted — against a database
 * that exists only for this block.
 */
describe("the destructive writes, on a school that exists only for them", () => {
  let doomedId = "", doomedKid = "";

  beforeAll(async () => {
    if (!URL) return;
    const school = await createSchool(sql, OPS, {
      name: "Doomed High", city: "Hyderabad", checksOffered: [...DESIGNED_CHECKS],
    });
    doomedId = school.school.id;
    const head: Actor = {
      profileId: "ph_doomed", name: "Head", role: "SCHOOL_ADMIN", schoolId: doomedId,
    };
    await setClasses(sql, OPS, doomedId, { grades: ["Class 5"], sections: ["A"] });
    await commitRoster(sql, head, doomedId, {
      rows: [{
        name: "Nikhil Verma", studentRef: "2027/0001", grade: "Class 5", section: "A",
        gender: "Male", dob: "2016-02-02", guardianName: "Sunil Verma",
        guardianPhone: "9876511111",
      }],
    });
    const k = await sql`SELECT id FROM vita_hero.kids WHERE school_id = ${doomedId} LIMIT 1`;
    doomedKid = k[0].id as string;
  });

  const DESTRUCTIVE: Array<{
    name: string; method: string; as: As;
    path: () => string; body: () => unknown; writes?: false; why?: string;
  }> = [
    { name: "a pupil is marked as having left", method: "POST", as: "ops",
      // /roster/student adds one; /student/:kid marks one as having left. Two
      // routes a segment apart, and the wrong one validates the body as a new
      // pupil and refuses it — which is how this was found.
      path: () => `/api/admin/schools/${doomedId}/student/${doomedKid}`,
      body: () => ({ leaving: true }) },
    { name: "the school is rolled over into the next year", method: "POST", as: "ops",
      path: () => `/api/admin/schools/${doomedId}/rollover`,
      body: () => ({ fromYear: "2026-27", toYear: "2027-28",
        mapping: { "Class 5": "Class 6" } }) },
    { name: "the school is archived", method: "POST", as: "ops",
      path: () => `/api/admin/schools/${doomedId}/archive`,
      body: () => ({ archived: true }) },
    { name: "and then deleted outright", method: "DELETE", as: "ops",
      path: () => `/api/admin/schools/${doomedId}`,
      body: () => ({ confirmName: "Doomed High" }) },
  ];

  for (const w of DESTRUCTIVE) {
    test(`${w.method} ${w.name}`, async () => {
      const r = await fire(w.method, w.path(), w.body(), w.as);
      expect(r.status, `${w.method} ${w.path()} -> ${r.status} ${r.body}`).toBeLessThan(300);
      if (w.writes === false) return;
      expect(r.wrote, `${w.method} ${w.path()} issued no write: ${r.body}`).toBe(true);
    });
  }

  // The erasure paths. These are the ones a family has a legal right to, so
  // "it answered 200" is not the assertion — what was removed is.
  test("POST a guardian withdraws consent", async () => {
    const r = await fire("POST", "/api/me/consent/withdraw",
      { reason: "No longer wish to take part" }, "guardian");
    expect(r.status, `withdraw -> ${r.status} ${r.body}`).toBeLessThan(300);
    expect(r.wrote, `withdraw issued no write: ${r.body}`).toBe(true);
    const open = await sql`
      SELECT COUNT(*)::int AS n FROM vita_hero.referrals
      WHERE profile_id = ${guardianId} AND status IN ('OPEN','BOOKED')`;
    expect(open[0].n, "withdrawing should close the open referrals").toBe(0);
  });

  test("DELETE a guardian erases a child", async () => {
    const r = await fire("DELETE", `/api/kids/${kidId}`, undefined, "guardian");
    expect(r.status, `delete kid -> ${r.status} ${r.body}`).toBeLessThan(300);
    expect(r.wrote, `delete kid issued no write: ${r.body}`).toBe(true);
    // The child is the easy half. The rows that hang off them are the half
    // that gets missed, and a finding left behind is a clinical record
    // attached to a child who no longer exists.
    for (const table of ["camp_findings", "camp_participants", "referrals", "streaks"]) {
      const left = await sql.query(
        `SELECT COUNT(*)::int AS n FROM vita_hero.${table} WHERE kid_id = $1`, [kidId]);
      expect(left[0].n, `${table} still holds rows for an erased child`).toBe(0);
    }
    const kid = await sql`SELECT id FROM vita_hero.kids WHERE id = ${kidId}`;
    expect(kid.length).toBe(0);
  });

  // Last in the file on purpose. It empties the programme, so anything after it
  // would be running against a database this test just cleared.
  test("POST the whole programme is reset", async () => {
    const r = await fire("POST", "/api/admin/reset",
      { confirm: "DELETE EVERYTHING", directory: true, library: true }, "ops");
    expect(r.status, `reset -> ${r.status} ${r.body}`).toBeLessThan(300);
    expect(r.wrote, `reset issued no write: ${r.body}`).toBe(true);
    const left = await sql`SELECT COUNT(*)::int AS n FROM vita_hero.kids`;
    expect(left[0].n, "a reset that leaves children behind is not a reset").toBe(0);
  });
});
});
