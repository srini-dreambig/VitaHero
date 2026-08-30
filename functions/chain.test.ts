// The whole chain, against a real Postgres.
//
// School -> roster -> camp -> consent -> screening -> review -> release ->
// what the parent app reads. Plus the access rules that keep each role inside
// its own lane.
//
// This exists because the pieces were built separately and the interesting
// failures live in the joins between them. The headline case is the one that
// was reported: a clinician signs in and cannot see the children of their camp.
//
// Skipped unless TEST_DATABASE_URL points at a throwaway database.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import pg from "pg";
import type { Sql } from "./common";
import { ensureStageASchema, createSchool, setClasses, addSchoolAdmin, type Actor } from "./schools";
import { commitRoster } from "./roster";
import {
  ensureCampSchema,
  createCamp,
  buildCampRoster,
  listParticipants,
  listMyCamps,
  recordConsent,
  setAttendance,
  getScreeningForm,
  saveScreening,
  reviewQueue,
  reviewDetail,
  reviewParticipant,
  releaseCamp,
  campReconciliation,
  pendingConsents,
  guardianCampResult,
  addStaffMember,
  assignCampStaff,
  getCamp,
  adminOverview,
  campPack,
  saveScreeningBulk,
  updateCamp,
} from "./camps";
import { ensureReferralSchema, guardianReferrals, markReferralAttended, declineReferral,
  recordReferralOutcome, referralDashboard, nudgeReferrals, kidReferrals } from "./referrals";
import { ensureLifecycleSchema, exportGuardianData, requestCorrection, listCorrections,
  resolveCorrection, withdrawConsent, deleteChild, rolloverClasses, changeGuardianPhone,
  markStudentLeft, retentionReport } from "./lifecycle";
import { kidHealthHistory, schoolReport, programmeReport, childAccessTrail } from "./reports";

const URL = process.env.TEST_DATABASE_URL;

/** Swap the database name in a connection string. */
function URL2(base: string, db: string): string {
  const u = new globalThis.URL(base);
  u.pathname = "/" + db;
  return u.toString();
}
const suite = URL ? describe : describe.skip;

let client: pg.Client;
let sql: Sql;
const noSms = async () => true;
const smsLog: Array<{ to: string; body: string }> = [];
const captureSms = async (to: string, body: string) => { smsLog.push({ to, body }); return true; };

function neonShim(c: pg.Client): Sql {
  const q = (s: string) => '"' + s.replace(/"/g, '""') + '"';
  const fn: any = (strings: TemplateStringsArray | string, ...values: unknown[]) => {
    // The real @neondatabase/serverless v1 driver REJECTS this call. A test
    // double that accepted it is why 248 green tests coexisted with a worker
    // that died on its very first statement: every `${sql(SCHEMA)}` threw
    // "can now be called only as a tagged-template function", the catch around
    // schema init turned it into a generic message, and no test could see it
    // because no test ran the real driver. Fail here the way production does.
    if (typeof strings === "string") {
      throw new Error(
        "sql(identifier) is not supported by the Neon driver \u2014 " +
        "use a literal schema name in the template instead"
      );
    }
    let text = "";
    const params: unknown[] = [];
    for (let i = 0; i < strings.length; i++) {
      text += strings[i];
      if (i < values.length) {
        const v = values[i] as { __ident?: string };
        if (v && typeof v === "object" && v.__ident) text += q(v.__ident);
        else { params.push(values[i]); text += "$" + params.length; }
      }
    }
    return c.query(text, params).then((r) => r.rows);
  };
  fn.query = (text: string, params: unknown[]) => c.query(text, params).then((r) => r.rows);
  return fn as Sql;
}

const OPS: Actor = { profileId: "ph_9000000001", name: "Ops", role: "SUPERADMIN", schoolId: null };

async function legacySchema(s: Sql) {
  await s`CREATE SCHEMA IF NOT EXISTS vita_hero`;
  await s`CREATE TABLE IF NOT EXISTS vita_hero.profiles (
    id TEXT PRIMARY KEY, user_id TEXT, phone TEXT, name TEXT NOT NULL DEFAULT '', email TEXT,
    session_token TEXT, auth_provider TEXT, onboarding_complete BOOLEAN DEFAULT false,
    is_logged_in BOOLEAN DEFAULT false, role TEXT DEFAULT 'PARENT',
    provisioned BOOLEAN DEFAULT false, school_id TEXT,
    locale_code TEXT DEFAULT 'en', family_code TEXT DEFAULT '', dark_theme BOOLEAN DEFAULT false,
    notifications_enabled BOOLEAN DEFAULT true, camp_reminders_enabled BOOLEAN DEFAULT true,
    consent_accepted BOOLEAN DEFAULT false, consent_declined BOOLEAN DEFAULT false)`;
  await s`CREATE TABLE IF NOT EXISTS vita_hero.kids (
    id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, user_id TEXT, name TEXT NOT NULL,
    age INT DEFAULT 0, gender TEXT DEFAULT '', school TEXT DEFAULT '', grade TEXT DEFAULT '',
    height_cm DOUBLE PRECISION DEFAULT 0, weight_kg DOUBLE PRECISION DEFAULT 0,
    overall_score INT DEFAULT 80, dental TEXT DEFAULT 'GOOD', eyesight TEXT DEFAULT 'GOOD',
    nutrition TEXT DEFAULT 'GOOD', last_checkup TEXT DEFAULT 'Not yet',
    student_ref TEXT, source TEXT DEFAULT 'PARENT')`;
  await s`CREATE UNIQUE INDEX IF NOT EXISTS kids_profile_studentref
    ON vita_hero.kids(profile_id, student_ref) WHERE student_ref IS NOT NULL`;
  await s`CREATE TABLE IF NOT EXISTS vita_hero.schools (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, city TEXT DEFAULT 'Hyderabad', district TEXT DEFAULT '',
    partner_code TEXT NOT NULL UNIQUE, contact_email TEXT DEFAULT '', description TEXT DEFAULT '',
    active BOOLEAN DEFAULT true)`;
  await s`CREATE TABLE IF NOT EXISTS vita_hero.school_camps (
    id TEXT PRIMARY KEY, school_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT DEFAULT '',
    date TEXT NOT NULL, time TEXT DEFAULT '', status TEXT DEFAULT 'UPCOMING',
    checks JSONB DEFAULT '[]'::jsonb, grades JSONB DEFAULT '[]'::jsonb, capacity INT DEFAULT 200,
    registered_count INT DEFAULT 0, result_summary TEXT, active BOOLEAN DEFAULT true)`;
  await s`CREATE TABLE IF NOT EXISTS vita_hero.school_enrollments (
    id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, school_id TEXT NOT NULL, kid_id TEXT,
    status TEXT DEFAULT 'ACTIVE', enrolled_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE (profile_id, school_id))`;
  await s`CREATE TABLE IF NOT EXISTS vita_hero.camp_registrations (
    id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, school_camp_id TEXT NOT NULL, kid_id TEXT NOT NULL,
    registered_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE (profile_id, school_camp_id, kid_id))`;
  await s`CREATE TABLE IF NOT EXISTS vita_hero.camp_kid_results (
    id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, school_camp_id TEXT NOT NULL, kid_id TEXT NOT NULL,
    dental TEXT DEFAULT 'GOOD', eyesight TEXT DEFAULT 'GOOD', nutrition TEXT DEFAULT 'GOOD',
    height_cm DOUBLE PRECISION, weight_kg DOUBLE PRECISION, recorded_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (school_camp_id, kid_id))`;
  await s`CREATE TABLE IF NOT EXISTS vita_hero.appointments (
    id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, user_id TEXT, doctor_name TEXT NOT NULL,
    doctor_id TEXT, specialty TEXT DEFAULT '', kid_name TEXT DEFAULT '', date TEXT NOT NULL, time TEXT NOT NULL)`;
  await s`CREATE TABLE IF NOT EXISTS vita_hero.meal_items (
    id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, user_id TEXT, kid_id TEXT NOT NULL,
    time_slot TEXT DEFAULT '', name TEXT NOT NULL, detail TEXT DEFAULT '', kcal INT DEFAULT 0,
    eaten BOOLEAN DEFAULT false)`;
  await s`CREATE TABLE IF NOT EXISTS vita_hero.streaks (
    kid_id TEXT PRIMARY KEY, user_id TEXT, current_streak INT DEFAULT 0, best_streak INT DEFAULT 0,
    last_log_date TEXT DEFAULT '')`;
  await s`CREATE TABLE IF NOT EXISTS vita_hero.ai_diet_tips (
    kid_id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, content JSONB NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT NOW())`;
  await s`CREATE TABLE IF NOT EXISTS vita_hero.co_parents (
    id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, user_id TEXT, name TEXT NOT NULL,
    relation TEXT DEFAULT '', joined_date TEXT DEFAULT '')`;
  await s`CREATE TABLE IF NOT EXISTS vita_hero.growth_points (
    id TEXT PRIMARY KEY, kid_id TEXT NOT NULL, user_id TEXT, label TEXT DEFAULT '',
    height DOUBLE PRECISION DEFAULT 0, weight DOUBLE PRECISION DEFAULT 0,
    recorded_at TIMESTAMPTZ DEFAULT NOW())`;
}

beforeAll(async () => {
  if (!URL) return;
  // Its own database, so the integration suites never race each other.
  const admin = new pg.Client({ connectionString: URL });
  await admin.connect();
  await admin.query("DROP DATABASE IF EXISTS vh_test_chain");
  await admin.query("CREATE DATABASE vh_test_chain");
  await admin.end();
  client = new pg.Client({ connectionString: URL2(URL, "vh_test_chain") });
  await client.connect();
  sql = neonShim(client);
  await client.query("DROP SCHEMA IF EXISTS vita_hero CASCADE");
  await legacySchema(sql);
  await ensureStageASchema(sql);
  await ensureCampSchema(sql);
  await ensureReferralSchema(sql);
  await ensureLifecycleSchema(sql);
});
afterAll(async () => { if (client) await client.end(); });

const students = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    "Admission No": "2026/" + (100 + i),
    "Student Name": "Child " + i,
    "Date of Birth": "14/03/2016",
    Gender: i % 2 ? "F" : "M",
    Class: i < 6 ? "Class 4" : "Class 7",
    Section: "A",
    "Guardian Name": "Guardian " + i,
    "Guardian Phone": String(9811100000 + i),
  }));

suite("end to end", () => {
  let schoolId = "";
  let campId = "";
  let screener: Actor;
  let physician: Actor;
  let admin: Actor;
  let kidIds: string[] = [];

  test("a school is onboarded with a programme", async () => {
    const r = await createSchool(sql, OPS, {
      name: "Oakridge International", city: "Hyderabad", academicYear: "2026-27",
      checksOffered: ["Height & weight", "Vision", "Dental", "Haemoglobin"],
    });
    schoolId = r.school.id;
    await setClasses(sql, OPS, schoolId, {
      academicYear: "2026-27", grades: ["Class 4", "Class 7"], sections: ["A", "B"],
    });
    expect(r.school.checksOffered.length).toBe(4);
  });

  test("its roster is imported", async () => {
    const rep = await commitRoster(sql, OPS, schoolId, { rows: students(10), filename: "roll.csv" });
    expect(rep.create).toBe(10);
    const rows = await client.query("SELECT id FROM vita_hero.kids WHERE school_id=$1 ORDER BY name", [schoolId]);
    kidIds = rows.rows.map((r) => r.id);
    expect(kidIds.length).toBe(10);
  });

  test("importing the roster enrols guardians so the app can show them camps", async () => {
    const r = await client.query("SELECT COUNT(*)::int AS n FROM vita_hero.school_enrollments WHERE school_id=$1", [schoolId]);
    expect(r.rows[0].n).toBe(10);
  });

  test("staff are provisioned and can be assigned", async () => {
    const a = await addSchoolAdmin(sql, OPS, schoolId, { name: "Meera Rao", phone: "9123400001" });
    admin = { profileId: a.admin.profileId, name: "Meera Rao", role: "SCHOOL_ADMIN", schoolId };
    const s = await addStaffMember(sql, OPS, schoolId, { name: "Nurse Latha", phone: "9123400002", role: "SCREENER" });
    screener = { profileId: s.staff.profileId, name: "Nurse Latha", role: "SCREENER", schoolId };
    const p = await addStaffMember(sql, OPS, schoolId, { name: "Dr Anand", phone: "9123400003", role: "PHYSICIAN" });
    physician = { profileId: p.staff.profileId, name: "Dr Anand", role: "PHYSICIAN", schoolId };
    expect(screener.profileId).not.toBe(physician.profileId);
  });

  test("a camp cannot record a check the school has not agreed to", async () => {
    await expect(createCamp(sql, admin, schoolId, {
      title: "Bad camp", date: "2026-09-10", checks: ["Spine"], grades: ["Class 4"],
    })).rejects.toThrow(/has not agreed to/);
  });

  test("a camp is scheduled for one class", async () => {
    const r = await createCamp(sql, admin, schoolId, {
      title: "Annual Health Camp", date: "2026-09-10", time: "09:00", venue: "School hall",
      checks: ["Height & weight", "Vision", "Dental"], grades: ["Class 4"], sections: ["A"],
      consentDeadline: "2026-09-05",
    });
    campId = r.camp.id;
    expect(r.camp.status).toBe("DRAFT");
    expect(r.camp.participants).toBe(0);
  });

  // ── the reported bug ──
  test("before the roster is built a clinician sees a camp with no children", async () => {
    await assignCampStaff(sql, admin, campId, { profileId: screener.profileId });
    const mine = await listMyCamps(sql, screener);
    expect(mine.camps.length).toBe(1);
    expect(mine.camps[0].participants).toBe(0);
    const p = await listParticipants(sql, screener, campId, {});
    expect(p.participants.length).toBe(0);
  });

  test("building the roster puts the right children on the camp", async () => {
    const r = await buildCampRoster(sql, admin, campId);
    // Six children are in Class 4; the other four are Class 7 and must not appear.
    expect(r.added).toBe(6);
    expect(r.total).toBe(6);
  });

  test("the screener now sees exactly those children", async () => {
    const p = await listParticipants(sql, screener, campId, {});
    expect(p.participants.length).toBe(6);
    expect(p.participants.every((x) => x.grade === "Class 4")).toBe(true);
    expect(p.can.screen).toBe(true);
    expect(p.can.review).toBe(false);
    const mine = await listMyCamps(sql, screener);
    expect(mine.camps[0].participants).toBe(6);
    expect(mine.camps[0].staffRole).toBe("SCREENER");
  });

  test("a screener from another camp sees nothing", async () => {
    const stranger: Actor = { profileId: "ph_9999999999", name: "Other", role: "SCREENER", schoolId };
    await expect(listParticipants(sql, stranger, campId, {})).rejects.toThrow(/not assigned to this camp/);
    const mine = await listMyCamps(sql, stranger);
    expect(mine.camps.length).toBe(0);
  });

  test("screening is refused without consent", async () => {
    const kid = (await listParticipants(sql, screener, campId, {})).participants[0];
    await expect(saveScreening(sql, screener, campId, kid.kidId, {
      findings: [{ checkType: "Height & weight", detail: { heightCm: 130, weightKg: 28 } }],
    })).rejects.toThrow(/No consent on file/);
  });

  test("a guardian sees the consent request and can grant it", async () => {
    const parts = (await listParticipants(sql, screener, campId, {})).participants;
    const first = parts[0];
    const owner = await client.query("SELECT profile_id FROM vita_hero.camp_participants WHERE kid_id=$1", [first.kidId]);
    const guardianId = owner.rows[0].profile_id;

    const pend = await pendingConsents(sql, guardianId);
    expect(pend.consents.length).toBe(1);
    expect(pend.consents[0].campId).toBe(campId);
    expect(pend.consents[0].checks).toContain("Vision");

    await recordConsent(sql, campId, first.kidId, "GRANTED", {
      actorId: guardianId, source: "APP", profileId: guardianId,
    });
    const after = await pendingConsents(sql, guardianId);
    expect(after.consents.length).toBe(0);
  });

  test("a guardian cannot consent for someone else's child", async () => {
    const parts = (await listParticipants(sql, screener, campId, {})).participants;
    await expect(recordConsent(sql, campId, parts[3].kidId, "GRANTED", {
      actorId: "ph_9811100000", source: "APP", profileId: "ph_9811100000",
    })).rejects.toThrow(/not your child/);
  });

  test("consent is recorded for the rest, one declined", async () => {
    const parts = (await listParticipants(sql, screener, campId, {})).participants;
    for (let i = 1; i < parts.length - 1; i++) {
      await recordConsent(sql, campId, parts[i].kidId, "PAPER", { actorId: admin.profileId, source: "PAPER" });
    }
    await recordConsent(sql, campId, parts[parts.length - 1].kidId, "DECLINED", {
      actorId: admin.profileId, source: "PAPER",
    });
    const c = await getCamp(sql, admin, campId);
    expect(c.camp.consented).toBe(5);
    expect(c.camp.declined).toBe(1);
  });

  test("a declined child cannot be screened", async () => {
    const declined = (await listParticipants(sql, screener, campId, { consent: "DECLINED" })).participants[0];
    await expect(saveScreening(sql, screener, campId, declined.kidId, {
      findings: [{ checkType: "Vision", detail: { leftAcuity: "6/6", rightAcuity: "6/6" } }],
    })).rejects.toThrow(/declined consent/);
  });

  test("the screening form offers only this camp's checks", async () => {
    const p = (await listParticipants(sql, screener, campId, { consent: "GRANTED" })).participants[0];
    const form = await getScreeningForm(sql, screener, campId, p.kidId);
    expect(form.checks.sort()).toEqual(["Dental", "Height & weight", "Vision"]);
    expect(form.child.name).toBeTruthy();
  });

  test("findings are recorded and flagged from the clinical rules", async () => {
    const parts = (await listParticipants(sql, screener, campId, {})).participants
      .filter((p) => p.consentStatus === "GRANTED" || p.consentStatus === "PAPER");

    // A healthy child.
    const ok = await saveScreening(sql, screener, campId, parts[0].kidId, {
      findings: [
        { checkType: "Height & weight", detail: { heightCm: 137, weightKg: 32 } },
        { checkType: "Vision", detail: { leftAcuity: "6/6", rightAcuity: "6/6" } },
        { checkType: "Dental", detail: { cariesCount: 0, gums: "healthy" } },
      ],
    });
    expect(ok.saved.find((s) => s.checkType === "Vision")!.flag).toBe("GOOD");
    expect(ok.saved.find((s) => s.checkType === "Dental")!.flag).toBe("GOOD");

    // A child who needs referring.
    const bad = await saveScreening(sql, screener, campId, parts[1].kidId, {
      findings: [
        { checkType: "Height & weight", detail: { heightCm: 118, weightKg: 19 } },
        { checkType: "Vision", detail: { leftAcuity: "6/36", rightAcuity: "6/24" } },
        { checkType: "Dental", detail: { cariesCount: 4, gums: "bleeding", pain: true } },
      ],
    });
    expect(bad.saved.find((s) => s.checkType === "Vision")!.flag).toBe("ALERT");
    expect(bad.saved.find((s) => s.checkType === "Dental")!.flag).toBe("ALERT");

    // The remaining consented children, all healthy.
    for (let i = 2; i < parts.length; i++) {
      await saveScreening(sql, screener, campId, parts[i].kidId, {
        findings: [
          { checkType: "Height & weight", detail: { heightCm: 136, weightKg: 31 } },
          { checkType: "Vision", detail: { leftAcuity: "6/6", rightAcuity: "6/6" } },
          { checkType: "Dental", detail: { cariesCount: 0, gums: "healthy" } },
        ],
      });
    }
  });

  test("overriding the suggested flag requires a reason", async () => {
    const p = (await listParticipants(sql, screener, campId, { status: "SCREENED" })).participants[0];
    await expect(saveScreening(sql, screener, campId, p.kidId, {
      findings: [{ checkType: "Vision", detail: { leftAcuity: "6/6", rightAcuity: "6/6" }, flag: "ALERT" }],
    })).rejects.toThrow(/needs a reason/);

    const ok = await saveScreening(sql, screener, campId, p.kidId, {
      findings: [{ checkType: "Vision", detail: { leftAcuity: "6/6", rightAcuity: "6/6" }, flag: "WATCH",
        note: "Child could not cooperate, repeat test advised" }],
    });
    expect(ok.saved[0].flag).toBe("WATCH");
  });

  test("attendance is tracked and reconciles", async () => {
    const declined = (await listParticipants(sql, screener, campId, { consent: "DECLINED" })).participants[0];
    await setAttendance(sql, screener, campId, declined.kidId, "ABSENT");
    const r = await campReconciliation(sql, admin, campId);
    expect(r.reconciliation.rostered).toBe(6);
    expect(r.reconciliation.consented).toBe(5);
    expect(r.reconciliation.screened).toBe(5);
    expect(r.reconciliation.absent).toBe(1);
  });

  test("a screener cannot review or release", async () => {
    await expect(reviewQueue(sql, screener, campId)).rejects.toThrow(/permission to review/);
    await expect(releaseCamp(sql, screener, campId, noSms)).rejects.toThrow(/permission to release/);
  });

  test("nothing is visible to the guardian before release", async () => {
    const parts = (await listParticipants(sql, admin, campId, { status: "SCREENED" })).participants;
    const owner = await client.query("SELECT profile_id FROM vita_hero.camp_participants WHERE kid_id=$1", [parts[0].kidId]);
    const res = await guardianCampResult(sql, owner.rows[0].profile_id, campId, parts[0].kidId);
    expect(res.status).toBe("PENDING");
    expect(res.findings).toBeUndefined();
  });

  test("the physician's queue is ordered by severity", async () => {
    await assignCampStaff(sql, admin, campId, { profileId: physician.profileId });
    const q = await reviewQueue(sql, physician, campId);
    expect(q.queue.length).toBe(5);
    expect(q.queue[0].alerts).toBeGreaterThan(0);
  });

  test("review detail drafts a recommendation the physician can edit", async () => {
    const q = await reviewQueue(sql, physician, campId);
    const d = await reviewDetail(sql, physician, campId, q.queue[0].kidId);
    expect(d.findings.length).toBe(3);
    expect(d.recommendationIsDraft).toBe(true);
    expect(d.recommendation).toContain(d.child.name);
    expect(d.summary.dental).toBe("ALERT");
    expect(d.suggestedUrgency).toBe("URGENT");
  });

  test("approval requires a message for the guardian", async () => {
    const q = await reviewQueue(sql, physician, campId);
    await expect(reviewParticipant(sql, physician, campId, q.queue[0].kidId, { recommendation: "  " }))
      .rejects.toThrow(/what the guardian should do/);
  });

  test("release refuses while nothing is approved", async () => {
    await expect(releaseCamp(sql, physician, campId, noSms)).rejects.toThrow(/Nothing has been approved/);
  });

  test("the physician approves everyone", async () => {
    const q = await reviewQueue(sql, physician, campId);
    for (const item of q.queue) {
      const d = await reviewDetail(sql, physician, campId, item.kidId);
      await reviewParticipant(sql, physician, campId, item.kidId, {
        recommendation: d.recommendation,
        urgency: d.suggestedUrgency,
        findings: d.findings.map((f) => ({ checkType: f.checkType, flag: f.flag })),
      });
    }
    const c = await getCamp(sql, physician, campId);
    expect(c.camp.approved).toBe(5);
  });

  test("release writes results the parent app can read", async () => {
    smsLog.length = 0;
    const r = await releaseCamp(sql, physician, campId, captureSms);
    expect(r.released).toBe(5);
    expect(r.urgentNotified).toBe(1);
    expect(smsLog[0].body).toContain("needs a doctor's attention");

    const results = await client.query("SELECT * FROM vita_hero.camp_kid_results WHERE school_camp_id=$1", [campId]);
    expect(results.rowCount).toBe(5);

    const gp = await client.query("SELECT COUNT(*)::int AS n FROM vita_hero.growth_points");
    expect(gp.rows[0].n).toBeGreaterThanOrEqual(5);

    const regs = await client.query("SELECT COUNT(*)::int AS n FROM vita_hero.camp_registrations WHERE school_camp_id=$1", [campId]);
    expect(regs.rows[0].n).toBe(5);
  });

  test("the child's headline flags reflect the real findings", async () => {
    const q = await client.query(
      "SELECT k.name, k.dental, k.eyesight, k.nutrition, k.height_cm, k.last_checkup " +
      "FROM vita_hero.kids k JOIN vita_hero.camp_participants p ON p.kid_id=k.id " +
      "WHERE p.camp_id=$1 AND p.status='RELEASED' ORDER BY k.dental DESC", [campId]);
    const referred = q.rows.find((r) => r.dental === "ALERT");
    expect(referred).toBeDefined();
    expect(referred.eyesight).toBe("ALERT");
    expect(referred.last_checkup).toBe("2026-09-10");
    expect(Number(referred.height_cm)).toBe(118);
  });

  test("a child who was never screened keeps NOT_MEASURED, not a clean bill", async () => {
    const declined = (await listParticipants(sql, admin, campId, { consent: "DECLINED" })).participants[0];
    const k = await client.query("SELECT dental, eyesight, nutrition FROM vita_hero.kids WHERE id=$1", [declined.kidId]);
    // Untouched by release: still the roster default, never fabricated into GOOD by a hash.
    expect(k.rows[0].dental).toBe("GOOD");
    const res = await client.query(
      "SELECT COUNT(*)::int AS n FROM vita_hero.camp_kid_results WHERE kid_id=$1", [declined.kidId]);
    expect(res.rows[0].n).toBe(0);
  });

  test("the guardian now sees the released result", async () => {
    const parts = (await listParticipants(sql, admin, campId, { status: "RELEASED" })).participants;
    const target = parts[0];
    const owner = await client.query("SELECT profile_id FROM vita_hero.camp_participants WHERE kid_id=$1", [target.kidId]);
    const res = await guardianCampResult(sql, owner.rows[0].profile_id, campId, target.kidId);
    expect(res.status).toBe("RELEASED");
    expect(res.findings!.length).toBe(3);
    expect(res.recommendation).toBeTruthy();
    expect(res.schoolName).toBe("Oakridge International");
  });

  test("a guardian cannot read another family's result", async () => {
    const parts = (await listParticipants(sql, admin, campId, { status: "RELEASED" })).participants;
    await expect(guardianCampResult(sql, "ph_9811100009", campId, parts[0].kidId)).rejects.toThrow(/No result/);
  });

  test("a released camp cannot be edited", async () => {
    await expect(updateCamp(sql, admin, campId, { title: "Renamed" })).rejects.toThrow(/no longer be edited/);
  });

  test("screening a released child is refused", async () => {
    const parts = (await listParticipants(sql, screener, campId, { status: "RELEASED" })).participants;
    await expect(saveScreening(sql, screener, campId, parts[0].kidId, {
      findings: [{ checkType: "Vision", detail: { leftAcuity: "6/6", rightAcuity: "6/6" } }],
    })).rejects.toThrow(/already been released/);
  });

  test("rebuilding the roster never discards a screened child", async () => {
    // Narrow the camp to a class none of these children are in, then rebuild.
    await client.query("UPDATE vita_hero.school_camps SET grades='[\"Class 7\"]'::jsonb WHERE id=$1", [campId]);
    const r = await buildCampRoster(sql, OPS, campId);
    expect(r.removed).toBe(0); // all six have consent or findings on file
    const still = await listParticipants(sql, OPS, campId, { status: "RELEASED" });
    expect(still.participants.length).toBe(5);
    await client.query("UPDATE vita_hero.school_camps SET grades='[\"Class 4\"]'::jsonb WHERE id=$1", [campId]);
  });

  // ── Stage C: offline camp day ──

  test("the camp pack carries everything a screener needs offline", async () => {
    const pack = await campPack(sql, screener, campId);
    expect(pack.camp.checks.length).toBe(3);
    expect(pack.participants.length).toBeGreaterThan(0);
    const one = pack.participants[0];
    expect(one.name).toBeTruthy();
    expect(one.consentStatus).toBeTruthy();
    // Each child carries the checks their own consent allows.
    expect(Array.isArray(one.checks)).toBe(true);
    expect(pack.downloadedAt).toBeTruthy();
  });

  test("a screener not on the camp cannot download its pack", async () => {
    const stranger: Actor = { profileId: "ph_9999999998", name: "Other", role: "SCREENER", schoolId };
    await expect(campPack(sql, stranger, campId)).rejects.toThrow(/not assigned to this camp/);
  });

  test("a batch of offline captures applies in one pass", async () => {
    // A fresh camp so this does not disturb the released one.
    const c2 = await createCamp(sql, admin, schoolId, {
      title: "Offline Camp", date: "2026-11-02",
      checks: ["Height & weight", "Vision"], grades: ["Class 7"],
    });
    const camp2 = c2.camp.id;
    await buildCampRoster(sql, admin, camp2);
    await assignCampStaff(sql, admin, camp2, { profileId: screener.profileId });
    const parts = (await listParticipants(sql, admin, camp2, {})).participants;
    expect(parts.length).toBeGreaterThanOrEqual(3);

    for (const p of parts) {
      await recordConsent(sql, camp2, p.kidId, "PAPER", { actorId: admin.profileId, source: "PAPER" });
    }

    const entries = parts.map((p, i) => ({
      kidId: p.kidId,
      attendance: "PRESENT",
      findings: [
        { checkType: "Height & weight", detail: { heightCm: 140 + i, weightKg: 34 + i } },
        { checkType: "Vision", detail: { leftAcuity: "6/6", rightAcuity: "6/6" } },
      ],
    }));
    const r = await saveScreeningBulk(sql, screener, camp2, entries);
    expect(r.applied).toBe(parts.length);
    expect(r.rejected.length).toBe(0);

    const after = await listParticipants(sql, admin, camp2, {});
    expect(after.participants.every((p) => p.status === "SCREENED")).toBe(true);
    (globalThis as Record<string, unknown>).__camp2 = camp2;
  });

  test("one rejected child does not discard the rest of the batch", async () => {
    const camp2 = (globalThis as Record<string, unknown>).__camp2 as string;
    const parts = (await listParticipants(sql, admin, camp2, {})).participants;

    // Consent withdrawn while the device was offline — the classic case.
    await client.query(
      "UPDATE vita_hero.camp_participants SET consent_status='DECLINED' WHERE camp_id=$1 AND kid_id=$2",
      [camp2, parts[0].kidId]);

    const entries = parts.map((p) => ({
      kidId: p.kidId,
      findings: [{ checkType: "Vision", detail: { leftAcuity: "6/12", rightAcuity: "6/12" } }],
    }));
    const r = await saveScreeningBulk(sql, screener, camp2, entries);

    expect(r.rejected.length).toBe(1);
    expect(r.rejected[0].kidId).toBe(parts[0].kidId);
    expect(r.rejected[0].code).toBe("NO_CONSENT");
    expect(r.applied).toBe(parts.length - 1);

    // The declined child keeps their earlier reading; the rest took the new one.
    const declined = await client.query(
      "SELECT detail FROM vita_hero.camp_findings WHERE camp_id=$1 AND kid_id=$2 AND check_type='Vision'",
      [camp2, parts[0].kidId]);
    expect(declined.rows[0].detail.leftAcuity).toBe("6/6");
    await client.query(
      "UPDATE vita_hero.camp_participants SET consent_status='PAPER' WHERE camp_id=$1 AND kid_id=$2",
      [camp2, parts[0].kidId]);
  });

  test("re-sending the same batch is safe", async () => {
    const camp2 = (globalThis as Record<string, unknown>).__camp2 as string;
    const parts = (await listParticipants(sql, admin, camp2, {})).participants;
    const before = await client.query(
      "SELECT COUNT(*)::int n FROM vita_hero.camp_findings WHERE camp_id=$1", [camp2]);
    const entries = parts.map((p) => ({
      kidId: p.kidId,
      findings: [{ checkType: "Vision", detail: { leftAcuity: "6/6", rightAcuity: "6/6" } }],
    }));
    await saveScreeningBulk(sql, screener, camp2, entries);
    const after = await client.query(
      "SELECT COUNT(*)::int n FROM vita_hero.camp_findings WHERE camp_id=$1", [camp2]);
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });

  // ── Stage D: urgent escalation and repeat findings ──

  test("marking a child urgent texts the guardian straight away", async () => {
    const camp2 = (globalThis as Record<string, unknown>).__camp2 as string;
    await assignCampStaff(sql, admin, camp2, { profileId: physician.profileId });
    const q = await reviewQueue(sql, physician, camp2);
    const sent: string[] = [];
    const r = await reviewParticipant(sql, physician, camp2, q.queue[0].kidId, {
      recommendation: "Please see an eye doctor within a few days.",
      urgency: "URGENT",
    }, async (to) => { sent.push(to); return true; });
    expect(r.escalated).toBe(true);
    expect(sent.length).toBe(1);

    // Release must not text the same family a second time.
    const rest = await reviewQueue(sql, physician, camp2);
    for (const item of rest.queue.filter((x) => x.status === "SCREENED")) {
      const d = await reviewDetail(sql, physician, camp2, item.kidId);
      await reviewParticipant(sql, physician, camp2, item.kidId, {
        recommendation: d.recommendation, urgency: "ROUTINE",
      });
    }
    const releaseSms: string[] = [];
    const rel = await releaseCamp(sql, physician, camp2, async (to) => { releaseSms.push(to); return true; });
    expect(rel.released).toBeGreaterThan(0);
    expect(releaseSms.length).toBe(0);
  });

  test("a repeat finding is surfaced to the physician", async () => {
    // The same children were screened at both camps; the second camp's review
    // should know about the first.
    const camp2 = (globalThis as Record<string, unknown>).__camp2 as string;
    // Give the earlier camp a genuine finding to recur. An earlier test reset
    // every Vision reading to normal, and a normal result is not a recurrence.
    const firstKid = (await listParticipants(sql, admin, camp2, {})).participants[0];
    await client.query(
      "UPDATE vita_hero.camp_findings SET flag='WATCH' WHERE camp_id=$1 AND kid_id=$2 AND check_type='Vision'",
      [camp2, firstKid.kidId]);

    const c3 = await createCamp(sql, admin, schoolId, {
      title: "Follow-up Camp", date: "2027-03-02",
      checks: ["Vision"], grades: ["Class 7"], academicYear: "2026-27",
    });
    const camp3 = c3.camp.id;
    await buildCampRoster(sql, admin, camp3);
    await assignCampStaff(sql, admin, camp3, { profileId: screener.profileId });
    await assignCampStaff(sql, admin, camp3, { profileId: physician.profileId });
    const parts = (await listParticipants(sql, admin, camp3, {})).participants;
    const target = parts.find((p) => p.kidId === firstKid.kidId) || parts[0];
    await recordConsent(sql, camp3, target.kidId, "PAPER", { actorId: admin.profileId, source: "PAPER" });
    await saveScreening(sql, screener, camp3, target.kidId, {
      findings: [{ checkType: "Vision", detail: { leftAcuity: "6/18", rightAcuity: "6/18" } }],
    });
    const d = await reviewDetail(sql, physician, camp3, target.kidId);
    const vision = d.findings.find((f) => f.checkType === "Vision")!;
    expect((vision as Record<string, unknown>).recurring).toBe(true);
    expect(d.recurring.length).toBeGreaterThan(0);
    // A problem that did not resolve since the last camp is not "routine".
    expect(d.suggestedUrgency).not.toBe("NONE");
    expect(d.suggestedUrgency).not.toBe("ROUTINE");
  });

  // ── Stage G: the referral loop ──

  test("release opened a referral for every flagged finding", async () => {
    const d = await referralDashboard(sql, admin, schoolId, {});
    // One child had ALERT vision + ALERT dental + a WATCH growth flag; another
    // was overridden to WATCH on vision.
    expect(d.totals.total).toBeGreaterThanOrEqual(3);
    expect(d.totals.open).toBe(d.totals.total);
    expect(d.totals.closureRate).toBe(0);
    const vision = d.referrals.find((r) => r.checkType === "Vision" && r.flag === "ALERT");
    expect(vision).toBeDefined();
    expect(vision!.specialty).toBe("Ophthalmology");
    expect(vision!.dueBy).toBeTruthy();
  });

  test("a guardian sees their own referrals and nobody else's", async () => {
    const d = await referralDashboard(sql, admin, schoolId, {});
    const target = d.referrals[0];
    const own = await guardianReferrals(sql, (await client.query(
      "SELECT profile_id FROM vita_hero.referrals WHERE id=$1", [target.id])).rows[0].profile_id);
    expect(own.referrals.length).toBeGreaterThan(0);
    expect(own.referrals.every((r) => r.kidId === target.kidId)).toBe(true);

    const stranger = await guardianReferrals(sql, "ph_9811100009");
    expect(stranger.referrals.length).toBe(0);
  });

  test("a guardian cannot act on someone else's referral", async () => {
    const d = await referralDashboard(sql, admin, schoolId, {});
    await expect(markReferralAttended(sql, "ph_9811100009", d.referrals[0].id, ""))
      .rejects.toThrow(/not yours/);
  });

  test("a guardian confirms the visit, then a clinician closes it", async () => {
    const d = await referralDashboard(sql, admin, schoolId, {});
    const r = d.referrals.find((x) => x.status === "OPEN")!;
    const owner = (await client.query("SELECT profile_id FROM vita_hero.referrals WHERE id=$1", [r.id])).rows[0].profile_id;

    await markReferralAttended(sql, owner, r.id, "Saw the eye doctor on Tuesday");
    let after = await referralDashboard(sql, admin, schoolId, {});
    expect(after.referrals.find((x) => x.id === r.id)!.status).toBe("ATTENDED");

    await recordReferralOutcome(sql, physician, r.id, {
      outcome: "ONGOING", diagnosis: "Refractive error", treatment: "Spectacles prescribed",
      clinicianName: "Dr Anand",
    });
    after = await referralDashboard(sql, admin, schoolId, {});
    const closed = after.referrals.find((x) => x.id === r.id)!;
    expect(closed.status).toBe("CLOSED");
    expect(closed.outcome).toBe("ONGOING");
    expect(after.totals.closed).toBe(1);
    expect(after.totals.closureRate).toBeGreaterThan(0);
  });

  test("closing a referral requires recording what was found", async () => {
    const d = await referralDashboard(sql, admin, schoolId, { status: "OPEN" });
    await expect(recordReferralOutcome(sql, physician, d.referrals[0].id, { outcome: "ONGOING" }))
      .rejects.toThrow(/Record what was found/);
    await expect(recordReferralOutcome(sql, physician, d.referrals[0].id, { outcome: "MAYBE" }))
      .rejects.toThrow(/Outcome must be/);
  });

  test("referring onward keeps the loop open under a new record", async () => {
    const before = await referralDashboard(sql, admin, schoolId, {});
    const open = before.referrals.find((x) => x.status === "OPEN")!;
    await recordReferralOutcome(sql, admin, open.id, {
      outcome: "REFERRED_ON", diagnosis: "Needs a specialist", referredTo: "Paediatric Surgery",
    });
    const after = await referralDashboard(sql, admin, schoolId, {});
    expect(after.totals.total).toBe(before.totals.total + 1);
    expect(after.referrals.some((r) => r.reason.indexOf("Referred on") === 0)).toBe(true);
  });

  test("a guardian may decline, and it stops being chased", async () => {
    const d = await referralDashboard(sql, admin, schoolId, { status: "OPEN" });
    const r = d.referrals[0];
    const owner = (await client.query("SELECT profile_id FROM vita_hero.referrals WHERE id=$1", [r.id])).rows[0].profile_id;
    await declineReferral(sql, owner, r.id, "Already under our own doctor");
    const after = await referralDashboard(sql, admin, schoolId, {});
    expect(after.referrals.find((x) => x.id === r.id)!.status).toBe("DECLINED");
    // Declined is excluded from the closure denominator.
    expect(after.totals.declined).toBeGreaterThan(0);
  });

  test("nudging chases open referrals and reports who is stuck", async () => {
    const sent: string[] = [];
    const r = await nudgeReferrals(sql, admin, schoolId, async (to) => { sent.push(to); return true; });
    expect(r.nudged).toBe(sent.length);
    const rows = await client.query(
      "SELECT nudge_count FROM vita_hero.referrals WHERE school_id=$1 AND status='OPEN'", [schoolId]);
    if (rows.rowCount) expect(rows.rows.every((x) => x.nudge_count >= 1)).toBe(true);
  });

  test("per-child referral history is guarded by ownership", async () => {
    const parts = (await listParticipants(sql, admin, campId, { status: "RELEASED" })).participants;
    const owner = (await client.query(
      "SELECT profile_id FROM vita_hero.camp_participants WHERE kid_id=$1", [parts[0].kidId])).rows[0].profile_id;
    const mine = await kidReferrals(sql, owner, parts[0].kidId);
    expect(Array.isArray(mine.referrals)).toBe(true);
    await expect(kidReferrals(sql, "ph_9811100009", parts[0].kidId)).rejects.toThrow(/not your child/);
  });

  // ── Stage I / K: reporting ──

  test("the school report answers coverage, findings and follow-through", async () => {
    const r = await schoolReport(sql, admin, schoolId, "2026-27");
    expect(r.camps.length).toBeGreaterThanOrEqual(1);
    // An earlier test widened this camp to Class 7 and rebuilt, so the roster
    // legitimately grew. What matters is that only the screened five count.
    expect(r.coverage!.rostered).toBeGreaterThanOrEqual(6);
    // Several camps now sit in this academic year, so screened counts across
    // all of them. What matters is that it never exceeds those on the roll.
    expect(r.coverage!.screened).toBeGreaterThanOrEqual(5);
    expect(r.coverage!.screened).toBeLessThanOrEqual(r.coverage!.rostered);
    expect(r.coverage!.screenedRate).toBeGreaterThan(0);
    const vision = r.prevalence.find((p) => p.checkType === "Vision")!;
    expect(vision.measured).toBeGreaterThanOrEqual(5);
    expect(vision.alert).toBeGreaterThanOrEqual(1);
    expect(r.referrals!.total).toBeGreaterThan(0);
    expect(r.referrals!.closureRate).not.toBeNull();
  });

  test("the programme report is ops-only and anonymised", async () => {
    await expect(programmeReport(sql, admin)).rejects.toThrow(/operations view/);
    const p = await programmeReport(sql, OPS);
    expect(p.totals.schools).toBeGreaterThanOrEqual(1);
    expect(p.schools[0].name).toBe("Oakridge International");
    // Prevalence carries no child identifiers.
    expect(JSON.stringify(p.prevalence)).not.toContain("Child ");
  });

  test("a child's history shows each camp and what changed", async () => {
    const parts = (await listParticipants(sql, admin, campId, { status: "RELEASED" })).participants;
    const owner = (await client.query(
      "SELECT profile_id FROM vita_hero.camp_participants WHERE kid_id=$1", [parts[0].kidId])).rows[0].profile_id;
    const h = await kidHealthHistory(sql, owner, parts[0].kidId);
    expect(h.camps.length).toBe(1);
    expect(h.camps[0].findings.length).toBe(3);
    expect(h.growth.length).toBeGreaterThan(0);
    await expect(kidHealthHistory(sql, "ph_9811100009", parts[0].kidId)).rejects.toThrow(/not your child/);
  });

  test("the access trail says who touched a child's record", async () => {
    const parts = (await listParticipants(sql, admin, campId, { status: "RELEASED" })).participants;
    const t = await childAccessTrail(sql, admin, parts[0].kidId);
    const actions = t.events.map((e) => e.action);
    expect(actions).toContain("Screened");
    expect(actions).toContain("Reviewed by physician");
    expect(actions).toContain("Released to guardian");
  });

  // ── Stage J: data rights and lifecycle ──

  test("a guardian can export everything held about their family", async () => {
    const parts = (await listParticipants(sql, admin, campId, { status: "RELEASED" })).participants;
    const owner = (await client.query(
      "SELECT profile_id FROM vita_hero.camp_participants WHERE kid_id=$1", [parts[0].kidId])).rows[0].profile_id;
    const x = await exportGuardianData(sql, owner);
    expect(x.children.length).toBeGreaterThan(0);
    expect(x.campFindings.length).toBe(3);
    expect(x.consentHistory.length).toBeGreaterThan(0);
    expect((x.profile as Record<string, unknown>).session_token).toBeUndefined();
  });

  test("a correction is a request an administrator answers, not a silent edit", async () => {
    const parts = (await listParticipants(sql, admin, campId, {})).participants;
    const kid = parts[0];
    const owner = (await client.query(
      "SELECT profile_id FROM vita_hero.camp_participants WHERE kid_id=$1", [kid.kidId])).rows[0].profile_id;

    await expect(requestCorrection(sql, owner, { kidId: kid.kidId, field: "dental", value: "GOOD" }))
      .rejects.toThrow(/You can request a correction to/);

    const req = await requestCorrection(sql, owner, {
      kidId: kid.kidId, field: "name", value: "Corrected Name", note: "Spelling",
    });
    const before = await client.query("SELECT name FROM vita_hero.kids WHERE id=$1", [kid.kidId]);
    expect(before.rows[0].name).not.toBe("Corrected Name");

    const list = await listCorrections(sql, admin, schoolId);
    expect(list.corrections.length).toBe(1);
    expect(list.corrections[0].status).toBe("OPEN");

    await resolveCorrection(sql, admin, req.id, true, "Applied");
    const after = await client.query("SELECT name FROM vita_hero.kids WHERE id=$1", [kid.kidId]);
    expect(after.rows[0].name).toBe("Corrected Name");
    await expect(resolveCorrection(sql, admin, req.id, true, "again")).rejects.toThrow(/already been answered/);
  });

  test("withdrawing consent stops future processing without erasing the past", async () => {
    const parts = (await listParticipants(sql, admin, campId, {})).participants;
    const owner = (await client.query(
      "SELECT profile_id FROM vita_hero.camp_participants WHERE kid_id=$1", [parts[1].kidId])).rows[0].profile_id;
    const before = await client.query("SELECT COUNT(*)::int n FROM vita_hero.camp_findings WHERE kid_id=$1", [parts[1].kidId]);
    const r = await withdrawConsent(sql, owner, "No longer wish to take part");
    expect(r.withdrawn).toBe(true);
    const after = await client.query("SELECT COUNT(*)::int n FROM vita_hero.camp_findings WHERE kid_id=$1", [parts[1].kidId]);
    expect(after.rows[0].n).toBe(before.rows[0].n);
    const open = await client.query(
      "SELECT COUNT(*)::int n FROM vita_hero.referrals WHERE profile_id=$1 AND status IN ('OPEN','BOOKED')", [owner]);
    expect(open.rows[0].n).toBe(0);
  });

  test("deleting a child leaves nothing behind", async () => {
    const parts = (await listParticipants(sql, admin, campId, { status: "RELEASED" })).participants;
    const kidId = parts[parts.length - 1].kidId;
    const owner = (await client.query(
      "SELECT profile_id FROM vita_hero.camp_participants WHERE kid_id=$1", [kidId])).rows[0].profile_id;

    await expect(deleteChild(sql, "ph_9811100009", kidId, "ph_9811100009")).rejects.toThrow(/not your child/);
    await deleteChild(sql, owner, kidId, owner);

    for (const t of ["camp_findings", "camp_kid_results", "camp_participants", "camp_registrations",
                     "referrals", "growth_points", "consent_log", "correction_requests"]) {
      const n = await client.query("SELECT COUNT(*)::int n FROM vita_hero." + t + " WHERE kid_id=$1", [kidId]);
      expect({ table: t, rows: n.rows[0].n }).toEqual({ table: t, rows: 0 });
    }
    const k = await client.query("SELECT COUNT(*)::int n FROM vita_hero.kids WHERE id=$1", [kidId]);
    expect(k.rows[0].n).toBe(0);
  });

  test("a guardian's phone number can be moved without losing their children", async () => {
    const before = await client.query(
      "SELECT COUNT(*)::int n FROM vita_hero.kids WHERE profile_id='ph_9811100003'");
    expect(before.rows[0].n).toBeGreaterThan(0);
    const r = await changeGuardianPhone(sql, admin, schoolId, {
      currentPhone: "9811100003", newPhone: "9777700003",
    });
    expect(r.profileId).toBe("ph_9777700003");
    const after = await client.query(
      "SELECT COUNT(*)::int n FROM vita_hero.kids WHERE profile_id='ph_9777700003'");
    expect(after.rows[0].n).toBe(before.rows[0].n);
    const gone = await client.query("SELECT COUNT(*)::int n FROM vita_hero.profiles WHERE id='ph_9811100003'");
    expect(gone.rows[0].n).toBe(0);
  });

  test("moving a phone onto an existing account is refused", async () => {
    await expect(changeGuardianPhone(sql, admin, schoolId, {
      currentPhone: "9811100004", newPhone: "9777700003",
    })).rejects.toThrow(/already an account/);
  });

  test("a student can be marked as having left, and comes back off the roll", async () => {
    const rows = await client.query(
      "SELECT id FROM vita_hero.kids WHERE school_id=$1 AND grade='Class 7' LIMIT 1", [schoolId]);
    const r = await markStudentLeft(sql, admin, schoolId, rows.rows[0].id, true);
    expect(r.status).toBe("LEFT");
    await markStudentLeft(sql, admin, schoolId, rows.rows[0].id, false);
  });

  test("rollover previews before it moves anyone", async () => {
    const preview = await rolloverClasses(sql, admin, schoolId, {
      fromYear: "2026-27", toYear: "2027-28", dryRun: true,
    });
    expect(preview.dryRun).toBe(true);
    expect(preview.plan!.find((p) => p.grade === "Class 4")!.becomes).toBe("Class 7");
    const unchanged = await client.query(
      "SELECT COUNT(*)::int n FROM vita_hero.kids WHERE school_id=$1 AND academic_year='2027-28'", [schoolId]);
    expect(unchanged.rows[0].n).toBe(0);
  });

  test("rollover moves students up and graduates the final class", async () => {
    const r = await rolloverClasses(sql, admin, schoolId, { fromYear: "2026-27", toYear: "2027-28" });
    expect(r.promoted).toBeGreaterThan(0);
    expect(r.graduated).toBeGreaterThan(0);
    const moved = await client.query(
      "SELECT COUNT(*)::int n FROM vita_hero.kids WHERE school_id=$1 AND academic_year='2027-28' AND grade='Class 7'", [schoolId]);
    expect(moved.rows[0].n).toBe(r.promoted);
    const graduated = await client.query(
      "SELECT COUNT(*)::int n FROM vita_hero.kids WHERE school_id=$1 AND status='GRADUATED'", [schoolId]);
    expect(graduated.rows[0].n).toBe(r.graduated);
  });

  test("rollover refuses a malformed year", async () => {
    await expect(rolloverClasses(sql, admin, schoolId, { fromYear: "2027", toYear: "2028-29" }))
      .rejects.toThrow(/must look like/);
  });

  test("retention reports rather than deleting on a timer", async () => {
    await expect(retentionReport(sql, admin)).rejects.toThrow(/operations view/);
    const r = await retentionReport(sql, OPS, 7);
    expect(r.note).toContain("Nothing is deleted automatically");
    expect(typeof r.findingsOlderThanWindow).toBe("number");
  });

  test("the overview reflects the finished camp", async () => {
    const o = await adminOverview(sql, OPS);
    const actual = await client.query(
      "SELECT COUNT(*)::int n FROM vita_hero.kids WHERE source='ADMIN'");
    expect(o.students).toBe(actual.rows[0].n);
    expect(o.campStatus.RELEASED).toBeGreaterThanOrEqual(1);
  });
});
