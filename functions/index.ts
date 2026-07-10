const LOGO_DATA_URI = "data:image/png;base64,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";

// VitaHero Neon DB Backend — Cloudflare Worker
// Admin panel & invite page redesigned to match app brand
// Fix: eliminated template-literal quote escaping in admin JS
// Connects to Neon Postgres (vita_hero schema) for all CRUD operations.
// Updated: 2026-07-03 — admin panel uses app icon logo
// Auth delegates to Neon Auth (Better Auth) for Google OAuth + email/password.
// Phone OTP via Plivo is independent.
// Updated: 2026-06-15 — email/password + Neon Auth social sign-in (idToken exchange, no callbackURL)

import { neon } from "@neondatabase/serverless";
import { renderAdminPanel } from "./admin-panel";

const SCHEMA = "vita_hero";
const NEON_AUTH = "https://ep-super-tree-afp87aw4.neonauth.c-2.us-west-2.aws.neon.tech/neondb/auth";
const APP_ORIGIN = "https://kidhero.rork.app";
const APP_CALLBACK_URL = "https://kidhero.rork.app/auth/callback";
const PLIVO_API = "https://api.plivo.com/v1/Account";
// Plivo source number (your purchased Plivo phone number in E.164 format).
// Override at deploy time via the PLIVO_SRC_NUMBER env var if needed.
const PLIVO_SRC_NUMBER = "+12562828337";
const OTP_EXPIRY_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;
const DOCTOR_SETUP_OTP_EXPIRY_MINUTES = 30;

// ── Closed-app configuration ──
// VitaHero is a closed, admin-provisioned app: parents log in by phone only and
// must have been imported by an admin first. Public self-signup is disabled.
const ANDROID_PACKAGE = "com.rork.vitahero";
const DEFAULT_COUNTRY_CODE = "91"; // India
const INVITE_EXPIRY_DAYS = 30;
const INVITE_RESEND_COOLDOWN_HOURS = 24;
const IMPORT_MAX_ROWS = 2000;

interface Env {
  DATABASE_URL: string;
  PLIVO_AUTH_ID: string;
  PLIVO_AUTH_TOKEN: string;
  // Optional override for the Plivo source (sender) number.
  PLIVO_SRC_NUMBER?: string;
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
  // ── DEV MODE ──────────────────────────────────────────────
  // Set DEV_MODE=true to bypass Plivo SMS entirely:
  //  • Any phone number can request an OTP (no admin provisioning needed).
  //  • The OTP code is returned in the /phone/send response as `dev_otp`.
  //  • A test profile is auto-provisioned on first OTP request.
  //  • Invite SMS sends are skipped (the invite link is logged instead).
  // Never enable in production — the OTP is exposed in the API response.
  DEV_MODE?: string;
}

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

async function generateAndSendOtp(
  sql: ReturnType<typeof neon>,
  env: Env,
  phone: string,
  template?: string
): Promise<{ otp: string; sent: boolean }> {
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + DOCTOR_SETUP_OTP_EXPIRY_MINUTES * 60_000);
  await sql`
    INSERT INTO ${sql.unsafe(SCHEMA)}.phone_otps (phone, otp, expires_at, attempts, last_sent_at)
    VALUES (${phone}, ${otp}, ${expiresAt.toISOString()}, 0, NOW())
    ON CONFLICT (phone) DO UPDATE SET
      otp = EXCLUDED.otp,
      expires_at = EXCLUDED.expires_at,
      attempts = 0,
      last_sent_at = NOW()
  `;
  const text = (template || "Your VitaHero verification code is: {otp}").replace("{otp}", otp);
  const sent = await sendPlivoSms(env, phone, text);
  return { otp, sent };
}

function sanitizeProfile(row: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!row) return null;
  const copy = { ...row };
  delete copy.session_token;
  return copy;
}

async function kidOwnedByProfile(
  sql: ReturnType<typeof neon>,
  kidId: string,
  profileId: string
): Promise<boolean> {
  const rows = await sql`
    SELECT id FROM ${sql.unsafe(SCHEMA)}.kids
    WHERE id = ${kidId} AND profile_id = ${profileId} LIMIT 1
  `;
  return rows.length > 0;
}

async function ensureSchema(sql: ReturnType<typeof neon>): Promise<void> {
  await sql`CREATE SCHEMA IF NOT EXISTS ${sql.unsafe(SCHEMA)}`;

  await sql`
    CREATE TABLE IF NOT EXISTS ${sql.unsafe(SCHEMA)}.profiles (
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
    ALTER TABLE ${sql.unsafe(SCHEMA)}.profiles
    ADD COLUMN IF NOT EXISTS read_notification_ids JSONB DEFAULT '[]'::jsonb
  `;

  // Closed-app: roles + admin provisioning of parents.
  await sql`ALTER TABLE vita_hero.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'PARENT'`;
  await sql`ALTER TABLE vita_hero.profiles ADD COLUMN IF NOT EXISTS provisioned BOOLEAN DEFAULT false`;
  await sql`ALTER TABLE vita_hero.profiles ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ`;
  await sql`ALTER TABLE vita_hero.profiles ADD COLUMN IF NOT EXISTS invite_count INT DEFAULT 0`;
  await sql`ALTER TABLE vita_hero.profiles ADD COLUMN IF NOT EXISTS school_id TEXT`;

  await sql`
    CREATE TABLE IF NOT EXISTS ${sql.unsafe(SCHEMA)}.phone_otps (
      phone TEXT PRIMARY KEY,
      otp TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      attempts INT DEFAULT 0,
      last_sent_at TIMESTAMPTZ
    )
  `;

  await sql`
    ALTER TABLE ${sql.unsafe(SCHEMA)}.phone_otps
    ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMPTZ
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ${sql.unsafe(SCHEMA)}.kids (
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
    CREATE TABLE IF NOT EXISTS ${sql.unsafe(SCHEMA)}.appointments (
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

  await sql`ALTER TABLE ${sql.unsafe(SCHEMA)}.appointments ADD COLUMN IF NOT EXISTS doctor_id TEXT`;

  await sql`
    CREATE TABLE IF NOT EXISTS ${sql.unsafe(SCHEMA)}.camps (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      user_id TEXT,
      title TEXT NOT NULL,
      school TEXT DEFAULT '',
      date TEXT NOT NULL,
      time TEXT DEFAULT '',
      status TEXT DEFAULT 'UPCOMING',
      checks JSONB DEFAULT '[]'::jsonb,
      result_summary TEXT
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ${sql.unsafe(SCHEMA)}.meal_items (
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

  await sql`
    CREATE TABLE IF NOT EXISTS ${sql.unsafe(SCHEMA)}.streaks (
      kid_id TEXT PRIMARY KEY,
      user_id TEXT,
      current_streak INT DEFAULT 0,
      best_streak INT DEFAULT 0,
      last_log_date TEXT DEFAULT ''
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ${sql.unsafe(SCHEMA)}.growth_points (
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
    CREATE TABLE IF NOT EXISTS ${sql.unsafe(SCHEMA)}.co_parents (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      user_id TEXT,
      name TEXT NOT NULL,
      relation TEXT DEFAULT '',
      joined_date TEXT DEFAULT ''
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ${sql.unsafe(SCHEMA)}.doctors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      specialty TEXT NOT NULL,
      hospital TEXT DEFAULT '',
      city TEXT DEFAULT 'Hyderabad',
      rating DOUBLE PRECISION DEFAULT 4.5,
      active BOOLEAN DEFAULT true
    )
  `;

  const docCount = await sql`SELECT COUNT(*)::int AS c FROM ${sql.unsafe(SCHEMA)}.doctors`;
  if ((docCount[0]?.c as number) === 0) {
    const doctors = [
      ["d1", "Dr. Ananya Rao", "Paediatrics", "Rainbow Children's Hospital", 4.9],
      ["d2", "Dr. Vikram Reddy", "Dental", "Apollo Cradle", 4.7],
      ["d3", "Dr. Meera Iyer", "Ophthalmology", "LV Prasad Eye Institute", 4.8],
      ["d4", "Dr. Karthik Nair", "Nutrition", "KIMS Hospital", 4.6],
      ["d5", "Dr. Priya Sharma", "General Paediatrics", "Continental Hospitals", 4.5],
    ] as const;
    for (const [id, name, specialty, hospital, rating] of doctors) {
      await sql`
        INSERT INTO ${sql.unsafe(SCHEMA)}.doctors (id, name, specialty, hospital, rating)
        VALUES (${id}, ${name}, ${specialty}, ${hospital}, ${rating})
        ON CONFLICT (id) DO NOTHING
      `;
    }
  }

  await sql`
    CREATE TABLE IF NOT EXISTS ${sql.unsafe(SCHEMA)}.ai_diet_tips (
      kid_id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      content JSONB NOT NULL,
      generated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ${sql.unsafe(SCHEMA)}.schools (
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
    CREATE TABLE IF NOT EXISTS ${sql.unsafe(SCHEMA)}.school_enrollments (
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
    CREATE TABLE IF NOT EXISTS ${sql.unsafe(SCHEMA)}.school_camps (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      date TEXT NOT NULL,
      time TEXT DEFAULT '',
      status TEXT DEFAULT 'UPCOMING',
      checks JSONB DEFAULT '[]'::jsonb,
      grades JSONB DEFAULT '[]'::jsonb,
      capacity INT DEFAULT 200,
      registered_count INT DEFAULT 0,
      result_summary TEXT,
      active BOOLEAN DEFAULT true
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ${sql.unsafe(SCHEMA)}.camp_registrations (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      school_camp_id TEXT NOT NULL,
      kid_id TEXT NOT NULL,
      registered_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (profile_id, school_camp_id, kid_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ${sql.unsafe(SCHEMA)}.camp_kid_results (
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

  // ── Doctor system: per-camp credentials + health checkup forms ──
  // doctor_camp_assignments links a doctor profile to one or more camps.
  await sql`
    CREATE TABLE IF NOT EXISTS ${sql.unsafe(SCHEMA)}.doctor_camp_assignments (
      id TEXT PRIMARY KEY,
      doctor_profile_id TEXT NOT NULL,
      school_camp_id TEXT NOT NULL,
      role TEXT DEFAULT 'DOCTOR',
      status TEXT DEFAULT 'ACTIVE',
      assigned_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (doctor_profile_id, school_camp_id)
    )
  `;

  // health_checkups stores comprehensive screening form data as JSONB.
  // One row per kid per camp (doctor can update an existing record).
  await sql`
    CREATE TABLE IF NOT EXISTS ${sql.unsafe(SCHEMA)}.health_checkups (
      id TEXT PRIMARY KEY,
      kid_id TEXT NOT NULL,
      school_camp_id TEXT NOT NULL,
      doctor_profile_id TEXT NOT NULL,
      doctor_name TEXT DEFAULT '',
      form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
      summary TEXT DEFAULT '',
      referral_needed BOOLEAN DEFAULT false,
      referral_notes TEXT DEFAULT '',
      overall_status TEXT DEFAULT 'GOOD',
      recorded_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (kid_id, school_camp_id)
    )
  `;

  await ensureHospitalPartnerships(sql);
  await seedPartnerSchools(sql);
  await linkCampHospitals(sql);

  // Performance indexes for admin panel queries.
  await sql`CREATE INDEX IF NOT EXISTS idx_profiles_provisioned ON ${sql.unsafe(SCHEMA)}.profiles(provisioned, invited_at DESC NULLS LAST, name, phone)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_profiles_role ON ${sql.unsafe(SCHEMA)}.profiles(role, id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_kids_profile_id ON ${sql.unsafe(SCHEMA)}.kids(profile_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_doctor_camp_assignments_profile ON ${sql.unsafe(SCHEMA)}.doctor_camp_assignments(doctor_profile_id, assigned_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_school_camps_date ON ${sql.unsafe(SCHEMA)}.school_camps(date DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sms_log_type_status ON ${sql.unsafe(SCHEMA)}.sms_log(type, status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_import_batches_created_at ON ${sql.unsafe(SCHEMA)}.import_batches(created_at DESC)`;
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

async function seedPartnerSchools(sql: ReturnType<typeof neon>): Promise<void> {
  const schoolCount = await sql`SELECT COUNT(*)::int AS c FROM ${sql.unsafe(SCHEMA)}.schools`;
  if ((schoolCount[0]?.c as number) > 0) return;

  const schools = [
    ["sch_oak", "Oakridge International School", "Hyderabad", "Gachibowli", "OAK2026", "health@oakridge.in", "Partner since 2024 · Full annual screening programme"],
    ["sch_dps", "Delhi Public School Hyderabad", "Hyderabad", "Khajaguda", "DPS2026", "nurse@dpshyd.com", "Vision, dental & nutrition camps every term"],
    ["sch_jgs", "Johnson Grammar School", "Hyderabad", "Habsiguda", "JGS2026", "wellness@jgs.edu.in", "IAP-aligned growth monitoring"],
    ["sch_chirec", "CHIREC International School", "Hyderabad", "Kondapur", "CHI2026", "health@chirec.in", "WHO growth charts integrated with camp results"],
  ] as const;

  for (const [id, name, city, district, code, email, desc] of schools) {
    await sql`
      INSERT INTO ${sql.unsafe(SCHEMA)}.schools (id, name, city, district, partner_code, contact_email, description)
      VALUES (${id}, ${name}, ${city}, ${district}, ${code}, ${email}, ${desc})
      ON CONFLICT (id) DO NOTHING
    `;
  }

  const now = new Date();
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const d14 = new Date(now); d14.setDate(d14.getDate() + 14);
  const d28 = new Date(now); d28.setDate(d28.getDate() + 28);
  const d45 = new Date(now); d45.setDate(d45.getDate() + 45);
  const d60 = new Date(now); d60.setDate(d60.getDate() - 30);

  const campHospitalById: Record<string, string> = {
    sc_oak_1: "hosp_rainbow",
    sc_oak_2: "hosp_kims",
    sc_oak_past: "hosp_rainbow",
    sc_dps_1: "hosp_lvp",
    sc_jgs_1: "hosp_rainbow",
    sc_chirec_1: "hosp_continental",
  };

  const camps = [
    ["sc_oak_1", "sch_oak", "Annual Health & Growth Camp", "Full IAP screening: height, weight, BMI percentile, dental, vision, Hb", fmt(d14), "9:00 AM – 1:00 PM", "UPCOMING", ["Height & Weight", "BMI Percentile", "Dental", "Eye Test", "Hemoglobin"], ["Class 1", "Class 2", "Class 3", "Class 4", "Class 5"], 250, null],
    ["sc_oak_2", "sch_oak", "Nutrition & Anaemia Camp", "Focus on iron deficiency and BMI-for-age screening", fmt(d45), "10:00 AM – 12:30 PM", "UPCOMING", ["Nutrition", "Hemoglobin", "BMI"], ["Class 6", "Class 7", "Class 8"], 180, null],
    ["sc_dps_1", "sch_dps", "Vision & Dental Screening", "School-wide eye and dental check for primary grades", fmt(d28), "8:30 AM – 12:00 PM", "UPCOMING", ["Dental", "Eye Test"], ["Nursery", "Class 1", "Class 2", "Class 3"], 300, null],
    ["sc_jgs_1", "sch_jgs", "Growth Monitoring Day", "WHO/IAP growth charts with paediatrician review", fmt(d45), "9:00 AM – 2:00 PM", "UPCOMING", ["Height & Weight", "Growth Percentile", "Nutrition"], ["Class 4", "Class 5", "Class 6"], 200, null],
    ["sc_chirec_1", "sch_chirec", "Comprehensive Health Camp", "Multi-specialty camp with follow-up booking", fmt(d14), "9:00 AM – 3:00 PM", "UPCOMING", ["Height & Weight", "Dental", "Eye Test", "Nutrition", "General"], ["All grades"], 400, null],
    ["sc_oak_past", "sch_oak", "Mid-Term Dental Check", "Completed screening — 3 follow-ups recommended", fmt(d60), "10:00 AM – 12:00 PM", "COMPLETED", ["Dental"], ["Class 3", "Class 4"], 120, "142 children screened · 3 follow-ups recommended"],
  ] as const;

  for (const [id, schoolId, title, desc, date, time, status, checks, grades, cap, summary] of camps) {
    const hospitalId = campHospitalById[id] || null;
    await sql`
      INSERT INTO ${sql.unsafe(SCHEMA)}.school_camps
        (id, school_id, title, description, date, time, status, checks, grades, capacity, result_summary, hospital_id)
      VALUES (
        ${id}, ${schoolId}, ${title}, ${desc}, ${date}, ${time}, ${status},
        ${JSON.stringify(checks)}::jsonb, ${JSON.stringify(grades)}::jsonb,
        ${cap}, ${summary}, ${hospitalId}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }
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

function stableHash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function nutritionFlagFromBmi(bmi: number): string {
  if (bmi <= 0) return "GOOD";
  if (bmi < 14) return "WATCH";
  if (bmi > 19.5) return "ALERT";
  if (bmi < 15 || bmi > 18) return "WATCH";
  return "GOOD";
}

function deriveCampFlags(
  kid: Record<string, unknown>,
  checks: string[],
  campId: string,
  resultSummary: string | null
): { dental: string; eyesight: string; nutrition: string; height_cm: number; weight_kg: number } {
  const heightCm = Number(kid.height_cm) || 0;
  const weightKg = Number(kid.weight_kg) || 0;
  const bmi = kidBmi(heightCm, weightKg);
  const seed = stableHash(`${kid.id}:${campId}`);
  const checkText = checks.join(" ").toLowerCase();

  let dental = (kid.dental as string) || "GOOD";
  let eyesight = (kid.eyesight as string) || "GOOD";
  let nutrition = nutritionFlagFromBmi(bmi);

  if (checkText.includes("dental")) {
    if (resultSummary?.toLowerCase().includes("follow-up")) {
      dental = seed % 7 === 0 ? "ALERT" : seed % 3 === 0 ? "WATCH" : "GOOD";
    } else {
      dental = seed % 11 === 0 ? "WATCH" : "GOOD";
    }
  }
  if (checkText.includes("eye")) {
    eyesight = seed % 13 === 0 ? "WATCH" : "GOOD";
  }
  if (
    checkText.includes("nutrition") ||
    checkText.includes("hemoglobin") ||
    checkText.includes("bmi")
  ) {
    if (bmi > 0 && bmi < 14) nutrition = "WATCH";
    if (bmi > 19.5) nutrition = "ALERT";
    else if (seed % 9 === 0 && nutrition === "GOOD") nutrition = "WATCH";
  }

  const heightAdj = heightCm > 0 ? Math.round(heightCm + (seed % 3) - 1) : heightCm;
  const weightAdj =
    weightKg > 0 ? Math.round((weightKg + ((seed % 5) - 2) * 0.1) * 10) / 10 : weightKg;

  return {
    dental,
    eyesight,
    nutrition,
    height_cm: heightAdj || heightCm,
    weight_kg: weightAdj || weightKg,
  };
}

async function ensureCampKidResults(
  sql: ReturnType<typeof neon>,
  profileId: string
): Promise<void> {
  const pending = await sql`
    SELECT cr.kid_id, cr.school_camp_id, sc.checks, sc.date, sc.status, sc.result_summary
    FROM ${sql.unsafe(SCHEMA)}.camp_registrations cr
    JOIN ${sql.unsafe(SCHEMA)}.school_camps sc ON sc.id = cr.school_camp_id
    WHERE cr.profile_id = ${profileId}
      AND sc.status = 'COMPLETED'
      AND NOT EXISTS (
        SELECT 1 FROM ${sql.unsafe(SCHEMA)}.camp_kid_results ckr
        WHERE ckr.kid_id = cr.kid_id AND ckr.school_camp_id = cr.school_camp_id
      )
  `;

  for (const row of pending) {
    const kidRows = await sql`
      SELECT * FROM ${sql.unsafe(SCHEMA)}.kids
      WHERE id = ${row.kid_id as string} AND profile_id = ${profileId}
      LIMIT 1
    `;
    if (kidRows.length === 0) continue;

    const checks = Array.isArray(row.checks)
      ? (row.checks as string[])
      : JSON.parse(String(row.checks || "[]"));
    const flags = deriveCampFlags(
      kidRows[0] as Record<string, unknown>,
      checks,
      row.school_camp_id as string,
      (row.result_summary as string) || null
    );
    const resultId = `ckr_${row.school_camp_id}_${row.kid_id}`;
    await sql`
      INSERT INTO ${sql.unsafe(SCHEMA)}.camp_kid_results
        (id, profile_id, school_camp_id, kid_id, dental, eyesight, nutrition, height_cm, weight_kg)
      VALUES (
        ${resultId}, ${profileId}, ${row.school_camp_id}, ${row.kid_id},
        ${flags.dental}, ${flags.eyesight}, ${flags.nutrition},
        ${flags.height_cm}, ${flags.weight_kg}
      )
      ON CONFLICT (school_camp_id, kid_id) DO NOTHING
    `;
  }
}

async function mergeCampResultsIntoKids(
  sql: ReturnType<typeof neon>,
  profileId: string
): Promise<void> {
  await ensureCampKidResults(sql, profileId);
  await sql`
    UPDATE ${sql.unsafe(SCHEMA)}.kids k SET
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
      FROM ${sql.unsafe(SCHEMA)}.camp_kid_results ckr
      JOIN ${sql.unsafe(SCHEMA)}.school_camps sc ON sc.id = ckr.school_camp_id
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

async function ensureHospitalPartnerships(sql: ReturnType<typeof neon>): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS ${sql.unsafe(SCHEMA)}.hospitals (
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

  await sql`ALTER TABLE ${sql.unsafe(SCHEMA)}.doctors ADD COLUMN IF NOT EXISTS hospital_id TEXT`;
  await sql`ALTER TABLE ${sql.unsafe(SCHEMA)}.school_camps ADD COLUMN IF NOT EXISTS hospital_id TEXT`;

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
      INSERT INTO ${sql.unsafe(SCHEMA)}.hospitals
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
      INSERT INTO ${sql.unsafe(SCHEMA)}.doctors (id, name, specialty, hospital, hospital_id, rating)
      VALUES (${id}, ${name}, ${specialty}, ${hospital}, ${hospitalId}, ${rating})
      ON CONFLICT (id) DO UPDATE SET
        hospital_id = EXCLUDED.hospital_id,
        hospital = EXCLUDED.hospital
    `;
  }

  await sql`
    UPDATE ${sql.unsafe(SCHEMA)}.doctors SET hospital_id = 'hosp_rainbow'
    WHERE id = 'd1' AND (hospital_id IS NULL OR hospital_id = '')
  `;
  await sql`
    UPDATE ${sql.unsafe(SCHEMA)}.doctors SET hospital_id = 'hosp_apollo'
    WHERE id = 'd2' AND (hospital_id IS NULL OR hospital_id = '')
  `;
  await sql`
    UPDATE ${sql.unsafe(SCHEMA)}.doctors SET hospital_id = 'hosp_lvp'
    WHERE id = 'd3' AND (hospital_id IS NULL OR hospital_id = '')
  `;
  await sql`
    UPDATE ${sql.unsafe(SCHEMA)}.doctors SET hospital_id = 'hosp_kims'
    WHERE id = 'd4' AND (hospital_id IS NULL OR hospital_id = '')
  `;
  await sql`
    UPDATE ${sql.unsafe(SCHEMA)}.doctors SET hospital_id = 'hosp_continental'
    WHERE id = 'd5' AND (hospital_id IS NULL OR hospital_id = '')
  `;
}

async function linkCampHospitals(sql: ReturnType<typeof neon>): Promise<void> {
  const campHospitalLinks: Record<string, string> = {
    sc_oak_1: "hosp_rainbow",
    sc_oak_2: "hosp_kims",
    sc_oak_past: "hosp_rainbow",
    sc_dps_1: "hosp_lvp",
    sc_jgs_1: "hosp_rainbow",
    sc_chirec_1: "hosp_continental",
  };

  for (const [campId, hospitalId] of Object.entries(campHospitalLinks)) {
    await sql`
      UPDATE ${sql.unsafe(SCHEMA)}.school_camps
      SET hospital_id = ${hospitalId}
      WHERE id = ${campId} AND (hospital_id IS NULL OR hospital_id = '')
    `;
  }
}

async function getFamilyOwnerId(
  sql: ReturnType<typeof neon>,
  familyCode: string,
  fallbackProfileId: string
): Promise<string> {
  if (!familyCode) return fallbackProfileId;
  const owners = await sql`
    SELECT p.id FROM ${sql.unsafe(SCHEMA)}.profiles p
    WHERE p.family_code = ${familyCode}
      AND EXISTS (SELECT 1 FROM ${sql.unsafe(SCHEMA)}.kids k WHERE k.profile_id = p.id)
    ORDER BY p.id
    LIMIT 1
  `;
  if (owners.length > 0) return owners[0].id as string;
  const any = await sql`
    SELECT id FROM ${sql.unsafe(SCHEMA)}.profiles
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

async function authenticateSession(
  sql: ReturnType<typeof neon>,
  token: string
): Promise<{ profileId: string; userId: string; name: string; role: string } | null> {
  if (!token || token.length < 30) return null;
  try {
    const rows = await sql`
      SELECT id, user_id, name, role FROM ${sql.unsafe(SCHEMA)}.profiles
      WHERE session_token = ${token} LIMIT 1
    `;
    if (rows.length === 0) return null;
    return {
      profileId: rows[0].id,
      userId: rows[0].user_id || "",
      name: rows[0].name,
      role: (rows[0].role as string) || "PARENT",
    };
  } catch {
    return null;
  }
}

// ─── Dev mode helper ───────────────────────────────────────

/** True when DEV_MODE env var is set to "true" / "1" / "yes". */
function isDevMode(env: Env): boolean {
  const v = (env.DEV_MODE || "").trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

// ─── Plivo SMS ─────────────────────────────────────────────

async function sendPlivoSms(
  env: Env,
  to: string,
  text: string
): Promise<boolean> {
  // Dev mode: skip SMS delivery entirely, log the message.
  if (isDevMode(env)) {
    console.log(`[DEV_MODE] SMS to ${to}: ${text}`);
    return true;
  }
  const authId = env.PLIVO_AUTH_ID;
  const authToken = env.PLIVO_AUTH_TOKEN;
  if (!authId || !authToken) {
    console.error("Plivo credentials not configured");
    return false;
  }
  const src = env.PLIVO_SRC_NUMBER || PLIVO_SRC_NUMBER;
  try {
    const resp = await fetch(
      `${PLIVO_API}/${authId}/Message/`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(`${authId}:${authToken}`),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          src,
          dst: to,
          text,
        }),
      }
    );
    if (!resp.ok) {
      const errBody = await resp.text().catch(() => "");
      console.error(`Plivo send failed (${resp.status}):`, errBody);
    }
    return resp.ok;
  } catch (e) {
    console.error("Plivo send error:", e);
    return false;
  }
}

// ─── Closed-app helpers (provisioning, admin auth, invites) ──

/** Normalize a raw phone string into E.164 + the 10-digit local key. */
function normalizePhone(raw: string | undefined | null): { e164: string; last10: string } | null {
  if (!raw) return null;
  const hadPlus = raw.trim().startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const last10 = digits.slice(-10);
  // Preserve an explicit country code if one was provided, else default.
  let cc = DEFAULT_COUNTRY_CODE;
  if (digits.length > 10) cc = digits.slice(0, digits.length - 10);
  else if (hadPlus) cc = ""; // already E.164-ish without national digits — unlikely
  const e164 = `+${cc || DEFAULT_COUNTRY_CODE}${last10}`;
  return { e164, last10 };
}

function profileIdForPhone(last10: string): string {
  return `ph_${last10}`;
}

function slugify(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

/** Stable per-child identity so re-imports across camps update the same kid row. */
function buildStudentRef(
  provided: string | undefined,
  last10: string,
  name: string,
  dobOrAge: string
): string {
  const explicit = (provided || "").trim();
  if (explicit) return `sid_${slugify(explicit)}`;
  return `auto_${last10}_${slugify(name)}_${slugify(dobOrAge || "na")}`;
}

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
  sql: ReturnType<typeof neon>,
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

// ─── Admin import (CSV/Excel rows → provisioned data) ────────

/** Case-insensitive, punctuation-insensitive field accessor for a CSV/Excel row. */
function rowField(row: Record<string, unknown>, ...wanted: string[]): string {
  for (const k of Object.keys(row)) {
    const norm = k.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (wanted.includes(norm)) {
      const v = row[k];
      return v == null ? "" : String(v).trim();
    }
  }
  return "";
}

function normHealthFlag(v: string): string {
  const s = (v || "").trim().toUpperCase();
  if (s === "GOOD" || s === "OK" || s === "NORMAL" || s === "FINE") return "GOOD";
  if (s === "WATCH" || s === "MONITOR" || s === "ATTENTION") return "WATCH";
  if (s === "ALERT" || s === "CRITICAL" || s === "REFER" || s === "BAD") return "ALERT";
  return "GOOD";
}

function parseNum(v: string): number | null {
  if (!v) return null;
  const n = parseFloat(v.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function deriveAge(dob: string, age: string): number {
  const a = parseInt(age, 10);
  if (Number.isFinite(a) && a > 0 && a < 25) return a;
  // dob like YYYY-MM-DD or DD-MM-YYYY or YYYY
  const yearMatch = dob.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) {
    const y = parseInt(yearMatch[0], 10);
    const now = new Date().getFullYear();
    const diff = now - y;
    if (diff > 0 && diff < 25) return diff;
  }
  return 0;
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
  sql: ReturnType<typeof neon>,
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
            VALUES (${campId}, ${schoolId}, ${campTitle}, ${campDate || new Date().toISOString().slice(0, 10)}, 'COMPLETED', true)
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
    for (const [last10, e164] of uniquePhones) {
      const sent = await sendInviteForPhone(sql, env, last10, e164, opts.appOrigin);
      if (sent) report.invited++;
    }
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

/** Send an invite SMS to a provisioned parent (respects a resend cooldown). */
async function sendInviteForPhone(
  sql: ReturnType<typeof neon>,
  env: Env,
  last10: string,
  e164: string,
  appOrigin: string,
  force = false
): Promise<boolean> {
  const profileId = profileIdForPhone(last10);
  const prof = await sql`SELECT invited_at FROM vita_hero.profiles WHERE id = ${profileId} LIMIT 1`;
  if (!force && prof[0]?.invited_at) {
    const elapsed = Date.now() - new Date(prof[0].invited_at as string).getTime();
    if (elapsed < INVITE_RESEND_COOLDOWN_HOURS * 3600_000) return false;
  }
  const token = await signInviteToken(last10, env);
  const link = token ? `${appOrigin}/i/${token}` : (env.APP_PLAY_URL || appOrigin);
  const ok = await sendPlivoSms(
    env,
    e164,
    `VitaHero: Your child's school health screening report is ready. Install the VitaHero app from Google Play Store and sign in with this mobile number: ${link}`
  );
  await sql`
    INSERT INTO vita_hero.sms_log (id, phone, type, status)
    VALUES (${"sms_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)}, ${e164}, 'INVITE', ${ok ? "SENT" : "FAILED"})
  `;
  await sql`
    UPDATE vita_hero.profiles SET invited_at = NOW(), invite_count = invite_count + 1 WHERE id = ${profileId}
  `;
  return ok;
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
  sql: ReturnType<typeof neon>,
  user: NeonAuthUser,
  provider: string,
  role?: string
): Promise<{ profileId: string; sessionToken: string }> {
  const profileId = `na_${user.id.slice(0, 24)}`;
  const sessionToken = generateToken();

  const existing = await sql`
    SELECT id FROM ${sql.unsafe(SCHEMA)}.profiles WHERE id = ${profileId} LIMIT 1
  `;

  if (existing.length === 0) {
    await sql`
      INSERT INTO ${sql.unsafe(SCHEMA)}.profiles
        (id, user_id, name, email, session_token, auth_provider,
         onboarding_complete, is_logged_in, role)
      VALUES (
        ${profileId}, ${user.id}, ${user.name || user.email.split('@')[0]},
        ${user.email}, ${sessionToken}, ${provider}, true, true, ${role || 'PARENT'}
      )
    `;
  } else {
    await sql`
      UPDATE ${sql.unsafe(SCHEMA)}.profiles
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));

    const url = new URL(request.url);
    const path = url.pathname;
    const dbUrl = env.DATABASE_URL;

    if (!dbUrl) {
      return json({ error: "DATABASE_URL not configured" }, 500);
    }

    const sql = neon(dbUrl);

    // ── Health Check ─────────────────────────────────
    // /ping only tests DB connectivity — skip full schema init so the
    // health endpoint always responds even if a migration is broken.
    if (path === "/ping") {
      try {
        const rows = await sql`SELECT 1 AS ok, NOW() AS now`;
        return json({ ok: true, db: rows[0], dev_mode: isDevMode(env) });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("Ping DB error:", message);
        return json({ ok: false, error: message }, 500);
      }
    }

    // ── Admin Panel (HTML) ────────────────────────────
    if (path === "/admin") {
      const html = renderAdminPanel(LOGO_DATA_URI);
      return cors(new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }));
    }

    try {
      try {
        await ensureSchema(sql);
      } catch (schemaErr) {
        const message = schemaErr instanceof Error ? schemaErr.message : String(schemaErr);
        console.error("Schema init error:", message);
        return json({ error: "Database schema initialization failed", detail: message }, 500);
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
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Host+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Host Grotesk',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;margin:0;background:linear-gradient(160deg,#F47B20 0%,#1FA2DD 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;-webkit-font-smoothing:antialiased}
.card{background:#fff;color:#0F172A;max-width:440px;width:100%;padding:40px 32px;border-radius:28px;box-shadow:0 24px 80px rgba(15,23,42,.22);text-align:center}
.logo{display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:24px}
.logo .mark{width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,#F47B20,#1FA2DD);display:flex;align-items:center;justify-content:center;color:#fff;font-size:28px;font-weight:700}
.logo .name{font-size:26px;font-weight:700;letter-spacing:-.5px}
.logo .name span{color:#F47B20}
.card h1{font-size:21px;margin:0 0 10px;font-weight:600;letter-spacing:-.2px}
.card p{color:#475569;line-height:1.55;font-size:15px;margin-bottom:8px}
a.btn{display:flex;align-items:center;justify-content:center;gap:8px;text-align:center;background:linear-gradient(90deg,#F47B20,#1FA2DD);color:#fff;text-decoration:none;padding:15px;border-radius:14px;font-weight:600;font-size:15px;margin-top:16px;transition:opacity .2s,transform .1s}
a.btn:hover{opacity:.92}a.btn:active{transform:scale(.98)}
a.btn.secondary{background:#0F172A}
.shield{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;background:rgba(244,123,32,.1);margin-bottom:16px;font-size:20px}
</style></head>
<body><div class="card">
<div class="logo"><div class="mark">V</div><div class="name">Vita<span>Hero</span></div></div>
<div class="shield">&#9877;</div>
<h1>Your child's health report is ready</h1>
<p>Install the VitaHero app, then sign in with the mobile number this link was sent to.</p>
<a class="btn" href="${playUrl}">Get the app</a>
<a class="btn secondary" href="${deepLink}">Open in app</a></div>
<script>try{window.location.href=${JSON.stringify(deepLink)};}catch(e){}</script>
</body></html>`;
        return cors(new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }));
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
              role: "ADMIN",
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

          const roleRows = await sql`
            SELECT role FROM vita_hero.profiles WHERE id = ${profileId} LIMIT 1
          `;
          return json({
            token: sessionToken,
            profile: {
              id: profileId,
              user_id: neonResp.user.id,
              name: neonResp.user.name || email.split("@")[0],
              email: neonResp.user.email,
              auth_provider: "EMAIL",
              role: (roleRows[0]?.role as string) || "ADMIN",
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

        const norm = normalizePhone(phone);
        if (!norm) return json({ error: "Enter a valid mobile number" }, 400);

        const dev = isDevMode(env);

        if (!dev) {
          // Closed app: only admin-provisioned numbers (parents) or doctor
          // profiles generated by an admin may receive an OTP.
          const provRows = await sql`
            SELECT provisioned, role FROM vita_hero.profiles
            WHERE id = ${profileIdForPhone(norm.last10)} LIMIT 1
          `;
          const isAllowed =
            provRows.length > 0 &&
            (provRows[0].provisioned === true || provRows[0].role === "DOCTOR");
          if (!isAllowed) {
            return json(
              {
                error: "This number isn't registered. Please contact your school or camp organizer.",
                code: "NOT_PROVISIONED",
              },
              403
            );
          }
        } else {
          // Dev mode: auto-provision a test profile so verify works.
          const profileId = profileIdForPhone(norm.last10);
          await sql`
            INSERT INTO vita_hero.profiles (id, phone, name, provisioned, onboarding_complete, is_logged_in)
            VALUES (${profileId}, ${norm.e164}, 'Test Parent', true, false, false)
            ON CONFLICT (id) DO UPDATE SET
              phone = EXCLUDED.phone,
              provisioned = true
          `;
        }

        const existing = await sql`
          SELECT last_sent_at FROM ${sql.unsafe(SCHEMA)}.phone_otps WHERE phone = ${phone} LIMIT 1
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
          INSERT INTO ${sql.unsafe(SCHEMA)}.phone_otps (phone, otp, expires_at, attempts, last_sent_at)
          VALUES (${phone}, ${otp}, ${expiresAt.toISOString()}, 0, NOW())
          ON CONFLICT (phone) DO UPDATE SET
            otp = EXCLUDED.otp,
            expires_at = EXCLUDED.expires_at,
            attempts = 0,
            last_sent_at = NOW()
        `;

        if (dev) {
          // Dev mode: return the OTP directly so the app can display it.
          console.log(`[DEV_MODE] OTP for ${phone}: ${otp}`);
          return json({ success: true, dev_otp: otp, dev_mode: true });
        }

        const sent = await sendPlivoSms(
          env, phone,
          `Your VitaHero verification code is: ${otp}`
        );

        return json({ success: sent, note: sent ? undefined : "OTP generated but SMS delivery may be delayed" });
      }

      // ── Phone OTP: Verify ────────────────────────────
      if (path === "/api/auth/phone/verify" && request.method === "POST") {
        const body: Record<string, unknown> = await request.json();
        const phone = (body.phone as string)?.trim();
        const otp = (body.otp as string)?.trim();
        if (!phone || !otp) return json({ error: "Missing phone or otp" }, 400);

        const rows = await sql`
          SELECT otp, expires_at, attempts
          FROM ${sql.unsafe(SCHEMA)}.phone_otps WHERE phone = ${phone} LIMIT 1
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
          UPDATE ${sql.unsafe(SCHEMA)}.phone_otps
          SET attempts = attempts + 1 WHERE phone = ${phone}
        `;

        if (record.otp !== otp) {
          return json({ error: "Invalid OTP" }, 401);
        }

        // OTP verified — clean up
        await sql`DELETE FROM ${sql.unsafe(SCHEMA)}.phone_otps WHERE phone = ${phone}`;

        // Closed app: the parent must have been provisioned by an admin import.
        // We never auto-create a profile here.
        const norm = normalizePhone(phone);
        if (!norm) return json({ error: "Enter a valid mobile number" }, 400);
        const profileId = profileIdForPhone(norm.last10);
        const sessionToken = generateToken();

        const existing = await sql`
          SELECT id, provisioned, name, role FROM ${sql.unsafe(SCHEMA)}.profiles WHERE id = ${profileId} LIMIT 1
        `;

        const isAllowed =
          existing.length > 0 &&
          (existing[0].provisioned === true || existing[0].role === "DOCTOR");
        if (!isAllowed) {
          return json(
            {
              error: "This number isn't registered. Please contact your school or camp organizer.",
              code: "NOT_PROVISIONED",
            },
            403
          );
        }

        await sql`
          UPDATE vita_hero.profiles
          SET session_token = ${sessionToken}, is_logged_in = true, phone = ${phone},
              user_id = COALESCE(user_id, ${profileId})
          WHERE id = ${profileId}
        `;

        // Also delete any old OTPs
        try {
          await sql`DELETE FROM ${sql.unsafe(SCHEMA)}.phone_otps WHERE expires_at < NOW()`;
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
          },
        });
      }

      // ── Verify Session Token ─────────────────────────
      if (path === "/api/auth/me" && request.method === "GET") {
        const token = extractToken(request);
        const session = await authenticateSession(sql, token);
        if (!session) return json({ error: "Invalid or expired session" }, 401);

        const profile = await sql`
          SELECT * FROM ${sql.unsafe(SCHEMA)}.profiles WHERE id = ${session.profileId} LIMIT 1
        `;
        return json(sanitizeProfile(profile[0] as Record<string, unknown>));
      }

      // ── Logout ───────────────────────────────────────
      if (path === "/api/auth/logout" && request.method === "POST") {
        const token = extractToken(request);
        if (token) {
          await sql`
            UPDATE ${sql.unsafe(SCHEMA)}.profiles
            SET session_token = NULL, is_logged_in = false
            WHERE session_token = ${token}
          `;
        }
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
        const phones = Array.isArray(body.phones) ? (body.phones as string[]) : [];
        const force = body.force === true;
        let invited = 0;
        const skipped: string[] = [];
        for (const raw of phones) {
          const norm = normalizePhone(raw);
          if (!norm) { skipped.push(raw); continue; }
          const prof = await sql`
            SELECT provisioned FROM vita_hero.profiles WHERE id = ${profileIdForPhone(norm.last10)} LIMIT 1
          `;
          if (prof.length === 0 || prof[0].provisioned !== true) { skipped.push(norm.e164); continue; }
          const sent = await sendInviteForPhone(sql, env, norm.last10, norm.e164, url.origin, force);
          if (sent) invited++; else skipped.push(norm.e164);
        }
        return json({ invited, skipped });
      }

      if (path === "/api/admin/verify" && request.method === "GET") {
        const admin = await requireAdmin(request, sql, env);
        if (!admin) return json({ error: "Admin authorization required", code: "ADMIN_REQUIRED" }, 403);
        return json({ valid: true });
      }

      if (path === "/api/admin/stats" && request.method === "GET") {
        const admin = await requireAdmin(request, sql, env);
        if (!admin) return json({ error: "Admin authorization required", code: "ADMIN_REQUIRED" }, 403);
        const [parents, active, kids, invites] = await Promise.all([
          sql`SELECT COUNT(*)::int AS n FROM vita_hero.profiles WHERE provisioned = true`,
          sql`SELECT COUNT(*)::int AS n FROM vita_hero.profiles WHERE provisioned = true AND is_logged_in = true`,
          sql`SELECT COUNT(*)::int AS n FROM vita_hero.kids WHERE source = 'ADMIN'`,
          sql`SELECT COUNT(*)::int AS n FROM vita_hero.sms_log WHERE type = 'INVITE' AND status = 'SENT'`,
        ]);
        return json({
          provisionedParents: parents[0].n,
          activeParents: active[0].n,
          importedKids: kids[0].n,
          invitesSent: invites[0].n,
        });
      }

      // ── List provisioned parents (with search) ──────
      if (path === "/api/admin/parents" && request.method === "GET") {
        const admin = await requireAdmin(request, sql, env);
        if (!admin) return json({ error: "Admin authorization required", code: "ADMIN_REQUIRED" }, 403);
        const search = (url.searchParams.get("q") || "").trim();
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "100", 10) || 100, 500);
        const searchPattern = search ? "%" + search + "%" : null;
        const rows = await sql`
          SELECT p.id, p.phone, p.name, p.school_id, p.invited_at, p.invite_count,
                 p.is_logged_in, p.provisioned,
                 COALESCE(k.kid_count, 0) AS kid_count,
                 s.name AS school_name
          FROM vita_hero.profiles p
          LEFT JOIN (
            SELECT profile_id, COUNT(*)::int AS kid_count
            FROM vita_hero.kids
            GROUP BY profile_id
          ) k ON k.profile_id = p.id
          LEFT JOIN vita_hero.schools s ON s.id = p.school_id
          WHERE p.provisioned = true
            ${search ? sql`AND (p.phone ILIKE ${searchPattern} OR p.name ILIKE ${searchPattern})` : sql``}
          ORDER BY p.invited_at DESC NULLS LAST, p.name
          LIMIT ${limit}
        `;
        return json(rows);
      }

      // ═══════════════════════════════════════════════════
      // ADMIN: DOCTOR CREDENTIAL MANAGEMENT
      // Admin generates per-camp doctor credentials dynamically.
      // Each credential is a phone-based profile with role=DOCTOR,
      // linked to one or more camps via doctor_camp_assignments.
      // ═══════════════════════════════════════════════════

      // ── Generate doctor credential for a camp ──
      if (path === "/api/admin/doctors/generate" && request.method === "POST") {
        const admin = await requireAdmin(request, sql, env);
        if (!admin) return json({ error: "Admin authorization required", code: "ADMIN_REQUIRED" }, 403);
        const body: Record<string, unknown> = await request.json();
        const doctorName = (body.doctor_name as string)?.trim();
        const phone = (body.phone as string)?.trim();
        const schoolCampId = (body.school_camp_id as string)?.trim();
        const specialty = (body.specialty as string)?.trim() || "General Paediatrics";
        const regNumber = (body.registration_number as string)?.trim() || "";
        const hospital = (body.hospital as string)?.trim() || "";
        if (!doctorName || !phone || !schoolCampId) {
          return json({ error: "doctor_name, phone, and school_camp_id are required" }, 400);
        }
        const norm = normalizePhone(phone);
        if (!norm) return json({ error: "Invalid phone number" }, 400);
        const profileId = profileIdForPhone(norm.last10);

        // Upsert doctor profile — never downgrade an existing admin.
        await sql`
          INSERT INTO vita_hero.profiles (id, phone, name, user_id, auth_provider, role, provisioned, is_logged_in)
          VALUES (${profileId}, ${norm.e164}, ${doctorName}, ${profileId}, 'PHONE', 'DOCTOR', true, false)
          ON CONFLICT (id) DO UPDATE SET
            name = CASE WHEN vita_hero.profiles.role = 'DOCTOR' THEN EXCLUDED.name ELSE vita_hero.profiles.name END,
            phone = EXCLUDED.phone,
            role = CASE WHEN vita_hero.profiles.role IN ('ADMIN','SUPERADMIN') THEN vita_hero.profiles.role ELSE 'DOCTOR' END
        `;

        // Link doctor to the camp.
        const assignId = `dca_${profileId}_${schoolCampId}`;
        await sql`
          INSERT INTO vita_hero.doctor_camp_assignments (id, doctor_profile_id, school_camp_id, role, status)
          VALUES (${assignId}, ${profileId}, ${schoolCampId}, 'DOCTOR', 'ACTIVE')
          ON CONFLICT (doctor_profile_id, school_camp_id) DO UPDATE SET status = 'ACTIVE'
        `;

        // Also store doctor metadata in the doctors directory if not already there.
        const docDirId = `doc_${norm.last10}`;
        await sql`
          INSERT INTO vita_hero.doctors (id, name, specialty, hospital, city, rating, active)
          VALUES (${docDirId}, ${doctorName}, ${specialty}, ${hospital}, 'Hyderabad', 4.5, true)
          ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, specialty = EXCLUDED.specialty
        `;

        // Generate and send the initial login OTP.
        const otpResult = await generateAndSendOtp(sql, env, norm.e164, "Your VitaHero doctor verification code is: {otp}");

        return json({
          success: true,
          doctor_profile_id: profileId,
          phone: norm.e164,
          doctor_name: doctorName,
          school_camp_id: schoolCampId,
          specialty,
          otp: otpResult.otp,
          sms_sent: otpResult.sent,
          message: `Doctor credential created for ${doctorName}. They can now log in with ${norm.e164} via OTP.`,
        });
      }

      // ── Batch generate doctor credentials ──
      if (path === "/api/admin/doctors/generate-batch" && request.method === "POST") {
        const admin = await requireAdmin(request, sql, env);
        if (!admin) return json({ error: "Admin authorization required", code: "ADMIN_REQUIRED" }, 403);
        const body: Record<string, unknown> = await request.json();
        const doctors = body.doctors as Array<Record<string, string>> | undefined;
        const schoolCampId = (body.school_camp_id as string)?.trim();
        if (!Array.isArray(doctors) || doctors.length === 0) {
          return json({ error: "doctors array is required" }, 400);
        }
        if (!schoolCampId) {
          return json({ error: "school_camp_id is required" }, 400);
        }
        if (doctors.length > 50) {
          return json({ error: "Max 50 doctors per batch" }, 400);
        }
        const results: Array<Record<string, unknown>> = [];
        let created = 0;
        let errors = 0;
        for (let i = 0; i < doctors.length; i++) {
          const doc = doctors[i];
          const doctorName = (doc.doctor_name as string)?.trim();
          const phone = (doc.phone as string)?.trim();
          const specialty = (doc.specialty as string)?.trim() || "General Paediatrics";
          const hospital = (doc.hospital as string)?.trim() || "";
          if (!doctorName || !phone) {
            results.push({ row: i + 1, doctor_name: doctorName || "", phone: phone || "", status: "error", message: "Missing name or phone" });
            errors++;
            continue;
          }
          const norm = normalizePhone(phone);
          if (!norm) {
            results.push({ row: i + 1, doctor_name: doctorName, phone, status: "error", message: "Invalid phone number" });
            errors++;
            continue;
          }
          try {
            const profileId = profileIdForPhone(norm.last10);
            await sql`
              INSERT INTO vita_hero.profiles (id, phone, name, user_id, auth_provider, role, provisioned, is_logged_in)
              VALUES (${profileId}, ${norm.e164}, ${doctorName}, ${profileId}, 'PHONE', 'DOCTOR', true, false)
              ON CONFLICT (id) DO UPDATE SET
                name = CASE WHEN vita_hero.profiles.role = 'DOCTOR' THEN EXCLUDED.name ELSE vita_hero.profiles.name END,
                phone = EXCLUDED.phone,
                role = CASE WHEN vita_hero.profiles.role IN ('ADMIN','SUPERADMIN') THEN vita_hero.profiles.role ELSE 'DOCTOR' END
            `;
            const assignId = `dca_${profileId}_${schoolCampId}`;
            await sql`
              INSERT INTO vita_hero.doctor_camp_assignments (id, doctor_profile_id, school_camp_id, role, status)
              VALUES (${assignId}, ${profileId}, ${schoolCampId}, 'DOCTOR', 'ACTIVE')
              ON CONFLICT (doctor_profile_id, school_camp_id) DO UPDATE SET status = 'ACTIVE'
            `;
            const docDirId = `doc_${norm.last10}`;
            await sql`
              INSERT INTO vita_hero.doctors (id, name, specialty, hospital, city, rating, active)
              VALUES (${docDirId}, ${doctorName}, ${specialty}, ${hospital}, 'Hyderabad', 4.5, true)
              ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, specialty = EXCLUDED.specialty
            `;

            const otpResult = await generateAndSendOtp(sql, env, norm.e164, "Your VitaHero doctor verification code is: {otp}");
            results.push({ row: i + 1, doctor_name: doctorName, phone: norm.e164, status: "created", profile_id: profileId, otp: otpResult.otp, sms_sent: otpResult.sent });
            created++;
          } catch (err) {
            results.push({ row: i + 1, doctor_name: doctorName, phone, status: "error", message: (err as Error).message });
            errors++;
          }
        }
        return json({ success: true, total: doctors.length, created, errors, results });
      }

      // ── List all doctor credentials ──
      if (path === "/api/admin/doctors" && request.method === "GET") {
        const admin = await requireAdmin(request, sql, env);
        if (!admin) return json({ error: "Admin authorization required", code: "ADMIN_REQUIRED" }, 403);
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "100", 10) || 100, 500);
        const rows = await sql`
          SELECT p.id AS doctor_profile_id, p.phone, p.name AS doctor_name, p.is_logged_in,
                 dca.id AS assignment_id, dca.school_camp_id, dca.status AS assignment_status, dca.assigned_at,
                 sc.title AS camp_title, sc.date AS camp_date,
                 s.name AS school_name
          FROM vita_hero.profiles p
          JOIN vita_hero.doctor_camp_assignments dca ON dca.doctor_profile_id = p.id
          LEFT JOIN vita_hero.school_camps sc ON sc.id = dca.school_camp_id
          LEFT JOIN vita_hero.schools s ON s.id = sc.school_id
          WHERE p.role = 'DOCTOR'
          ORDER BY dca.assigned_at DESC
          LIMIT ${limit}
        `;
        return json(rows);
      }

      // ── Resend/view doctor login OTP ──
      if (path === "/api/admin/doctors/resend-otp" && request.method === "POST") {
        const admin = await requireAdmin(request, sql, env);
        if (!admin) return json({ error: "Admin authorization required", code: "ADMIN_REQUIRED" }, 403);
        const body: Record<string, unknown> = await request.json();
        const phone = (body.phone as string)?.trim();
        if (!phone) return json({ error: "phone is required" }, 400);
        const norm = normalizePhone(phone);
        if (!norm) return json({ error: "Invalid phone number" }, 400);
        const otpResult = await generateAndSendOtp(sql, env, norm.e164, "Your VitaHero doctor verification code is: {otp}");
        return json({ success: true, phone: norm.e164, otp: otpResult.otp, sms_sent: otpResult.sent });
      }

      // ── Revoke a doctor's camp assignment ──
      if (path.startsWith("/api/admin/doctors/revoke/") && request.method === "POST") {
        const admin = await requireAdmin(request, sql, env);
        if (!admin) return json({ error: "Admin authorization required", code: "ADMIN_REQUIRED" }, 403);
        const assignmentId = path.split("/").pop() || "";
        await sql`
          UPDATE vita_hero.doctor_camp_assignments SET status = 'REVOKED'
          WHERE id = ${assignmentId}
        `;
        return json({ success: true });
      }

      // ── List camps for the admin doctor tab dropdown ──
      if (path === "/api/admin/camps" && request.method === "GET") {
        const admin = await requireAdmin(request, sql, env);
        if (!admin) return json({ error: "Admin authorization required", code: "ADMIN_REQUIRED" }, 403);
        const rows = await sql`
          SELECT sc.id, sc.title, sc.date, sc.time, sc.status, sc.description,
                 sc.checks, sc.grades, sc.capacity, sc.registered_count,
                 sc.result_summary, sc.active, sc.school_id, s.name AS school_name,
                 s.city AS school_city
          FROM vita_hero.school_camps sc
          LEFT JOIN vita_hero.schools s ON s.id = sc.school_id
          ORDER BY sc.date DESC
        `;
        return json(rows);
      }

      // ── List schools for admin camp form dropdown ──
      if (path === "/api/admin/schools" && request.method === "GET") {
        const admin = await requireAdmin(request, sql, env);
        if (!admin) return json({ error: "Admin authorization required", code: "ADMIN_REQUIRED" }, 403);
        const rows = await sql`
          SELECT id, name, city, partner_code, active
          FROM vita_hero.schools
          WHERE active = true
          ORDER BY name
        `;
        return json(rows);
      }

      // ── Create a new camp ──
      if (path === "/api/admin/camps" && request.method === "POST") {
        const admin = await requireAdmin(request, sql, env);
        if (!admin) return json({ error: "Admin authorization required", code: "ADMIN_REQUIRED" }, 403);
        const body: Record<string, unknown> = await request.json();
        const schoolId = (body.school_id as string)?.trim();
        const title = (body.title as string)?.trim();
        const date = (body.date as string)?.trim();
        const time = (body.time as string)?.trim() || "9:00 AM – 1:00 PM";
        const description = (body.description as string)?.trim() || "";
        const status = (body.status as string)?.trim() || "UPCOMING";
        const capacity = parseInt(String(body.capacity || 200), 10) || 200;
        const checks = Array.isArray(body.checks) ? body.checks : [];
        const grades = Array.isArray(body.grades) ? body.grades : [];
        if (!title || !date || !schoolId) {
          return json({ error: "title, date, and school_id are required" }, 400);
        }
        const campId = `sc_${schoolId}_${crypto.randomUUID().slice(0, 8)}`;
        await sql`
          INSERT INTO vita_hero.school_camps
            (id, school_id, title, description, date, time, status, checks, grades, capacity, registered_count, active)
          VALUES (
            ${campId}, ${schoolId}, ${title}, ${description},
            ${date}, ${time}, ${status},
            ${JSON.stringify(checks)}::jsonb, ${JSON.stringify(grades)}::jsonb,
            ${capacity}, 0, true
          )
        `;
        const created = await sql`
          SELECT sc.*, s.name AS school_name, s.city AS school_city
          FROM vita_hero.school_camps sc
          LEFT JOIN vita_hero.schools s ON s.id = sc.school_id
          WHERE sc.id = ${campId}
        `;
        return json(created[0]);
      }

      // ── Update a camp ──
      if (path.startsWith("/api/admin/camps/") && request.method === "PUT") {
        const admin = await requireAdmin(request, sql, env);
        if (!admin) return json({ error: "Admin authorization required", code: "ADMIN_REQUIRED" }, 403);
        const campId = path.split("/")[4];
        const body: Record<string, unknown> = await request.json();
        const title = (body.title as string)?.trim();
        const date = (body.date as string)?.trim();
        const time = (body.time as string)?.trim();
        const description = (body.description as string)?.trim();
        const status = (body.status as string)?.trim();
        const capacity = body.capacity != null ? parseInt(String(body.capacity), 10) : undefined;
        const checks = body.checks !== undefined ? (Array.isArray(body.checks) ? body.checks : []) : undefined;
        const grades = body.grades !== undefined ? (Array.isArray(body.grades) ? body.grades : []) : undefined;
        const active = body.active !== undefined ? !!body.active : undefined;
        if (!title || !date) {
          return json({ error: "title and date are required" }, 400);
        }
        await sql`
          UPDATE vita_hero.school_camps SET
            title = ${title},
            date = ${date},
            time = ${time || ""},
            description = ${description || ""},
            status = ${status || "UPCOMING"},
            capacity = ${capacity ?? 200},
            checks = ${JSON.stringify(checks || [])}::jsonb,
            grades = ${JSON.stringify(grades || [])}::jsonb,
            active = ${active ?? true}
          WHERE id = ${campId}
        `;
        const updated = await sql`
          SELECT sc.*, s.name AS school_name, s.city AS school_city
          FROM vita_hero.school_camps sc
          LEFT JOIN vita_hero.schools s ON s.id = sc.school_id
          WHERE sc.id = ${campId}
        `;
        return json(updated[0] || { success: true });
      }

      // ── Delete / deactivate a camp ──
      if (path.startsWith("/api/admin/camps/") && request.method === "DELETE") {
        const admin = await requireAdmin(request, sql, env);
        if (!admin) return json({ error: "Admin authorization required", code: "ADMIN_REQUIRED" }, 403);
        const campId = path.split("/")[4];
        await sql`UPDATE vita_hero.school_camps SET active = false WHERE id = ${campId}`;
        return json({ success: true, deactivated: campId });
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
        const rows = await sql`SELECT * FROM ${sql.unsafe(SCHEMA)}.profiles WHERE id = ${session.profileId} LIMIT 1`;
        // Don't leak session token
        if (rows[0]) delete rows[0].session_token;
        return json(rows[0] || null);
      }

      if (path === "/api/profiles" && request.method === "POST") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const body: Record<string, unknown> = await request.json();
        const row = await sql`
          INSERT INTO ${sql.unsafe(SCHEMA)}.profiles
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
        const rows = await sql`SELECT * FROM ${sql.unsafe(SCHEMA)}.kids WHERE profile_id = ${profileId} ORDER BY name`;
        return json(rows);
      }

      if (path === "/api/kids" && request.method === "POST") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const body: Record<string, unknown> = await request.json();
        const row = await sql`
          INSERT INTO ${sql.unsafe(SCHEMA)}.kids
            (id, profile_id, user_id, name, age, gender, school, grade,
             height_cm, weight_kg, avatar_color, overall_score, dental,
             eyesight, nutrition, last_checkup)
          VALUES (
            ${body.id as string}, ${session.profileId},
            ${session.userId || null}, ${body.name as string},
            ${body.age as number}, ${body.gender as string},
            ${(body.school as string) || ""}, ${(body.grade as string) || ""},
            ${(body.height_cm as number) || 0}, ${(body.weight_kg as number) || 0},
            ${(body.avatar_color as number) || 0}, ${(body.overall_score as number) || 80},
            ${(body.dental as string) || "GOOD"}, ${(body.eyesight as string) || "GOOD"},
            ${(body.nutrition as string) || "GOOD"}, ${(body.last_checkup as string) || "Not yet"}
          )
          ON CONFLICT (id) DO UPDATE SET
            profile_id = EXCLUDED.profile_id, user_id = EXCLUDED.user_id,
            name = EXCLUDED.name, age = EXCLUDED.age, gender = EXCLUDED.gender,
            school = EXCLUDED.school, grade = EXCLUDED.grade,
            avatar_color = EXCLUDED.avatar_color,
            height_cm = EXCLUDED.height_cm, weight_kg = EXCLUDED.weight_kg,
            dental = COALESCE(
              (SELECT ckr.dental FROM ${sql.unsafe(SCHEMA)}.camp_kid_results ckr
               WHERE ckr.kid_id = EXCLUDED.id ORDER BY ckr.recorded_at DESC LIMIT 1),
              EXCLUDED.dental),
            eyesight = COALESCE(
              (SELECT ckr.eyesight FROM ${sql.unsafe(SCHEMA)}.camp_kid_results ckr
               WHERE ckr.kid_id = EXCLUDED.id ORDER BY ckr.recorded_at DESC LIMIT 1),
              EXCLUDED.eyesight),
            nutrition = COALESCE(
              (SELECT ckr.nutrition FROM ${sql.unsafe(SCHEMA)}.camp_kid_results ckr
               WHERE ckr.kid_id = EXCLUDED.id ORDER BY ckr.recorded_at DESC LIMIT 1),
              EXCLUDED.nutrition),
            last_checkup = COALESCE(
              (SELECT sc.date FROM ${sql.unsafe(SCHEMA)}.camp_kid_results ckr
               JOIN ${sql.unsafe(SCHEMA)}.school_camps sc ON sc.id = ckr.school_camp_id
               WHERE ckr.kid_id = EXCLUDED.id ORDER BY ckr.recorded_at DESC LIMIT 1),
              EXCLUDED.last_checkup),
            overall_score = CASE
              WHEN EXISTS (
                SELECT 1 FROM ${sql.unsafe(SCHEMA)}.camp_kid_results ckr WHERE ckr.kid_id = EXCLUDED.id
              ) THEN ${sql.unsafe(SCHEMA)}.kids.overall_score
              ELSE EXCLUDED.overall_score END
          RETURNING *
        `;
        return json(row[0], 201);
      }

      if (path.startsWith("/api/kids/") && request.method === "DELETE") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const kidId = path.split("/")[3];
        if (!(await kidOwnedByProfile(sql, kidId, session.profileId))) {
          return json({ error: "Kid not found" }, 404);
        }
        await sql`DELETE FROM ${sql.unsafe(SCHEMA)}.meal_items WHERE kid_id = ${kidId} AND profile_id = ${session.profileId}`;
        await sql`DELETE FROM ${sql.unsafe(SCHEMA)}.streaks WHERE kid_id = ${kidId}`;
        await sql`DELETE FROM ${sql.unsafe(SCHEMA)}.growth_points WHERE kid_id = ${kidId}`;
        await sql`DELETE FROM ${sql.unsafe(SCHEMA)}.ai_diet_tips WHERE kid_id = ${kidId} AND profile_id = ${session.profileId}`;
        await sql`DELETE FROM ${sql.unsafe(SCHEMA)}.kids WHERE id = ${kidId} AND profile_id = ${session.profileId}`;
        return json({ deleted: true });
      }

      // ═══════════════════════════════════════════════════
      // Appointments
      // ═══════════════════════════════════════════════════

      if (path === "/api/appointments" && request.method === "GET") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const rows = await sql`SELECT * FROM ${sql.unsafe(SCHEMA)}.appointments WHERE profile_id = ${session.profileId} ORDER BY date, time`;
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
            SELECT id FROM ${sql.unsafe(SCHEMA)}.appointments
            WHERE doctor_id = ${doctorId} AND date = ${date} AND time = ${time}
            LIMIT 1
          `;
          if (clash.length > 0) {
            return json({ error: "This slot is no longer available" }, 409);
          }
        }
        const row = await sql`
          INSERT INTO ${sql.unsafe(SCHEMA)}.appointments
            (id, profile_id, user_id, doctor_id, doctor_name, specialty, kid_name, date, time)
          VALUES (
            ${body.id as string}, ${session.profileId},
            ${session.userId || null}, ${doctorId || null}, ${body.doctor_name as string},
            ${body.specialty as string}, ${body.kid_name as string},
            ${date}, ${time}
          )
          ON CONFLICT (id) DO UPDATE SET
            profile_id = EXCLUDED.profile_id, user_id = EXCLUDED.user_id,
            doctor_id = EXCLUDED.doctor_id,
            doctor_name = EXCLUDED.doctor_name, specialty = EXCLUDED.specialty,
            kid_name = EXCLUDED.kid_name, date = EXCLUDED.date, time = EXCLUDED.time
          RETURNING *
        `;
        return json(row[0], 201);
      }

      if (path.startsWith("/api/appointments/") && request.method === "DELETE") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const apptId = path.split("/")[3];
        await sql`DELETE FROM ${sql.unsafe(SCHEMA)}.appointments WHERE id = ${apptId} AND profile_id = ${session.profileId}`;
        return json({ deleted: true });
      }

      // ═══════════════════════════════════════════════════
      // Camps
      // ═══════════════════════════════════════════════════

      if (path === "/api/camps" && request.method === "GET") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        await mergeCampResultsIntoKids(sql, session.profileId);
        let rows = await sql`
          SELECT * FROM ${sql.unsafe(SCHEMA)}.camps
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
          SELECT school_id FROM ${sql.unsafe(SCHEMA)}.school_enrollments
          WHERE profile_id = ${session.profileId} AND status = 'ACTIVE'
        `;
        const schoolIds = enrollments.map((e: Record<string, unknown>) => e.school_id as string);
        let partner: Record<string, unknown>[] = [];
        if (schoolIds.length > 0) {
          for (const sid of schoolIds) {
            const partnerRows = await sql`
              SELECT sc.*, s.name AS school_name, s.city AS school_city
              FROM ${sql.unsafe(SCHEMA)}.school_camps sc
              JOIN ${sql.unsafe(SCHEMA)}.schools s ON s.id = sc.school_id
              WHERE sc.school_id = ${sid} AND sc.active = true
              ORDER BY sc.date
            `;
            partner.push(...(partnerRows as Record<string, unknown>[]));
          }
          partner.sort((a, b) => String(a.date).localeCompare(String(b.date)));
          const regs = await sql`
            SELECT school_camp_id, kid_id FROM ${sql.unsafe(SCHEMA)}.camp_registrations
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
          INSERT INTO ${sql.unsafe(SCHEMA)}.camps
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
            profile_id = EXCLUDED.profile_id, user_id = EXCLUDED.user_id,
            title = EXCLUDED.title, school = EXCLUDED.school,
            date = EXCLUDED.date, time = EXCLUDED.time,
            status = EXCLUDED.status, checks = EXCLUDED.checks,
            result_summary = EXCLUDED.result_summary
          RETURNING *
        `;
        return json(row[0], 201);
      }

      // ═══════════════════════════════════════════════════
      // Meals
      // ═══════════════════════════════════════════════════

      if (path === "/api/meals" && request.method === "GET") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const rows = await sql`SELECT * FROM ${sql.unsafe(SCHEMA)}.meal_items WHERE profile_id = ${session.profileId} ORDER BY kid_id, time_slot`;
        return json(rows);
      }

      if (path === "/api/meals" && request.method === "POST") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const body = await request.json() as Record<string, unknown>[];
        const meals = Array.isArray(body) ? body : [body];
        const results = [];
        for (const m of meals) {
          const row = await sql`
            INSERT INTO ${sql.unsafe(SCHEMA)}.meal_items
              (id, profile_id, user_id, kid_id, time_slot, name, detail, kcal, eaten)
            VALUES (
              ${m.id as string}, ${session.profileId},
              ${session.userId || null}, ${m.kid_id as string},
              ${m.time_slot as string}, ${m.name as string},
              ${(m.detail as string) || ""}, ${(m.kcal as number) || 0},
              ${(m.eaten as boolean) || false}
            )
            ON CONFLICT (id) DO UPDATE SET
              profile_id = EXCLUDED.profile_id, user_id = EXCLUDED.user_id,
              kid_id = EXCLUDED.kid_id, time_slot = EXCLUDED.time_slot,
              name = EXCLUDED.name, detail = EXCLUDED.detail,
              kcal = EXCLUDED.kcal, eaten = EXCLUDED.eaten
            RETURNING *
          `;
          results.push(row[0]);
        }
        return json(results, 201);
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
        const rows = await sql`SELECT * FROM ${sql.unsafe(SCHEMA)}.streaks WHERE kid_id = ${kidId} LIMIT 1`;
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
          INSERT INTO ${sql.unsafe(SCHEMA)}.streaks
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
        const rows = await sql`SELECT * FROM ${sql.unsafe(SCHEMA)}.growth_points WHERE kid_id = ${kidId} ORDER BY recorded_at`;
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
          INSERT INTO ${sql.unsafe(SCHEMA)}.growth_points
            (id, kid_id, user_id, label, height, weight, recorded_at)
          VALUES (
            ${body.id as string}, ${kidId},
            ${session.userId || session.profileId}, ${body.label as string},
            ${(body.height as number) || 0}, ${(body.weight as number) || 0}, NOW()
          )
          ON CONFLICT (id) DO UPDATE SET
            kid_id = EXCLUDED.kid_id, user_id = EXCLUDED.user_id,
            label = EXCLUDED.label, height = EXCLUDED.height,
            weight = EXCLUDED.weight
          RETURNING *
        `;
        return json(row[0], 201);
      }

      // ═══════════════════════════════════════════════════
      // Co-Parents
      // ═══════════════════════════════════════════════════

      if (path === "/api/co-parents" && request.method === "GET") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const profileRows = await sql`
          SELECT family_code, name FROM ${sql.unsafe(SCHEMA)}.profiles
          WHERE id = ${session.profileId} LIMIT 1
        `;
        const familyCode = (profileRows[0]?.family_code as string) || "";
        const ownerId = await getFamilyOwnerId(sql, familyCode, session.profileId);
        const rows = await sql`
          SELECT * FROM ${sql.unsafe(SCHEMA)}.co_parents
          WHERE profile_id = ${ownerId}
          ORDER BY joined_date, name
        `;
        const ownerProfile = await sql`
          SELECT id, name FROM ${sql.unsafe(SCHEMA)}.profiles WHERE id = ${ownerId} LIMIT 1
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
          INSERT INTO ${sql.unsafe(SCHEMA)}.co_parents
            (id, profile_id, user_id, name, relation, joined_date)
          VALUES (
            ${body.id as string}, ${session.profileId},
            ${session.userId || null}, ${body.name as string},
            ${body.relation as string}, ${(body.joined_date as string) || ""}
          )
          ON CONFLICT (id) DO UPDATE SET
            profile_id = EXCLUDED.profile_id, user_id = EXCLUDED.user_id,
            name = EXCLUDED.name, relation = EXCLUDED.relation,
            joined_date = EXCLUDED.joined_date
          RETURNING *
        `;
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
          SELECT id, name, family_code FROM ${sql.unsafe(SCHEMA)}.profiles
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
          SELECT id, name, family_code FROM ${sql.unsafe(SCHEMA)}.profiles
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
          SELECT id, user_id, family_code FROM ${sql.unsafe(SCHEMA)}.profiles
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
          INSERT INTO ${sql.unsafe(SCHEMA)}.co_parents
            (id, profile_id, user_id, name, relation, joined_date)
          VALUES (
            ${coParentId}, ${familyProfile.id}, ${session.userId || session.profileId},
            ${coParentName}, ${relation}, ${new Date().toISOString().split("T")[0]}
          )
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name, relation = EXCLUDED.relation
        `;
        await sql`
          UPDATE ${sql.unsafe(SCHEMA)}.profiles
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
          SELECT id, user_id FROM ${sql.unsafe(SCHEMA)}.profiles
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
            SELECT id FROM ${sql.unsafe(SCHEMA)}.co_parents
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
          SELECT * FROM ${sql.unsafe(SCHEMA)}.kids
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
        const rows = await sql`
          WITH scored AS (
            SELECT
              k.id,
              k.name,
              k.overall_score AS score,
              COALESCE(s.current_streak, 0) AS streak,
              (k.overall_score * 10 + COALESCE(s.current_streak, 0) * 50)::INT AS points
            FROM ${sql.unsafe(SCHEMA)}.kids k
            LEFT JOIN ${sql.unsafe(SCHEMA)}.streaks s ON s.kid_id = k.id
            WHERE k.profile_id IS NOT NULL
          ),
          ranked AS (
            SELECT
              ROW_NUMBER() OVER (ORDER BY s.points DESC, s.score DESC) AS rank,
              s.name AS kid_name,
              (s.id = ${currentKidId}) AS is_you,
              s.score,
              s.points
            FROM scored s
          )
          SELECT rank, kid_name, is_you, score, points
          FROM ranked r
          WHERE r.is_you OR r.rank <= 20
          ORDER BY rank
          LIMIT 20
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
          SELECT content, generated_at FROM ${sql.unsafe(SCHEMA)}.ai_diet_tips
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
          INSERT INTO ${sql.unsafe(SCHEMA)}.ai_diet_tips (kid_id, profile_id, content, generated_at)
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
          SELECT * FROM ${sql.unsafe(SCHEMA)}.kids
          WHERE id = ${kidId} AND profile_id = ${session.profileId}
          LIMIT 1
        `;
        const mealRows = await sql`
          SELECT * FROM ${sql.unsafe(SCHEMA)}.meal_items
          WHERE kid_id = ${kidId} AND profile_id = ${session.profileId}
          ORDER BY time_slot
        `;
        const streakRows = await sql`
          SELECT * FROM ${sql.unsafe(SCHEMA)}.streaks
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
          INSERT INTO ${sql.unsafe(SCHEMA)}.ai_diet_tips (kid_id, profile_id, content, generated_at)
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
          FROM ${sql.unsafe(SCHEMA)}.schools
          WHERE active = true
          ORDER BY name
        `;
        return json(rows);
      }

      if (path === "/api/schools/my" && request.method === "GET") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const rows = await sql`
          SELECT s.id, s.name, s.city, s.district, s.description, e.enrolled_at, e.kid_id
          FROM ${sql.unsafe(SCHEMA)}.school_enrollments e
          JOIN ${sql.unsafe(SCHEMA)}.schools s ON s.id = e.school_id
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
          SELECT id, name FROM ${sql.unsafe(SCHEMA)}.schools
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
          INSERT INTO ${sql.unsafe(SCHEMA)}.school_enrollments
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
          SELECT sc.*, s.name AS school_name FROM ${sql.unsafe(SCHEMA)}.school_camps sc
          JOIN ${sql.unsafe(SCHEMA)}.schools s ON s.id = sc.school_id
          WHERE sc.id = ${schoolCampId} AND sc.active = true LIMIT 1
        `;
        if (campRows.length === 0) return json({ error: "Camp not found" }, 404);
        const camp = campRows[0];
        const enrolled = await sql`
          SELECT id FROM ${sql.unsafe(SCHEMA)}.school_enrollments
          WHERE profile_id = ${session.profileId} AND school_id = ${camp.school_id} AND status = 'ACTIVE'
          LIMIT 1
        `;
        if (enrolled.length === 0) {
          return json({ error: "Enroll with your school partner code first" }, 403);
        }
        const regId = `reg_${schoolCampId}_${kidId}`;
        await sql`
          INSERT INTO ${sql.unsafe(SCHEMA)}.camp_registrations
            (id, profile_id, school_camp_id, kid_id)
          VALUES (${regId}, ${session.profileId}, ${schoolCampId}, ${kidId})
          ON CONFLICT (profile_id, school_camp_id, kid_id) DO NOTHING
        `;
        await sql`
          UPDATE ${sql.unsafe(SCHEMA)}.school_camps
          SET registered_count = (
            SELECT COUNT(*)::int FROM ${sql.unsafe(SCHEMA)}.camp_registrations
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
          SELECT id, name FROM ${sql.unsafe(SCHEMA)}.doctors
          WHERE id = ${doctorId} AND active = true LIMIT 1
        `;
        if (doctorRows.length === 0) return json({ error: "Doctor not found" }, 404);

        const booked = await sql`
          SELECT doctor_id, date, time FROM ${sql.unsafe(SCHEMA)}.appointments
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
          SELECT school_id FROM ${sql.unsafe(SCHEMA)}.school_enrollments
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
          FROM ${sql.unsafe(SCHEMA)}.hospitals h
          LEFT JOIN ${sql.unsafe(SCHEMA)}.school_camps sc
            ON sc.hospital_id = h.id AND sc.active = true
          WHERE h.active = true AND h.city ILIKE ${city}
          GROUP BY h.id
        `;

        const doctorRows = await sql`
          SELECT d.id, d.name, d.specialty, d.hospital, d.city, d.rating, d.hospital_id,
                 h.name AS hospital_name, h.is_camp_partner,
                 COUNT(DISTINCT sc.id)::int AS conducted_camps
          FROM ${sql.unsafe(SCHEMA)}.doctors d
          LEFT JOIN ${sql.unsafe(SCHEMA)}.hospitals h ON h.id = d.hospital_id
          LEFT JOIN ${sql.unsafe(SCHEMA)}.school_camps sc
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
          FROM ${sql.unsafe(SCHEMA)}.doctors d
          LEFT JOIN ${sql.unsafe(SCHEMA)}.hospitals h ON h.id = d.hospital_id
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
          SELECT read_notification_ids FROM ${sql.unsafe(SCHEMA)}.profiles
          WHERE id = ${session.profileId} LIMIT 1
        `;
        const existing = (profileRows[0]?.read_notification_ids as string[]) || [];
        const merged = [...new Set([...existing, ...ids])];
        await sql`
          UPDATE ${sql.unsafe(SCHEMA)}.profiles
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
          SELECT read_notification_ids FROM ${sql.unsafe(SCHEMA)}.profiles
          WHERE id = ${session.profileId} LIMIT 1
        `;
        const readIds = new Set<string>(
          ((profileRows[0]?.read_notification_ids as string[]) || [])
        );

        const camps = await sql`
          SELECT title, school, date, time, status FROM ${sql.unsafe(SCHEMA)}.camps
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
          SELECT doctor_name, kid_name, date, time FROM ${sql.unsafe(SCHEMA)}.appointments
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
          FROM ${sql.unsafe(SCHEMA)}.kids k
          LEFT JOIN ${sql.unsafe(SCHEMA)}.streaks s ON s.kid_id = k.id
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

      // ═══════════════════════════════════════════════════
      // DOCTOR ENDPOINTS (role=DOCTOR session required)
      // ═══════════════════════════════════════════════════

      // ── Doctor: list assigned camps ──
      if (path === "/api/doctor/camps" && request.method === "GET") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        if (session.role !== "DOCTOR") return json({ error: "Doctor access required" }, 403);
        const rows = await sql`
          SELECT dca.id AS assignment_id, dca.status AS assignment_status,
                 sc.id AS camp_id, sc.title AS camp_title, sc.date AS camp_date,
                 sc.time AS camp_time, sc.status AS camp_status, sc.checks,
                 s.id AS school_id, s.name AS school_name, s.city AS school_city,
                 (SELECT COUNT(*)::int FROM vita_hero.camp_registrations cr
                  WHERE cr.school_camp_id = sc.id) AS registered_count,
                 (SELECT COUNT(*)::int FROM vita_hero.health_checkups hc
                  WHERE hc.school_camp_id = sc.id) AS checked_count
          FROM vita_hero.doctor_camp_assignments dca
          JOIN vita_hero.school_camps sc ON sc.id = dca.school_camp_id
          LEFT JOIN vita_hero.schools s ON s.id = sc.school_id
          WHERE dca.doctor_profile_id = ${session.profileId}
            AND dca.status = 'ACTIVE'
          ORDER BY sc.date DESC
        `;
        return json(rows);
      }

      // ── Doctor: list kids registered for a camp ──
      if (path === "/api/doctor/camp-kids" && request.method === "GET") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        if (session.role !== "DOCTOR") return json({ error: "Doctor access required" }, 403);
        const campId = (url.searchParams.get("camp_id") || "").trim();
        if (!campId) return json({ error: "camp_id required" }, 400);

        // Verify doctor is assigned to this camp.
        const assigned = await sql`
          SELECT id FROM vita_hero.doctor_camp_assignments
          WHERE doctor_profile_id = ${session.profileId}
            AND school_camp_id = ${campId} AND status = 'ACTIVE'
          LIMIT 1
        `;
        if (assigned.length === 0) return json({ error: "Not assigned to this camp" }, 403);

        const rows = await sql`
          SELECT k.id AS kid_id, k.name, k.age, k.gender, k.grade, k.school,
                 k.height_cm, k.weight_kg, k.dental, k.eyesight, k.nutrition,
                 k.last_checkup, k.student_ref,
                 p.name AS parent_name, p.phone AS parent_phone,
                 hc.id AS checkup_id, hc.overall_status AS checkup_status,
                 hc.updated_at AS checkup_at, hc.referral_needed
          FROM vita_hero.camp_registrations cr
          JOIN vita_hero.kids k ON k.id = cr.kid_id
          LEFT JOIN vita_hero.profiles p ON p.id = k.profile_id
          LEFT JOIN vita_hero.health_checkups hc
            ON hc.kid_id = k.id AND hc.school_camp_id = ${campId}
          WHERE cr.school_camp_id = ${campId}
          ORDER BY k.name
        `;
        return json(rows);
      }

      // ── Doctor: get a single kid's existing checkup data ──
      if (path === "/api/doctor/checkup" && request.method === "GET") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        if (session.role !== "DOCTOR") return json({ error: "Doctor access required" }, 403);
        const kidId = (url.searchParams.get("kid_id") || "").trim();
        const campId = (url.searchParams.get("camp_id") || "").trim();
        if (!kidId || !campId) return json({ error: "kid_id and camp_id required" }, 400);
        const rows = await sql`
          SELECT * FROM vita_hero.health_checkups
          WHERE kid_id = ${kidId} AND school_camp_id = ${campId}
          LIMIT 1
        `;
        return json(rows[0] || null);
      }

      // ── Doctor: submit/update health checkup form ──
      if (path === "/api/doctor/checkup" && request.method === "POST") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        if (session.role !== "DOCTOR") return json({ error: "Doctor access required" }, 403);
        const body: Record<string, unknown> = await request.json();
        const kidId = (body.kid_id as string)?.trim();
        const campId = (body.school_camp_id as string)?.trim();
        const formData = body.form_data as Record<string, unknown>;
        if (!kidId || !campId || !formData) {
          return json({ error: "kid_id, school_camp_id, and form_data are required" }, 400);
        }

        // Verify assignment.
        const assigned = await sql`
          SELECT id FROM vita_hero.doctor_camp_assignments
          WHERE doctor_profile_id = ${session.profileId}
            AND school_camp_id = ${campId} AND status = 'ACTIVE'
          LIMIT 1
        `;
        if (assigned.length === 0) return json({ error: "Not assigned to this camp" }, 403);

        const checkupId = `hc_${kidId}_${campId}`;
        const summary = (body.summary as string) || "";
        const referralNeeded = (body.referral_needed as boolean) || false;
        const referralNotes = (body.referral_notes as string) || "";
        const overallStatus = (body.overall_status as string) || "GOOD";
        const doctorName = session.name;

        await sql`
          INSERT INTO vita_hero.health_checkups
            (id, kid_id, school_camp_id, doctor_profile_id, doctor_name,
             form_data, summary, referral_needed, referral_notes, overall_status,
             recorded_at, updated_at)
          VALUES (
            ${checkupId}, ${kidId}, ${campId}, ${session.profileId}, ${doctorName},
            ${JSON.stringify(formData)}::jsonb, ${summary}, ${referralNeeded},
            ${referralNotes}, ${overallStatus},
            NOW(), NOW()
          )
          ON CONFLICT (kid_id, school_camp_id) DO UPDATE SET
            doctor_profile_id = EXCLUDED.doctor_profile_id,
            doctor_name = EXCLUDED.doctor_name,
            form_data = EXCLUDED.form_data,
            summary = EXCLUDED.summary,
            referral_needed = EXCLUDED.referral_needed,
            referral_notes = EXCLUDED.referral_notes,
            overall_status = EXCLUDED.overall_status,
            updated_at = NOW()
        `;

        // Update the kid's summary fields from the checkup form.
        const vitals = (formData.vitals as Record<string, unknown>) || {};
        const dental = (formData.dental as Record<string, unknown>) || {};
        const vision = (formData.vision as Record<string, unknown>) || {};
        const nutrition = (formData.nutrition as Record<string, unknown>) || {};
        const heightCm = parseNum(String(vitals.height_cm ?? "")) ?? null;
        const weightKg = parseNum(String(vitals.weight_kg ?? "")) ?? null;
        const dentalFlag = normHealthFlag(String(dental.overall_status ?? "")) || "GOOD";
        const visionFlag = normHealthFlag(String(vision.overall_status ?? "")) || "GOOD";
        const nutritionFlag = normHealthFlag(String(nutrition.overall_status ?? "")) || "GOOD";

        await sql`
          UPDATE vita_hero.kids SET
            height_cm = COALESCE(${heightCm}, height_cm),
            weight_kg = COALESCE(${weightKg}, weight_kg),
            dental = ${dentalFlag},
            eyesight = ${visionFlag},
            nutrition = ${nutritionFlag},
            last_checkup = ${new Date().toISOString().split("T")[0]}
          WHERE id = ${kidId}
        `;

        // Update camp_kid_results if the kid is registered.
        await sql`
          INSERT INTO vita_hero.camp_kid_results
            (id, profile_id, school_camp_id, kid_id, dental, eyesight, nutrition, height_cm, weight_kg)
          VALUES (
            ${"ckr_" + kidId + "_" + campId.slice(-6)},
            (SELECT profile_id FROM vita_hero.camp_registrations WHERE kid_id = ${kidId} AND school_camp_id = ${campId} LIMIT 1),
            ${campId}, ${kidId},
            ${dentalFlag}, ${visionFlag}, ${nutritionFlag},
            ${heightCm}, ${weightKg}
          )
          ON CONFLICT (school_camp_id, kid_id) DO UPDATE SET
            dental = EXCLUDED.dental, eyesight = EXCLUDED.eyesight,
            nutrition = EXCLUDED.nutrition, height_cm = EXCLUDED.height_cm,
            weight_kg = EXCLUDED.weight_kg, recorded_at = NOW()
        `;

        return json({ success: true, checkup_id: checkupId });
      }

      // ── Doctor: get checkup statistics for a camp ──
      if (path === "/api/doctor/camp-stats" && request.method === "GET") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        if (session.role !== "DOCTOR") return json({ error: "Doctor access required" }, 403);
        const campId = (url.searchParams.get("camp_id") || "").trim();
        if (!campId) return json({ error: "camp_id required" }, 400);
        const total = await sql`
          SELECT COUNT(*)::int AS n FROM vita_hero.camp_registrations WHERE school_camp_id = ${campId}
        `;
        const checked = await sql`
          SELECT COUNT(*)::int AS n FROM vita_hero.health_checkups WHERE school_camp_id = ${campId}
        `;
        const referrals = await sql`
          SELECT COUNT(*)::int AS n FROM vita_hero.health_checkups
          WHERE school_camp_id = ${campId} AND referral_needed = true
        `;
        return json({
          totalKids: total[0]?.n || 0,
          checked: checked[0]?.n || 0,
          pending: (total[0]?.n || 0) - (checked[0]?.n || 0),
          referrals: referrals[0]?.n || 0,
        });
      }

      // ═══════════════════════════════════════════════════
      // PARENT: VIEW HEALTH CHECKUP RESULTS
      // ═══════════════════════════════════════════════════

      // ── Parent: get all checkup results for their kids ──
      if (path === "/api/health-checkups" && request.method === "GET") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const kidId = url.searchParams.get("kid_id");
        if (kidId && !(await kidOwnedByProfile(sql, kidId, session.profileId))) {
          return json({ error: "Kid not found" }, 404);
        }
        const rows = kidId
          ? await sql`
              SELECT hc.*, sc.title AS camp_title, sc.date AS camp_date,
                     s.name AS school_name
              FROM vita_hero.health_checkups hc
              JOIN vita_hero.school_camps sc ON sc.id = hc.school_camp_id
              LEFT JOIN vita_hero.schools s ON s.id = sc.school_id
              WHERE hc.kid_id = ${kidId}
              ORDER BY hc.updated_at DESC
            `
          : await sql`
              SELECT hc.*, sc.title AS camp_title, sc.date AS camp_date,
                     s.name AS school_name, k.name AS kid_name
              FROM vita_hero.health_checkups hc
              JOIN vita_hero.kids k ON k.id = hc.kid_id
              JOIN vita_hero.school_camps sc ON sc.id = hc.school_camp_id
              LEFT JOIN vita_hero.schools s ON s.id = sc.school_id
              WHERE k.profile_id = ${session.profileId}
              ORDER BY hc.updated_at DESC
            `;
        return json(rows);
      }

      // ── Parent: get a single checkup by id ──
      if (path.startsWith("/api/health-checkups/") && request.method === "GET") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const checkupId = path.split("/")[3];
        const rows = await sql`
          SELECT hc.*, sc.title AS camp_title, sc.date AS camp_date,
                 s.name AS school_name, k.name AS kid_name
          FROM vita_hero.health_checkups hc
          JOIN vita_hero.kids k ON k.id = hc.kid_id
          JOIN vita_hero.school_camps sc ON sc.id = hc.school_camp_id
          LEFT JOIN vita_hero.schools s ON s.id = sc.school_id
          WHERE hc.id = ${checkupId}
            AND k.profile_id = ${session.profileId}
          LIMIT 1
        `;
        if (rows.length === 0) return json({ error: "Checkup not found" }, 404);
        return json(rows[0]);
      }

      return json({ error: "Not found", path }, 404);

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Worker error:", message);
      return json({ error: message }, 500);
    }
  },
};
