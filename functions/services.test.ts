// Photographs, the question channel, the library and billing — against a real
// Postgres, on top of a real screening.
//
// These four were built last, and each one carries a rule that matters more
// than the feature does:
//
//   * a photograph is impossible without photography consent, which is asked
//     separately from consent to the check-up itself;
//   * a school administrator cannot open a photograph of a child;
//   * no clinical result, referral or data right can ever sit behind a plan.
//
// The tests below are written to fail loudly if any of those stop holding.
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
  recordConsent,
  setAttendance,
  saveScreening,
  reviewParticipant,
  releaseCamp,
  addStaffMember,
  assignCampStaff,
  pendingConsents,
} from "./camps";
import { ensureReferralSchema } from "./referrals";
import { ensureLifecycleSchema } from "./lifecycle";
import {
  ensureMediaSchema,
  uploadFindingPhoto,
  listFindingPhotos,
  getFindingPhoto,
  deleteFindingPhoto,
  photoAccessTrail,
  setCampPhotos,
  guardianPhotos,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS_PER_CHILD,
} from "./media";
import {
  ensureMessageSchema,
  askQuestion,
  questionPolicy,
  guardianThreads,
  threadMessages,
  replyToThread,
  schoolThreads,
  setQuestionsEnabled,
} from "./messages";
import {
  ensureLibrarySchema,
  seedLibraryIfEmpty,
  libraryForGuardian,
  getArticle,
  listArticles,
  upsertArticle,
} from "./library";
import {
  ensureSymptomSchema,
  symptomOptions,
  recordSymptom,
  kidSymptoms,
  deleteSymptom,
  symptomHistoryForClinician,
  SYMPTOMS,
} from "./symptoms";
import {
  ensureBillingSchema,
  setContract,
  getContract,
  generateInvoice,
  listInvoices,
  setInvoiceStatus,
  entitlements,
  requireFeature,
  setParentPlan,
  billingSummary,
  PAYWALLABLE,
} from "./billing";

const URL = process.env.TEST_DATABASE_URL;

function URL2(base: string, db: string): string {
  const u = new globalThis.URL(base);
  u.pathname = "/" + db;
  return u.toString();
}
const suite = URL ? describe : describe.skip;

let client: pg.Client;
let sql: Sql;
const noSms = async () => true;

function neonShim(c: pg.Client): Sql {
  const q = (s: string) => '"' + s.replace(/"/g, '""') + '"';
  const fn: any = (strings: TemplateStringsArray | string, ...values: unknown[]) => {
    if (typeof strings === "string") return { __ident: strings };
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

/** The handful of legacy tables these modules join against. */
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
}

beforeAll(async () => {
  if (!URL) return;
  const admin = new pg.Client({ connectionString: URL });
  await admin.connect();
  await admin.query("DROP DATABASE IF EXISTS vh_test_services");
  await admin.query("CREATE DATABASE vh_test_services");
  await admin.end();
  client = new pg.Client({ connectionString: URL2(URL, "vh_test_services") });
  await client.connect();
  sql = neonShim(client);
  await client.query("DROP SCHEMA IF EXISTS vita_hero CASCADE");
  await legacySchema(sql);
  await ensureStageASchema(sql);
  await ensureCampSchema(sql);
  await ensureReferralSchema(sql);
  await ensureLifecycleSchema(sql);
  await ensureMediaSchema(sql);
  await ensureMessageSchema(sql);
  await ensureLibrarySchema(sql);
  await seedLibraryIfEmpty(sql);
  await ensureBillingSchema(sql);
  await ensureSymptomSchema(sql);
});
afterAll(async () => { if (client) await client.end(); });

/** N days before today, as YYYY-MM-DD. The symptom log only accepts real dates. */
const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

/** A tiny but structurally valid PNG, as base64. */
const PNG_1PX =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const students = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    "Admission No": "2027/" + (200 + i),
    "Student Name": "Pupil " + i,
    "Date of Birth": "12/06/2015",
    Gender: i % 2 ? "F" : "M",
    Class: "Class 5",
    Section: "A",
    "Guardian Name": "Parent " + i,
    "Guardian Phone": String(9700000000 + i),
  }));

suite("photographs, questions, library and billing", () => {
  let schoolId = "";
  let campId = "";
  let kidIds: string[] = [];
  let guardianIds: string[] = [];
  let screener: Actor;
  let physician: Actor;
  let schoolAdmin: Actor;

  test("a school, a roster and a camp exist", async () => {
    const r = await createSchool(sql, OPS, {
      name: "Silver Oaks", city: "Hyderabad", academicYear: "2027-28",
      checksOffered: ["Height & weight", "Vision", "Dental", "Skin"],
    });
    schoolId = r.school.id;
    await setClasses(sql, OPS, schoolId, {
      academicYear: "2027-28", grades: ["Class 5"], sections: ["A"],
    });
    const rep = await commitRoster(sql, OPS, schoolId, { rows: students(6), filename: "roll.csv" });
    expect(rep.create).toBe(6);

    const rows = await client.query(
      "SELECT id, profile_id FROM vita_hero.kids WHERE school_id=$1 ORDER BY name", [schoolId]);
    kidIds = rows.rows.map((r) => r.id);
    guardianIds = rows.rows.map((r) => r.profile_id);
    expect(kidIds.length).toBe(6);

    const admin = await addSchoolAdmin(sql, OPS, schoolId, { name: "Latha K", phone: "9123499001" });
    schoolAdmin = { profileId: admin.admin.profileId, name: "Latha K", role: "SCHOOL_ADMIN", schoolId };

    const c = await createCamp(sql, OPS, schoolId, {
      title: "Annual check-up", date: "2027-09-10", academicYear: "2027-28",
      grades: ["Class 5"], sections: ["A"],
      checks: ["Height & weight", "Vision", "Dental", "Skin"],
    });
    campId = c.camp.id;
    await buildCampRoster(sql, OPS, campId);

    const s1 = await addStaffMember(sql, OPS, schoolId, { name: "Nurse Devi", phone: "9123499002", role: "SCREENER" });
    const s2 = await addStaffMember(sql, OPS, schoolId, { name: "Dr Rao", phone: "9123499003", role: "PHYSICIAN" });
    screener = { profileId: s1.staff.profileId, name: "Nurse Devi", role: "SCREENER", schoolId };
    physician = { profileId: s2.staff.profileId, name: "Dr Rao", role: "PHYSICIAN", schoolId };
    await assignCampStaff(sql, OPS, campId, { profileId: screener.profileId, role: "SCREENER" });
    await assignCampStaff(sql, OPS, campId, { profileId: physician.profileId, role: "PHYSICIAN" });
  });

  // ── Photographs ───────────────────────────────────────────

  test("photography is off until someone deliberately turns it on", async () => {
    const before = await client.query(
      "SELECT photos_enabled FROM vita_hero.school_camps WHERE id=$1", [campId]);
    expect(before.rows[0].photos_enabled).toBe(false);
  });

  test("a guardian is not asked about photographs while the camp has them off", async () => {
    const p = await pendingConsents(sql, guardianIds[0]);
    const mine = p.consents.find((c) => c.kidId === kidIds[0]);
    expect(mine).toBeTruthy();
    expect(mine!.photosAsked).toBe(false);
  });

  test("consenting to the check-up does not consent to photographs", async () => {
    await recordConsent(sql, campId, kidIds[0], "GRANTED", {
      actorId: guardianIds[0], source: "APP", profileId: guardianIds[0],
      checks: ["Height & weight", "Vision", "Dental", "Skin"],
    });
    const row = await client.query(
      "SELECT consent_status, consent_photos FROM vita_hero.camp_participants WHERE camp_id=$1 AND kid_id=$2",
      [campId, kidIds[0]]);
    expect(row.rows[0].consent_status).toBe("GRANTED");
    expect(row.rows[0].consent_photos).toBe(false);
  });

  test("a photo is refused while the camp has photography switched off", async () => {
    await setAttendance(sql, screener, campId, kidIds[0], "PRESENT");
    await expect(uploadFindingPhoto(sql, screener, campId, kidIds[0], {
      checkType: "Skin", mime: "image/png", data: PNG_1PX,
    })).rejects.toThrow(/switched off/i);
  });

  test("with photography on, a photo is still refused without photo consent", async () => {
    await setCampPhotos(sql, OPS, campId, true);
    const p = await pendingConsents(sql, guardianIds[1]);
    expect(p.consents.find((c) => c.kidId === kidIds[1])!.photosAsked).toBe(true);

    await expect(uploadFindingPhoto(sql, screener, campId, kidIds[0], {
      checkType: "Skin", mime: "image/png", data: PNG_1PX,
    })).rejects.toThrow(/not to photographs/i);
  });

  test("photo consent is a separate yes, and then the photo is accepted", async () => {
    await recordConsent(sql, campId, kidIds[1], "GRANTED", {
      actorId: guardianIds[1], source: "APP", profileId: guardianIds[1],
      checks: ["Height & weight", "Vision", "Dental", "Skin"],
      consentPhotos: true,
    });
    await setAttendance(sql, screener, campId, kidIds[1], "PRESENT");
    const up = await uploadFindingPhoto(sql, screener, campId, kidIds[1], {
      checkType: "Skin", mime: "image/png", data: PNG_1PX, caption: "Patch on left forearm",
    });
    expect(up.bytes).toBeGreaterThan(0);
    const list = await listFindingPhotos(sql, screener, campId, kidIds[1]);
    expect(list.photos.length).toBe(1);
    expect(list.photos[0].caption).toBe("Patch on left forearm");
  });

  test("declining the check-up clears any photo consent", async () => {
    await recordConsent(sql, campId, kidIds[2], "DECLINED", {
      actorId: guardianIds[2], source: "APP", profileId: guardianIds[2],
      consentPhotos: true,
    });
    const row = await client.query(
      "SELECT consent_photos FROM vita_hero.camp_participants WHERE camp_id=$1 AND kid_id=$2",
      [campId, kidIds[2]]);
    expect(row.rows[0].consent_photos).toBe(false);
  });

  test("a school administrator cannot open a photograph of a child", async () => {
    const list = await listFindingPhotos(sql, physician, campId, kidIds[1]);
    const photoId = list.photos[0].id;
    await expect(getFindingPhoto(sql, { actor: schoolAdmin }, photoId))
      .rejects.toThrow(/clinical team and the child's guardian only/i);
  });

  test("the clinical team can, and every look is recorded", async () => {
    const list = await listFindingPhotos(sql, physician, campId, kidIds[1]);
    const photoId = list.photos[0].id;
    const got = await getFindingPhoto(sql, { actor: physician }, photoId);
    expect(got.base64.length).toBeGreaterThan(20);
    expect(got.mime).toBe("image/png");

    const trail = await photoAccessTrail(sql, physician, campId, kidIds[1]);
    expect(trail.views.length).toBeGreaterThan(0);
    expect(trail.views[0].role).toBe("PHYSICIAN");
    expect(trail.views[0].name).toBe("Dr Rao");
  });

  test("another family's guardian cannot open it", async () => {
    const list = await listFindingPhotos(sql, physician, campId, kidIds[1]);
    await expect(getFindingPhoto(sql, { guardianProfileId: guardianIds[3] }, list.photos[0].id))
      .rejects.toThrow(/not your child/i);
  });

  test("an oversized image is refused before it reaches the database", async () => {
    const big = btoa("x".repeat(MAX_PHOTO_BYTES + 10));
    await expect(uploadFindingPhoto(sql, screener, campId, kidIds[1], {
      checkType: "Skin", mime: "image/jpeg", data: big,
    })).rejects.toThrow(/Shrink it/i);
  });

  test("a non-image type is refused", async () => {
    await expect(uploadFindingPhoto(sql, screener, campId, kidIds[1], {
      checkType: "Skin", mime: "application/pdf", data: PNG_1PX,
    })).rejects.toThrow(/Photos must be one of/i);
  });

  test("photography cannot be switched off to hide photos already taken", async () => {
    await expect(setCampPhotos(sql, OPS, campId, false)).rejects.toThrow(/already been taken/i);
  });

  test("the per-child ceiling holds", async () => {
    for (let i = 1; i < MAX_PHOTOS_PER_CHILD; i++) {
      await uploadFindingPhoto(sql, screener, campId, kidIds[1], {
        checkType: "Skin", mime: "image/png", data: PNG_1PX,
      });
    }
    await expect(uploadFindingPhoto(sql, screener, campId, kidIds[1], {
      checkType: "Skin", mime: "image/png", data: PNG_1PX,
    })).rejects.toThrow(/at most/i);
    const extra = await listFindingPhotos(sql, screener, campId, kidIds[1]);
    await deleteFindingPhoto(sql, screener, extra.photos[extra.photos.length - 1].id);
  });

  test("the guardian sees nothing until the results are released, then sees their own", async () => {
    const before = await guardianPhotos(sql, guardianIds[1], kidIds[1]);
    expect(before.photos.length).toBe(0);

    await saveScreening(sql, screener, campId, kidIds[1], {
      measurements: { heightCm: 132, weightKg: 28 },
      findings: [
        { checkType: "Vision", flag: "WATCH", note: "Squints at the far chart" },
        { checkType: "Skin", flag: "WATCH", note: "Dry patch, left forearm" },
      ],
    });
    await reviewParticipant(sql, physician, campId, kidIds[1], {
      recommendation: "Book an eye test within a month. Keep an eye on the dry patch.",
      urgency: "SOON",
      findings: [
        { checkType: "Vision", flag: "WATCH" },
        { checkType: "Skin", flag: "WATCH" },
      ],
    }, noSms);
    await releaseCamp(sql, OPS, campId, noSms);

    const after = await guardianPhotos(sql, guardianIds[1], kidIds[1]);
    expect(after.photos.length).toBeGreaterThan(0);
    expect(after.photos[0].campTitle).toBe("Annual check-up");

    const one = await getFindingPhoto(sql, { guardianProfileId: guardianIds[1] }, after.photos[0].id);
    expect(one.base64.length).toBeGreaterThan(20);
  });

  // ── The question channel ──────────────────────────────────

  test("the compose box is told what this channel is and is not", async () => {
    const p = await questionPolicy(sql, guardianIds[1]);
    expect(p.available).toBe(true);
    expect(p.responseWindowDays).toBeGreaterThan(0);
    expect(p.notice).toMatch(/not monitored around the clock/i);
    expect(p.notice).toMatch(/call your doctor|hospital/i);
  });

  test("a question without the not-urgent acknowledgement is refused", async () => {
    await expect(askQuestion(sql, guardianIds[1], "Parent 1", {
      schoolId, body: "Should I take her to an eye doctor?",
    })).rejects.toThrow(/not an emergency/i);
  });

  test("an acknowledged question opens a thread with a stated reply window", async () => {
    const r = await askQuestion(sql, guardianIds[1], "Parent 1", {
      schoolId, kidId: kidIds[1], notUrgentAcknowledged: true,
      body: "The report says WATCH for vision. Should I take her to an eye doctor?",
    });
    expect(r.status).toBe("OPEN");
    expect(r.expectedReplyWithinDays).toBeGreaterThan(0);
  });

  test("asking again lands in the same thread rather than starting a queue", async () => {
    const first = await guardianThreads(sql, guardianIds[1]);
    expect(first.threads.length).toBe(1);
    await askQuestion(sql, guardianIds[1], "Parent 1", {
      schoolId, notUrgentAcknowledged: true, body: "Also, is the dental result normal for her age?",
    });
    const second = await guardianThreads(sql, guardianIds[1]);
    expect(second.threads.length).toBe(1);
    expect(second.threads[0].messages).toBe(2);
  });

  test("a guardian cannot read another family's thread", async () => {
    const t = await guardianThreads(sql, guardianIds[1]);
    await expect(threadMessages(sql, { profileId: guardianIds[3] }, t.threads[0].id))
      .rejects.toThrow(/not your question/i);
  });

  test("the school queue puts what is waiting on them first, with the wait in days", async () => {
    const q = await schoolThreads(sql, schoolAdmin, schoolId, "");
    expect(q.enabled).toBe(true);
    expect(q.counts.waiting_on_us).toBe(1);
    expect(q.threads[0].awaiting).toBe("SCHOOL");
    expect(typeof q.threads[0].waitingDays).toBe("number");
  });

  test("the channel cannot be switched off while a family is still waiting", async () => {
    await expect(setQuestionsEnabled(sql, schoolAdmin, schoolId, false))
      .rejects.toThrow(/still waiting on you/i);
  });

  test("answering hands the thread back to the family", async () => {
    const q = await schoolThreads(sql, schoolAdmin, schoolId, "");
    const id = q.threads[0].id;
    await replyToThread(sql, schoolAdmin, id, {
      body: "Dr Rao suggests an eye test within a month. We can share the referral letter.",
    });
    const t = await threadMessages(sql, { profileId: guardianIds[1] }, id);
    expect(t.thread.status).toBe("ANSWERED");
    expect(t.thread.awaiting).toBe("GUARDIAN");
    expect(t.messages[t.messages.length - 1].side).toBe("SCHOOL");
  });

  test("once nothing is waiting, the school may close the channel honestly", async () => {
    const r = await setQuestionsEnabled(sql, schoolAdmin, schoolId, false);
    expect(r.questionsEnabled).toBe(false);
    await expect(askQuestion(sql, guardianIds[1], "Parent 1", {
      schoolId, notUrgentAcknowledged: true, body: "One more thing about the dental note.",
    })).rejects.toThrow(/not taking questions/i);
    await setQuestionsEnabled(sql, schoolAdmin, schoolId, true);
  });

  test("an administrator of another school cannot read this school's queue", async () => {
    const other: Actor = { profileId: "ph_x", name: "Other", role: "SCHOOL_ADMIN", schoolId: "sch_other" };
    await expect(schoolThreads(sql, other, schoolId, "")).rejects.toThrow();
  });

  // ── The library ───────────────────────────────────────────

  test("the seeded library is present in more than one language", async () => {
    const all = await listArticles(sql, OPS);
    expect(all.articles.length).toBeGreaterThan(5);
    const locales = new Set(all.articles.map((a) => a.locale));
    expect(locales.has("en")).toBe(true);
    expect(locales.has("hi")).toBe(true);
  });

  test("reading is chosen from this child's own released findings", async () => {
    const lib = await libraryForGuardian(sql, guardianIds[1], "en");
    expect(lib.forYou.length).toBeGreaterThan(0);
    const vision = lib.forYou.find((a: any) => a.checkTypes.includes("Vision"));
    expect(vision).toBeTruthy();
    expect((vision as any).because.kidName).toBe("Pupil 1");
    expect(lib.general.length).toBeGreaterThan(0);
  });

  test("a family with no findings gets the general shelf only", async () => {
    const lib = await libraryForGuardian(sql, guardianIds[4], "en");
    expect(lib.forYou.length).toBe(0);
    expect(lib.general.length).toBeGreaterThan(0);
  });

  test("an unknown language falls back rather than returning nothing", async () => {
    const lib = await libraryForGuardian(sql, guardianIds[1], "fr");
    expect(lib.locale).toBe("en");
    expect(lib.general.length).toBeGreaterThan(0);
  });

  test("an article outside the child's age band is not suggested", async () => {
    await upsertArticle(sql, OPS, {
      slug: "teen-vision", locale: "en", title: "Screens and eyes in the teenage years",
      summary: "For older students.",
      body: "Long hours on a screen tire the eyes. Ask your teenager to look away from the screen every twenty minutes and rest their eyes on something far away.",
      checkTypes: ["Vision"], flags: ["WATCH"], minAge: 13, maxAge: 18,
    });
    const lib = await libraryForGuardian(sql, guardianIds[1], "en");
    expect(lib.forYou.find((a: any) => a.slug === "teen-vision")).toBeUndefined();
  });

  test("a school administrator cannot edit the library", async () => {
    await expect(upsertArticle(sql, schoolAdmin, {
      slug: "not-allowed", locale: "en", title: "No",
      body: "This should never be written because a school administrator is not a clinical editor of the library.",
    })).rejects.toThrow(/operations/i);
  });

  test("a single article can be fetched by slug", async () => {
    const a = await getArticle(sql, "teen-vision", "en");
    expect(a.article.title).toMatch(/teenage/i);
  });

  // ── Contracts, invoices and entitlements ──────────────────

  test("an invoice cannot be raised without a contract", async () => {
    await expect(generateInvoice(sql, OPS, schoolId, {})).rejects.toThrow(/no contract/i);
  });

  test("a paid contract needs a rate, and a free one bills nothing", async () => {
    await expect(setContract(sql, OPS, schoolId, { shape: "PER_STUDENT_YEAR", ratePaise: 0 }))
      .rejects.toThrow(/needs a rate/i);
    await setContract(sql, OPS, schoolId, { shape: "FREE", academicYear: "2027-28" });
    await expect(generateInvoice(sql, OPS, schoolId, {})).rejects.toThrow(/nothing to invoice/i);
  });

  test("a school administrator cannot set their own school's rate", async () => {
    await expect(setContract(sql, schoolAdmin, schoolId, { shape: "PER_STUDENT_YEAR", ratePaise: 15000 }))
      .rejects.toThrow(/operations/i);
  });

  test("an invoice bills only children whose results were actually released", async () => {
    await setContract(sql, OPS, schoolId, {
      shape: "PER_STUDENT_YEAR", ratePaise: 15000, academicYear: "2027-28",
    });
    const r = await generateInvoice(sql, OPS, schoolId, { academicYear: "2027-28" });
    // Six children are on the roster; exactly one was screened, reviewed and
    // released, so exactly one is billable.
    expect(r.lines.length).toBe(1);
    expect(r.lines[0].quantity).toBe(1);
    expect(r.lines[0].evidence).toMatch(/1 distinct child/);
    expect(r.invoice.subtotalPaise).toBe(15000);
    expect(r.invoice.subtotalRupees).toBe(150);
    expect(r.invoice.status).toBe("DRAFT");
  });

  test("the school can read its own contract and invoices", async () => {
    const c = await getContract(sql, schoolAdmin, schoolId);
    expect(c.contract!.shape).toBe("PER_STUDENT_YEAR");
    const list = await listInvoices(sql, schoolAdmin, schoolId);
    expect(list.invoices.length).toBe(1);
  });

  test("only recognised money is counted as paid", async () => {
    const list = await listInvoices(sql, OPS, schoolId);
    const id = list.invoices[0].id;
    let sum = await billingSummary(sql, OPS);
    expect(sum.invoices.paidRupees).toBe(0);
    expect(sum.invoices.draft).toBe(1);

    await setInvoiceStatus(sql, OPS, id, "SENT");
    sum = await billingSummary(sql, OPS);
    expect(sum.invoices.paidRupees).toBe(0);
    expect(sum.invoices.outstandingRupees).toBe(150);

    await setInvoiceStatus(sql, OPS, id, "PAID");
    sum = await billingSummary(sql, OPS);
    expect(sum.invoices.paidRupees).toBe(150);
    expect(sum.invoices.outstandingRupees).toBe(0);
  });

  // The rule this whole module exists to keep.

  test("care is free on every plan, and says so", async () => {
    const e = await entitlements(sql, guardianIds[1]);
    expect(e.plan).toBe("FREE");
    for (const [, allowed] of Object.entries(e.care)) expect(allowed).toBe(true);
    expect(e.notice).toMatch(/free and always will be/i);
  });

  test("nothing clinical appears on the list of things a plan may gate", async () => {
    const forbidden = [
      "CAMP_RESULTS", "REFERRALS", "CONSENT", "DATA_RIGHTS", "GROWTH_CHARTS",
      "ASK_THE_SCHOOL", "PHOTOS", "REPORT_PDF",
    ];
    for (const f of forbidden) {
      expect((PAYWALLABLE as readonly string[]).includes(f)).toBe(false);
    }
  });

  test("trying to gate a clinical feature is a server error, not a paywall", async () => {
    // A 402 here would mean a family was asked to pay to see a result. The
    // guard has to make that a bug report instead.
    await expect(requireFeature(sql, guardianIds[1], "CAMP_RESULTS"))
      .rejects.toThrow(/not a feature that may be gated/i);
    await expect(requireFeature(sql, guardianIds[1], "REFERRALS"))
      .rejects.toThrow(/not a feature that may be gated/i);
  });

  test("a convenience feature is gated, and a plan unlocks it", async () => {
    await expect(requireFeature(sql, guardianIds[1], "AI_DIET_COACH"))
      .rejects.toThrow(/VitaHero Plus/i);
    await setParentPlan(sql, OPS, guardianIds[1], "PLUS", "2099-01-01T00:00:00.000Z");
    expect(await requireFeature(sql, guardianIds[1], "AI_DIET_COACH")).toBe(true);
    const e = await entitlements(sql, guardianIds[1]);
    expect(e.features.AI_DIET_COACH).toBe(true);
    for (const [, allowed] of Object.entries(e.care)) expect(allowed).toBe(true);
  });

  test("an expired plan falls back to free without touching care", async () => {
    await setParentPlan(sql, OPS, guardianIds[1], "PLUS", "2020-01-01T00:00:00.000Z");
    const e = await entitlements(sql, guardianIds[1]);
    expect(e.plan).toBe("FREE");
    expect(e.features.AI_DIET_COACH).toBe(false);
    expect(e.care.campResults).toBe(true);
  });

  // ── Everyday illness, recorded by the parent ─────────────
  //
  // The boundary this feature exists to hold: a parent may record that their
  // child had a fever, and may not record a measurement or a diagnosis.

  test("the form says plainly that it is not a way to get help now", () => {
    const o = symptomOptions();
    expect(o.notice).toMatch(/not a way to get help now/i);
    expect(o.notice).toMatch(/take them to one/i);
    expect(o.symptoms.length).toBeGreaterThan(8);
  });

  test("a parent records an everyday illness against their own child", async () => {
    const r = await recordSymptom(sql, guardianIds[1], kidIds[1], {
      symptom: "Fever", severity: "MILD", startedOn: daysAgo(10),
      endedOn: daysAgo(8), note: "Settled with paracetamol", missedSchool: true,
    });
    expect(r.symptom).toBe("Fever");
    const list = await kidSymptoms(sql, guardianIds[1], kidIds[1]);
    expect(list.events.length).toBe(1);
    expect(list.events[0].missedSchool).toBe(true);
  });

  test("a complaint that can turn serious comes back with advice to see a doctor", async () => {
    const r = await recordSymptom(sql, guardianIds[1], kidIds[1], {
      symptom: "Loose motions", severity: "MODERATE", startedOn: daysAgo(7),
    });
    expect(r.advice).toMatch(/ORS/);
    expect(r.advice).toMatch(/see a doctor today/i);
  });

  test("only the listed complaints are accepted, so nobody enters a diagnosis", async () => {
    for (const bad of ["Diabetes", "Anaemia", "Asthma", "Height 132cm", ""]) {
      await expect(recordSymptom(sql, guardianIds[1], kidIds[1], {
        symptom: bad, startedOn: daysAgo(10),
      })).rejects.toThrow(/listed complaints/i);
    }
  });

  test("nothing in the list is a measurement or a diagnosis", () => {
    for (const s of SYMPTOMS) {
      expect(s).not.toMatch(/height|weight|bmi|vision|acuity|haemoglobin|hb\b/i);
    }
  });

  test("a free-text note is kept, but never in place of the complaint", async () => {
    const r = await recordSymptom(sql, guardianIds[1], kidIds[1], {
      symptom: "Cough", startedOn: daysAgo(6),
      note: "x".repeat(900),
    });
    const rows = await client.query(
      "SELECT symptom, note FROM vita_hero.symptom_events WHERE id=$1", [r.id]);
    expect(rows.rows[0].symptom).toBe("Cough");
    expect(rows.rows[0].note.length).toBe(500);
  });

  test("a date in the future, or older than a year, is refused", async () => {
    await expect(recordSymptom(sql, guardianIds[1], kidIds[1], {
      symptom: "Fever", startedOn: "2099-01-01",
    })).rejects.toThrow(/future/i);
    await expect(recordSymptom(sql, guardianIds[1], kidIds[1], {
      symptom: "Fever", startedOn: "2000-01-01",
    })).rejects.toThrow(/more than a year/i);
    await expect(recordSymptom(sql, guardianIds[1], kidIds[1], {
      symptom: "Fever", startedOn: "last tuesday",
    })).rejects.toThrow(/YYYY-MM-DD/);
  });

  test("an illness cannot have ended before it started", async () => {
    await expect(recordSymptom(sql, guardianIds[1], kidIds[1], {
      symptom: "Fever", startedOn: daysAgo(10), endedOn: daysAgo(12),
    })).rejects.toThrow(/before it started/i);
  });

  test("a parent cannot record against another family's child", async () => {
    await expect(recordSymptom(sql, guardianIds[3], kidIds[1], {
      symptom: "Fever", startedOn: daysAgo(10),
    })).rejects.toThrow(/not your child/i);
    await expect(kidSymptoms(sql, guardianIds[3], kidIds[1]))
      .rejects.toThrow(/not your child/i);
  });

  test("recording an illness does not touch a single clinical flag", async () => {
    const before = await client.query(
      "SELECT dental, eyesight, nutrition, overall_score FROM vita_hero.kids WHERE id=$1", [kidIds[1]]);
    await recordSymptom(sql, guardianIds[1], kidIds[1], {
      symptom: "Toothache", severity: "MODERATE", startedOn: daysAgo(5),
    });
    const after = await client.query(
      "SELECT dental, eyesight, nutrition, overall_score FROM vita_hero.kids WHERE id=$1", [kidIds[1]]);
    expect(after.rows[0]).toEqual(before.rows[0]);
    const findings = await client.query(
      "SELECT COUNT(*)::int AS n FROM vita_hero.camp_findings WHERE kid_id=$1 AND check_type='Dental'",
      [kidIds[1]]);
    // A toothache reported by a parent must not appear as a dental finding.
    expect(findings.rows[0].n).toBe(0);
  });

  test("the clinical team sees it as the family's account, clearly labelled", async () => {
    const h = await symptomHistoryForClinician(sql, physician, campId, kidIds[1]);
    expect(h.source).toBe("REPORTED_BY_GUARDIAN");
    expect(h.caution).toMatch(/not examined or confirmed/i);
    expect(h.events.length).toBeGreaterThan(0);
  });

  test("the school office cannot read a child's illness history", async () => {
    await expect(symptomHistoryForClinician(sql, schoolAdmin, campId, kidIds[1]))
      .rejects.toThrow(/clinical team and the child's guardian only/i);
  });

  test("a parent can delete what they wrote, and only what they wrote", async () => {
    const list = await kidSymptoms(sql, guardianIds[1], kidIds[1]);
    const id = list.events[0].id;
    await expect(deleteSymptom(sql, guardianIds[3], id)).rejects.toThrow(/not found/i);
    await deleteSymptom(sql, guardianIds[1], id);
    const after = await kidSymptoms(sql, guardianIds[1], kidIds[1]);
    expect(after.events.find((e) => e.id === id)).toBeUndefined();
  });

  test("a guardian's results stay readable on the free plan", async () => {
    // The end of the rule: after the plan lapsed, the released result is still
    // there. Nothing in the read path consults a plan at all.
    const photos = await guardianPhotos(sql, guardianIds[1], kidIds[1]);
    expect(photos.photos.length).toBeGreaterThan(0);
    const lib = await libraryForGuardian(sql, guardianIds[1], "en");
    expect(lib.forYou.length).toBeGreaterThan(0);
  });
});
