// VitaHero Neon DB Backend — Cloudflare Worker
// Connects to Neon Postgres (vita_hero schema) for all CRUD operations.
// Auth delegates to Neon Auth (Better Auth) for Google OAuth + email/password.
// Phone OTP via Twilio is independent.
// Updated: 2026-06-15 — email/password + Neon Auth social sign-in (idToken exchange, no callbackURL)
// Updated: 2026-09-17 — merged audit work deployed (schema v8, Firebase phone verify retained)

import { neon } from "@neondatabase/serverless";
import {
  DEFAULT_COUNTRY_CODE,
  Sql,
  buildStudentRef,
  deriveAge,
  insertRows,
  normalizePhone,
  parseNum,
  profileIdForPhone,
  programmeToday,
  rowField,
  slugify,
} from "./common";
import { surfaceOf, surfaceRefusal } from "./surfaces";
import {
  Actor,
  ApiError,
  ensureStageASchema,
  createSchool,
  getSchool,
  listSchools,
  updateSchool,
  listClasses,
  setClasses,
  addSchoolAdmin,
  listSchoolAdmins,
  removeSchoolAdmin,
  removeStaffMember,
  setSchoolArchived,
  schoolDeletionPreview,
  deleteSchool,
  grantOpsRole,
} from "./schools";
import {
  validateRoster,
  addStudent,
  commitRoster,
  listRoster,
  listRosterBatches,
} from "./roster";
import {
  ensureCampSchema,
  listCamps,
  listMyCamps,
  getCamp,
  createCamp,
  updateCamp,
  buildCampRoster,
  listParticipants,
  requestConsent,
  recordConsent,
  setAttendance,
  getScreeningForm,
  saveScreening,
  campReconciliation,
  reviewQueue,
  reviewDetail,
  reviewParticipant,
  releaseCamp,
  pendingConsents,
  guardianCampResult,
  adminOverview,
  addStaffMember,
  listStaff,
  assignCampStaff,
  removeCampStaff,
  assertCampAccess,
  campPack,
  saveScreeningBulk,
  canClinicianSignIn,
  assignDoctorToCamp,
  doctorCamps,
  setCampStaffActive,
} from "./camps";
import { adminAnalytics } from "./analytics";
import { makeSender, sendToMany, smsProvider, textbeeDevice } from "./messaging";
import { ensureOversightSchema, hospitalPerformance, recordAccessLog } from "./oversight";
import {
  ensureReferralSchema,
  guardianReferrals,
  markReferralBooked,
  markReferralAttended,
  declineReferral,
  recordReferralOutcome,
  referralDashboard,
  referralDetail,
  nudgeReferrals,
  kidReferrals,
  openReferralSpecialties,
} from "./referrals";
import {
  ensureLifecycleSchema,
  exportGuardianData,
  requestCorrection,
  listCorrections,
  resolveCorrection,
  withdrawConsent,
  deleteChild,
  deleteAccount,
  rolloverClasses,
  markStudentLeft,
  changeGuardianPhone,
  retentionReport,
  purgeBeyondRetention,
  dataRightsHistory,
  identityChallenge,
  confirmIdentity,
  acceptTerms,
  TERMS_VERSION,
} from "./lifecycle";
import {
  kidHealthHistory,
  schoolReport,
  programmeReport,
  childAccessTrail,
  guardianNudges,
} from "./reports";
import {
  ensureMediaSchema,
  uploadFindingPhoto,
  listFindingPhotos,
  getFindingPhoto,
  deleteFindingPhoto,
  photoAccessTrail,
  setCampPhotos,
  guardianPhotos,
} from "./media";
import {
  ensureMessageSchema,
  questionPolicy,
  askQuestion,
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
  deleteArticle,
} from "./library";
import {
  ensureBillingSchema,
  setContract,
  getContract,
  generateInvoice,
  getInvoice,
  listInvoices,
  setInvoiceStatus,
  entitlements,
  setParentPlan,
  billingSummary,
} from "./billing";
import {
  ensureSymptomSchema,
  symptomOptions,
  recordSymptom,
  kidSymptoms,
  deleteSymptom,
  symptomHistoryForClinician,
} from "./symptoms";
import {
  listHospitals,
  upsertHospital,
  deleteHospital,
  listDoctors,
  upsertDoctor,
  deleteDoctor,
  inviteStatus,
  inviteGuardians,
  campPeople,
  lookupPhone,
  listGuardians,
} from "./directory";
import { previewDemoData, purgeDemoData } from "./demo";
import { previewReset, resetProgramme } from "./reset";
import { migrate, SCHEMA_VERSION } from "./migrate";
import { servePrivacyPage, serveDataDeletionPage } from "./pages";
import { PORTAL_HTML, SERVICE_WORKER_JS, portalShellEtag } from "./portal";

const NEON_AUTH = "https://ep-super-tree-afp87aw4.neonauth.c-2.us-west-2.aws.neon.tech/neondb/auth";
const APP_ORIGIN = "https://kidhero.rork.app";
const APP_CALLBACK_URL = "https://kidhero.rork.app/auth/callback";
const OTP_EXPIRY_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;

// ── Closed-app configuration ──
// VitaHero is a closed, admin-provisioned app: parents log in by phone only and
// must have been imported by an admin first. Public self-signup is disabled.
const ANDROID_PACKAGE = "com.rork.vitahero";
const INVITE_EXPIRY_DAYS = 30;
const INVITE_RESEND_COOLDOWN_HOURS = 24;
const IMPORT_MAX_ROWS = 2000;

interface Env {
  DATABASE_URL: string;
  // Which SMS gateway this deployment uses: "twilio" or "textbee". Inferred
  // from whichever credentials are set when it is not named. See messaging.ts.
  SMS_PROVIDER?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  /** A number the Twilio account owns, or a Messaging Service SID (MG…). */
  TWILIO_FROM?: string;
  TEXTBEE_API_KEY?: string;
  TEXTBEE_DEVICE_ID?: string;
  TEXTBEE_BASE_URL?: string;
  TOOLKIT_URL?: string;
  TOOLKIT_SECRET_KEY?: string;
  // Admin import portal auth (bootstrap key; role-based admins also supported).
  ADMIN_API_KEY?: string;
  // HMAC key for stateless invite tokens.
  INVITE_SIGNING_KEY?: string;
  // Android App Links: comma-separated SHA-256 signing-cert fingerprints.
  ANDROID_CERT_SHA256?: string;
  // Play Store listing URL used as install fallback in the invite landing page.
  APP_PLAY_URL?: string;
  // Firebase Web API key used to validate phone-auth ID tokens server-side.
  FIREBASE_API_KEY?: string;
}

/**
 * Firebase Web API key for project vitahero-8c5c0 (public client identifier,
 * also shipped inside the Android app's google-services.json). Used by
 * /api/auth/phone/firebase-verify to validate on-device Firebase phone-auth
 * ID tokens; override with the FIREBASE_API_KEY binding if it ever rotates.
 */
const FIREBASE_WEB_API_KEY = "AIzaSyCRkecFBarBe-Z1TOPxk9eeohHhL-ZF1Kk";

// ─── Helpers ────────────────────────────────────────────────

function cors(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type,Authorization,Origin,Referer,X-Requested-With,X-Admin-Key");
  headers.set("Access-Control-Max-Age", "86400");
  return new Response(response.body, { status: response.status, headers });
}

function json(data: unknown, status = 200): Response {
  return cors(new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  }));
}

/**
 * The answer when a request carries an id that belongs to somebody else.
 *
 * These endpoints take the primary key from the request body — they are a sync
 * API, and the app mints ids offline. What was missing was the other half of
 * that bargain: the upserts said `ON CONFLICT (id) DO UPDATE SET profile_id =
 * EXCLUDED.profile_id` with nothing checking who owned the row first. Posting
 * a child id that was not yours moved that child, and every finding, referral
 * and photograph hanging off them, onto your account. Kid ids are built from
 * the guardian's number, the child's name and four random characters, so they
 * were not much of a secret either.
 *
 * Every one of those statements now carries an owner predicate, which makes a
 * conflict on someone else's row update nothing and return nothing. This is
 * what the route says when that happens.
 */
const NOT_YOURS = { error: "That record belongs to another account", code: "NOT_YOURS" };

function extractToken(request: Request): string {
  return (request.headers.get("Authorization") || "").replace("Bearer ", "");
}

function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

function generateOtp(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(100000 + (array[0] % 900000));
}

function sanitizeProfile(row: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!row) return null;
  const copy = { ...row };
  delete copy.session_token;
  return copy;
}

async function kidOwnedByProfile(
  sql: Sql,
  kidId: string,
  profileId: string
): Promise<boolean> {
  const rows = await sql`
    SELECT id FROM vita_hero.kids
    WHERE id = ${kidId} AND profile_id = ${profileId} LIMIT 1
  `;
  return rows.length > 0;
}

async function ensureSchema(sql: Sql): Promise<void> {
  await sql`CREATE SCHEMA IF NOT EXISTS vita_hero`;

  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      phone TEXT,
      name TEXT NOT NULL DEFAULT '',
      email TEXT,
      session_token TEXT,
      auth_provider TEXT,
      onboarding_complete BOOLEAN DEFAULT false,
      is_logged_in BOOLEAN DEFAULT false,
      dark_theme BOOLEAN DEFAULT false,
      locale_code TEXT DEFAULT 'en',
      family_code TEXT DEFAULT '',
      notifications_enabled BOOLEAN DEFAULT true,
      camp_reminders_enabled BOOLEAN DEFAULT true,
      consent_accepted BOOLEAN DEFAULT false,
      consent_declined BOOLEAN DEFAULT false,
      read_notification_ids JSONB DEFAULT '[]'::jsonb
    )
  `;

  await sql`
    ALTER TABLE vita_hero.profiles
    ADD COLUMN IF NOT EXISTS read_notification_ids JSONB DEFAULT '[]'::jsonb
  `;

  // Closed-app: roles + admin provisioning of parents.
  await sql`ALTER TABLE vita_hero.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'PARENT'`;
  await sql`ALTER TABLE vita_hero.profiles ADD COLUMN IF NOT EXISTS provisioned BOOLEAN DEFAULT false`;
  await sql`ALTER TABLE vita_hero.profiles ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ`;
  await sql`ALTER TABLE vita_hero.profiles ADD COLUMN IF NOT EXISTS invite_count INT DEFAULT 0`;
  await sql`ALTER TABLE vita_hero.profiles ADD COLUMN IF NOT EXISTS school_id TEXT`;

  // One row per signed-in device.
  //
  // A session used to be a single column on the profile, which made signing in
  // an act that silently destroyed every other sign-in for that person. See
  // `authenticateSession` for what that did to the app.
  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.sessions (
      token TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      device TEXT DEFAULT ''
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS sessions_profile ON vita_hero.sessions(profile_id, revoked_at)`;
  await sql`CREATE INDEX IF NOT EXISTS sessions_expiry ON vita_hero.sessions(expires_at)`;

  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.phone_otps (
      phone TEXT PRIMARY KEY,
      otp TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      attempts INT DEFAULT 0,
      last_sent_at TIMESTAMPTZ
    )
  `;

  await sql`
    ALTER TABLE vita_hero.phone_otps
    ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.kids (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      user_id TEXT,
      name TEXT NOT NULL,
      age INT DEFAULT 0,
      gender TEXT DEFAULT '',
      school TEXT DEFAULT '',
      grade TEXT DEFAULT '',
      height_cm DOUBLE PRECISION DEFAULT 0,
      weight_kg DOUBLE PRECISION DEFAULT 0,
      avatar_color BIGINT DEFAULT 0,
      overall_score INT DEFAULT 80,
      dental TEXT DEFAULT 'GOOD',
      eyesight TEXT DEFAULT 'GOOD',
      nutrition TEXT DEFAULT 'GOOD',
      last_checkup TEXT DEFAULT 'Not yet'
    )
  `;

  // Closed-app: stable identity for idempotent re-imports + provenance.
  await sql`ALTER TABLE vita_hero.kids ADD COLUMN IF NOT EXISTS student_ref TEXT`;
  await sql`ALTER TABLE vita_hero.kids ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'PARENT'`;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS kids_profile_studentref
    ON vita_hero.kids(profile_id, student_ref) WHERE student_ref IS NOT NULL
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.appointments (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      user_id TEXT,
      doctor_name TEXT NOT NULL,
      doctor_id TEXT,
      specialty TEXT DEFAULT '',
      kid_name TEXT DEFAULT '',
      date TEXT NOT NULL,
      time TEXT NOT NULL
    )
  `;

  await sql`ALTER TABLE vita_hero.appointments ADD COLUMN IF NOT EXISTS doctor_id TEXT`;

  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.camps (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      user_id TEXT,
      title TEXT NOT NULL,
      school TEXT DEFAULT '',
      date TEXT NOT NULL,
      time TEXT DEFAULT '',
      status TEXT DEFAULT 'DRAFT',
      checks JSONB DEFAULT '[]'::jsonb,
      result_summary TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.meal_items (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      user_id TEXT,
      kid_id TEXT NOT NULL,
      time_slot TEXT DEFAULT '',
      name TEXT NOT NULL,
      detail TEXT DEFAULT '',
      kcal INT DEFAULT 0,
      eaten BOOLEAN DEFAULT false
    )
  `;
  // Which day a meal belongs to.
  //
  // There was no such column, and nothing ever deleted a row, so a meal plan
  // only grew: every custom snack a parent added stayed in the set for good
  // and came back as part of today's plan, still ticked. The read had no
  // filter and no limit either, so a family two years in was downloading
  // thousands of rows on every launch and uploading them again on every sync.
  await sql`ALTER TABLE vita_hero.meal_items ADD COLUMN IF NOT EXISTS day TEXT DEFAULT ''`;
  // What is already there is somebody's plan as it stands, so it becomes
  // today's rather than vanishing. Runs once: after this nothing is blank.
  await sql`
    UPDATE vita_hero.meal_items SET day = ${programmeToday()} WHERE COALESCE(day, '') = ''
  `;
  await sql`CREATE INDEX IF NOT EXISTS meal_items_profile_day ON vita_hero.meal_items(profile_id, day)`;

  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.streaks (
      kid_id TEXT PRIMARY KEY,
      user_id TEXT,
      current_streak INT DEFAULT 0,
      best_streak INT DEFAULT 0,
      last_log_date TEXT DEFAULT ''
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.growth_points (
      id TEXT PRIMARY KEY,
      kid_id TEXT NOT NULL,
      user_id TEXT,
      label TEXT DEFAULT '',
      height DOUBLE PRECISION DEFAULT 0,
      weight DOUBLE PRECISION DEFAULT 0,
      recorded_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.co_parents (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      user_id TEXT,
      name TEXT NOT NULL,
      relation TEXT DEFAULT '',
      joined_date TEXT DEFAULT ''
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.doctors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      specialty TEXT NOT NULL,
      hospital TEXT DEFAULT '',
      city TEXT DEFAULT 'Hyderabad',
      rating DOUBLE PRECISION DEFAULT 4.5,
      active BOOLEAN DEFAULT true
    )
  `;


  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.ai_diet_tips (
      kid_id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      content JSONB NOT NULL,
      generated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.schools (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      city TEXT DEFAULT 'Hyderabad',
      district TEXT DEFAULT '',
      partner_code TEXT NOT NULL UNIQUE,
      contact_email TEXT DEFAULT '',
      description TEXT DEFAULT '',
      active BOOLEAN DEFAULT true
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.school_enrollments (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      school_id TEXT NOT NULL,
      kid_id TEXT,
      status TEXT DEFAULT 'ACTIVE',
      enrolled_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (profile_id, school_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.school_camps (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      date TEXT NOT NULL,
      time TEXT DEFAULT '',
      status TEXT DEFAULT 'DRAFT',
      checks JSONB DEFAULT '[]'::jsonb,
      grades JSONB DEFAULT '[]'::jsonb,
      capacity INT DEFAULT 200,
      registered_count INT DEFAULT 0,
      result_summary TEXT,
      active BOOLEAN DEFAULT true
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.camp_registrations (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      school_camp_id TEXT NOT NULL,
      kid_id TEXT NOT NULL,
      registered_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (profile_id, school_camp_id, kid_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.camp_kid_results (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      school_camp_id TEXT NOT NULL,
      kid_id TEXT NOT NULL,
      dental TEXT DEFAULT 'GOOD',
      eyesight TEXT DEFAULT 'GOOD',
      nutrition TEXT DEFAULT 'GOOD',
      height_cm DOUBLE PRECISION,
      weight_kg DOUBLE PRECISION,
      recorded_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (school_camp_id, kid_id)
    )
  `;

  // Closed-app: admin import audit + SMS invite ledger.
  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.import_batches (
      id TEXT PRIMARY KEY,
      admin_id TEXT DEFAULT '',
      filename TEXT DEFAULT '',
      total INT DEFAULT 0,
      created INT DEFAULT 0,
      updated INT DEFAULT 0,
      skipped INT DEFAULT 0,
      errors INT DEFAULT 0,
      invited INT DEFAULT 0,
      dry_run BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.sms_log (
      id TEXT PRIMARY KEY,
      phone TEXT NOT NULL,
      type TEXT DEFAULT 'INVITE',
      status TEXT DEFAULT 'SENT',
      sent_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await ensureHospitalPartnerships(sql);
  await ensureHotPathIndexes(sql);
}

/**
 * Indexes for the queries this app actually runs.
 *
 * Measured against a district-sized database — 40,000 guardians, 60,000
 * children, 240,000 meal rows — every one of these was a sequential scan:
 *
 *   authenticating a request          4.9 ms  ->  0.1 ms
 *   a parent's children on launch     5.9 ms  ->  0.1 ms
 *   a parent's meals on launch       16.5 ms  ->  0.1 ms
 *   one child's growth points        10.9 ms  ->  0.1 ms
 *   a school's children for a camp    8.7 ms  ->  0.0 ms
 *
 * The first of those runs on every single authenticated request, and a
 * sequential scan is linear: at four times the size it is four times the cost,
 * on a serverless database billed for the compute. Opening the app makes about
 * eight of these calls.
 *
 * Deliberately not one index per column. Every index is maintained on write,
 * and a camp day is write-heavy: measured, carrying these costs about 8µs per
 * inserted row, which is nothing against a 16ms scan on every read, but the
 * same reasoning stops at the leading column of queries that are actually hot.
 * Secondary filters like `status` and `active` are left to the heap.
 */
async function ensureHotPathIndexes(sql: Sql): Promise<void> {
  // Authentication, on every request. Partial, because most rows have no
  // token: it is the most-used index in the system and one of the smallest.
  await sql`CREATE INDEX IF NOT EXISTS profiles_session_token
            ON vita_hero.profiles(session_token) WHERE session_token IS NOT NULL`;

  // Opening the app: the parent's children, and everything hanging off them.
  await sql`CREATE INDEX IF NOT EXISTS kids_profile ON vita_hero.kids(profile_id)`;
  await sql`CREATE INDEX IF NOT EXISTS meal_items_profile ON vita_hero.meal_items(profile_id)`;
  await sql`CREATE INDEX IF NOT EXISTS meal_items_kid ON vita_hero.meal_items(kid_id)`;
  await sql`CREATE INDEX IF NOT EXISTS growth_points_kid ON vita_hero.growth_points(kid_id)`;
  await sql`CREATE INDEX IF NOT EXISTS appointments_profile ON vita_hero.appointments(profile_id)`;
  await sql`CREATE INDEX IF NOT EXISTS co_parents_profile ON vita_hero.co_parents(profile_id)`;
  await sql`CREATE INDEX IF NOT EXISTS camps_profile ON vita_hero.camps(profile_id)`;
  await sql`CREATE INDEX IF NOT EXISTS camp_kid_results_kid ON vita_hero.camp_kid_results(kid_id)`;

  // Booking: the clash check that runs before every appointment is written.
  await sql`CREATE INDEX IF NOT EXISTS appointments_slot
            ON vita_hero.appointments(doctor_id, date, time)`;

  // kids_school_grade is created in ensureStageASchema instead, beside the
  // ALTER that adds kids.school_id. It lived here, one step earlier in
  // SCHEMA_STEPS than the column it indexes, which is fine on a database that
  // already has the column and fatal on an empty one: a brand-new deployment
  // could not build its own schema.
  await sql`CREATE INDEX IF NOT EXISTS school_camps_school ON vita_hero.school_camps(school_id, status)`;
  await sql`CREATE INDEX IF NOT EXISTS school_enrollments_school ON vita_hero.school_enrollments(school_id)`;
}

/**
 * Seed the starter doctor directory, once, on a database that has none.
 *
 * Separated from ensureSchema for the same reason as the library: that
 * function is now pure DDL, recorded and sent as a batch, and anything that
 * reads a result has to run on its own.
 */
async function seedDoctorsIfEmpty(sql: Sql): Promise<void> {
  const docCount = await sql`SELECT COUNT(*)::int AS c FROM vita_hero.doctors`;
  if ((docCount[0]?.c as number) === 0) {
    const doctors = [
      ["d1", "Dr. Ananya Rao", "Paediatrics", "Rainbow Children's Hospital", 4.9],
      ["d2", "Dr. Vikram Reddy", "Dental", "Apollo Cradle", 4.7],
      ["d3", "Dr. Meera Iyer", "Ophthalmology", "LV Prasad Eye Institute", 4.8],
      ["d4", "Dr. Karthik Nair", "Nutrition", "KIMS Hospital", 4.6],
      ["d5", "Dr. Priya Sharma", "General Paediatrics", "Continental Hospitals", 4.5],
    ] as const;
    await insertRows(
      sql,
      `INSERT INTO vita_hero.doctors (id, name, specialty, hospital, rating)
       SELECT v.id, v.name, v.specialty, v.hospital, v.rating::numeric
       FROM (VALUES %VALUES%) AS v(id, name, specialty, hospital, rating)
       ON CONFLICT (id) DO NOTHING`,
      doctors.map((d) => [...d])
    );
  }
}


function generateDoctorSlots(
  doctorId: string,
  bookedKeys: Set<string>,
): Array<{ date: string; time: string; label: string }> {
  const slots: Array<{ date: string; time: string; label: string }> = [];
  const now = new Date();
  const times = ["10:00 AM", "11:00 AM", "04:30 PM", "05:15 PM"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  for (let offset = 1; offset <= 21 && slots.length < 12; offset++) {
    const day = new Date(now);
    day.setDate(day.getDate() + offset);
    if (day.getDay() === 0) continue;
    const dateStr = `${String(day.getDate()).padStart(2, "0")} ${monthNames[day.getMonth()]} ${day.getFullYear()}`;
    const dayLabel = dayNames[day.getDay()];
    for (const time of times) {
      const key = `${doctorId}|${dateStr}|${time}`;
      if (bookedKeys.has(key)) continue;
      slots.push({
        date: dateStr,
        time,
        label: `${dayLabel}, ${time}`,
      });
      if (slots.length >= 12) break;
    }
  }
  return slots;
}

/**
 * The demo partner schools and their camps, once, on a database that has none.
 *
 * This used to be called from `ensureSchema`, which was wrong twice over.
 *
 * `ensureSchema` is pure DDL: it is handed a recorder that writes statements
 * down instead of running them, and reads come back empty. So the
 * `SELECT COUNT(*)` guard below always saw zero and never fired. The inserts
 * survived that only because they say DO NOTHING — which in turn meant an ops
 * user who deleted a demo school got it back the next time the schema version
 * moved, because by then the row it would have conflicted with was gone. A
 * school returning from the dead after somebody deliberately removed it is not
 * a cosmetic problem, and the console can delete schools now.
 *
 * Run as a seed step the read is real, the guard does its job, and the whole
 * thing is two statements rather than ten.
 */
export async function seedPartnerSchools(sql: Sql): Promise<void> {
  const schoolCount = await sql`SELECT COUNT(*)::int AS c FROM vita_hero.schools`;
  if ((schoolCount[0]?.c as number) > 0) return;

  const schools = [
    ["sch_oak", "Oakridge International School", "Hyderabad", "Gachibowli", "OAK2026", "health@oakridge.in", "Partner since 2024 · Full annual screening programme"],
    ["sch_dps", "Delhi Public School Hyderabad", "Hyderabad", "Khajaguda", "DPS2026", "nurse@dpshyd.com", "Vision, dental & nutrition camps every term"],
    ["sch_jgs", "Johnson Grammar School", "Hyderabad", "Habsiguda", "JGS2026", "wellness@jgs.edu.in", "IAP-aligned growth monitoring"],
    ["sch_chirec", "CHIREC International School", "Hyderabad", "Kondapur", "CHI2026", "health@chirec.in", "WHO growth charts integrated with camp results"],
  ];

  await insertRows(
    sql,
    `INSERT INTO vita_hero.schools (id, name, city, district, partner_code, contact_email, description)
     VALUES %VALUES% ON CONFLICT (id) DO NOTHING`,
    schools
  );

  const now = new Date();
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const d14 = new Date(now); d14.setDate(d14.getDate() + 14);
  const d28 = new Date(now); d28.setDate(d28.getDate() + 28);
  const d45 = new Date(now); d45.setDate(d45.getDate() + 45);
  const d60 = new Date(now); d60.setDate(d60.getDate() - 30);

  // The hospital each camp is run with, carried on the row rather than patched
  // in afterwards by a second pass over the same six ids.
  const camps: unknown[][] = [
    ["sc_oak_1", "sch_oak", "Annual Health & Growth Camp", "Full IAP screening: height, weight, BMI percentile, dental, vision, Hb", fmt(d14), "9:00 AM – 1:00 PM", "SCHEDULED", ["Height & weight", "Dental", "Vision", "Haemoglobin"], ["Class 1", "Class 2", "Class 3", "Class 4", "Class 5"], 250, null, "hosp_rainbow"],
    ["sc_oak_2", "sch_oak", "Nutrition & Anaemia Camp", "Focus on iron deficiency and BMI-for-age screening", fmt(d45), "10:00 AM – 12:30 PM", "SCHEDULED", ["Height & weight", "Haemoglobin"], ["Class 6", "Class 7", "Class 8"], 180, null, "hosp_kims"],
    ["sc_dps_1", "sch_dps", "Vision & Dental Screening", "School-wide eye and dental check for primary grades", fmt(d28), "8:30 AM – 12:00 PM", "SCHEDULED", ["Dental", "Vision"], ["Nursery", "Class 1", "Class 2", "Class 3"], 300, null, "hosp_lvp"],
    ["sc_jgs_1", "sch_jgs", "Growth Monitoring Day", "WHO/IAP growth charts with paediatrician review", fmt(d45), "9:00 AM – 2:00 PM", "SCHEDULED", ["Height & weight"], ["Class 4", "Class 5", "Class 6"], 200, null, "hosp_rainbow"],
    ["sc_chirec_1", "sch_chirec", "Comprehensive Health Camp", "Multi-specialty camp with follow-up booking", fmt(d14), "9:00 AM – 3:00 PM", "SCHEDULED", ["Height & weight", "Dental", "Vision"], ["All grades"], 400, null, "hosp_continental"],
    ["sc_oak_past", "sch_oak", "Mid-Term Dental Check", "Completed screening — 3 follow-ups recommended", fmt(d60), "10:00 AM – 12:00 PM", "COMPLETED", ["Dental"], ["Class 3", "Class 4"], 120, "142 children screened · 3 follow-ups recommended", "hosp_rainbow"],
  ];

  await insertRows(
    sql,
    `INSERT INTO vita_hero.school_camps
       (id, school_id, title, description, date, time, status, checks, grades, capacity, result_summary, hospital_id)
     SELECT v.id, v.school_id, v.title, v.description, v.date, v.time, v.status,
            v.checks::jsonb, v.grades::jsonb, v.capacity::int, v.result_summary, v.hospital_id
     FROM (VALUES %VALUES%) AS v(id, school_id, title, description, date, time, status,
                                 checks, grades, capacity, result_summary, hospital_id)
     ON CONFLICT (id) DO NOTHING`,
    camps.map((c) => [
      c[0], c[1], c[2], c[3], c[4], c[5], c[6],
      JSON.stringify(c[7]), JSON.stringify(c[8]), c[9], c[10], c[11],
    ])
  );
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function kidBmi(heightCm: number, weightKg: number): number {
  const m = heightCm / 100;
  return m > 0 ? weightKg / (m * m) : 0;
}


async function mergeCampResultsIntoKids(
  sql: Sql,
  profileId: string
): Promise<void> {
  // Projects released camp results onto the child's headline flags. Results are
  // written only by releaseCamp() in camps.ts, after a physician has approved
  // them — nothing is derived or guessed here.
  await sql`
    UPDATE vita_hero.kids k SET
      dental = COALESCE(l.dental, k.dental),
      eyesight = COALESCE(l.eyesight, k.eyesight),
      nutrition = COALESCE(l.nutrition, k.nutrition),
      last_checkup = COALESCE(l.camp_date, k.last_checkup),
      height_cm = CASE WHEN l.height_cm > 0 THEN l.height_cm ELSE k.height_cm END,
      weight_kg = CASE WHEN l.weight_kg > 0 THEN l.weight_kg ELSE k.weight_kg END,
      overall_score = CASE
        WHEN l.dental = 'ALERT' OR l.eyesight = 'ALERT' OR l.nutrition = 'ALERT' THEN LEAST(k.overall_score, 58)
        WHEN l.dental = 'WATCH' OR l.eyesight = 'WATCH' OR l.nutrition = 'WATCH' THEN LEAST(k.overall_score, 72)
        ELSE GREATEST(k.overall_score, 80)
      END
    FROM (
      SELECT DISTINCT ON (ckr.kid_id)
        ckr.kid_id,
        ckr.dental,
        ckr.eyesight,
        ckr.nutrition,
        ckr.height_cm,
        ckr.weight_kg,
        sc.date AS camp_date
      FROM vita_hero.camp_kid_results ckr
      JOIN vita_hero.school_camps sc ON sc.id = ckr.school_camp_id
      WHERE ckr.profile_id = ${profileId}
      ORDER BY ckr.kid_id, ckr.recorded_at DESC
    ) l
    WHERE k.id = l.kid_id AND k.profile_id = ${profileId}
  `;
}

async function callToolkitDietTip(
  env: Env,
  kid: Record<string, unknown>,
  meals: Record<string, unknown>[],
  streak: Record<string, unknown> | null
): Promise<Record<string, string> | null> {
  const toolkitUrl = (env.TOOLKIT_URL || "").replace(/\/$/, "");
  const toolkitKey = env.TOOLKIT_SECRET_KEY || "";
  if (!toolkitUrl || !toolkitKey) return null;

  const eatenCount = meals.filter((m) => m.eaten).length;
  const totalKcal = meals
    .filter((m) => m.eaten)
    .reduce((sum, m) => sum + (Number(m.kcal) || 0), 0);
  const mealNames = meals.map((m) => `${m.name} (${m.kcal} kcal)`).join(", ");
  const heightCm = Number(kid.height_cm) || 0;
  const weightKg = Number(kid.weight_kg) || 0;
  const currentStreak = Number(streak?.current_streak) || 0;
  const bestStreak = Number(streak?.best_streak) || 0;

  const systemPrompt = [
    "You are a pediatric nutrition coach for VitaHero, an Indian child health app.",
    "Give culturally relevant, actionable diet tips for Indian parents.",
    "Focus on Indian foods: dal, roti, rice, sabzi, idli, dosa, poha, paneer, ragi, curd, sprouts.",
    'Respond ONLY with valid JSON: {"greeting":"...", "insight":"...", "suggestion":"...", "funFact":"..."}',
    "Keep each field 1-2 sentences max. No markdown, no extra text.",
  ].join("\n");

  const userLines = [
    `Child: ${kid.name}, ${kid.age} years, ${kid.gender}`,
    `Height: ${heightCm} cm, Weight: ${weightKg} kg, Health Score: ${kid.overall_score}/100`,
    `Dental: ${kid.dental}, Nutrition: ${kid.nutrition}`,
    `Meals (${eatenCount}/${meals.length} eaten, ${totalKcal} kcal): ${mealNames}`,
    `Streak: ${currentStreak} days (best ${bestStreak})`,
  ];
  if (kid.nutrition === "WATCH") {
    userLines.push("Nutrition needs attention — suggest calorie-dense, iron and protein rich Indian foods.");
  }
  if (kid.nutrition === "ALERT") {
    userLines.push("Nutrition is a concern — recommend a balanced, fibre-rich Indian diet and a pediatric check-up.");
  }
  userLines.push("Generate a personalised Indian diet coaching tip as JSON.");

  const resp = await fetch(`${toolkitUrl}/v2/vercel/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${toolkitKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-4.1-nano",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userLines.join("\n") },
      ],
      temperature: 0.7,
      max_tokens: 400,
    }),
  });

  if (!resp.ok) return null;
  const data = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content?.trim() || "";
  if (!raw) return null;

  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    const jsonBlock = raw.includes("```")
      ? raw.split("```json").pop()?.split("```")[0]?.trim() || raw
      : raw;
    try {
      return JSON.parse(jsonBlock) as Record<string, string>;
    } catch {
      return null;
    }
  }
}

async function callToolkitFoodVision(
  env: Env,
  imageDataUrl: string
): Promise<Array<{ name: string; kcal: number; confidence: number }> | null> {
  const toolkitUrl = (env.TOOLKIT_URL || "").replace(/\/$/, "");
  const toolkitKey = env.TOOLKIT_SECRET_KEY || "";
  if (!toolkitUrl || !toolkitKey) return null;

  const systemPrompt = [
    "You are a food recognition assistant for VitaHero, an Indian child-nutrition app.",
    "Identify the edible food and drink items visible in the photo.",
    "Prefer specific names (e.g. 'Dates', 'Banana', 'Idli & Sambar', 'Dal & Rice', 'Curd Rice').",
    "Estimate calories (kcal) for a typical child-sized serving of what is shown.",
    "Return ONLY valid JSON of this exact shape, up to 5 items, most likely first:",
    '{"items":[{"name":"...","kcal":123,"confidence":0.0}]}',
    'confidence is 0.0-1.0. If no food is visible, return {"items":[]}. No markdown, no extra text.',
  ].join("\n");

  const resp = await fetch(`${toolkitUrl}/v2/vercel/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${toolkitKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Identify the foods in this photo and estimate calories. Respond as JSON only.",
            },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 500,
    }),
  });

  if (!resp.ok) return null;
  const data = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  let raw = data.choices?.[0]?.message?.content?.trim() || "";
  if (!raw) return null;
  if (raw.includes("```")) {
    raw =
      raw.split("```json").pop()?.split("```")[0]?.trim() ||
      raw.replace(/```/g, "").trim();
  }
  try {
    const parsed = JSON.parse(raw) as {
      items?: Array<{ name?: unknown; kcal?: unknown; confidence?: unknown }>;
    };
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    return items
      .map((it) => ({
        name: String(it.name || "").trim(),
        kcal: Math.max(0, Math.round(Number(it.kcal) || 0)),
        confidence: Math.min(1, Math.max(0, Number(it.confidence) || 0.6)),
      }))
      .filter((it) => it.name.length > 0)
      .slice(0, 5);
  } catch {
    return null;
  }
}

async function ensureHospitalPartnerships(sql: Sql): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.hospitals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      city TEXT DEFAULT 'Hyderabad',
      district TEXT DEFAULT '',
      address TEXT DEFAULT '',
      lat DOUBLE PRECISION,
      lng DOUBLE PRECISION,
      phone TEXT DEFAULT '',
      rating DOUBLE PRECISION DEFAULT 4.5,
      is_camp_partner BOOLEAN DEFAULT false,
      active BOOLEAN DEFAULT true
    )
  `;

  await sql`ALTER TABLE vita_hero.doctors ADD COLUMN IF NOT EXISTS hospital_id TEXT`;
  // A directory doctor had no phone number at all, which meant a family told
  // to see Dr X had no way to reach them and the console had nothing to show.
  // Nullable: a hospital's own switchboard is often the right number, and an
  // invented one is worse than none.
  await sql`ALTER TABLE vita_hero.doctors ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT ''`;
  await sql`ALTER TABLE vita_hero.school_camps ADD COLUMN IF NOT EXISTS hospital_id TEXT`;
}

/**
 * The hospitals and doctors a first-time reader of the console expects to see.
 *
 * These rows used to be written by ensureHospitalPartnerships, which is a DDL
 * step, with ON CONFLICT DO UPDATE on every column. Two consequences, both of
 * them live:
 *
 *   - An operations user who corrected a hospital's address or phone number
 *     had that correction reverted the next time the schema version moved.
 *     Nothing reported it; the edit simply went back to the seeded value.
 *   - Deleting a demonstration hospital or doctor was pointless, because the
 *     next migration put it back.
 *
 * It is a seed now: it only runs when the directory is empty, and only when
 * demonstration data has been asked for. The DDL it was living inside stays
 * where it was.
 */
async function seedDirectoryIfEmpty(sql: Sql): Promise<void> {
  const have = await sql`SELECT COUNT(*)::int AS c FROM vita_hero.hospitals`;
  if ((have[0]?.c as number) > 0) return;

  const hospitals = [
    ["hosp_rainbow", "Rainbow Children's Hospital", "Hyderabad", "Gachibowli", "Road No. 2, Gachibowli", 17.4401, 78.3489, "+91 40 4244 2222", 4.9, true],
    ["hosp_apollo", "Apollo Cradle & Children's Hospital", "Hyderabad", "Jubilee Hills", "Road No. 36, Jubilee Hills", 17.4239, 78.4738, "+91 40 2355 1234", 4.8, true],
    ["hosp_lvp", "LV Prasad Eye Institute", "Hyderabad", "Banjara Hills", "Kallam Anji Reddy Campus, Banjara Hills", 17.4125, 78.4482, "+91 40 3061 2345", 4.8, true],
    ["hosp_kims", "KIMS Hospital", "Hyderabad", "Secunderabad", "1-112 / 86, Survey No 5, Kondapur", 17.4399, 78.4983, "+91 40 4488 5000", 4.6, true],
    ["hosp_continental", "Continental Hospitals", "Hyderabad", "Gachibowli", "Plot No. 3, Road No. 2, Gachibowli", 17.4435, 78.3772, "+91 40 6700 0000", 4.7, true],
    ["hosp_smile", "Smile Care Dental Clinic", "Hyderabad", "Banjara Hills", "Road No. 12, Banjara Hills", 17.4158, 78.4487, "+91 40 2335 6789", 4.7, true],
    ["hosp_care", "Care Hospital", "Hyderabad", "Banjara Hills", "Road No. 10, Banjara Hills", 17.4122, 78.4489, "+91 40 3041 4141", 4.5, false],
    ["hosp_yashoda", "Yashoda Hospitals", "Hyderabad", "Somajiguda", "Raj Bhavan Road, Somajiguda", 17.4231, 78.4578, "+91 40 4567 4567", 4.6, false],
  ] as const;

  for (const [id, name, city, district, address, lat, lng, phone, rating, isPartner] of hospitals) {
    await sql`
      INSERT INTO vita_hero.hospitals
        (id, name, city, district, address, lat, lng, phone, rating, is_camp_partner)
      VALUES (${id}, ${name}, ${city}, ${district}, ${address}, ${lat}, ${lng}, ${phone}, ${rating}, ${isPartner})
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        city = EXCLUDED.city,
        district = EXCLUDED.district,
        address = EXCLUDED.address,
        lat = EXCLUDED.lat,
        lng = EXCLUDED.lng,
        phone = EXCLUDED.phone,
        rating = EXCLUDED.rating,
        is_camp_partner = EXCLUDED.is_camp_partner
    `;
  }

  const extraDoctors = [
    ["d6", "Dr. Lakshmi Devi", "Paediatrics", "Rainbow Children's Hospital", "hosp_rainbow", 4.8],
    ["d7", "Dr. Rohit Verma", "Ophthalmology", "Continental Hospitals", "hosp_continental", 4.7],
    ["d8", "Dr. Anjali Mehta", "Dental", "Smile Care Dental Clinic", "hosp_smile", 4.7],
    ["d9", "Dr. Suresh Kumar", "Nutrition", "Apollo Cradle & Children's Hospital", "hosp_apollo", 4.8],
    ["d10", "Dr. Deepa Singh", "General Paediatrics", "Care Hospital", "hosp_care", 4.5],
  ] as const;

  for (const [id, name, specialty, hospital, hospitalId, rating] of extraDoctors) {
    await sql`
      INSERT INTO vita_hero.doctors (id, name, specialty, hospital, hospital_id, rating)
      VALUES (${id}, ${name}, ${specialty}, ${hospital}, ${hospitalId}, ${rating})
      ON CONFLICT (id) DO UPDATE SET
        hospital_id = EXCLUDED.hospital_id,
        hospital = EXCLUDED.hospital
    `;
  }

  await sql`
    UPDATE vita_hero.doctors SET hospital_id = 'hosp_rainbow'
    WHERE id = 'd1' AND (hospital_id IS NULL OR hospital_id = '')
  `;
  await sql`
    UPDATE vita_hero.doctors SET hospital_id = 'hosp_apollo'
    WHERE id = 'd2' AND (hospital_id IS NULL OR hospital_id = '')
  `;
  await sql`
    UPDATE vita_hero.doctors SET hospital_id = 'hosp_lvp'
    WHERE id = 'd3' AND (hospital_id IS NULL OR hospital_id = '')
  `;
  await sql`
    UPDATE vita_hero.doctors SET hospital_id = 'hosp_kims'
    WHERE id = 'd4' AND (hospital_id IS NULL OR hospital_id = '')
  `;
  await sql`
    UPDATE vita_hero.doctors SET hospital_id = 'hosp_continental'
    WHERE id = 'd5' AND (hospital_id IS NULL OR hospital_id = '')
  `;
}


async function getFamilyOwnerId(
  sql: Sql,
  familyCode: string,
  fallbackProfileId: string
): Promise<string> {
  if (!familyCode) return fallbackProfileId;
  const owners = await sql`
    SELECT p.id FROM vita_hero.profiles p
    WHERE p.family_code = ${familyCode}
      AND EXISTS (SELECT 1 FROM vita_hero.kids k WHERE k.profile_id = p.id)
    ORDER BY p.id
    LIMIT 1
  `;
  if (owners.length > 0) return owners[0].id as string;
  const any = await sql`
    SELECT id FROM vita_hero.profiles
    WHERE family_code = ${familyCode}
    ORDER BY id
    LIMIT 1
  `;
  return (any[0]?.id as string) || fallbackProfileId;
}

function anonymizeLeaderboardName(name: string, rank: number, isYou: boolean): string {
  if (isYou) return name;
  return `Hero #${rank}`;
}

// ─── Session Auth ───────────────────────────────────────────

/**
 * How long a session lasts without being used. Every authenticated request
 * pushes it out again, so a parent who opens the app in term time is never
 * asked to sign in; one who last opened it two academic years ago is.
 */
const SESSION_TTL_DAYS = 180;

/**
 * Mint a session for a device.
 *
 * The bug this replaces: a session was a single `session_token` column on the
 * profile, so every sign-in overwrote the one before it. Signing in on a
 * second device, or simply signing in again after a while, invalidated the
 * token the first device was still holding — and the first device never found
 * out, because the app read the resulting 401 as "no data" and drew an empty
 * screen that looked like a loading failure. A parent with a phone and a
 * tablet could not have both working at once.
 *
 * `profiles.session_token` is still written: tokens minted before this table
 * existed are still in the field and are still honoured. It is now a record of
 * the most recent sign-in rather than the only one that works.
 */
async function mintSession(sql: Sql, profileId: string, device = ""): Promise<string> {
  const token = generateToken();
  const expires = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000).toISOString();
  try {
    await sql`
      INSERT INTO vita_hero.sessions (token, profile_id, expires_at, device)
      VALUES (${token}, ${profileId}, ${expires}, ${device.slice(0, 200)})
    `;
  } catch {
    // A database that has not run the migration yet: profiles.session_token
    // still carries this sign-in, so nobody is locked out by the gap.
  }
  return token;
}

/** Revoke one device's session. Logging out of a phone leaves the tablet alone. */
async function revokeSession(sql: Sql, token: string): Promise<void> {
  try {
    await sql`UPDATE vita_hero.sessions SET revoked_at = NOW() WHERE token = ${token}`;
  } catch { /* pre-migration database */ }
  await sql`
    UPDATE vita_hero.profiles
    SET session_token = NULL, is_logged_in = false
    WHERE session_token = ${token}
  `;
}

async function authenticateSession(
  sql: Sql,
  token: string
): Promise<{ profileId: string; userId: string; name: string; role: string; schoolId: string | null } | null> {
  if (!token || token.length < 30) return null;

  const shape = (r: Record<string, unknown>) => ({
    profileId: r.id as string,
    userId: (r.user_id as string) || "",
    name: r.name as string,
    role: (r.role as string) || "PARENT",
    schoolId: (r.school_id as string) || null,
  });

  try {
    const rows = await sql`
      SELECT p.id, p.user_id, p.name, p.role, p.school_id
      FROM vita_hero.sessions s
      JOIN vita_hero.profiles p ON p.id = s.profile_id
      WHERE s.token = ${token} AND s.revoked_at IS NULL AND s.expires_at > NOW()
      LIMIT 1
    `;
    if (rows.length > 0) {
      // Sliding expiry, best effort: a failed touch must never fail the request.
      Promise.resolve(
        sql`UPDATE vita_hero.sessions SET last_seen_at = NOW() WHERE token = ${token}`
      ).catch(() => {});
      return shape(rows[0]);
    }
  } catch {
    // The table is not there yet. Fall through to the column below, which is
    // where every token issued before this change lives.
  }

  try {
    const rows = await sql`
      SELECT id, user_id, name, role, school_id FROM vita_hero.profiles
      WHERE session_token = ${token} LIMIT 1
    `;
    if (rows.length === 0) return null;
    return shape(rows[0]);
  } catch {
    return null;
  }
}


// ─── Closed-app helpers (provisioning, admin auth, invites) ──


function b64urlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToString(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
}

async function hmacSign(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return b64urlEncode(sig);
}

/** Stateless, expiring invite token: base64url(payload).hmac. */
async function signInviteToken(last10: string, env: Env): Promise<string | null> {
  const secret = env.INVITE_SIGNING_KEY || env.ADMIN_API_KEY;
  if (!secret) return null;
  const payload = b64urlEncode(
    new TextEncoder().encode(
      JSON.stringify({ p: last10, exp: Date.now() + INVITE_EXPIRY_DAYS * 86400_000 })
    )
  );
  const sig = await hmacSign(payload, secret);
  return `${payload}.${sig}`;
}

async function verifyInviteToken(token: string, env: Env): Promise<string | null> {
  const secret = env.INVITE_SIGNING_KEY || env.ADMIN_API_KEY;
  if (!secret || !token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  const expected = await hmacSign(payload, secret);
  if (expected !== sig) return null;
  try {
    const data = JSON.parse(b64urlToString(payload)) as { p?: string; exp?: number };
    if (!data.p || !data.exp || Date.now() > data.exp) return null;
    return data.p;
  } catch {
    return null;
  }
}

/** Admin gate: ADMIN_API_KEY header (bootstrap) OR a role=ADMIN session. */
async function requireAdmin(
  request: Request,
  sql: Sql,
  env: Env
): Promise<{ adminId: string } | null> {
  const headerKey = request.headers.get("X-Admin-Key") || "";
  if (env.ADMIN_API_KEY && headerKey && headerKey === env.ADMIN_API_KEY) {
    return { adminId: "apikey" };
  }
  const session = await authenticateSession(sql, extractToken(request));
  if (session && (session.role === "ADMIN" || session.role === "SUPERADMIN")) {
    return { adminId: session.profileId };
  }
  return null;
}

/**
 * Resolve who is calling an administrative endpoint.
 *
 * The bootstrap API key acts as SUPERADMIN. Otherwise the session's own role
 * decides, and parents (or revoked administrators) are refused outright rather
 * than being allowed through to a per-school check that might pass.
 */
async function resolveActor(
  request: Request,
  sql: Sql,
  env: Env
): Promise<Actor | null> {
  const headerKey = request.headers.get("X-Admin-Key") || "";
  if (env.ADMIN_API_KEY && headerKey && headerKey === env.ADMIN_API_KEY) {
    return { profileId: "apikey", name: "VitaHero Ops", role: "SUPERADMIN", schoolId: null };
  }
  const session = await authenticateSession(sql, extractToken(request));
  if (!session) return null;
  const staffRoles = ["SCHOOL_ADMIN", "SCREENER", "PHYSICIAN", "ADMIN", "SUPERADMIN"];
  if (!staffRoles.includes(session.role)) return null;
  return {
    profileId: session.profileId,
    name: session.name,
    role: session.role,
    schoolId: session.schoolId,
  };
}

// ─── Admin import (CSV/Excel rows → provisioned data) ────────


function normHealthFlag(v: string): string {
  const s = (v || "").trim().toUpperCase();
  if (s === "GOOD" || s === "OK" || s === "NORMAL" || s === "FINE") return "GOOD";
  if (s === "WATCH" || s === "MONITOR" || s === "ATTENTION") return "WATCH";
  if (s === "ALERT" || s === "CRITICAL" || s === "REFER" || s === "BAD") return "ALERT";
  return "GOOD";
}


interface ImportRowResult {
  row: number;
  phone: string;
  student: string;
  status: "created" | "updated" | "skipped" | "error";
  message?: string;
}

interface ImportReport {
  batchId: string;
  dryRun: boolean;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  invited: number;
  uniqueParents: number;
  results: ImportRowResult[];
}

async function processImport(
  sql: Sql,
  env: Env,
  rows: Record<string, unknown>[],
  opts: { dryRun: boolean; sendInvites: boolean; filename: string; adminId: string; appOrigin: string }
): Promise<ImportReport> {
  const report: ImportReport = {
    batchId: `imp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    dryRun: opts.dryRun,
    total: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    invited: 0,
    uniqueParents: 0,
    results: [],
  };
  const uniquePhones = new Map<string, string>(); // last10 -> e164

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNo = i + 1;
    try {
      const rawPhone = rowField(row, "phone", "mobile", "mobilenumber", "phonenumber", "contact");
      const studentName = rowField(row, "studentname", "childname", "kidname", "student", "name");
      const norm = normalizePhone(rawPhone);
      if (!norm) {
        report.errors++;
        report.results.push({ row: rowNo, phone: rawPhone, student: studentName, status: "error", message: "Invalid phone number" });
        continue;
      }
      if (!studentName) {
        report.errors++;
        report.results.push({ row: rowNo, phone: norm.e164, student: "", status: "error", message: "Missing student name" });
        continue;
      }

      const parentName = rowField(row, "parentname", "guardianname", "parent", "fathername", "mothername") || "Parent";
      const gender = rowField(row, "gender", "sex");
      const grade = rowField(row, "grade", "class", "standard");
      const dob = rowField(row, "dob", "dateofbirth", "birthdate");
      const ageStr = rowField(row, "age");
      const age = deriveAge(dob, ageStr);
      const schoolCode = rowField(row, "schoolcode", "schoolid");
      const schoolName = rowField(row, "schoolname", "school");
      const campCode = rowField(row, "campcode", "campid");
      const campDate = rowField(row, "campdate", "date");
      const campTitle = rowField(row, "camptitle", "campname", "camp") || "Health Camp";
      const heightCm = parseNum(rowField(row, "heightcm", "height"));
      const weightKg = parseNum(rowField(row, "weightkg", "weight"));
      const dental = normHealthFlag(rowField(row, "dental", "teeth"));
      const eyesight = normHealthFlag(rowField(row, "eyesight", "vision", "eye"));
      const nutrition = normHealthFlag(rowField(row, "nutrition", "nutritionstatus"));
      const studentId = rowField(row, "studentid", "studentref", "rollno", "rollnumber", "admissionno");

      const profileId = profileIdForPhone(norm.last10);
      const studentRef = buildStudentRef(studentId, norm.last10, studentName, dob || ageStr);

      // Resolve / upsert school + camp identity (writes skipped on dry run).
      let schoolId = "";
      if (schoolCode || schoolName) {
        schoolId = schoolCode ? `sch_${slugify(schoolCode)}` : `sch_${slugify(schoolName)}`;
        if (!opts.dryRun) {
          await sql`
            INSERT INTO vita_hero.schools (id, name, partner_code, active)
            VALUES (${schoolId}, ${schoolName || schoolCode}, ${(schoolCode || slugify(schoolName)).toUpperCase()}, true)
            ON CONFLICT (id) DO UPDATE SET name = COALESCE(NULLIF(EXCLUDED.name, ''), vita_hero.schools.name)
          `;
        }
      }

      let campId = "";
      if (schoolId && (campCode || campDate || campTitle)) {
        campId = `sc_${schoolId}_${slugify(campCode || campDate || campTitle)}`;
        if (!opts.dryRun) {
          await sql`
            INSERT INTO vita_hero.school_camps (id, school_id, title, date, status, active)
            VALUES (${campId}, ${schoolId}, ${campTitle}, ${campDate || programmeToday()}, 'COMPLETED', true)
            ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title
          `;
        }
      }

      // Classify created vs updated by checking the kid's existence.
      const existingKid = await sql`
        SELECT id FROM vita_hero.kids WHERE profile_id = ${profileId} AND student_ref = ${studentRef} LIMIT 1
      `;
      const isNew = existingKid.length === 0;
      const kidId = isNew ? `k_${slugify(studentRef)}_${Math.random().toString(36).slice(2, 6)}` : (existingKid[0].id as string);

      if (!opts.dryRun) {
        // Provision the parent profile (no session, never downgrade an admin).
        await sql`
          INSERT INTO vita_hero.profiles (id, phone, name, user_id, auth_provider, role, provisioned, school_id, is_logged_in)
          VALUES (${profileId}, ${norm.e164}, ${parentName}, ${profileId}, 'PHONE', 'PARENT', true, ${schoolId || null}, false)
          ON CONFLICT (id) DO UPDATE SET
            provisioned = true,
            name = CASE WHEN vita_hero.profiles.name IN ('', 'Parent') THEN EXCLUDED.name ELSE vita_hero.profiles.name END,
            phone = EXCLUDED.phone,
            school_id = COALESCE(EXCLUDED.school_id, vita_hero.profiles.school_id)
        `;

        if (isNew) {
          await sql`
            INSERT INTO vita_hero.kids
              (id, profile_id, user_id, name, age, gender, school, grade, height_cm, weight_kg,
               dental, eyesight, nutrition, last_checkup, student_ref, source)
            VALUES (${kidId}, ${profileId}, ${profileId}, ${studentName}, ${age}, ${gender}, ${schoolName || ""}, ${grade},
                    ${heightCm ?? 0}, ${weightKg ?? 0}, ${dental}, ${eyesight}, ${nutrition},
                    ${campDate || "Camp"}, ${studentRef}, 'ADMIN')
          `;
        } else {
          await sql`
            UPDATE vita_hero.kids SET
              name = ${studentName}, age = ${age}, gender = ${gender},
              school = ${schoolName || ""}, grade = ${grade},
              height_cm = ${heightCm ?? 0}, weight_kg = ${weightKg ?? 0},
              dental = ${dental}, eyesight = ${eyesight}, nutrition = ${nutrition},
              last_checkup = ${campDate || "Camp"}, source = 'ADMIN'
            WHERE id = ${kidId}
          `;
        }

        // Seed a growth-history point from the camp measurement (height/weight only).
        // Idempotent: keyed by kid + measurement label so re-imports update in place.
        if (heightCm != null || weightKg != null) {
          const gpLabel = campDate || campTitle || "Camp";
          const gpId = `gp_${kidId}_${slugify(gpLabel)}`;
          await sql`
            INSERT INTO vita_hero.growth_points (id, kid_id, user_id, label, height, weight)
            VALUES (${gpId}, ${kidId}, ${profileId}, ${gpLabel}, ${heightCm ?? 0}, ${weightKg ?? 0})
            ON CONFLICT (id) DO UPDATE SET
              label = EXCLUDED.label, height = EXCLUDED.height, weight = EXCLUDED.weight, recorded_at = NOW()
          `;
        }

        if (campId) {
          await sql`
            INSERT INTO vita_hero.camp_registrations (id, profile_id, school_camp_id, kid_id)
            VALUES (${"reg_" + kidId + "_" + campId.slice(-6)}, ${profileId}, ${campId}, ${kidId})
            ON CONFLICT (profile_id, school_camp_id, kid_id) DO NOTHING
          `;
          await sql`
            INSERT INTO vita_hero.camp_kid_results
              (id, profile_id, school_camp_id, kid_id, dental, eyesight, nutrition, height_cm, weight_kg)
            VALUES (${"ckr_" + kidId + "_" + campId.slice(-6)}, ${profileId}, ${campId}, ${kidId},
                    ${dental}, ${eyesight}, ${nutrition}, ${heightCm}, ${weightKg})
            ON CONFLICT (school_camp_id, kid_id) DO UPDATE SET
              dental = EXCLUDED.dental, eyesight = EXCLUDED.eyesight, nutrition = EXCLUDED.nutrition,
              height_cm = EXCLUDED.height_cm, weight_kg = EXCLUDED.weight_kg, recorded_at = NOW()
          `;
        }
      }

      uniquePhones.set(norm.last10, norm.e164);
      if (isNew) report.created++; else report.updated++;
      report.results.push({ row: rowNo, phone: norm.e164, student: studentName, status: isNew ? "created" : "updated" });
    } catch (e) {
      report.errors++;
      report.results.push({
        row: rowNo,
        phone: "",
        student: "",
        status: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  report.uniqueParents = uniquePhones.size;

  // Send invites (only on a real run when requested).
  if (!opts.dryRun && opts.sendInvites) {
    const outcome = await sendInvitesForPhones(
      sql, env,
      [...uniquePhones].map(([last10, e164]) => ({ last10, e164 })),
      opts.appOrigin
    );
    report.invited += outcome.sent.length;
  }

  if (!opts.dryRun) {
    await sql`
      INSERT INTO vita_hero.import_batches
        (id, admin_id, filename, total, created, updated, skipped, errors, invited, dry_run)
      VALUES (${report.batchId}, ${opts.adminId}, ${opts.filename}, ${report.total},
              ${report.created}, ${report.updated}, ${report.skipped}, ${report.errors}, ${report.invited}, false)
    `;
  }

  return report;
}

/**
 * Invite a list of provisioned parents.
 *
 * This was one phone at a time, and each one cost four subrequests: read the
 * cooldown, send the text, log it, mark the profile. A roster import for a
 * school of two hundred families was eight hundred, which is past what the
 * platform allows, so the invites stopped partway through an import that
 * reported success.
 *
 * It also marked every number as invited whether the text went out or not, so
 * a school whose provider was misconfigured had its whole roster put behind
 * the resend cooldown without one message arriving.
 */
async function sendInvitesForPhones(
  sql: Sql,
  env: Env,
  numbers: Array<{ last10: string; e164: string }>,
  appOrigin: string,
  force = false
): Promise<{ sent: string[]; skipped: string[] }> {
  if (numbers.length === 0) return { sent: [], skipped: [] };

  const byProfile = new Map(numbers.map((n) => [profileIdForPhone(n.last10), n]));
  const ids = [...byProfile.keys()];
  const known = await sql`
    SELECT id, invited_at FROM vita_hero.profiles WHERE id = ANY(${ids})
  `;
  const invitedAt = new Map(known.map((r) => [r.id as string, r.invited_at as string | null]));

  const skipped: string[] = [];
  const due: Array<{ id: string; phone: string; last10: string }> = [];
  for (const [profileId, n] of byProfile) {
    const last = invitedAt.get(profileId);
    if (!force && last) {
      const elapsed = Date.now() - new Date(last).getTime();
      if (elapsed < INVITE_RESEND_COOLDOWN_HOURS * 3600_000) { skipped.push(n.e164); continue; }
    }
    due.push({ id: profileId, phone: n.e164, last10: n.last10 });
  }
  if (due.length === 0) return { sent: [], skipped };

  const tokens = await Promise.all(due.map((d) => signInviteToken(d.last10, env)));
  const linkFor = new Map(due.map((d, i) => [
    d.id,
    tokens[i] ? `${appOrigin}/i/${tokens[i]}` : (env.APP_PLAY_URL || appOrigin),
  ]));

  const outcome = await sendToMany(
    makeSender(env),
    due.map((d) => ({ id: d.id, phone: d.phone })),
    (r: { id: string; phone: string }) =>
      "VitaHero: your child's school health report is ready. Open the app and " +
      `sign in with this mobile number: ${linkFor.get(r.id)}`
  );

  const phoneOf = new Map(due.map((d) => [d.id, d.phone]));
  await insertRows(
    sql,
    `INSERT INTO vita_hero.sms_log (id, phone, type, status)
     SELECT v.id, v.phone, 'INVITE', v.status
     FROM (VALUES %VALUES%) AS v(id, phone, status)`,
    [
      ...outcome.sent.map((id: string) => [
        "sms_" + Math.random().toString(36).slice(2, 12), phoneOf.get(id), "SENT",
      ]),
      ...outcome.failed.map((f: { id: string }) => [
        "sms_" + Math.random().toString(36).slice(2, 12), phoneOf.get(f.id), "FAILED",
      ]),
    ]
  );

  // Only the ones that actually went. A failed send must not start the
  // cooldown, or the number can never be retried.
  if (outcome.sent.length > 0) {
    await sql`
      UPDATE vita_hero.profiles
      SET invited_at = NOW(), invite_count = COALESCE(invite_count, 0) + 1
      WHERE id = ANY(${outcome.sent})
    `;
  }
  for (const f of outcome.failed) skipped.push(phoneOf.get(f.id) || f.id);
  return { sent: outcome.sent.map((id: string) => phoneOf.get(id) || id), skipped };
}

interface NeonAuthUser {
  id: string;
  name?: string;
  email: string;
  emailVerified?: boolean;
}

interface NeonAuthSession {
  token: string;
}

interface NeonAuthResponse {
  user: NeonAuthUser;
  session?: NeonAuthSession;
  token?: string;
}

// ─── Neon Auth Helpers ─────────────────────────────────────

/** Call Neon Auth REST API. Returns parsed JSON or throws on error. */
async function callNeonAuth(
  path: string,
  body: Record<string, unknown>,
  request?: Request
): Promise<NeonAuthResponse> {
  const origin = request?.headers.get("Origin") || APP_ORIGIN;
  const url = `${NEON_AUTH}${path}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      Referer: `${origin}/`,
    },
    // Mobile/API flows: rely on Origin header only. Do not send callbackURL —
    // a relative callbackURL triggers MISSING_ORIGIN; an unlisted absolute URL
    // triggers INVALID_CALLBACKURL in Neon Auth.
    body: JSON.stringify(body),
  });
  const data = await resp.json() as Record<string, unknown>;
  if (!resp.ok) {
    const message =
      (data.message as string) ||
      (data.error as string) ||
      (typeof data === "object" && data !== null && "code" in data
        ? String((data as { code?: string }).code)
        : "") ||
      `Auth error (${resp.status})`;
    throw new Error(message);
  }
  return data as unknown as NeonAuthResponse;
}

/** Create or update a profile in vita_hero.profiles after Neon Auth success. */
async function upsertProfileFromNeonAuth(
  sql: Sql,
  user: NeonAuthUser,
  provider: string,
  role?: string
): Promise<{ profileId: string; sessionToken: string }> {
  const profileId = `na_${user.id.slice(0, 24)}`;
  const sessionToken = await mintSession(sql, profileId, provider);

  const existing = await sql`
    SELECT id FROM vita_hero.profiles WHERE id = ${profileId} LIMIT 1
  `;

  if (existing.length === 0) {
    await sql`
      INSERT INTO vita_hero.profiles
        (id, user_id, name, email, session_token, auth_provider,
         onboarding_complete, is_logged_in, role)
      VALUES (
        ${profileId}, ${user.id}, ${user.name || user.email.split('@')[0]},
        ${user.email}, ${sessionToken}, ${provider}, true, true, ${role || 'PARENT'}
      )
    `;
  } else {
    await sql`
      UPDATE vita_hero.profiles
      SET session_token = ${sessionToken}, is_logged_in = true,
          name = ${user.name || user.email.split('@')[0]},
          email = ${user.email}, auth_provider = ${provider},
          role = COALESCE(${role ?? null}, role)
      WHERE id = ${profileId}
    `;
  }

  return { profileId, sessionToken };
}

// ─── Entrypoint ─────────────────────────────────────────────

/**
 * Pure DDL, in dependency order. Recorded and shipped as a batch by migrate().
 * Nothing in here may read a query result — see migrate.ts for why.
 */
export const SCHEMA_STEPS = [
  ensureSchema,
  ensureStageASchema,
  ensureCampSchema,
  ensureReferralSchema,
  ensureLifecycleSchema,
  ensureMediaSchema,
  ensureMessageSchema,
  ensureLibrarySchema,
  ensureBillingSchema,
  ensureSymptomSchema,
  ensureOversightSchema,
];

/** Steps that have to read before they write. Only ever touch an empty table. */
// Demonstration data is opt-in now.
//
// Four fictional schools, six camps against them, four hospitals and five
// doctors are exactly what someone opening the console for the first time
// wants to see, and exactly what a district running a real programme does not:
// they sit among the real schools looking like real schools. Set
// SEED_DEMO_DATA=true on an evaluation deployment; leave it unset everywhere
// that matters.
//
// The reading library is not demo data — it is content a guardian is shown —
// so it is seeded regardless.
export function seedSteps(env: Env) {
  const demo = String((env as unknown as Record<string, unknown>).SEED_DEMO_DATA || "") === "true";
  return demo
    ? [seedDirectoryIfEmpty, seedDoctorsIfEmpty, seedPartnerSchools, seedLibraryIfEmpty]
    : [seedLibraryIfEmpty];
}

/** Per-isolate latch so schema init does not run on every request. */
let schemaReady = false;

/**
 * A list from a request body, refused rather than truncated when it is too big.
 *
 * Truncating would be worse than refusing: a screener's sync would come back
 * reporting success having written half a camp. The caps are far above any
 * real use — a camp is a few hundred children, an invite run is a school —
 * and exist because these lists cost a database statement or a text message
 * each, and nothing was stopping one request from asking for a hundred
 * thousand of either.
 */
const MAX_SYNC_ENTRIES = 2000;
const MAX_INVITE_PHONES = 1000;

function cappedList<T>(value: unknown, limit: number, what: string): T[] {
  if (!Array.isArray(value)) return [];
  if (value.length > limit) {
    throw new ApiError(413, `Too many ${what} in one request (limit ${limit})`, "TOO_MANY");
  }
  return value as T[];
}

/**
 * What a caller is told when something broke that was not their fault.
 *
 * These returned the raw exception message. A Postgres error carries the
 * table, the column, the constraint and often the value that tripped it, so a
 * 500 handed any signed-in parent a piece of the schema — and echoed back
 * whatever had been submitted. The detail goes to the log, where whoever is
 * on call can read it; the caller gets a sentence and a code.
 *
 * An ApiError is different and is passed through: those are written for the
 * person reading them, which is the whole reason the type exists.
 */
function serverError(e: unknown, where: string): Response {
  if (e instanceof ApiError) return json({ error: e.message, code: e.code }, e.status);
  console.error(`[${where}]`, e instanceof Error ? e.stack || e.message : String(e));
  return json({ error: "Something went wrong at our end", code: "SERVER_ERROR" }, 500);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));

    const url = new URL(request.url);
    const path = url.pathname;

    // ── Static pages required by Google Play ────────────
    //
    // The store listing and Data safety form link to these. They must answer
    // even if the database is unreachable, so they sit in front of it.
    if (path === "/privacy") return servePrivacyPage();
    if (path === "/data-deletion") return serveDataDeletionPage();

    const dbUrl = env.DATABASE_URL;

    if (!dbUrl) {
      return json({ error: "DATABASE_URL not configured" }, 500);
    }

    try {
      const sql = neon(dbUrl);

      // Schema init is idempotent but not free: it issues ~46 statements, and
      // with the Neon HTTP driver each one is its own round trip. Running it per
      // request put that cost in front of every single call. Once per isolate is
      // enough; a deploy-time migration would be better still.
      // The console's own HTML is served below, so a failure here used to take
      // out the page a founder would use to diagnose it. It is now cheap on a
      // migrated database (one query) and it reports what actually broke.
      if (!schemaReady) {
        try {
          await migrate(sql, SCHEMA_STEPS, seedSteps(env));
          schemaReady = true;
        } catch (schemaErr) {
          const detail = (schemaErr as Error)?.message || String(schemaErr);
          console.error("Schema init error:", schemaErr);
          return json({
            error: "Database schema initialization failed",
            detail,
            hint: "Run GET /api/admin/schema with the ops key for the full state.",
          }, 500);
        }
      }

      // ── Schema state, for when something like this happens again ──
      //
      // Behind the ops key, and it answers the question the generic error
      // could not: which version is this database at, and what broke.
      if (path === "/api/admin/schema") {
        const key = request.headers.get("X-Admin-Key") || "";
        if (!env.ADMIN_API_KEY || key !== env.ADMIN_API_KEY) {
          return json({ error: "Ops key required" }, 403);
        }
        try {
          const rows = await sql`SELECT version, migrated_at FROM vita_hero.schema_meta WHERE id = 1`;
          const tables = await sql`
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'vita_hero' ORDER BY table_name
          `;
          return json({
            expected: SCHEMA_VERSION,
            actual: Number(rows[0]?.version) || 0,
            migratedAt: rows[0]?.migrated_at ? String(rows[0].migrated_at) : null,
            upToDate: (Number(rows[0]?.version) || 0) >= SCHEMA_VERSION,
            tables: tables.map((t: Record<string, unknown>) => t.table_name as string),
          });
        } catch (e) {
          return json({ expected: SCHEMA_VERSION, actual: 0, error: (e as Error).message }, 500);
        }
      }

      // ── Health Check ─────────────────────────────────
      if (path === "/ping") {
        const rows = await sql`SELECT 1 AS ok, NOW() AS now`;
        return json({ ok: true, db: rows[0] });
      }

      // ── Android App Links verification ───────────────
      if (path === "/.well-known/assetlinks.json") {
        const fingerprints = (env.ANDROID_CERT_SHA256 || "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const body = [
          {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: {
              namespace: "android_app",
              package_name: ANDROID_PACKAGE,
              sha256_cert_fingerprints: fingerprints,
            },
          },
        ];
        return cors(new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }));
      }

      // ── Invite token → phone (app prefill) ───────────
      if (path === "/api/invite/resolve" && request.method === "GET") {
        const token = url.searchParams.get("token") || "";
        const last10 = await verifyInviteToken(token, env);
        if (!last10) return json({ valid: false }, 200);
        return json({ valid: true, phone: `+${DEFAULT_COUNTRY_CODE}${last10}`, last10 });
      }

      // ── Invite landing page (opened from SMS) ────────
      if (path.startsWith("/i/")) {
        const token = path.slice(3);
        const playUrl = env.APP_PLAY_URL || `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
        const deepLink = `vitahero://invite?token=${encodeURIComponent(token)}`;
        const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>VitaHero — Open your child's health report</title>
<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:0;background:#0EA5A4;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center}
.card{background:#fff;color:#0f172a;max-width:420px;margin:20px;padding:28px;border-radius:20px;box-shadow:0 10px 40px rgba(0,0,0,.2)}
h1{font-size:20px;margin:0 0 8px}p{color:#475569;line-height:1.5}
a.btn{display:block;text-align:center;background:#0EA5A4;color:#fff;text-decoration:none;padding:14px;border-radius:12px;font-weight:600;margin-top:16px}</style></head>
<body><div class="card"><h1>VitaHero</h1>
<p>Your child's school health report is ready. Install the app, then sign in with the mobile number this link was sent to.</p>
<a class="btn" href="${playUrl}">Get the app</a>
<a class="btn" style="background:#1e293b" href="${deepLink}">Open in app</a></div>
<script>try{window.location.href=${JSON.stringify(deepLink)};}catch(e){}</script>
</body></html>`;
        return cors(new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }));
      }

      // ═══════════════════════════════════════════════════
      // STAGE A — school administration portal + API
      // ═══════════════════════════════════════════════════

      // The console must open on a device that has been offline since it left
      // the office, so its shell is cached. Data still comes from the pack the
      // screener downloaded; this only guarantees the page itself loads.
      if (path === "/admin/sw.js") {
        return cors(new Response(SERVICE_WORKER_JS, {
          status: 200,
          headers: {
            "Content-Type": "application/javascript; charset=utf-8",
            "Cache-Control": "no-cache",
            "Service-Worker-Allowed": "/admin",
          },
        }));
      }

      // The console owns everything under /admin.
      //
      // Its screens have real addresses now — /admin/schools/sch_oak/roster —
      // and a refresh, a bookmark or a pasted link asks the server for that
      // path. Only /admin itself used to answer, so every one of those was a
      // 404 and the address bar could only hold a fragment the server never
      // sees. The same page answers for all of them and reads the path itself;
      // /admin/sw.js is handled above and is the one exception.
      if (path === "/admin" || path === "/admin/" || path.startsWith("/admin/")) {
        // no-cache means "check with me first", not "do not store". Paired with
        // a validator, a console that has not changed since the last visit is
        // answered with an empty 304 instead of 259 KiB of HTML, and a deploy
        // is still picked up on the very next load.
        const etag = portalShellEtag();
        const shellHeaders = {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache",
          ETag: etag,
        };
        if (request.headers.get("If-None-Match") === etag) {
          return cors(new Response(null, { status: 304, headers: shellHeaders }));
        }
        return cors(new Response(PORTAL_HTML, { status: 200, headers: shellHeaders }));
      }

      // ── Admin: referrals, corrections, lifecycle, reports ──
      if (path.startsWith("/api/admin/referrals") || path === "/api/admin/programme-report"
          || path === "/api/admin/retention" || path.startsWith("/api/admin/child/")) {
        const actor = await resolveActor(request, sql, env);
        if (!actor) return json({ error: "Administrator sign-in required", code: "ADMIN_REQUIRED" }, 401);
        const readBody = async (): Promise<Record<string, unknown>> => {
          try { return (await request.json()) as Record<string, unknown>; }
          catch { throw new ApiError(400, "Expected a JSON body", "BAD_JSON"); }
        };
        try {
          if (path === "/api/admin/programme-report" && request.method === "GET") {
            return json(await programmeReport(sql, actor));
          }
          if (path === "/api/admin/retention" && request.method === "POST") {
            const b = await readBody();
            return json(await purgeBeyondRetention(sql, actor,
              parseInt(String(b.years || "7"), 10), parseInt(String(b.confirm || "-1"), 10)));
          }
          if (path === "/api/admin/retention" && request.method === "GET") {
            return json(await retentionReport(sql, actor,
              parseInt(url.searchParams.get("years") || "7", 10)));
          }
          if (path.startsWith("/api/admin/child/")) {
            const kidId = decodeURIComponent(path.slice("/api/admin/child/".length).split("/")[0]);
            if (request.method === "GET") return json(await childAccessTrail(sql, actor, kidId));
            return json({ error: "Method not allowed" }, 405);
          }
          const refRest = path.slice("/api/admin/referrals".length).replace(/^\//, "");
          const refParts = refRest ? refRest.split("/").map(decodeURIComponent) : [];
          if (refParts.length === 1 && request.method === "GET") {
            return json(await referralDetail(sql, actor, refParts[0]));
          }
          if (refParts.length === 2 && refParts[1] === "outcome" && request.method === "POST") {
            return json(await recordReferralOutcome(sql, actor, refParts[0], await readBody()));
          }
          return json({ error: "Not found" }, 404);
        } catch (e) {
          return serverError(e, "api");
        }
      }

      // ── Admin: overview, my camps, camp operations ──
      if (path === "/api/admin/overview" || path === "/api/admin/analytics"
          || path === "/api/admin/sms-status"
          || path === "/api/admin/partners" || path === "/api/admin/access-log"
          || path.startsWith("/api/admin/doctor-camps/")
          || path === "/api/admin/my-camps"
          || path === "/api/admin/camps" || path.startsWith("/api/admin/camps/")) {
        const actor = await resolveActor(request, sql, env);
        if (!actor) {
          return json({ error: "Administrator sign-in required", code: "ADMIN_REQUIRED" }, 401);
        }
        const method = request.method;
        const readBody = async (): Promise<Record<string, unknown>> => {
          try { return (await request.json()) as Record<string, unknown>; }
          catch { throw new ApiError(400, "Expected a JSON body", "BAD_JSON"); }
        };
        const smsSender = makeSender(env);

        try {
          if (path === "/api/admin/overview" && method === "GET") {
            return json(await adminOverview(sql, actor));
          }
          if (path.startsWith("/api/admin/doctor-camps/") && method === "GET") {
            const docId = decodeURIComponent(path.slice("/api/admin/doctor-camps/".length));
            return json(await doctorCamps(sql, actor, docId));
          }
          if (path === "/api/admin/partners" && method === "GET") {
            return json(await hospitalPerformance(sql, actor, {
              schoolId: url.searchParams.get("school_id") || "",
            }));
          }
          if (path === "/api/admin/access-log" && method === "GET") {
            return json(await recordAccessLog(sql, actor, {
              kidId: url.searchParams.get("kid_id") || "",
              actorId: url.searchParams.get("actor_id") || "",
              days: parseInt(url.searchParams.get("days") || "30", 10),
            }));
          }
          // Is this deployment able to send a text at all? Asked before
          // anything is sent, so "0 of 2" is never the first time anyone
          // learns the gateway is not configured.
          if (path === "/api/admin/sms-status" && method === "GET") {
            const status = smsProvider(env);
            // For textbee, configuration alone is not enough: the registered
            // phone must also be connected or every send queues forever. The
            // screen shows that before anyone clicks Invite.
            if (status.provider === "textbee" && status.configured) {
              const device = await textbeeDevice(env);
              return json({ ...status, device });
            }
            return json(status);
          }
          if (path === "/api/admin/analytics" && method === "GET") {
            return json(await adminAnalytics(sql, actor, {
              schoolId: url.searchParams.get("school_id") || "",
            }));
          }
          if (path === "/api/admin/my-camps" && method === "GET") {
            return json(await listMyCamps(sql, actor));
          }

          const rest = path.slice("/api/admin/camps".length).replace(/^\//, "");
          const parts = rest ? rest.split("/").map(decodeURIComponent) : [];
          if (parts.length === 0) return json({ error: "Not found" }, 404);

          const campId = parts[0];
          const section = parts[1] || "";
          const third = parts[2] || "";

          if (!section) {
            if (method === "GET") return json(await getCamp(sql, actor, campId));
            if (method === "PATCH" || method === "PUT") {
              return json(await updateCamp(sql, actor, campId, await readBody()));
            }
            return json({ error: "Method not allowed" }, 405);
          }

          if (section === "roster" && method === "POST") {
            return json(await buildCampRoster(sql, actor, campId));
          }

          if (section === "participants" && method === "GET") {
            return json(await listParticipants(sql, actor, campId, {
              consent: url.searchParams.get("consent") || undefined,
              attendance: url.searchParams.get("attendance") || undefined,
              status: url.searchParams.get("status") || undefined,
              search: url.searchParams.get("q") || undefined,
            }));
          }

          if (section === "reconciliation" && method === "GET") {
            return json(await campReconciliation(sql, actor, campId));
          }

          if (section === "consent") {
            if (third === "request" && method === "POST") {
              const b = await readBody().catch(() => ({}) as Record<string, unknown>);
              return json(await requestConsent(sql, actor, campId, smsSender, url.origin, {
                profileIds: Array.isArray(b.profileIds) ? (b.profileIds as string[]) : [],
              }));
            }
            if (third === "record" && method === "POST") {
              const b = await readBody();
              const access = await assertCampAccess(sql, actor, campId);
              if (!access.canSchedule) {
                return json({ error: "You cannot record consent for this camp", code: "FORBIDDEN" }, 403);
              }
              const decision = String(b.decision || "").toUpperCase();
              if (decision !== "GRANTED" && decision !== "DECLINED" && decision !== "PAPER") {
                return json({ error: "Decision must be GRANTED, DECLINED or PAPER", code: "BAD_DECISION" }, 400);
              }
              return json(await recordConsent(sql, campId, String(b.kidId || ""), decision, {
                actorId: actor.profileId,
                source: String(b.source || "PAPER"),
                checks: Array.isArray(b.checks) ? (b.checks as string[]) : undefined,
                consentPhotos: b.consentPhotos === true,
                note: String(b.note || ""),
              }));
            }
            return json({ error: "Method not allowed" }, 405);
          }

          if (section === "attendance" && method === "POST") {
            const b = await readBody();
            return json(await setAttendance(sql, actor, campId, String(b.kidId || ""), String(b.attendance || "")));
          }

          if (section === "pack" && method === "GET") {
            return json(await campPack(sql, actor, campId));
          }

          if (section === "screening-bulk" && method === "POST") {
            const b = await readBody();
            return json(await saveScreeningBulk(sql, actor, campId,
              cappedList(b.entries, MAX_SYNC_ENTRIES, "entries")));
          }

          if (section === "screening") {
            if (!third) return json({ error: "Which child?" }, 400);
            if (method === "GET") return json(await getScreeningForm(sql, actor, campId, third));
            if (method === "POST") return json(await saveScreening(sql, actor, campId, third, await readBody()));
            return json({ error: "Method not allowed" }, 405);
          }

          if (section === "review") {
            if (!third && method === "GET") return json(await reviewQueue(sql, actor, campId));
            if (third && method === "GET") return json(await reviewDetail(sql, actor, campId, third));
            if (third && method === "POST") {
              return json(await reviewParticipant(sql, actor, campId, third, await readBody(), smsSender));
            }
            return json({ error: "Method not allowed" }, 405);
          }

          if (section === "release" && method === "POST") {
            return json(await releaseCamp(sql, actor, campId, smsSender));
          }

          if (section === "staff") {
            if (method === "POST") {
              const b = await readBody();
              // A doctor comes from the directory; a screener from the school's
              // own staff list. Assigning a doctor also provisions the login
              // their phone number signs in with.
              if (b.doctorId) {
                return json(await assignDoctorToCamp(sql, actor, campId, String(b.doctorId)));
              }
              return json(await assignCampStaff(sql, actor, campId, b));
            }
            // PATCH revokes or restores; DELETE is kept as a revoke so the
            // record of who screened whom survives.
            if (method === "PATCH" && third) {
              const b = await readBody();
              return json(await setCampStaffActive(sql, actor, campId, third, b.active === true));
            }
            if (method === "DELETE" && third) return json(await removeCampStaff(sql, actor, campId, third));
            return json({ error: "Method not allowed" }, 405);
          }

          // Photographs of a finding. Gated twice: the camp has to have
          // photography switched on, and the guardian has to have agreed to it
          // separately from agreeing to the screening itself.
          if (section === "photos") {
            if (!third) return json({ error: "Which child?" }, 400);
            if (method === "GET") return json(await listFindingPhotos(sql, actor, campId, third));
            if (method === "POST") return json(await uploadFindingPhoto(sql, actor, campId, third, await readBody()), 201);
            return json({ error: "Method not allowed" }, 405);
          }

          // The family's own account of everyday illness since the last camp.
          // History for the clinician, never a finding.
          if (section === "symptoms" && method === "GET") {
            if (!third) return json({ error: "Which child?" }, 400);
            return json(await symptomHistoryForClinician(sql, actor, campId, third));
          }

          if (section === "photo-trail" && method === "GET") {
            if (!third) return json({ error: "Which child?" }, 400);
            return json(await photoAccessTrail(sql, actor, campId, third));
          }

          if (section === "photos-enabled" && method === "POST") {
            const b = await readBody();
            return json(await setCampPhotos(sql, actor, campId, b.enabled === true));
          }

          return json({ error: "Not found" }, 404);
        } catch (e) {
          return serverError(e, "api");
        }
      }

      // ═══════════════════════════════════════════════════
      // Photographs, the question channel, the library, billing
      // ═══════════════════════════════════════════════════
      if (path.startsWith("/api/admin/photo/")
          || path === "/api/admin/questions" || path.startsWith("/api/admin/questions/")
          || path === "/api/admin/library" || path.startsWith("/api/admin/library/")
          || path === "/api/admin/billing" || path.startsWith("/api/admin/billing/")) {
        const actor = await resolveActor(request, sql, env);
        if (!actor) {
          return json({ error: "Administrator sign-in required", code: "ADMIN_REQUIRED" }, 401);
        }
        const method = request.method;
        const readBody = async (): Promise<Record<string, unknown>> => {
          try { return (await request.json()) as Record<string, unknown>; }
          catch { throw new ApiError(400, "Expected a JSON body", "BAD_JSON"); }
        };

        try {
          // ── One photograph, by id ──
          if (path.startsWith("/api/admin/photo/")) {
            const photoId = decodeURIComponent(path.slice("/api/admin/photo/".length));
            if (method === "GET") return json(await getFindingPhoto(sql, { actor }, photoId));
            if (method === "DELETE") return json(await deleteFindingPhoto(sql, actor, photoId));
            return json({ error: "Method not allowed" }, 405);
          }

          // ── Questions from families ──
          if (path === "/api/admin/questions" && method === "GET") {
            return json(await schoolThreads(
              sql,
              actor,
              url.searchParams.get("school_id") || actor.schoolId || "",
              url.searchParams.get("status") || "OPEN"
            ));
          }
          if (path.startsWith("/api/admin/questions/")) {
            const bits = path.slice("/api/admin/questions/".length).split("/").map(decodeURIComponent);
            if (bits[0] === "settings" && method === "POST") {
              const b = await readBody();
              return json(await setQuestionsEnabled(
                sql,
                actor,
                String(b.schoolId || actor.schoolId || ""),
                b.enabled === true
              ));
            }
            const threadId = bits[0];
            const action = bits[1] || "";
            if (!action && method === "GET") {
              return json(await threadMessages(sql, { actor }, threadId));
            }
            if (action === "reply" && method === "POST") {
              return json(await replyToThread(sql, actor, threadId, await readBody()));
            }
            return json({ error: "Method not allowed" }, 405);
          }

          // ── Education library ──
          if (path === "/api/admin/library") {
            if (method === "GET") return json(await listArticles(sql, actor));
            if (method === "POST" || method === "PUT") {
              return json(await upsertArticle(sql, actor, await readBody()));
            }
            return json({ error: "Method not allowed" }, 405);
          }
          if (path.startsWith("/api/admin/library/") && method === "DELETE") {
            const bits = path.slice("/api/admin/library/".length).split("/").map(decodeURIComponent);
            return json(await deleteArticle(sql, actor, bits[0] || "", bits[1] || "en"));
          }

          // ── Contracts and invoices ──
          if (path === "/api/admin/billing" && method === "GET") {
            return json(await billingSummary(sql, actor));
          }
          if (path.startsWith("/api/admin/billing/")) {
            const bits = path.slice("/api/admin/billing/".length).split("/").map(decodeURIComponent);
            const head = bits[0] || "";

            if (head === "contract") {
              if (method === "GET") {
                return json(await getContract(sql, actor, url.searchParams.get("school_id") || ""));
              }
              if (method === "POST" || method === "PUT") {
                const b = await readBody();
                return json(await setContract(sql, actor, String(b.schoolId || ""), b));
              }
              return json({ error: "Method not allowed" }, 405);
            }

            if (head === "invoices") {
              if (method === "GET") {
                return json(await listInvoices(sql, actor, url.searchParams.get("school_id") || ""));
              }
              if (method === "POST") {
                const b = await readBody();
                return json(await generateInvoice(sql, actor, String(b.schoolId || ""), b), 201);
              }
              return json({ error: "Method not allowed" }, 405);
            }

            if (head === "invoice") {
              const invoiceId = bits[1] || "";
              const action = bits[2] || "";
              if (!action && method === "GET") return json(await getInvoice(sql, actor, invoiceId));
              if (action === "status" && method === "POST") {
                const b = await readBody();
                return json(await setInvoiceStatus(sql, actor, invoiceId, String(b.status || "")));
              }
              return json({ error: "Method not allowed" }, 405);
            }

            if (head === "parent-plan" && method === "POST") {
              const b = await readBody();
              return json(await setParentPlan(
                sql,
                actor,
                String(b.profileId || ""),
                String(b.plan || "FREE"),
                String(b.until || "")
              ));
            }
          }

          return json({ error: "Not found" }, 404);
        } catch (e) {
          return serverError(e, "api");
        }
      }

      // ═══════════════════════════════════════════════════
      // Hospitals, doctors, invitations, and who is at a camp
      // ═══════════════════════════════════════════════════
      // Every path handled inside this block has to be named here, or its
      // handler is unreachable and the request falls past to the generic 404.
      // /api/admin/lookup and /api/admin/demo-data were written inside it and
      // not added here: both shipped as dead code, and the console showed
      // "Not found" on a screen whose server-side function had passing tests.
      if (path === "/api/admin/hospitals" || path.startsWith("/api/admin/hospitals/")
          || path === "/api/admin/doctors" || path.startsWith("/api/admin/doctors/")
          || path === "/api/admin/invites" || path === "/api/admin/invites/send"
          || path === "/api/admin/camp-people"
          || path === "/api/admin/lookup" || path === "/api/admin/demo-data"
          || path === "/api/admin/guardians" || path === "/api/admin/reset") {
        const actor = await resolveActor(request, sql, env);
        if (!actor) {
          return json({ error: "Administrator sign-in required", code: "ADMIN_REQUIRED" }, 401);
        }
        const method = request.method;
        const readBody = async (): Promise<Record<string, unknown>> => {
          try { return (await request.json()) as Record<string, unknown>; }
          catch { throw new ApiError(400, "Expected a JSON body", "BAD_JSON"); }
        };
        const smsSender = makeSender(env);

        try {
          if (path === "/api/admin/hospitals") {
            if (method === "GET") {
              return json(await listHospitals(sql, actor, url.searchParams.get("q") || ""));
            }
            if (method === "POST" || method === "PUT") {
              return json(await upsertHospital(sql, actor, await readBody()));
            }
            return json({ error: "Method not allowed" }, 405);
          }
          if (path.startsWith("/api/admin/hospitals/") && method === "DELETE") {
            return json(await deleteHospital(sql, actor,
              decodeURIComponent(path.slice("/api/admin/hospitals/".length))));
          }

          if (path === "/api/admin/doctors") {
            if (method === "GET") {
              return json(await listDoctors(sql, actor,
                url.searchParams.get("hospital_id") || "",
                url.searchParams.get("q") || ""));
            }
            if (method === "POST" || method === "PUT") {
              return json(await upsertDoctor(sql, actor, await readBody()));
            }
            return json({ error: "Method not allowed" }, 405);
          }
          if (path.startsWith("/api/admin/doctors/") && method === "DELETE") {
            return json(await deleteDoctor(sql, actor,
              decodeURIComponent(path.slice("/api/admin/doctors/".length))));
          }

          // Who is this number? Crosses every school, so operations only —
          // the function checks that itself rather than trusting this route.
          if (path === "/api/admin/lookup" && method === "GET") {
            return json(await lookupPhone(sql, actor, url.searchParams.get("phone") || ""));
          }

          if (path === "/api/admin/guardians" && method === "GET") {
            return json(await listGuardians(sql, actor, {
              q: url.searchParams.get("q") || "",
              schoolId: url.searchParams.get("school_id") || "",
              onApp: url.searchParams.get("on_app") || "",
            }));
          }

          // Emptying the programme. Its own endpoint, not an option on the
          // demonstration-data one: that refuses to touch anything real, and
          // this exists to remove exactly that.
          if (path === "/api/admin/reset") {
            if (method === "GET") return json(await previewReset(sql, actor));
            if (method === "POST") {
              const b = await readBody();
              return json(await resetProgramme(sql, actor, String(b.confirm || ""), {
                directory: b.directory !== false,
                library: b.library !== false,
              }));
            }
            return json({ error: "Method not allowed" }, 405);
          }

          // Demonstration data: look before you leap, then leap.
          if (path === "/api/admin/demo-data") {
            if (method === "GET") return json(await previewDemoData(sql, actor));
            if (method === "DELETE") {
              const b = await readBody();
              return json(await purgeDemoData(sql, actor, { articles: b.articles === true }));
            }
            return json({ error: "Method not allowed" }, 405);
          }

          if (path === "/api/admin/invites" && method === "GET") {
            return json(await inviteStatus(sql, actor, url.searchParams.get("school_id") || ""));
          }
          if (path === "/api/admin/invites/send" && method === "POST") {
            const b = await readBody();
            const link = async (last10: string) => {
              const token = await signInviteToken(last10, env);
              return token ? `${url.origin}/i/${token}` : (env.APP_PLAY_URL || url.origin);
            };
            // Links are signed one at a time, so resolve them all first rather
            // than making the sender async-in-a-loop twice over.
            const status = await inviteStatus(sql, actor, String(b.schoolId || ""));
            const links = new Map<string, string>();
            for (const g of status.guardians) {
              const norm = normalizePhone(g.phone);
              if (norm) links.set(norm.last10, await link(norm.last10));
            }
            return json(await inviteGuardians(
              sql, actor, String(b.schoolId || ""),
              smsSender,
              (last10) => links.get(last10) || (env.APP_PLAY_URL || url.origin),
              {
                onlyNotJoined: b.onlyNotJoined !== false,
                profileIds: Array.isArray(b.profileIds) ? (b.profileIds as string[]) : [],
              }
            ));
          }

          if (path === "/api/admin/camp-people" && method === "GET") {
            return json(await campPeople(
              sql, actor,
              url.searchParams.get("camp_id") || "",
              url.searchParams.get("school_id") || ""
            ));
          }

          return json({ error: "Not found" }, 404);
        } catch (e) {
          return serverError(e, "api");
        }
      }

      if (path === "/api/admin/schools" || path.startsWith("/api/admin/schools/")) {
        const actor = await resolveActor(request, sql, env);
        if (!actor) {
          return json({ error: "Administrator sign-in required", code: "ADMIN_REQUIRED" }, 401);
        }

        // /api/admin/schools/<id>/<section>/<extra>
        const rest = path.slice("/api/admin/schools".length).replace(/^\//, "");
        const parts = rest ? rest.split("/").map(decodeURIComponent) : [];
        const method = request.method;
        const readBody = async (): Promise<Record<string, unknown>> => {
          try {
            return (await request.json()) as Record<string, unknown>;
          } catch {
            throw new ApiError(400, "Expected a JSON body", "BAD_JSON");
          }
        };
        const smsSender = makeSender(env);

        try {
          // Collection
          if (parts.length === 0) {
            if (method === "GET") return json(await listSchools(sql, actor));
            if (method === "POST") return json(await createSchool(sql, actor, await readBody()), 201);
            return json({ error: "Method not allowed" }, 405);
          }

          const schoolId = parts[0];
          const section = parts[1] || "";

          // Single school
          if (!section) {
            if (method === "GET") return json(await getSchool(sql, actor, schoolId));
            if (method === "PATCH" || method === "PUT") {
              return json(await updateSchool(sql, actor, schoolId, await readBody()));
            }
            // A9 — closing a school down. The name is sent in the body rather
            // than the query string so it is not left sitting in a request log.
            if (method === "DELETE") {
              const b = await readBody();
              return json(await deleteSchool(sql, actor, schoolId, String(b.confirmName || "")));
            }
            return json({ error: "Method not allowed" }, 405);
          }

          // A9 — archive, reopen, and the preview that says which is possible.
          if (section === "archive") {
            if (method === "GET") return json(await schoolDeletionPreview(sql, actor, schoolId));
            if (method === "POST") {
              const b = await readBody();
              return json(await setSchoolArchived(sql, actor, schoolId, b.archived !== false));
            }
            return json({ error: "Method not allowed" }, 405);
          }

          // A4 — classes and sections
          if (section === "classes") {
            if (method === "GET") {
              const year = url.searchParams.get("year") || "";
              return json(await listClasses(sql, actor, schoolId, year));
            }
            if (method === "POST" || method === "PUT") {
              return json(await setClasses(sql, actor, schoolId, await readBody()));
            }
            return json({ error: "Method not allowed" }, 405);
          }

          // Referral tracking and closure (G9)
          if (section === "referrals") {
            if (!parts[2] && method === "GET") {
              return json(await referralDashboard(sql, actor, schoolId, {
                status: url.searchParams.get("status") || undefined,
                campId: url.searchParams.get("camp") || undefined,
              }));
            }
            if (parts[2] === "nudge" && method === "POST") {
              return json(await nudgeReferrals(sql, actor, schoolId,
                smsSender));
            }
            return json({ error: "Method not allowed" }, 405);
          }

          // Correction requests from guardians (J6)
          if (section === "corrections") {
            if (!parts[2] && method === "GET") return json(await listCorrections(sql, actor, schoolId));
            if (parts[2] && method === "POST") {
              const b = await readBody();
              return json(await resolveCorrection(sql, actor, parts[2], b.accept === true, String(b.note || "")));
            }
            return json({ error: "Method not allowed" }, 405);
          }

          // Academic-year rollover and students leaving (J1, J2)
          if (section === "rollover" && method === "POST") {
            return json(await rolloverClasses(sql, actor, schoolId, await readBody()));
          }
          if (section === "student" && parts[2] && method === "POST") {
            const b = await readBody();
            return json(await markStudentLeft(sql, actor, schoolId, parts[2], b.leaving === true));
          }

          // Guardian account recovery (J4)
          if (section === "guardian-phone" && method === "POST") {
            return json(await changeGuardianPhone(sql, actor, schoolId, await readBody()));
          }

          // Cohort report (I5)
          if (section === "report" && method === "GET") {
            return json(await schoolReport(sql, actor, schoolId, url.searchParams.get("year") || ""));
          }

          // Camps for this school (B1)
          if (section === "camps") {
            if (method === "GET") return json(await listCamps(sql, actor, schoolId));
            if (method === "POST") return json(await createCamp(sql, actor, schoolId, await readBody()), 201);
            return json({ error: "Method not allowed" }, 405);
          }

          // Screeners and physicians attached to this school
          if (section === "staff") {
            if (method === "GET") return json(await listStaff(sql, actor, schoolId));
            if (method === "POST" && !parts[2]) {
              return json(await addStaffMember(sql, actor, schoolId, await readBody()), 201);
            }
            // Revoking a screener's or physician's access to the school. The
            // tab could add them and never take them away.
            if (method === "DELETE" && parts[2]) {
              return json(await removeStaffMember(sql, actor, schoolId, parts[2]));
            }
            // A sign-in code an administrator can read out.
            //
            // Twilio is not reliably reachable on a pilot number, and when the
            // SMS does not arrive a screener simply cannot get in — there is no
            // password to fall back on. An administrator who already manages
            // this school may mint a code for staff of that school and pass it
            // on. It is the same one-time code the SMS would have carried, it
            // expires the same way, and it is written to the audit log.
            if (parts[2] && parts[3] === "signin-code" && method === "POST") {
              const staff = await sql`
                SELECT id, name, phone, role FROM vita_hero.profiles
                WHERE id = ${parts[2]} AND school_id = ${schoolId}
                  AND role IN ('SCREENER','PHYSICIAN','SCHOOL_ADMIN')
                LIMIT 1
              `;
              if (staff.length === 0) {
                return json({ error: "No such staff member at this school", code: "NOT_FOUND" }, 404);
              }
              const phone = String(staff[0].phone || "");
              const code = generateOtp();
              const expires = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60_000);
              await sql`
                INSERT INTO vita_hero.phone_otps (phone, otp, expires_at, attempts, last_sent_at)
                VALUES (${phone}, ${code}, ${expires.toISOString()}, 0, NOW())
                ON CONFLICT (phone) DO UPDATE SET
                  otp = EXCLUDED.otp, expires_at = EXCLUDED.expires_at,
                  attempts = 0, last_sent_at = NOW()
              `;
              const delivered = (await makeSender(env)(
                phone, `Your VitaHero sign-in code is: ${code}`
              )).ok;
              await sql`
                INSERT INTO vita_hero.data_rights_log (id, profile_id, action, detail, actor_id)
                VALUES (${"drl_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)},
                        ${parts[2]}, 'SIGNIN_CODE_ISSUED',
                        ${"Issued by " + actor.name + " (" + actor.role + ")"}, ${actor.profileId})
              `;
              return json({
                name: staff[0].name as string,
                phone,
                code,
                smsDelivered: delivered,
                expiresInMinutes: OTP_EXPIRY_MINUTES,
              });
            }
            return json({ error: "Method not allowed" }, 405);
          }

          // A3 — school administrators
          if (section === "admins") {
            if (method === "GET") return json(await listSchoolAdmins(sql, actor, schoolId));
            if (method === "POST") {
              return json(await addSchoolAdmin(sql, actor, schoolId, await readBody()), 201);
            }
            if (method === "DELETE" && parts[2]) {
              return json(await removeSchoolAdmin(sql, actor, schoolId, parts[2]));
            }
            return json({ error: "Method not allowed" }, 405);
          }

          // A5-A8 — roster
          if (section === "roster") {
            const sub = parts[2] || "";
            if (!sub && method === "GET") {
              return json(await listRoster(
                sql, actor, schoolId,
                url.searchParams.get("year") || "",
                (url.searchParams.get("q") || "").toLowerCase(),
                parseInt(url.searchParams.get("limit") || "100", 10),
                parseInt(url.searchParams.get("offset") || "0", 10)
              ));
            }
            if (sub === "validate" && method === "POST") {
              return json(await validateRoster(sql, actor, schoolId, await readBody()));
            }
            // One child, for a late admission. Goes through commitRoster so it
            // cannot drift from the CSV path.
            if (sub === "student" && method === "POST") {
              return json(await addStudent(sql, actor, schoolId, await readBody()));
            }
            if (sub === "commit" && method === "POST") {
              return json(await commitRoster(sql, actor, schoolId, await readBody()));
            }
            if (sub === "batches" && method === "GET") {
              return json(await listRosterBatches(sql, actor, schoolId));
            }
            return json({ error: "Method not allowed" }, 405);
          }

          return json({ error: "Not found" }, 404);
        } catch (e) {
          return serverError(e, "stage-a");
        }
      }

      // Bootstrap an operations account from the API key, so the first real
      // person can sign in by phone instead of pasting the key every time.
      if (path === "/api/admin/ops/grant" && request.method === "POST") {
        const headerKey = request.headers.get("X-Admin-Key") || "";
        if (!env.ADMIN_API_KEY || headerKey !== env.ADMIN_API_KEY) {
          return json({ error: "Admin API key required", code: "ADMIN_REQUIRED" }, 403);
        }
        try {
          const body: Record<string, unknown> = await request.json();
          return json(await grantOpsRole(sql, String(body.phone || ""), String(body.name || "")));
        } catch (e) {
          return serverError(e, "api");
        }
      }

      // ═══════════════════════════════════════════════════
      // AUTH ENDPOINTS
      // ═══════════════════════════════════════════════════

      // ── Email/Password Sign-Up (ADMIN accounts only) ──
      // Closed app: public self-signup is disabled. Only an existing admin
      // (X-Admin-Key bootstrap or role=ADMIN session) may create new admin accounts.
      if (path === "/api/auth/signup" && request.method === "POST") {
        try {
          const admin = await requireAdmin(request, sql, env);
          if (!admin) {
            return json(
              { error: "Sign-up is disabled. This is a closed app.", code: "SIGNUP_DISABLED" },
              403
            );
          }
          const body: Record<string, unknown> = await request.json();
          const name = (body.name as string)?.trim();
          const email = (body.email as string)?.trim();
          const password = body.password as string;

          if (!name || !email || !password) {
            return json({ error: "name, email, and password are required" }, 400);
          }
          if (password.length < 8) {
            return json({ error: "Password must be at least 8 characters" }, 400);
          }

          const neonResp = await callNeonAuth("/sign-up/email", { name, email, password }, request);
          const { profileId, sessionToken } = await upsertProfileFromNeonAuth(
            sql, neonResp.user, "EMAIL", "ADMIN"
          );

          return json({
            token: sessionToken,
            profile: {
              id: profileId,
              user_id: neonResp.user.id,
              name: neonResp.user.name || email.split("@")[0],
              email: neonResp.user.email,
              auth_provider: "EMAIL",
            },
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          return json({ error: message }, 400);
        }
      }

      // ── Email/Password Sign-In ───────────────────────
      if (path === "/api/auth/signin" && request.method === "POST") {
        try {
          const body: Record<string, unknown> = await request.json();
          const email = (body.email as string)?.trim();
          const password = body.password as string;

          if (!email || !password) {
            return json({ error: "email and password are required" }, 400);
          }

          const neonResp = await callNeonAuth("/sign-in/email", { email, password }, request);
          const { profileId, sessionToken } = await upsertProfileFromNeonAuth(
            sql, neonResp.user, "EMAIL"
          );

          return json({
            token: sessionToken,
            profile: {
              id: profileId,
              user_id: neonResp.user.id,
              name: neonResp.user.name || email.split("@")[0],
              email: neonResp.user.email,
              auth_provider: "EMAIL",
            },
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          return json({ error: message }, 401);
        }
      }

      // ── Google Sign-In ───────────────────────────────
      // Closed app: parents are phone-only, admins use email. Google is disabled.
      if (path === "/api/auth/google" && request.method === "POST") {
        return json(
          {
            error: "Google sign-in is disabled. Please sign in with your registered mobile number.",
            code: "GOOGLE_DISABLED",
          },
          403
        );
      }

      // ── Phone OTP: Send ──────────────────────────────
      if (path === "/api/auth/phone/send" && request.method === "POST") {
        const body: Record<string, unknown> = await request.json();
        const phone = (body.phone as string)?.trim();
        if (!phone) return json({ error: "Missing phone" }, 400);

        // Closed app: only admin-provisioned numbers may receive an OTP.
        const norm = normalizePhone(phone);
        if (!norm) return json({ error: "Enter a valid mobile number" }, 400);
        const signInProfileId = profileIdForPhone(norm.last10);
        const provRows = await sql`
          SELECT provisioned, role FROM vita_hero.profiles
          WHERE id = ${signInProfileId} LIMIT 1
        `;
        if (provRows.length === 0 || provRows[0].provisioned !== true) {
          // Before the generic refusal: is this a doctor who is in the
          // directory but was never given a sign-in? They are entitled to a
          // better answer than "not registered", because they are registered —
          // just not as somebody who can get in. One extra query, and only on
          // the way to a refusal.
          const inDirectory = await sql`
            SELECT name FROM vita_hero.doctors
            WHERE active = true
              AND RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10) = ${norm.last10}
            LIMIT 1
          `;
          if (inDirectory.length > 0) {
            return json(
              {
                error:
                  `${inDirectory[0].name as string} is in the doctor directory but has not been given sign-in access yet. Ask VitaHero operations to switch it on.`,
                code: "DIRECTORY_ONLY",
              },
              403
            );
          }
          return json(
            {
              error: "This number isn't registered. Please contact your school or camp organizer.",
              code: "NOT_PROVISIONED",
            },
            403
          );
        }

        // A screener or physician holds access through their camp assignments.
        // When the last one is revoked the camp is over for them, and there is
        // nothing behind this door — so it does not open. Said plainly, because
        // the alternative is a doctor standing in a school hall reading
        // "something went wrong".
        // Which product is asking, and is this their door? Two very different
        // jobs sit behind this one endpoint, and it used to let anyone
        // provisioned into whichever one they had opened — so a doctor could
        // sign in to the family app, which has no notion of a role and would
        // have called them "Parent" and shown them an empty list of children.
        const signInRole = (provRows[0].role as string) || "";
        const wrongDoor = surfaceRefusal(
          surfaceOf(body.surface), signInRole, new URL(request.url).origin + "/admin");
        if (wrongDoor) {
          // Refused before the code is sent, not after. There is no point
          // texting somebody a code for a door that will not open.
          return json(wrongDoor, 403);
        }

        const clinicianRole = signInRole;
        if (!(await canClinicianSignIn(sql, signInProfileId, clinicianRole))) {
          return json(
            {
              error:
                "Your camp access has ended. Ask the school to assign you to a camp if this is wrong.",
              code: "NO_ACTIVE_CAMP",
            },
            403
          );
        }

        const existing = await sql`
          SELECT last_sent_at FROM vita_hero.phone_otps WHERE phone = ${phone} LIMIT 1
        `;
        if (existing[0]?.last_sent_at) {
          const elapsed = Date.now() - new Date(existing[0].last_sent_at as string).getTime();
          if (elapsed < 60_000) {
            return json({ error: "Please wait 60 seconds before requesting another OTP." }, 429);
          }
        }

        const otp = generateOtp();
        const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60_000);

        await sql`
          INSERT INTO vita_hero.phone_otps (phone, otp, expires_at, attempts, last_sent_at)
          VALUES (${phone}, ${otp}, ${expiresAt.toISOString()}, 0, NOW())
          ON CONFLICT (phone) DO UPDATE SET
            otp = EXCLUDED.otp,
            expires_at = EXCLUDED.expires_at,
            attempts = 0,
            last_sent_at = NOW()
        `;

        const smsRes = await makeSender(env)(
          phone, `Your VitaHero verification code is: ${otp}`
        );
        const sent = smsRes.ok;

        // Saying "sent" when nothing was sent is why staff sign-in looked
        // broken: the console showed "Code sent", the phone stayed silent, and
        // nothing anywhere said the message had failed.
        return json({
          success: sent,
          smsDelivered: sent,
          note: sent
            ? undefined
            : "We could not deliver the SMS. Ask a VitaHero administrator to read you a sign-in code from the school's Staff tab.",
        }, sent ? 200 : 502);
      }

      // ── Phone OTP: Verify ────────────────────────────
      if (path === "/api/auth/phone/verify" && request.method === "POST") {
        const body: Record<string, unknown> = await request.json();
        const phone = (body.phone as string)?.trim();
        const otp = (body.otp as string)?.trim();
        if (!phone || !otp) return json({ error: "Missing phone or otp" }, 400);

        const rows = await sql`
          SELECT otp, expires_at, attempts
          FROM vita_hero.phone_otps WHERE phone = ${phone} LIMIT 1
        `;

        if (rows.length === 0) {
          return json({ error: "No OTP requested for this number" }, 400);
        }

        const record = rows[0];
        if (record.attempts >= OTP_MAX_ATTEMPTS) {
          return json({ error: "Too many attempts. Request a new OTP." }, 429);
        }
        if (new Date(record.expires_at) < new Date()) {
          return json({ error: "OTP expired. Request a new one." }, 410);
        }

        // Increment attempts
        await sql`
          UPDATE vita_hero.phone_otps
          SET attempts = attempts + 1 WHERE phone = ${phone}
        `;

        if (record.otp !== otp) {
          return json({ error: "Invalid OTP" }, 401);
        }

        // OTP verified — clean up
        await sql`DELETE FROM vita_hero.phone_otps WHERE phone = ${phone}`;

        // Closed app: the parent must have been provisioned by an admin import.
        // We never auto-create a profile here.
        const norm = normalizePhone(phone);
        if (!norm) return json({ error: "Enter a valid mobile number" }, 400);
        const profileId = profileIdForPhone(norm.last10);

        const existing = await sql`
          SELECT id, provisioned, name, role, school_id
          FROM vita_hero.profiles WHERE id = ${profileId} LIMIT 1
        `;

        if (existing.length === 0 || existing[0].provisioned !== true) {
          return json(
            {
              error: "This number isn't registered. Please contact your school or camp organizer.",
              code: "NOT_PROVISIONED",
            },
            403
          );
        }

        // The same question as at /send, asked again where the session is
        // actually minted. A door that only checks on the way in is a door
        // anyone can walk around.
        const verifyWrongDoor = surfaceRefusal(
          surfaceOf(body.surface), (existing[0].role as string) || "",
          new URL(request.url).origin + "/admin");
        if (verifyWrongDoor) return json(verifyWrongDoor, 403);

        const sessionToken = await mintSession(sql, profileId, "PHONE");
        await sql`
          UPDATE vita_hero.profiles
          SET session_token = ${sessionToken}, is_logged_in = true, phone = ${phone},
              user_id = COALESCE(user_id, ${profileId})
          WHERE id = ${profileId}
        `;

        // Also delete any old OTPs
        try {
          await sql`DELETE FROM vita_hero.phone_otps WHERE expires_at < NOW()`;
        } catch { /* best effort */ }

        return json({
          token: sessionToken,
          profile: {
            id: profileId,
            user_id: profileId,
            phone,
            name: (existing[0].name as string) || "Parent",
            auth_provider: "PHONE",
            role: (existing[0].role as string) || "PARENT",
            school_id: (existing[0].school_id as string) || null,
          },
        });
      }

      // ── Firebase Phone Auth: exchange Firebase ID token for a session ──
      // The OTP itself is requested and verified on-device by Firebase's Phone
      // provider (Firebase only allows the request from the parent's own
      // phone). The app sends us the resulting Firebase ID token; we validate
      // it with Google and mint the same session the OTP flow used to.
      if (path === "/api/auth/phone/firebase-verify" && request.method === "POST") {
        const body: Record<string, unknown> = await request.json();
        const idToken = (body.idToken as string)?.trim();
        if (!idToken) return json({ error: "Missing idToken" }, 400);

        const apiKey = env.FIREBASE_API_KEY || FIREBASE_WEB_API_KEY;
        let lookupResp: Response;
        try {
          lookupResp = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ idToken }),
            }
          );
        } catch {
          return json({ error: "Could not verify sign-in. Please try again." }, 502);
        }
        if (!lookupResp.ok) {
          return json({ error: "Sign-in session expired. Please request a new code." }, 401);
        }
        const lookup = (await lookupResp.json()) as {
          users?: Array<{ phoneNumber?: string }>;
        };
        const fbPhone = lookup.users?.[0]?.phoneNumber;
        if (!fbPhone) return json({ error: "No phone number on this sign-in" }, 401);

        // Closed app: the parent must have been provisioned by an admin import.
        const norm = normalizePhone(fbPhone);
        if (!norm) return json({ error: "Enter a valid mobile number" }, 400);
        const profileId = profileIdForPhone(norm.last10);

        const existing = await sql`
          SELECT id, provisioned, name, role, school_id
          FROM vita_hero.profiles WHERE id = ${profileId} LIMIT 1
        `;

        if (existing.length === 0 || existing[0].provisioned !== true) {
          return json(
            {
              error: "This number isn't registered. Please contact your school or camp organizer.",
              code: "NOT_PROVISIONED",
            },
            403
          );
        }

        // Firebase is a third way in, and it needs the same question asked of
        // it. It is the one the Android app actually uses.
        const fbWrongDoor = surfaceRefusal(
          surfaceOf(body.surface), (existing[0].role as string) || "",
          new URL(request.url).origin + "/admin");
        if (fbWrongDoor) return json(fbWrongDoor, 403);

        const sessionToken = await mintSession(sql, profileId, "FIREBASE_PHONE");
        await sql`
          UPDATE vita_hero.profiles
          SET session_token = ${sessionToken}, is_logged_in = true, phone = ${fbPhone},
              user_id = COALESCE(user_id, ${profileId})
          WHERE id = ${profileId}
        `;

        return json({
          token: sessionToken,
          profile: {
            id: profileId,
            user_id: profileId,
            phone: fbPhone,
            name: (existing[0].name as string) || "Parent",
            auth_provider: "PHONE",
            role: (existing[0].role as string) || "PARENT",
            school_id: (existing[0].school_id as string) || null,
          },
        });
      }

      // ── Verify Session Token ─────────────────────────
      if (path === "/api/auth/me" && request.method === "GET") {
        const token = extractToken(request);
        const session = await authenticateSession(sql, token);
        if (!session) return json({ error: "Invalid or expired session" }, 401);

        const profile = await sql`
          SELECT * FROM vita_hero.profiles WHERE id = ${session.profileId} LIMIT 1
        `;
        return json(sanitizeProfile(profile[0] as Record<string, unknown>));
      }

      // ── Logout ───────────────────────────────────────
      if (path === "/api/auth/logout" && request.method === "POST") {
        const token = extractToken(request);
        // Only this device. Signing out of a phone used to be indistinguishable
        // from signing out of every device the family owns.
        if (token) await revokeSession(sql, token);
        return json({ success: true });
      }

      // ═══════════════════════════════════════════════════
      // ADMIN ENDPOINTS (X-Admin-Key or role=ADMIN session)
      // ═══════════════════════════════════════════════════

      if (path === "/api/admin/import" && request.method === "POST") {
        const admin = await requireAdmin(request, sql, env);
        if (!admin) return json({ error: "Admin authorization required", code: "ADMIN_REQUIRED" }, 403);

        const body: Record<string, unknown> = await request.json();
        const rows = Array.isArray(body.rows) ? (body.rows as Record<string, unknown>[]) : [];
        if (rows.length === 0) return json({ error: "No rows provided" }, 400);
        if (rows.length > IMPORT_MAX_ROWS) {
          return json({ error: `Too many rows (max ${IMPORT_MAX_ROWS}). Split the file into chunks.` }, 413);
        }

        const report = await processImport(sql, env, rows, {
          dryRun: body.dryRun === true,
          sendInvites: body.sendInvites === true,
          filename: (body.filename as string) || "",
          adminId: admin.adminId,
          appOrigin: url.origin,
        });
        return json(report);
      }

      if (path === "/api/admin/import-batches" && request.method === "GET") {
        const admin = await requireAdmin(request, sql, env);
        if (!admin) return json({ error: "Admin authorization required", code: "ADMIN_REQUIRED" }, 403);
        const rows = await sql`
          SELECT id, admin_id, filename, total, created, updated, skipped, errors, invited, dry_run, created_at
          FROM vita_hero.import_batches ORDER BY created_at DESC LIMIT 50
        `;
        return json(rows);
      }

      if (path === "/api/admin/invite" && request.method === "POST") {
        const admin = await requireAdmin(request, sql, env);
        if (!admin) return json({ error: "Admin authorization required", code: "ADMIN_REQUIRED" }, 403);
        const body: Record<string, unknown> = await request.json();
        // An SMS each, so the cap is about what this can be made to spend, not
        // about what the worker can hold. The meals route has had one from the
        // start; the routes that cost money did not.
        const phones = cappedList<string>(body.phones, MAX_INVITE_PHONES, "phones");
        const force = body.force === true;
        let invited = 0;
        const skipped: string[] = [];
        // One read to find out who is provisioned, then one batched send,
        // rather than four subrequests per number pasted in.
        const wanted: Array<{ last10: string; e164: string }> = [];
        for (const raw of phones) {
          const norm = normalizePhone(raw);
          if (!norm) { skipped.push(raw); continue; }
          wanted.push({ last10: norm.last10, e164: norm.e164 });
        }
        const provisioned = wanted.length
          ? await sql`
              SELECT id FROM vita_hero.profiles
              WHERE id = ANY(${wanted.map((w) => profileIdForPhone(w.last10))})
                AND provisioned = true
            `
          : [];
        const ready = new Set(provisioned.map((r) => r.id as string));
        const eligible = wanted.filter((w) => {
          if (ready.has(profileIdForPhone(w.last10))) return true;
          skipped.push(w.e164);
          return false;
        });
        const outcome = await sendInvitesForPhones(sql, env, eligible, url.origin, force);
        invited = outcome.sent.length;
        skipped.push(...outcome.skipped);
        return json({ invited, skipped });
      }

      if (path === "/api/admin/stats" && request.method === "GET") {
        const admin = await requireAdmin(request, sql, env);
        if (!admin) return json({ error: "Admin authorization required", code: "ADMIN_REQUIRED" }, 403);
        const parents = await sql`SELECT COUNT(*)::int AS n FROM vita_hero.profiles WHERE provisioned = true`;
        const active = await sql`SELECT COUNT(*)::int AS n FROM vita_hero.profiles WHERE provisioned = true AND is_logged_in = true`;
        const kids = await sql`SELECT COUNT(*)::int AS n FROM vita_hero.kids WHERE source = 'ADMIN'`;
        const invites = await sql`SELECT COUNT(*)::int AS n FROM vita_hero.sms_log WHERE type = 'INVITE' AND status = 'SENT'`;
        return json({
          provisionedParents: parents[0].n,
          activeParents: active[0].n,
          importedKids: kids[0].n,
          invitesSent: invites[0].n,
        });
      }

      // ═══════════════════════════════════════════════════
      // AUTHENTICATED DATA ENDPOINTS
      // ═══════════════════════════════════════════════════

      const token = extractToken(request);
      const session = await authenticateSession(sql, token);

      // ═══════════════════════════════════════════════════
      // Profiles
      // ═══════════════════════════════════════════════════

      if (path === "/api/profiles" && request.method === "GET") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const rows = await sql`SELECT * FROM vita_hero.profiles WHERE id = ${session.profileId} LIMIT 1`;
        // Don't leak session token
        if (rows[0]) delete rows[0].session_token;
        return json(rows[0] || null);
      }

      if (path === "/api/profiles" && request.method === "POST") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const body: Record<string, unknown> = await request.json();
        const row = await sql`
          INSERT INTO vita_hero.profiles
            (id, user_id, phone, name, email,
             onboarding_complete, is_logged_in,
             dark_theme, locale_code, family_code,
             notifications_enabled, camp_reminders_enabled,
             consent_accepted, consent_declined,
             auth_provider, session_token)
          VALUES (
            ${session.profileId},
            ${(body.user_id as string) || session.userId},
            ${(body.phone as string) || null},
            ${(body.name as string) || session.name},
            ${(body.email as string) || null},
            ${(body.onboarding_complete as boolean) || false},
            ${(body.is_logged_in as boolean) || false},
            ${(body.dark_theme as boolean) || false},
            ${(body.locale_code as string) || "en"},
            ${(body.family_code as string) || ""},
            ${(body.notifications_enabled as boolean) ?? true},
            ${(body.camp_reminders_enabled as boolean) ?? true},
            ${(body.consent_accepted as boolean) || false},
            ${(body.consent_declined as boolean) || false},
            ${(body.auth_provider as string) || "GOOGLE"},
            ${token}
          )
          ON CONFLICT (id) DO UPDATE SET
            user_id = EXCLUDED.user_id, phone = EXCLUDED.phone,
            name = EXCLUDED.name, email = EXCLUDED.email,
            onboarding_complete = EXCLUDED.onboarding_complete,
            is_logged_in = EXCLUDED.is_logged_in,
            dark_theme = EXCLUDED.dark_theme,
            locale_code = EXCLUDED.locale_code,
            family_code = EXCLUDED.family_code,
            notifications_enabled = EXCLUDED.notifications_enabled,
            camp_reminders_enabled = EXCLUDED.camp_reminders_enabled,
            consent_accepted = EXCLUDED.consent_accepted,
            consent_declined = EXCLUDED.consent_declined,
            auth_provider = EXCLUDED.auth_provider
          RETURNING *
        `;
        if (row[0]) delete row[0].session_token;
        return json(row[0], 201);
      }

      // ═══════════════════════════════════════════════════
      // Kids
      // ═══════════════════════════════════════════════════

      if (path === "/api/kids" && request.method === "GET") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const profileId = session.profileId;
        await mergeCampResultsIntoKids(sql, profileId);
        const rows = await sql`SELECT * FROM vita_hero.kids WHERE profile_id = ${profileId} ORDER BY name`;
        return json(rows);
      }

      // Children come from the school, not from the app.
      //
      // This is a closed programme: a guardian is provisioned by a roster
      // import and their children arrive with it, matched on the mobile number
      // the school holds. There is no parent-created child, and there never
      // should have been — a child the school has not enrolled cannot be
      // screened, cannot be consented for, and cannot appear on a camp list,
      // so one created here would sit in the app looking real and do nothing.
      //
      // A correction to a child the school did enrol goes through
      // /api/me/correction, which the school office reviews. That is the
      // pathway, and it is deliberately not this one.
      if (path === "/api/kids" && request.method === "POST") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        return json(
          {
            error: "Children are added by your school, not from the app. " +
              "If a child is missing, ask the school office to check the mobile number they hold for you.",
            code: "ROSTER_MANAGED",
          },
          403
        );
      }

      if (path.startsWith("/api/kids/") && request.method === "DELETE") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const kidId = path.split("/")[3];
        // Full erasure, including camp findings and referrals. The earlier
        // version left camp_kid_results and camp_registrations behind, so a
        // deleted child's clinical record survived attached to nothing.
        try {
          return json(await deleteChild(sql, session.profileId, kidId, session.profileId));
        } catch (e) {
          if (e instanceof ApiError) return json({ error: e.message, code: e.code }, e.status);
          return serverError(e, "api");
        }
      }

      // ═══════════════════════════════════════════════════
      // Appointments
      // ═══════════════════════════════════════════════════

      if (path === "/api/appointments" && request.method === "GET") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const rows = await sql`SELECT * FROM vita_hero.appointments WHERE profile_id = ${session.profileId} ORDER BY date, time`;
        return json(rows);
      }

      if (path === "/api/appointments" && request.method === "POST") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const body: Record<string, unknown> = await request.json();
        const doctorId = (body.doctor_id as string) || "";
        const date = body.date as string;
        const time = body.time as string;
        if (doctorId) {
          const clash = await sql`
            SELECT id FROM vita_hero.appointments
            WHERE doctor_id = ${doctorId} AND date = ${date} AND time = ${time}
            LIMIT 1
          `;
          if (clash.length > 0) {
            return json({ error: "This slot is no longer available" }, 409);
          }
        }
        const row = await sql`
          INSERT INTO vita_hero.appointments
            (id, profile_id, user_id, doctor_id, doctor_name, specialty, kid_name, date, time)
          VALUES (
            ${body.id as string}, ${session.profileId},
            ${session.userId || null}, ${doctorId || null}, ${body.doctor_name as string},
            ${body.specialty as string}, ${body.kid_name as string},
            ${date}, ${time}
          )
          ON CONFLICT (id) DO UPDATE SET
            user_id = EXCLUDED.user_id,
            doctor_id = EXCLUDED.doctor_id,
            doctor_name = EXCLUDED.doctor_name, specialty = EXCLUDED.specialty,
            kid_name = EXCLUDED.kid_name, date = EXCLUDED.date, time = EXCLUDED.time
          WHERE vita_hero.appointments.profile_id = ${session.profileId}
          RETURNING *
        `;
        if (row.length === 0) return json(NOT_YOURS, 409);
        return json(row[0], 201);
      }

      if (path.startsWith("/api/appointments/") && request.method === "DELETE") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const apptId = path.split("/")[3];
        await sql`DELETE FROM vita_hero.appointments WHERE id = ${apptId} AND profile_id = ${session.profileId}`;
        return json({ deleted: true });
      }

      // ═══════════════════════════════════════════════════
      // Camps
      // ═══════════════════════════════════════════════════

      // ── Guardian: referrals, history, and data rights ──
      if (path === "/api/referrals" || path.startsWith("/api/referrals/")
          || path === "/api/me/export" || path === "/api/me/correction"
          || path === "/api/me/consent/withdraw" || path === "/api/me/rights"
          || path === "/api/me/identity" || path === "/api/me/terms" || path === "/api/me/nudges"
          || path === "/api/referral-specialties"
          || path === "/api/me/photos" || path.startsWith("/api/me/photo/")
          || path === "/api/me/questions" || path.startsWith("/api/me/questions/")
          || path === "/api/me/question-policy" || path === "/api/me/entitlements"
          || path === "/api/me/symptoms" || path.startsWith("/api/me/symptoms/")
          || path === "/api/library" || path.startsWith("/api/library/")
          || path === "/api/me" || path === "/api/kids/history") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const pid = session.profileId;
        const readBody = async (): Promise<Record<string, unknown>> => {
          try { return (await request.json()) as Record<string, unknown>; }
          catch { throw new ApiError(400, "Expected a JSON body", "BAD_JSON"); }
        };
        try {
          if (path === "/api/referrals" && request.method === "GET") {
            return json(await guardianReferrals(sql, pid, url.searchParams.get("all") === "1"));
          }
          if (path.startsWith("/api/referrals/")) {
            const bits = path.slice("/api/referrals/".length).split("/").map(decodeURIComponent);
            const refId = bits[0];
            const action = bits[1] || "";
            const b = request.method === "POST" ? await readBody() : {};
            if (action === "booked" && request.method === "POST") {
              return json(await markReferralBooked(sql, pid, refId, (b.appointmentId as string) || null));
            }
            if (action === "attended" && request.method === "POST") {
              return json(await markReferralAttended(sql, pid, refId, String(b.note || "")));
            }
            if (action === "decline" && request.method === "POST") {
              return json(await declineReferral(sql, pid, refId, String(b.reason || "")));
            }
            if (!action && request.method === "GET") {
              return json(await kidReferrals(sql, pid, url.searchParams.get("kid_id") || ""));
            }
            return json({ error: "Method not allowed" }, 405);
          }
          if (path === "/api/kids/history" && request.method === "GET") {
            return json(await kidHealthHistory(sql, pid, url.searchParams.get("kid_id") || ""));
          }
          if (path === "/api/me/export" && request.method === "GET") {
            return json(await exportGuardianData(sql, pid));
          }
          if (path === "/api/me/identity" && request.method === "GET") {
            return json(await identityChallenge(sql, pid));
          }
          if (path === "/api/me/identity" && request.method === "POST") {
            const b = await readBody();
            return json(await confirmIdentity(sql, pid, String(b.answer || "")));
          }
          if (path === "/api/me/terms" && request.method === "POST") {
            const b = await readBody();
            return json(await acceptTerms(sql, pid, String(b.version || TERMS_VERSION)));
          }
          if (path === "/api/me/nudges" && request.method === "GET") {
            return json(await guardianNudges(sql, pid));
          }
          if (path === "/api/referral-specialties" && request.method === "GET") {
            return json(await openReferralSpecialties(sql, pid));
          }
          if (path === "/api/me/rights" && request.method === "GET") {
            return json(await dataRightsHistory(sql, pid));
          }
          if (path === "/api/me/correction" && request.method === "POST") {
            return json(await requestCorrection(sql, pid, await readBody()));
          }
          if (path === "/api/me/consent/withdraw" && request.method === "POST") {
            const b = await readBody();
            return json(await withdrawConsent(sql, pid, String(b.reason || "")));
          }
          if (path === "/api/me" && request.method === "DELETE") {
            return json(await deleteAccount(sql, pid));
          }

          // ── Photographs of this child's findings ──
          if (path === "/api/me/photos" && request.method === "GET") {
            return json(await guardianPhotos(sql, pid, url.searchParams.get("kid_id") || ""));
          }
          if (path.startsWith("/api/me/photo/") && request.method === "GET") {
            const photoId = decodeURIComponent(path.slice("/api/me/photo/".length));
            return json(await getFindingPhoto(sql, { guardianProfileId: pid }, photoId));
          }

          // ── The question channel ──
          if (path === "/api/me/question-policy" && request.method === "GET") {
            return json(await questionPolicy(sql, pid));
          }
          if (path === "/api/me/questions" && request.method === "GET") {
            return json(await guardianThreads(sql, pid));
          }
          if (path === "/api/me/questions" && request.method === "POST") {
            return json(await askQuestion(sql, pid, session.name || "", await readBody()), 201);
          }
          if (path.startsWith("/api/me/questions/") && request.method === "GET") {
            const threadId = decodeURIComponent(path.slice("/api/me/questions/".length));
            return json(await threadMessages(sql, { profileId: pid }, threadId));
          }

          // ── Reading, chosen for what this child's report actually said ──
          if (path === "/api/library" && request.method === "GET") {
            return json(await libraryForGuardian(sql, pid, url.searchParams.get("locale") || "en"));
          }
          if (path.startsWith("/api/library/") && request.method === "GET") {
            const slug = decodeURIComponent(path.slice("/api/library/".length));
            return json(await getArticle(sql, slug, url.searchParams.get("locale") || "en"));
          }

          // ── What this account can and cannot use ──
          if (path === "/api/me/entitlements" && request.method === "GET") {
            return json(await entitlements(sql, pid));
          }

          // ── Everyday illness, the one clinical thing a parent may write ──
          if (path === "/api/me/symptoms" && request.method === "GET") {
            const kidId = url.searchParams.get("kid_id") || "";
            if (!kidId) return json(symptomOptions());
            return json({ ...symptomOptions(), ...(await kidSymptoms(sql, pid, kidId)) });
          }
          if (path === "/api/me/symptoms" && request.method === "POST") {
            const b = await readBody();
            return json(await recordSymptom(sql, pid, String(b.kidId || ""), b), 201);
          }
          if (path.startsWith("/api/me/symptoms/") && request.method === "DELETE") {
            const id = decodeURIComponent(path.slice("/api/me/symptoms/".length));
            return json(await deleteSymptom(sql, pid, id));
          }
          return json({ error: "Not found" }, 404);
        } catch (e) {
          return serverError(e, "api");
        }
      }

      // ── Guardian: camp consent and released results ──
      if (path === "/api/camps/consents" && request.method === "GET") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        try {
          return json(await pendingConsents(sql, session.profileId));
        } catch (e) {
          if (e instanceof ApiError) return json({ error: e.message, code: e.code }, e.status);
          return serverError(e, "api");
        }
      }

      if (path === "/api/camps/consent" && request.method === "POST") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        try {
          const body: Record<string, unknown> = await request.json();
          const decision = String(body.decision || "").toUpperCase();
          if (decision !== "GRANTED" && decision !== "DECLINED") {
            return json({ error: "Decision must be GRANTED or DECLINED", code: "BAD_DECISION" }, 400);
          }
          return json(await recordConsent(
            sql,
            String(body.campId || ""),
            String(body.kidId || ""),
            decision,
            {
              actorId: session.profileId,
              source: "APP",
              checks: Array.isArray(body.checks) ? (body.checks as string[]) : undefined,
              consentPhotos: body.consentPhotos === true,
              profileId: session.profileId,
            }
          ));
        } catch (e) {
          if (e instanceof ApiError) return json({ error: e.message, code: e.code }, e.status);
          return serverError(e, "api");
        }
      }

      if (path === "/api/camps/result" && request.method === "GET") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        try {
          return json(await guardianCampResult(
            sql,
            session.profileId,
            url.searchParams.get("camp_id") || "",
            url.searchParams.get("kid_id") || ""
          ));
        } catch (e) {
          if (e instanceof ApiError) return json({ error: e.message, code: e.code }, e.status);
          return serverError(e, "api");
        }
      }

      if (path === "/api/camps" && request.method === "GET") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        await mergeCampResultsIntoKids(sql, session.profileId);
        let rows = await sql`
          SELECT * FROM vita_hero.camps
          WHERE profile_id = ${session.profileId}
          ORDER BY date
        `;
        const personal = rows.map((r: Record<string, unknown>) => ({
          ...r,
          is_partner: false,
          school_id: null,
          school_camp_id: null,
          description: "",
          grades: [],
          capacity: 0,
          registered_kid_ids: [],
        }));

        const enrollments = await sql`
          SELECT school_id FROM vita_hero.school_enrollments
          WHERE profile_id = ${session.profileId} AND status = 'ACTIVE'
        `;
        const schoolIds = enrollments.map((e: Record<string, unknown>) => e.school_id as string);
        let partner: Record<string, unknown>[] = [];
        if (schoolIds.length > 0) {
          for (const sid of schoolIds) {
            const partnerRows = await sql`
              SELECT sc.*, s.name AS school_name, s.city AS school_city
              FROM vita_hero.school_camps sc
              JOIN vita_hero.schools s ON s.id = sc.school_id
              -- A camp the school is still drafting, or has cancelled, is not
              -- something a parent should be shown.
              WHERE sc.school_id = ${sid} AND sc.active = true
                AND sc.status NOT IN ('DRAFT', 'CANCELLED')
              ORDER BY sc.date
            `;
            partner.push(...(partnerRows as Record<string, unknown>[]));
          }
          partner.sort((a, b) => String(a.date).localeCompare(String(b.date)));
          const regs = await sql`
            SELECT school_camp_id, kid_id FROM vita_hero.camp_registrations
            WHERE profile_id = ${session.profileId}
          `;
          const regMap = new Map<string, string[]>();
          for (const r of regs) {
            const campId = r.school_camp_id as string;
            const list = regMap.get(campId) || [];
            list.push(r.kid_id as string);
            regMap.set(campId, list);
          }
          partner = partner.map((sc: Record<string, unknown>) => ({
            id: sc.id,
            profile_id: session.profileId,
            title: sc.title,
            school: sc.school_name,
            date: sc.date,
            time: sc.time,
            // The console asks for a venue and a consent deadline on every
            // camp; neither reached the app's camp list, so a parent was told
            // a camp was happening but not where, and not by when to reply.
            venue: sc.venue,
            consent_deadline: sc.consent_deadline,
            status: sc.status,
            checks: sc.checks,
            result_summary: sc.result_summary,
            is_partner: true,
            school_id: sc.school_id,
            school_camp_id: sc.id,
            description: sc.description,
            grades: sc.grades,
            capacity: sc.capacity,
            registered_count: sc.registered_count,
            registered_kid_ids: regMap.get(sc.id as string) || [],
          }));
        }
        return json([...personal, ...partner]);
      }

      if (path === "/api/camps" && request.method === "POST") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const body: Record<string, unknown> = await request.json();
        const row = await sql`
          INSERT INTO vita_hero.camps
            (id, profile_id, user_id, title, school, date, time, status, checks, result_summary)
          VALUES (
            ${body.id as string}, ${session.profileId},
            ${session.userId || null}, ${body.title as string},
            ${body.school as string}, ${body.date as string}, ${body.time as string},
            ${(body.status as string) || "UPCOMING"},
            ${JSON.stringify(body.checks || [])}::jsonb,
            ${(body.result_summary as string) || null}
          )
          ON CONFLICT (id) DO UPDATE SET
            user_id = EXCLUDED.user_id,
            title = EXCLUDED.title, school = EXCLUDED.school,
            date = EXCLUDED.date, time = EXCLUDED.time,
            status = EXCLUDED.status, checks = EXCLUDED.checks,
            result_summary = EXCLUDED.result_summary
          WHERE vita_hero.camps.profile_id = ${session.profileId}
          RETURNING *
        `;
        if (row.length === 0) return json(NOT_YOURS, 409);
        return json(row[0], 201);
      }

      // ═══════════════════════════════════════════════════
      // Meals
      // ═══════════════════════════════════════════════════

      if (path === "/api/meals" && request.method === "GET") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        // Today's plan, not every meal the family has ever logged. The limit
        // is a backstop: six slots a child and a handful of snacks is nowhere
        // near it, and a family that somehow passes it has something wrong
        // that silently returning half a plan would hide.
        const today = programmeToday();
        const rows = await sql`
          SELECT * FROM vita_hero.meal_items
          WHERE profile_id = ${session.profileId} AND day = ${today}
          ORDER BY kid_id, time_slot
          LIMIT 500
        `;
        return json(rows);
      }

      if (path === "/api/meals" && request.method === "POST") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const body = await request.json() as Record<string, unknown>[];
        const meals = Array.isArray(body) ? body : [body];
        if (meals.length === 0) return json([], 201);
        const today = programmeToday();
        if (meals.length > 500) {
          return json({ error: "Too many meals in one request", code: "TOO_MANY" }, 413);
        }

        // Only this parent's own children. The kid id arrived from the client
        // and was never checked, so a day's plan could be written onto
        // somebody else's child.
        const kidIds = [...new Set(meals.map((m) => String(m.kid_id || "")).filter(Boolean))];
        if (kidIds.length > 0) {
          const mine = await sql`
            SELECT id FROM vita_hero.kids
            WHERE id = ANY(${kidIds}) AND profile_id = ${session.profileId}
          `;
          if (mine.length !== kidIds.length) return json({ error: "Kid not found" }, 404);
        }

        // One statement for the whole plan. The app sends a bootstrap plan of
        // several meals per child, and this used to be a round trip each.
        const values: string[] = [];
        const params: unknown[] = [];
        meals.forEach((m, i) => {
          const b = i * 10;
          values.push(
            `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, ` +
            `$${b + 7}, $${b + 8}, $${b + 9}, $${b + 10})`
          );
          params.push(
            String(m.id || ""),
            session.profileId,
            session.userId || null,
            String(m.kid_id || ""),
            String(m.time_slot || ""),
            String(m.name || ""),
            String(m.detail || ""),
            Number(m.kcal) || 0,
            m.eaten === true,
            // The app does not send a day and does not need to: a meal is
            // logged when it is sent. Deliberately not updated on conflict —
            // the app re-sends its whole set on every sync, and re-dating
            // yesterday's plan to today would put the growth straight back.
            String(m.day || "") || today,
          );
        });
        const rows = await sql.query(
          `INSERT INTO vita_hero.meal_items
             (id, profile_id, user_id, kid_id, time_slot, name, detail, kcal, eaten, day)
           VALUES ${values.join(", ")}
           ON CONFLICT (id) DO UPDATE SET
             user_id = EXCLUDED.user_id,
             kid_id = EXCLUDED.kid_id, time_slot = EXCLUDED.time_slot,
             name = EXCLUDED.name, detail = EXCLUDED.detail,
             kcal = EXCLUDED.kcal, eaten = EXCLUDED.eaten
           WHERE vita_hero.meal_items.profile_id = $${params.length + 1}
           RETURNING *`,
          [...params, session.profileId]
        );
        return json(rows, 201);
      }

      // ═══════════════════════════════════════════════════
      // Streaks
      // ═══════════════════════════════════════════════════

      if (path === "/api/streaks" && request.method === "GET") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const kidId = url.searchParams.get("kid_id");
        if (!kidId) return json({ error: "Missing kid_id" }, 400);
        if (!(await kidOwnedByProfile(sql, kidId, session.profileId))) {
          return json({ error: "Kid not found" }, 404);
        }
        const rows = await sql`SELECT * FROM vita_hero.streaks WHERE kid_id = ${kidId} LIMIT 1`;
        return json(rows[0] || null);
      }

      if (path === "/api/streaks" && request.method === "POST") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const body: Record<string, unknown> = await request.json();
        const kidId = body.kid_id as string;
        if (!kidId || !(await kidOwnedByProfile(sql, kidId, session.profileId))) {
          return json({ error: "Kid not found" }, 404);
        }
        const row = await sql`
          INSERT INTO vita_hero.streaks
            (kid_id, user_id, current_streak, best_streak, last_log_date)
          VALUES (
            ${kidId}, ${session.userId || session.profileId},
            ${(body.current_streak as number) || 0},
            ${(body.best_streak as number) || 0},
            ${(body.last_log_date as string) || ""}
          )
          ON CONFLICT (kid_id) DO UPDATE SET
            user_id = EXCLUDED.user_id, current_streak = EXCLUDED.current_streak,
            best_streak = EXCLUDED.best_streak, last_log_date = EXCLUDED.last_log_date
          RETURNING *
        `;
        return json(row[0], 201);
      }

      // ═══════════════════════════════════════════════════
      // Growth Points
      // ═══════════════════════════════════════════════════

      if (path === "/api/growth-points" && request.method === "GET") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const kidId = url.searchParams.get("kid_id");
        if (!kidId) return json({ error: "Missing kid_id" }, 400);
        if (!(await kidOwnedByProfile(sql, kidId, session.profileId))) {
          return json({ error: "Kid not found" }, 404);
        }
        const rows = await sql`SELECT * FROM vita_hero.growth_points WHERE kid_id = ${kidId} ORDER BY recorded_at`;
        return json(rows);
      }

      if (path === "/api/growth-points" && request.method === "POST") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const body: Record<string, unknown> = await request.json();
        const kidId = body.kid_id as string;
        if (!kidId || !(await kidOwnedByProfile(sql, kidId, session.profileId))) {
          return json({ error: "Kid not found" }, 404);
        }
        const row = await sql`
          INSERT INTO vita_hero.growth_points
            (id, kid_id, user_id, label, height, weight, recorded_at)
          VALUES (
            ${body.id as string}, ${kidId},
            ${session.userId || session.profileId}, ${body.label as string},
            ${(body.height as number) || 0}, ${(body.weight as number) || 0}, NOW()
          )
          ON CONFLICT (id) DO UPDATE SET
            user_id = EXCLUDED.user_id,
            label = EXCLUDED.label, height = EXCLUDED.height,
            weight = EXCLUDED.weight
          WHERE vita_hero.growth_points.kid_id = ${kidId}
          RETURNING *
        `;
        if (row.length === 0) return json(NOT_YOURS, 409);
        return json(row[0], 201);
      }

      // ═══════════════════════════════════════════════════
      // Co-Parents
      // ═══════════════════════════════════════════════════

      if (path === "/api/co-parents" && request.method === "GET") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const profileRows = await sql`
          SELECT family_code, name FROM vita_hero.profiles
          WHERE id = ${session.profileId} LIMIT 1
        `;
        const familyCode = (profileRows[0]?.family_code as string) || "";
        const ownerId = await getFamilyOwnerId(sql, familyCode, session.profileId);
        const rows = await sql`
          SELECT * FROM vita_hero.co_parents
          WHERE profile_id = ${ownerId}
          ORDER BY joined_date, name
        `;
        const ownerProfile = await sql`
          SELECT id, name FROM vita_hero.profiles WHERE id = ${ownerId} LIMIT 1
        `;
        const ownerName = (ownerProfile[0]?.name as string) || "Parent";
        const ownerInList = rows.some(
          (r: Record<string, unknown>) => r.user_id === ownerId || r.name === ownerName
        );
        const result: Record<string, unknown>[] = [];
        if (familyCode && ownerId && !ownerInList) {
          result.push({
            id: `owner_${ownerId}`,
            profile_id: ownerId,
            user_id: ownerId,
            name: ownerName,
            relation: "Primary parent",
            joined_date: "",
          });
        }
        result.push(...(rows as Record<string, unknown>[]));
        return json(result);
      }

      if (path === "/api/co-parents" && request.method === "POST") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const body: Record<string, unknown> = await request.json();
        const row = await sql`
          INSERT INTO vita_hero.co_parents
            (id, profile_id, user_id, name, relation, joined_date)
          VALUES (
            ${body.id as string}, ${session.profileId},
            ${session.userId || null}, ${body.name as string},
            ${body.relation as string}, ${(body.joined_date as string) || ""}
          )
          ON CONFLICT (id) DO UPDATE SET
            user_id = EXCLUDED.user_id,
            name = EXCLUDED.name, relation = EXCLUDED.relation,
            joined_date = EXCLUDED.joined_date
          WHERE vita_hero.co_parents.profile_id = ${session.profileId}
          RETURNING *
        `;
        if (row.length === 0) return json(NOT_YOURS, 409);
        return json(row[0], 201);
      }

      // ═══════════════════════════════════════════════════
      // Family Code Lookup
      // ═══════════════════════════════════════════════════

      if (path === "/api/family-lookup" && request.method === "GET") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const code = url.searchParams.get("code");
        if (!code) return json({ error: "Missing code" }, 400);
        const rows = await sql`
          SELECT id, name, family_code FROM vita_hero.profiles
          WHERE family_code = ${code} AND id != ${session.profileId} LIMIT 1
        `;
        return json(rows[0] || null);
      }

      // ── Family Sharing: Validate Code ─────────────────
      if (path === "/api/family-sharing/validate" && request.method === "POST") {
        if (!session) return json({ error: "Authentication required" }, 401);
        const body: Record<string, unknown> = await request.json();
        const code = ((body.code as string) || "").toUpperCase().trim();
        if (code.length < 4) {
          return json({ valid: false, error: "Code too short" }, 400);
        }
        const rows = await sql`
          SELECT id, name, family_code FROM vita_hero.profiles
          WHERE family_code = ${code} LIMIT 1
        `;
        if (rows.length === 0) {
          return json({ valid: false, error: "Family not found. Check the code and try again." });
        }
        return json({
          valid: true,
          familyOwner: rows[0].name,
          profileId: rows[0].id,
        });
      }

      // ── Family Sharing: Join ────────────────────────
      if (path === "/api/family-sharing/join" && request.method === "POST") {
        if (!session) return json({ error: "Authentication required" }, 401);
        const body: Record<string, unknown> = await request.json();
        const code = ((body.code as string) || "").toUpperCase().trim();
        const coParentName = ((body.coParentName as string) || "").trim();
        const relation = ((body.relation as string) || "Co-parent").trim();
        if (!code || !coParentName) {
          return json({ error: "Code and name required" }, 400);
        }
        const familyRows = await sql`
          SELECT id, user_id, family_code FROM vita_hero.profiles
          WHERE family_code = ${code} LIMIT 1
        `;
        if (familyRows.length === 0) {
          return json({ error: "Family not found" }, 404);
        }
        const familyProfile = familyRows[0];
        if (familyProfile.id === session.profileId) {
          return json({ error: "You cannot join your own family" }, 400);
        }
        const coParentId = `cp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await sql`
          INSERT INTO vita_hero.co_parents
            (id, profile_id, user_id, name, relation, joined_date)
          VALUES (
            ${coParentId}, ${familyProfile.id}, ${session.userId || session.profileId},
            ${coParentName}, ${relation}, ${new Date().toISOString().split("T")[0]}
          )
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name, relation = EXCLUDED.relation
        `;
        await sql`
          UPDATE vita_hero.profiles
          SET family_code = ${code}
          WHERE id = ${session.profileId}
        `;
        return json({ success: true, coParentId, familyCode: code });
      }

      // ── Family Sharing: Shared Kids ───────────────────
      if (path === "/api/family-sharing/kids" && request.method === "GET") {
        if (!session) return json({ error: "Authentication required" }, 401);
        const familyCode = url.searchParams.get("familyCode")?.toUpperCase().trim();
        if (!familyCode) return json({ error: "familyCode query parameter required" }, 400);
        const familyRows = await sql`
          SELECT id, user_id FROM vita_hero.profiles
          WHERE family_code = ${familyCode} LIMIT 1
        `;
        if (familyRows.length === 0) {
          return json({ error: "Family not found" }, 404);
        }
        const familyProfile = familyRows[0];
        const isOwner = familyProfile.id === session.profileId ||
          familyProfile.user_id === session.userId;
        let isCoParent = false;
        if (!isOwner) {
          const cpRows = await sql`
            SELECT id FROM vita_hero.co_parents
            WHERE profile_id = ${familyProfile.id}
              AND user_id = ${session.userId || session.profileId}
            LIMIT 1
          `;
          isCoParent = cpRows.length > 0;
        }
        if (!isOwner && !isCoParent) {
          return json({ error: "Not authorized to view this family" }, 403);
        }
        const kids = await sql`
          SELECT * FROM vita_hero.kids
          WHERE profile_id = ${familyProfile.id}
          ORDER BY name
        `;
        return json({
          kids: kids.map((k: Record<string, unknown>) => ({
            id: k.id,
            name: k.name,
            age: k.age,
            gender: k.gender,
            school: k.school,
            grade: k.grade,
            heightCm: k.height_cm,
            weightKg: k.weight_kg,
            overallScore: k.overall_score,
            dental: k.dental,
            eyesight: k.eyesight,
            nutrition: k.nutrition,
            lastCheckup: k.last_checkup,
          })),
          isOwner,
        });
      }

      // ── Leaderboard ───────────────────────────────────
      if (path === "/api/leaderboard" && request.method === "POST") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const body: Record<string, unknown> = await request.json();
        const currentKidId = (body.current_kid_id as string) || "";

        // The kid must be the caller's, otherwise "is_you" can be pointed at
        // any child in the country.
        const owned = await sql`
          SELECT id, school_id, grade FROM vita_hero.kids
          WHERE id = ${currentKidId} AND profile_id = ${session.profileId} LIMIT 1
        `;
        if (owned.length === 0) return json({ error: "That is not your child" }, 403);
        const schoolId = (owned[0].school_id as string) || "";
        const grade = (owned[0].grade as string) || "";

        // Scoped to the child's own school, and their class where we know it.
        // A national ranking of every child in the app is neither motivating
        // nor something to put in front of a parent.
        const rows = await sql`
          WITH scored AS (
            SELECT k.id, k.name, k.overall_score AS score,
              COALESCE(s.current_streak, 0) AS streak,
              (k.overall_score * 10 + COALESCE(s.current_streak, 0) * 50)::INT AS points
            FROM vita_hero.kids k
            LEFT JOIN vita_hero.streaks s ON s.kid_id = k.id
            WHERE k.profile_id IS NOT NULL
              AND COALESCE(k.status,'ACTIVE') = 'ACTIVE'
              AND (
                (${schoolId} <> '' AND k.school_id = ${schoolId}
                  AND (${grade} = '' OR k.grade = ${grade}))
                OR (${schoolId} = '' AND k.id = ${currentKidId})
              )
          ),
          ranked AS (
            SELECT ROW_NUMBER() OVER (ORDER BY s.points DESC, s.score DESC) AS rank,
              s.name AS kid_name, (s.id = ${currentKidId}) AS is_you, s.score, s.points
            FROM scored s
          )
          SELECT rank, kid_name, is_you, score, points
          FROM ranked r WHERE r.is_you OR r.rank <= 20
          ORDER BY rank LIMIT 20
        `;
        const anonymized = rows.map((r: Record<string, unknown>) => ({
          ...r,
          kid_name: anonymizeLeaderboardName(
            r.kid_name as string,
            r.rank as number,
            r.is_you as boolean
          ),
        }));
        return json(anonymized);
      }

      // ── AI Diet Tips (persisted) ──────────────────────
      if (path === "/api/ai-diet-tips" && request.method === "GET") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const kidId = url.searchParams.get("kid_id");
        if (!kidId) return json({ error: "Missing kid_id" }, 400);
        if (!(await kidOwnedByProfile(sql, kidId, session.profileId))) {
          return json({ error: "Kid not found" }, 404);
        }
        const rows = await sql`
          SELECT content, generated_at FROM vita_hero.ai_diet_tips
          WHERE kid_id = ${kidId} AND profile_id = ${session.profileId}
          LIMIT 1
        `;
        return json(rows[0] || null);
      }

      if (path === "/api/ai-diet-tips" && request.method === "POST") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const body: Record<string, unknown> = await request.json();
        const kidId = body.kid_id as string;
        if (!kidId || !(await kidOwnedByProfile(sql, kidId, session.profileId))) {
          return json({ error: "Kid not found" }, 404);
        }
        const content = body.content as Record<string, unknown>;
        const row = await sql`
          INSERT INTO vita_hero.ai_diet_tips (kid_id, profile_id, content, generated_at)
          VALUES (${kidId}, ${session.profileId}, ${JSON.stringify(content)}::jsonb, NOW())
          ON CONFLICT (kid_id) DO UPDATE SET
            content = EXCLUDED.content,
            generated_at = NOW()
          RETURNING content, generated_at
        `;
        return json(row[0], 201);
      }

      if (path === "/api/ai-diet-tips/generate" && request.method === "POST") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const body: Record<string, unknown> = await request.json();
        const kidId = body.kid_id as string;
        if (!kidId || !(await kidOwnedByProfile(sql, kidId, session.profileId))) {
          return json({ error: "Kid not found" }, 404);
        }

        await mergeCampResultsIntoKids(sql, session.profileId);
        const kidRows = await sql`
          SELECT * FROM vita_hero.kids
          WHERE id = ${kidId} AND profile_id = ${session.profileId}
          LIMIT 1
        `;
        // Today's, like /api/meals. This is the same view of the same thing,
        // and returning every meal ever logged here would put back exactly
        // what dating the rows was for.
        const mealRows = await sql`
          SELECT * FROM vita_hero.meal_items
          WHERE kid_id = ${kidId} AND profile_id = ${session.profileId}
            AND day = ${programmeToday()}
          ORDER BY time_slot
          LIMIT 200
        `;
        const streakRows = await sql`
          SELECT * FROM vita_hero.streaks
          WHERE kid_id = ${kidId}
          LIMIT 1
        `;

        const aiJson = await callToolkitDietTip(
          env,
          kidRows[0] as Record<string, unknown>,
          mealRows as Record<string, unknown>[],
          (streakRows[0] as Record<string, unknown>) || null
        );
        if (!aiJson) {
          return json({ error: "AI not configured", code: "TOOLKIT_NOT_CONFIGURED" }, 503);
        }

        const content = {
          greeting: String(aiJson.greeting || ""),
          insight: String(aiJson.insight || ""),
          suggestion: String(aiJson.suggestion || ""),
          funFact: String(aiJson.funFact || ""),
          generatedAt: `AI-generated for ${kidRows[0].name}`,
        };
        const row = await sql`
          INSERT INTO vita_hero.ai_diet_tips (kid_id, profile_id, content, generated_at)
          VALUES (${kidId}, ${session.profileId}, ${JSON.stringify(content)}::jsonb, NOW())
          ON CONFLICT (kid_id) DO UPDATE SET
            content = EXCLUDED.content,
            generated_at = NOW()
          RETURNING content, generated_at
        `;
        return json(row[0], 201);
      }

      // ── Food recognition (AI vision) ──────────────────
      if (path === "/api/food-recognition" && request.method === "POST") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const body: Record<string, unknown> = await request.json();
        const imageBase64 = String(body.image_base64 || "").trim();
        if (!imageBase64) return json({ error: "Missing image_base64" }, 400);
        const mime = String(body.mime || "image/jpeg");
        const dataUrl = imageBase64.startsWith("data:")
          ? imageBase64
          : `data:${mime};base64,${imageBase64}`;
        const items = await callToolkitFoodVision(env, dataUrl);
        if (items === null) {
          return json(
            { error: "AI not configured", code: "TOOLKIT_NOT_CONFIGURED" },
            503
          );
        }
        return json({ items });
      }

      // ── Doctors directory ─────────────────────────────
      if (path === "/api/schools" && request.method === "GET") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const rows = await sql`
          SELECT id, name, city, district, description, active
          FROM vita_hero.schools
          WHERE active = true
          ORDER BY name
        `;
        return json(rows);
      }

      if (path === "/api/schools/my" && request.method === "GET") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const rows = await sql`
          SELECT s.id, s.name, s.city, s.district, s.description, e.enrolled_at, e.kid_id
          FROM vita_hero.school_enrollments e
          JOIN vita_hero.schools s ON s.id = e.school_id
          WHERE e.profile_id = ${session.profileId} AND e.status = 'ACTIVE'
          ORDER BY s.name
        `;
        return json(rows);
      }

      if (path === "/api/schools/enroll" && request.method === "POST") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const body: Record<string, unknown> = await request.json();
        const code = ((body.partner_code as string) || "").toUpperCase().trim();
        const kidId = (body.kid_id as string) || null;
        if (code.length < 4) return json({ error: "Partner code required" }, 400);

        const schoolRows = await sql`
          SELECT id, name FROM vita_hero.schools
          WHERE partner_code = ${code} AND active = true LIMIT 1
        `;
        if (schoolRows.length === 0) {
          return json({ error: "Invalid partner code. Check with your school nurse." }, 404);
        }
        const school = schoolRows[0];
        if (kidId && !(await kidOwnedByProfile(sql, kidId, session.profileId))) {
          return json({ error: "Kid not found" }, 404);
        }
        const enrollId = `enr_${session.profileId}_${school.id}`;
        await sql`
          INSERT INTO vita_hero.school_enrollments
            (id, profile_id, school_id, kid_id, status)
          VALUES (${enrollId}, ${session.profileId}, ${school.id}, ${kidId}, 'ACTIVE')
          ON CONFLICT (profile_id, school_id) DO UPDATE SET
            kid_id = EXCLUDED.kid_id,
            status = 'ACTIVE',
            enrolled_at = NOW()
        `;
        return json({ success: true, schoolId: school.id, schoolName: school.name });
      }

      if (path === "/api/school-camps/register" && request.method === "POST") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const body: Record<string, unknown> = await request.json();
        const schoolCampId = body.school_camp_id as string;
        const kidId = body.kid_id as string;
        if (!schoolCampId || !kidId) return json({ error: "school_camp_id and kid_id required" }, 400);
        if (!(await kidOwnedByProfile(sql, kidId, session.profileId))) {
          return json({ error: "Kid not found" }, 404);
        }
        const campRows = await sql`
          SELECT sc.*, s.name AS school_name FROM vita_hero.school_camps sc
          JOIN vita_hero.schools s ON s.id = sc.school_id
          WHERE sc.id = ${schoolCampId} AND sc.active = true LIMIT 1
        `;
        if (campRows.length === 0) return json({ error: "Camp not found" }, 404);
        const camp = campRows[0];
        const enrolled = await sql`
          SELECT id FROM vita_hero.school_enrollments
          WHERE profile_id = ${session.profileId} AND school_id = ${camp.school_id} AND status = 'ACTIVE'
          LIMIT 1
        `;
        if (enrolled.length === 0) {
          return json({ error: "Enroll with your school partner code first" }, 403);
        }
        const regId = `reg_${schoolCampId}_${kidId}`;
        await sql`
          INSERT INTO vita_hero.camp_registrations
            (id, profile_id, school_camp_id, kid_id)
          VALUES (${regId}, ${session.profileId}, ${schoolCampId}, ${kidId})
          ON CONFLICT (profile_id, school_camp_id, kid_id) DO NOTHING
        `;
        await sql`
          UPDATE vita_hero.school_camps
          SET registered_count = (
            SELECT COUNT(*)::int FROM vita_hero.camp_registrations
            WHERE school_camp_id = ${schoolCampId}
          )
          WHERE id = ${schoolCampId}
        `;
        await mergeCampResultsIntoKids(sql, session.profileId);
        return json({ success: true, registrationId: regId });
      }

      if (path === "/api/booking/slots" && request.method === "GET") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const doctorId = (url.searchParams.get("doctor_id") || "").trim();
        if (!doctorId) return json({ error: "doctor_id required" }, 400);

        const doctorRows = await sql`
          SELECT id, name FROM vita_hero.doctors
          WHERE id = ${doctorId} AND active = true LIMIT 1
        `;
        if (doctorRows.length === 0) return json({ error: "Doctor not found" }, 404);

        const booked = await sql`
          SELECT doctor_id, date, time FROM vita_hero.appointments
          WHERE doctor_id = ${doctorId}
        `;
        const bookedKeys = new Set(
          booked.map((r: Record<string, unknown>) =>
            `${r.doctor_id}|${r.date}|${r.time}`
          )
        );
        const slots = generateDoctorSlots(doctorId, bookedKeys);
        return json({ doctor_id: doctorId, slots });
      }

      if (path === "/api/booking/directory" && request.method === "GET") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const city = (url.searchParams.get("city") || "Hyderabad").trim();
        const specialty = (url.searchParams.get("specialty") || "").trim();
        const latParam = url.searchParams.get("lat");
        const lngParam = url.searchParams.get("lng");
        const userLat = latParam ? parseFloat(latParam) : null;
        const userLng = lngParam ? parseFloat(lngParam) : null;

        const enrolledSchools = await sql`
          SELECT school_id FROM vita_hero.school_enrollments
          WHERE profile_id = ${session.profileId} AND status = 'ACTIVE'
        `;
        const userSchoolIds = enrolledSchools.map((r) => r.school_id as string);

        const hospitalRows = await sql`
          SELECT h.id, h.name, h.city, h.district, h.address, h.lat, h.lng,
                 h.phone, h.rating, h.is_camp_partner,
                 COUNT(DISTINCT sc.id)::int AS conducted_camps,
                 COUNT(DISTINCT CASE
                   WHEN sc.school_id = ANY(${userSchoolIds.length ? userSchoolIds : ["__none__"]}::text[])
                   THEN sc.id END)::int AS user_linked_camps
          FROM vita_hero.hospitals h
          LEFT JOIN vita_hero.school_camps sc
            ON sc.hospital_id = h.id AND sc.active = true
          WHERE h.active = true AND h.city ILIKE ${city}
          GROUP BY h.id
        `;

        const doctorRows = await sql`
          SELECT d.id, d.name, d.specialty, d.hospital, d.city, d.rating, d.hospital_id,
                 h.name AS hospital_name, h.is_camp_partner,
                 COUNT(DISTINCT sc.id)::int AS conducted_camps
          FROM vita_hero.doctors d
          LEFT JOIN vita_hero.hospitals h ON h.id = d.hospital_id
          LEFT JOIN vita_hero.school_camps sc
            ON sc.hospital_id = d.hospital_id AND sc.active = true
          WHERE d.active = true AND (d.city ILIKE ${city} OR h.city ILIKE ${city})
          GROUP BY d.id, h.name, h.is_camp_partner
        `;

        type DoctorRow = {
          id: string;
          name: string;
          specialty: string;
          hospital: string;
          city: string;
          rating: number;
          hospital_id: string | null;
          hospital_name: string | null;
          is_camp_partner: boolean | null;
          conducted_camps: number;
        };

        const doctorsByHospital = new Map<string, DoctorRow[]>();
        const allSpecialties = new Set<string>();

        for (const row of doctorRows as DoctorRow[]) {
          if (specialty && row.specialty !== specialty) continue;
          allSpecialties.add(row.specialty);
          const hid = row.hospital_id || "unlinked";
          if (!doctorsByHospital.has(hid)) doctorsByHospital.set(hid, []);
          doctorsByHospital.get(hid)!.push(row);
        }

        type HospitalOut = Record<string, unknown>;
        const hospitals: HospitalOut[] = [];

        for (const h of hospitalRows) {
          const hid = h.id as string;
          const docs = doctorsByHospital.get(hid) || [];
          if (docs.length === 0 && specialty) continue;

          const lat = h.lat as number | null;
          const lng = h.lng as number | null;
          const distanceKm =
            userLat != null && userLng != null && lat != null && lng != null
              ? Math.round(haversineKm(userLat, userLng, lat, lng) * 10) / 10
              : null;

          const conductedCamps = (h.conducted_camps as number) || 0;
          const userLinkedCamps = (h.user_linked_camps as number) || 0;
          const userCampLinked = userLinkedCamps > 0;
          const isCampPartner = (h.is_camp_partner as boolean) || conductedCamps > 0;

          const specialties = [...new Set(docs.map((d) => d.specialty))].sort();
          for (const s of specialties) allSpecialties.add(s);

          const priorityScore =
            (userCampLinked ? 10000 : 0) +
            conductedCamps * 100 +
            (isCampPartner ? 500 : 0) +
            ((h.rating as number) || 0) * 10 -
            (distanceKm ?? 999);

          hospitals.push({
            id: hid,
            name: h.name,
            city: h.city,
            district: h.district,
            address: h.address,
            lat,
            lng,
            phone: h.phone,
            rating: h.rating,
            is_camp_partner: isCampPartner,
            conducted_camps: conductedCamps,
            user_camp_linked: userCampLinked,
            user_linked_camps: userLinkedCamps,
            distance_km: distanceKm,
            priority_score: priorityScore,
            specialties,
            doctors: docs
              .sort((a, b) => (b.rating || 0) - (a.rating || 0))
              .map((d) => ({
                id: d.id,
                name: d.name,
                specialty: d.specialty,
                hospital: d.hospital_name || d.hospital,
                hospital_id: d.hospital_id,
                city: d.city,
                rating: d.rating,
                is_camp_partner: d.is_camp_partner || isCampPartner,
              })),
          });
        }

        hospitals.sort(
          (a, b) => (b.priority_score as number) - (a.priority_score as number)
        );

        return json({
          city,
          hospitals,
          specialties: [...allSpecialties].sort(),
        });
      }

      if (path === "/api/doctors" && request.method === "GET") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const city = (url.searchParams.get("city") || "").trim();
        const hospitalId = (url.searchParams.get("hospital_id") || "").trim();
        const specialty = (url.searchParams.get("specialty") || "").trim();

        const rows = await sql`
          SELECT d.id, d.name, d.specialty, d.hospital, d.city, d.rating,
                 d.hospital_id, h.name AS hospital_name, h.is_camp_partner
          FROM vita_hero.doctors d
          LEFT JOIN vita_hero.hospitals h ON h.id = d.hospital_id
          WHERE d.active = true
            AND (${city} = '' OR d.city ILIKE ${city} OR h.city ILIKE ${city})
            AND (${hospitalId} = '' OR d.hospital_id = ${hospitalId})
            AND (${specialty} = '' OR d.specialty = ${specialty})
          ORDER BY d.rating DESC, d.name
        `;
        return json(rows);
      }

      // ── Mark notifications read ───────────────────────
      if (path === "/api/notifications/read" && request.method === "POST") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const body: Record<string, unknown> = await request.json();
        const ids = Array.isArray(body.ids) ? (body.ids as string[]) : [];
        if (ids.length === 0) return json({ success: true });

        const profileRows = await sql`
          SELECT read_notification_ids FROM vita_hero.profiles
          WHERE id = ${session.profileId} LIMIT 1
        `;
        const existing = (profileRows[0]?.read_notification_ids as string[]) || [];
        const merged = [...new Set([...existing, ...ids])];
        await sql`
          UPDATE vita_hero.profiles
          SET read_notification_ids = ${JSON.stringify(merged)}::jsonb
          WHERE id = ${session.profileId}
        `;
        return json({ success: true, readCount: merged.length });
      }

      // ── In-app notifications feed ─────────────────────
      if (path === "/api/notifications" && request.method === "GET") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const items: Array<Record<string, unknown>> = [];

        const profileRows = await sql`
          SELECT read_notification_ids FROM vita_hero.profiles
          WHERE id = ${session.profileId} LIMIT 1
        `;
        const readIds = new Set<string>(
          ((profileRows[0]?.read_notification_ids as string[]) || [])
        );

        const camps = await sql`
          SELECT title, school, date, time, status FROM vita_hero.camps
          WHERE profile_id = ${session.profileId} AND status = 'UPCOMING'
          ORDER BY date LIMIT 5
        `;
        for (const c of camps) {
          const id = `camp_${c.title}_${c.date}`;
          items.push({
            id,
            title: "Upcoming health camp",
            body: `${c.title} at ${c.school || "school"} on ${c.date}`,
            time: c.date as string,
            type: "CAMP",
            unread: !readIds.has(id),
          });
        }

        const appts = await sql`
          SELECT doctor_name, kid_name, date, time FROM vita_hero.appointments
          WHERE profile_id = ${session.profileId}
          ORDER BY date, time LIMIT 5
        `;
        for (const a of appts) {
          const id = `appt_${a.doctor_name}_${a.date}_${a.time}`;
          items.push({
            id,
            title: "Checkup reminder",
            body: `${a.kid_name} with ${a.doctor_name} on ${a.date} at ${a.time}`,
            time: a.date as string,
            type: "CHECKUP",
            unread: !readIds.has(id),
          });
        }

        const kids = await sql`
          SELECT k.name, COALESCE(s.current_streak, 0) AS streak
          FROM vita_hero.kids k
          LEFT JOIN vita_hero.streaks s ON s.kid_id = k.id
          WHERE k.profile_id = ${session.profileId}
        `;
        for (const k of kids) {
          if ((k.streak as number) >= 3) {
            const id = `streak_${k.name}`;
            items.push({
              id,
              title: "Streak milestone",
              body: `${k.name} is on a ${k.streak}-day meal logging streak!`,
              time: new Date().toISOString().split("T")[0],
              type: "REWARD",
              unread: !readIds.has(id),
            });
          }
        }

        return json(items);
      }

      return json({ error: "Not found", path }, 404);

    } catch (error) {
      // serverError, not a blanket 500: an ApiError reaching here is still a
      // sentence written for the person who asked — a 413 for too much, a 403
      // for not yours — and turning those into "something went wrong" loses
      // both the reason and the status.
      return serverError(error, "worker");
    }
  },
};
