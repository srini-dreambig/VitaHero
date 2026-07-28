// VitaHero Backend — Cloudflare Worker + Firestore
// Migrated from Neon Postgres to Firebase Firestore.
// Auth is handled by Firebase Phone Auth on the client.
// Admin panel uses a static API key (ADMIN_API_KEY).
// AI features (diet tips, food recognition) use the Rork Toolkit.

import { FirestoreClient, decodeFirebaseToken, verifyFirebaseToken } from "./firestore";
import { renderAdminPanel } from "./admin-panel";
import { LOGO_DATA_URI } from "./logo";
import { PLAYSTORE_ASSETS } from "./playstore-assets";
import { SEED_SCHOOLS, SEED_HOSPITALS, SEED_DOCTORS } from "./seed-data";

const APP_ORIGIN = "https://kidhero.rork.app";
const ANDROID_PACKAGE = "kallam.healthcare";
const DEFAULT_COUNTRY_CODE = "91";
const INVITE_EXPIRY_DAYS = 30;
const IMPORT_MAX_ROWS = 2000;
const OTP_EXPIRY_MINUTES = 5;
const DOCTOR_SETUP_OTP_EXPIRY_MINUTES = 30;

interface Env {
  FIREBASE_SERVICE_ACCOUNT_KEY: string;
  ADMIN_API_KEY?: string;
  INVITE_SIGNING_KEY?: string;
  ANDROID_CERT_SHA256?: string;
  APP_PLAY_URL?: string;
  TOOLKIT_URL?: string;
  TOOLKIT_SECRET_KEY?: string;
  DEV_MODE?: string;
  TEXTBEE_API_KEY?: string;
  TEXTBEE_DEVICE_ID?: string;
}

// ─── Helpers ────────────────────────────────────────────────────

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

function generateOtp(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(100000 + (array[0] % 900000));
}

function isDevMode(env: Env): boolean {
  return env.DEV_MODE === "true" || env.DEV_MODE === "1";
}

function normalizePhone(raw: string | number | undefined | null): { e164: string; last10: string } | null {
  if (raw == null) return null;
  let digits = String(raw).replace(/\D/g, "");
  if (digits.length === 10) {
    return { e164: `+${DEFAULT_COUNTRY_CODE}${digits}`, last10: digits };
  }
  if (digits.length > 10 && digits.endsWith(DEFAULT_COUNTRY_CODE)) {
    const last10 = digits.slice(-10);
    return { e164: `+${DEFAULT_COUNTRY_CODE}${last10}`, last10 };
  }
  if (digits.length > 10) {
    const last10 = digits.slice(-10);
    return { e164: `+${DEFAULT_COUNTRY_CODE}${last10}`, last10 };
  }
  return null;
}

function normalizeFieldKey(s: string): string {
  return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]/g, "");
}

const FIELD_ALIASES: Record<string, string[]> = {
  phone: ["phone", "parentPhone", "parentphone", "mobile", "contact", "phoneNumber", "phonenumber", "mobilenumber"],
  studentName: ["studentName", "studentname", "name", "student", "kidName", "kidname", "childName", "childname", "studentFullName", "studentfullname"],
  parentName: ["parentName", "parentname", "fatherName", "fathername", "motherName", "mothername", "guardianName", "guardianname", "parent"],
  gender: ["gender", "sex"],
  grade: ["grade", "class", "className", "classname", "standard", "section"],
  dob: ["dob", "dateOfBirth", "dateofbirth", "birthDate", "birthdate"],
  age: ["age"],
  schoolCode: ["schoolCode", "school_code", "partnerCode", "partnercode", "partner_code", "schoolcode"],
  schoolName: ["schoolName", "school_name", "school", "schoolname"],
  campDate: ["campDate", "camp_date", "date"],
  campTitle: ["campTitle", "camp_title", "camp", "title"],
  heightCm: ["heightCm", "height_cm", "height", "stature"],
  weightKg: ["weightKg", "weight_kg", "weight", "mass"],
  dental: ["dental", "dental_status", "dentalstatus", "teeth"],
  eyesight: ["eyesight", "vision", "eye_status", "eyestatus", "eye"],
  nutrition: ["nutrition", "nutrition_status", "nutritionstatus", "bmi"],
  studentId: ["studentId", "student_id", "rollNumber", "rollnumber", "rollNo", "rollno", "id"],
};

function canonicalizeRow(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [rawKey, value] of Object.entries(row)) {
    const normKey = normalizeFieldKey(rawKey);
    let str = String(value ?? "").trim();
    if (str.charCodeAt(0) === 0xFEFF) str = str.slice(1);
    for (const [canonical, aliases] of Object.entries(FIELD_ALIASES)) {
      if (out[canonical]) continue;
      for (const alias of aliases) {
        if (normalizeFieldKey(alias) === normKey) {
          out[canonical] = str;
          break;
        }
      }
    }
    if (!(normKey in out)) {
      out[normKey] = str;
    }
  }
  return out;
}

function rowField(row: Record<string, unknown>, ...wanted: string[]): string {
  const n = canonicalizeRow(row);
  for (const key of wanted) {
    const val = n[normalizeFieldKey(key)];
    if (val && val.trim()) return val.trim();
  }
  return "";
}

function normHealthFlag(v: string): string {
  const upper = v.toUpperCase().trim();
  if (["GOOD", "WATCH", "ALERT"].includes(upper)) return upper;
  return "GOOD";
}

function parseNum(v: string): number | null {
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function deriveAge(dob: string, age: string): number {
  if (age) {
    const n = parseInt(age, 10);
    if (!isNaN(n) && n > 0 && n < 25) return n;
  }
  if (dob) {
    try {
      const d = new Date(dob);
      const now = new Date();
      let a = now.getFullYear() - d.getFullYear();
      const m = now.getMonth() - d.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
      if (a > 0 && a < 25) return a;
    } catch { /* ignore */ }
  }
  return 7;
}

function kidBmi(heightCm: number, weightKg: number): number {
  if (heightCm <= 0 || weightKg <= 0) return 0;
  const m = heightCm / 100;
  return weightKg / (m * m);
}

function nutritionFlagFromBmi(bmi: number): string {
  if (bmi <= 0) return "GOOD";
  if (bmi < 14) return "ALERT";
  if (bmi < 16) return "WATCH";
  if (bmi > 25) return "ALERT";
  if (bmi > 22) return "WATCH";
  return "GOOD";
}

function stableHash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) - h) + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function buildStudentRef(phone: string, studentName: string, studentId: string): string {
  if (studentId) return `stu_${studentId}`;
  return `stu_${stableHash(phone + studentName).toString(36)}`;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

async function getOrCreateSchool(
  fs: FirestoreClient,
  schoolCode: string,
  schoolName: string,
): Promise<{ schoolId: string; schoolName: string }> {
  if (!schoolCode && !schoolName) return { schoolId: "", schoolName: "" };
  const normalizedName = schoolName.toLowerCase().trim();
  const normalizedCode = schoolCode.toLowerCase().trim();
  try {
    const all = await fs.query("schools", [{ field: "active", op: "EQUAL", value: true }], undefined, 1000);
    for (const s of all) {
      const code = String(s.partner_code || "").toLowerCase().trim();
      if (normalizedCode && code === normalizedCode) {
        return { schoolId: s.id as string, schoolName: (s.name as string) || schoolName };
      }
      const name = String(s.name || "").toLowerCase().trim();
      if (normalizedName && name === normalizedName) {
        return { schoolId: s.id as string, schoolName: (s.name as string) || schoolName };
      }
    }
  } catch (_) {
    // ignore and fall through
  }
  if (!schoolName) return { schoolId: "", schoolName: "" };
  const id = schoolCode ? `sch_${slugify(schoolCode)}` : `sch_${slugify(schoolName)}`;
  const newSchool = {
    id,
    name: schoolName,
    city: "",
    district: "",
    partner_code: schoolCode || "",
    contact_email: "",
    description: "Imported via admin panel",
    active: true,
  };
  await fs.setDoc("schools", id, newSchool);
  return { schoolId: id, schoolName };
}

// ─── HMAC Invite Tokens ─────────────────────────────────────────

async function hmacSign(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signInviteToken(last10: string, env: Env): Promise<string | null> {
  const secret = env.INVITE_SIGNING_KEY || env.ADMIN_API_KEY;
  if (!secret) return null;
  const expires = Date.now() + INVITE_EXPIRY_DAYS * 86400000;
  const payload = `${last10}.${expires}`;
  const sig = await hmacSign(payload, secret);
  return `${payload}.${sig}`;
}

async function verifyInviteToken(token: string, env: Env): Promise<string | null> {
  const secret = env.INVITE_SIGNING_KEY || env.ADMIN_API_KEY;
  if (!secret || !token) return null;
  const parts = token.split(".");
  if (parts.length < 3) return null;
  const last10 = parts[0];
  const expires = parseInt(parts[1], 10);
  const sig = parts.slice(2).join(".");
  if (Date.now() > expires) return null;
  const expected = await hmacSign(`${last10}.${expires}`, secret);
  if (sig !== expected) return null;
  return last10;
}

// ─── textbee.dev SMS (invite link only — login OTP stays 100% Firebase) ─
// textbee.dev turns your own Android phone into an SMS gateway, so there's
// no per-message provider fee like Twilio/Plivo — texts go out from your SIM.

function textbeeConfigured(env: Env): boolean {
  return !!(env.TEXTBEE_API_KEY && env.TEXTBEE_DEVICE_ID);
}

function buildInviteMessage(link: string, studentName?: string, schoolName?: string): string {
  const kid = (studentName || "").trim();
  const school = (schoolName || "").trim();
  const who = kid ? kid : "your child";
  const source = school ? `${school} has` : "We've";
  return `VitaHero: ${source} set up a free health record for ${who} — track growth, vision & nutrition in one app. View it here: ${link}`;
}

async function sendInviteSms(e164Phone: string, link: string, env: Env, studentName?: string, schoolName?: string): Promise<{ sent: boolean; reason?: string }> {
  if (!textbeeConfigured(env)) {
    return { sent: false, reason: "textbee.dev not configured" };
  }
  try {
    const resp = await fetch(`https://api.textbee.dev/api/v1/gateway/devices/${env.TEXTBEE_DEVICE_ID}/send-sms`, {
      method: "POST",
      headers: {
        "x-api-key": env.TEXTBEE_API_KEY as string,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipients: [e164Phone],
        message: buildInviteMessage(link, studentName, schoolName),
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      return { sent: false, reason: `textbee.dev error: ${errText.slice(0, 200)}` };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: (err as Error).message };
  }
}

// ─── Admin Auth ─────────────────────────────────────────────────

function requireAdmin(request: Request, env: Env): boolean {
  const key = request.headers.get("X-Admin-Key") || "";
  return !!(env.ADMIN_API_KEY && key === env.ADMIN_API_KEY);
}

// ─── Firestore Seeding ──────────────────────────────────────────

let seedDone = false;

async function seedFirestore(fs: FirestoreClient): Promise<void> {
  if (seedDone) return;
  seedDone = true;
  try {
    // Check if schools already exist
    const existing = await fs.query("schools", [{ field: "active", op: "EQUAL", value: true }]);
    if (existing.length > 0) return;

    // Seed schools
    for (const school of SEED_SCHOOLS) {
      await fs.setDoc("schools", school.id, school as unknown as Record<string, unknown>);
    }
    // Seed hospitals
    for (const hosp of SEED_HOSPITALS) {
      await fs.setDoc("hospitals", hosp.id, hosp as unknown as Record<string, unknown>);
    }
    // Seed doctors
    for (const doc of SEED_DOCTORS) {
      await fs.setDoc("doctors", doc.id, doc as unknown as Record<string, unknown>);
    }
    console.log("Firestore seeded: schools, hospitals, doctors");
  } catch (e) {
    console.error("Seed error:", (e as Error).message);
    // Don't rethrow — seeding is best-effort
  }
}

// ─── CSV Import ─────────────────────────────────────────────────

async function processImport(
  fs: FirestoreClient,
  env: Env,
  rows: Record<string, unknown>[],
  opts: { dryRun: boolean; generateLinks: boolean; filename: string; adminId: string; appOrigin: string },
): Promise<Record<string, unknown>> {
  const results: Array<Record<string, unknown>> = [];
  let created = 0, updated = 0, errors = 0, linked = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const n = canonicalizeRow(row);
    const phoneRaw = n.phone;
    const studentName = n.studentName;
    const parentName = n.parentName;
    const gender = (n.gender || "").toUpperCase().startsWith("F") ? "F" : "M";
    const grade = n.grade;
    const age = deriveAge(n.dob, n.age);
    const schoolCode = (n.schoolCode || "").toUpperCase();
    const schoolName = n.schoolName;
    const campDate = n.campDate;
    const campTitle = n.campTitle;
    const heightCm = parseNum(n.heightCm) ?? 0;
    const weightKg = parseNum(n.weightKg) ?? 0;
    const dental = normHealthFlag(n.dental);
    const eyesight = normHealthFlag(n.eyesight);
    const nutrition = normHealthFlag(n.nutrition);
    const studentId = n.studentId;

    const norm = normalizePhone(phoneRaw);
    if (!norm) {
      results.push({ row: i + 1, phone: phoneRaw, student: studentName, status: "error", message: "Invalid phone number" });
      errors++;
      continue;
    }

    if (opts.dryRun) {
      results.push({ row: i + 1, phone: norm.e164, student: studentName, status: "created", message: "Dry run — no data written" });
      created++;
      continue;
    }

    try {
      // Look up or auto-create the school by code/name (case-insensitive)
      const { schoolId, schoolName: resolvedSchoolName } = await getOrCreateSchool(fs, schoolCode, schoolName);
      const finalSchoolName = resolvedSchoolName || schoolName;

      const studentRef = buildStudentRef(norm.last10, studentName, studentId);
      const kidId = `kid_${norm.last10}_${studentRef}`;
      const provisionedId = norm.last10;

      // Check if provisioned parent already exists
      const existing = await fs.getDoc("provisioned_parents", provisionedId);
      const isNew = !existing;

      // Build provisioned parent data
      const parentData: Record<string, unknown> = {
        id: provisionedId,
        phone: norm.e164,
        name: parentName || "Parent",
        provisioned: true,
        school_id: schoolId,
        school_name: finalSchoolName,
        invited_at: existing?.invited_at || "",
        invite_count: existing?.invite_count || 0,
        is_logged_in: existing?.is_logged_in || false,
        uid: existing?.uid || "",
      };
      await fs.setDoc("provisioned_parents", provisionedId, parentData);

      // Build kid data
      const kidData: Record<string, unknown> = {
        id: kidId,
        name: studentName || "Student",
        age,
        gender,
        grade,
        school: finalSchoolName,
        school_id: schoolId,
        height_cm: heightCm,
        weight_kg: weightKg,
        dental,
        eyesight,
        nutrition,
        last_checkup: "Not yet",
        source: "ADMIN",
        student_ref: studentRef,
        overall_score: 80,
      };
      await fs.setDocByPath(`provisioned_parents/${provisionedId}/kids/${kidId}`, kidData);

      // Handle camp registration if camp date/title provided
      if (campDate && campTitle && schoolId) {
        const campId = `sc_${schoolId}_${slugify(campTitle).slice(0, 12)}`;
        const existingCamp = await fs.getDoc("school_camps", campId);
        if (!existingCamp) {
          await fs.setDoc("school_camps", campId, {
            id: campId,
            school_id: schoolId,
            title: campTitle,
            description: "",
            date: campDate,
            time: "9:00 AM - 1:00 PM",
            status: "UPCOMING",
            checks: ["Height & Weight", "Dental", "Eye Test", "Hemoglobin"],
            grades: [],
            capacity: 200,
            registered_count: 0,
            result_summary: "",
            active: true,
          });
        }
        // Register kid for camp
        const regId = `${campId}_${kidId}`;
        await fs.mergeDoc("camp_registrations", regId, {
          school_camp_id: campId,
          kid_id: kidId,
          user_id: provisionedId,
          registered_at: Date.now().toString(),
        });
      }

      // Generate an invite link and, if textbee.dev is configured, text it to the parent automatically
      let inviteLink = "";
      let rowMessage = "";
      let smsSent = false;
      if (opts.generateLinks) {
        const token = await signInviteToken(norm.last10, env);
        if (token) {
          inviteLink = `${opts.appOrigin}/i/${token}`;
          linked++;
          await fs.mergeDoc("provisioned_parents", provisionedId, {
            invited_at: new Date().toISOString(),
            invite_count: (existing?.invite_count as number || 0) + 1,
          });
          const smsResult = await sendInviteSms(norm.e164, inviteLink, env, studentName, finalSchoolName);
          smsSent = smsResult.sent;
          rowMessage = smsResult.sent ? "Invite SMS sent" : (smsResult.reason || "");
        } else {
          rowMessage = "Could not sign invite link (INVITE_SIGNING_KEY missing)";
        }
      }
      results.push({ row: i + 1, phone: norm.e164, student: studentName, status: isNew ? "created" : "updated", message: rowMessage, link: inviteLink, smsSent });
      if (isNew) created++; else updated++;
    } catch (err) {
      results.push({ row: i + 1, phone: norm.e164, student: studentName, status: "error", message: (err as Error).message });
      errors++;
    }
  }

  // Store import batch audit
  if (!opts.dryRun) {
    const batchId = `batch_${Date.now()}`;
    await fs.setDoc("import_batches", batchId, {
      id: batchId,
      admin_id: opts.adminId,
      filename: opts.filename,
      total: rows.length,
      created,
      updated,
      skipped: 0,
      errors,
      invited: linked,
      dry_run: false,
      created_at: new Date().toISOString(),
    });
  }

  return {
    total: rows.length,
    created,
    updated,
    errors,
    linked,
    dryRun: opts.dryRun,
    results,
  };
}

// ─── AI Toolkit ─────────────────────────────────────────────────

async function callToolkitDietTip(
  env: Env,
  kid: Record<string, unknown>,
  meals: Record<string, unknown>[],
  streak: Record<string, unknown> | null,
): Promise<Record<string, string> | null> {
  if (!env.TOOLKIT_URL || !env.TOOLKIT_SECRET_KEY) return null;
  try {
    const prompt = `You are a paediatric nutrition AI. Generate a personalised diet tip for a child.
Kid: ${kid.name}, age ${kid.age}, gender ${kid.gender}, nutrition status: ${kid.nutrition}.
Recent meals: ${meals.map(m => `${m.time_slot}: ${m.name} (${m.eaten ? "eaten" : "skipped"})`).join(", ")}.
Current streak: ${streak?.current_streak || 0} days.
Respond as JSON: {"greeting":"","insight":"","suggestion":"","funFact":""}`;
    const resp = await fetch(`${env.TOOLKIT_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.TOOLKIT_SECRET_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json() as Record<string, unknown>;
    const content = (data.choices as Array<Record<string, unknown>>)?.[0]?.message?.content as string;
    if (!content) return null;
    return JSON.parse(content) as Record<string, string>;
  } catch {
    return null;
  }
}

async function callToolkitFoodVision(
  env: Env,
  dataUrl: string,
): Promise<Array<{ name: string; kcal: number; confidence: number }> | null> {
  if (!env.TOOLKIT_URL || !env.TOOLKIT_SECRET_KEY) return null;
  try {
    const resp = await fetch(`${env.TOOLKIT_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.TOOLKIT_SECRET_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Identify the food items in this image. Respond as JSON: {\"items\":[{\"name\":\"\",\"kcal\":0,\"confidence\":0.8}]}" },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json() as Record<string, unknown>;
    const content = (data.choices as Array<Record<string, unknown>>)?.[0]?.message?.content as string;
    if (!content) return null;
    const parsed = JSON.parse(content) as { items: Array<{ name: string; kcal: number; confidence: number }> };
    return parsed.items || [];
  } catch {
    return null;
  }
}

// ─── Booking Slots Generation ───────────────────────────────────

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
      slots.push({ date: dateStr, time, label: `${dayLabel}, ${time}` });
      if (slots.length >= 12) break;
    }
  }
  return slots;
}

// ─── Privacy Policy & Data Deletion Pages ─────────────────────

function renderPrivacyPolicy(): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>VitaHero — Privacy Policy</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Host+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Host Grotesk',system-ui,-apple-system,sans-serif;background:#F8FAFC;color:#0F172A;line-height:1.6}
.wrap{max-width:760px;margin:0 auto;padding:48px 24px 80px}
header{display:flex;align-items:center;gap:12px;margin-bottom:40px;padding-bottom:24px;border-bottom:1px solid #E2E8F0}
.mark{width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#F47B20,#1FA2DD);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:22px}
.name{font-size:22px;font-weight:700}.name span{color:#F47B20}
h1{font-size:30px;font-weight:700;margin:0 0 8px}
.updated{color:#64748B;font-size:14px;margin-bottom:32px}
h2{font-size:20px;font-weight:600;margin:32px 0 12px;color:#0F172A}
p{margin:0 0 14px;color:#334155;font-size:15px}
ul{margin:0 0 14px 0;padding-left:22px;color:#334155;font-size:15px}
li{margin-bottom:8px}
a{color:#1FA2DD;text-decoration:none}
.contact{background:#fff;border:1px solid #E2E8F0;border-radius:16px;padding:24px;margin-top:24px}
.contact h2{margin-top:0}
</style></head><body><div class="wrap">
<header><div class="mark">V</div><div class="name">Vita<span>Hero</span></div></header>
<h1>Privacy Policy</h1>
<div class="updated">Last updated: July 27, 2026</div>

<p>VitaHero ("we", "us", or "our") operates the VitaHero mobile application (the "App") and the associated backend services. The App helps parents access their children's health check-up reports from school health camps conducted by partner hospitals and doctors. This Privacy Policy explains what information we collect, how we use it, and the choices you have.</p>

<h2>1. Information We Collect</h2>
<ul>
<li><b>Phone number:</b> Your mobile number is used as your account identifier and to send you a one-time password (OTP) via SMS for sign-in.</li>
<li><b>Child health records:</b> Health check-up results entered by authorised doctors during school health camps, including vision, dental, BMI, and general paediatric findings. These are associated with your account so you can view your child's reports.</li>
<li><b>Profile information:</b> Parent name and child name(s), collected during school camp registration or imported by the school administrator.</li>
<li><b>Optional device data:</b> If you grant permission, the App may read step count, active calories, and exercise data from Android Health Connect to display wellness trends. This data stays on your device unless you choose to share it.</li>
<li><b>Camera usage:</b> The App uses the camera for food recognition (AI diet tips) only when you choose to scan a meal. Images are processed to generate suggestions and are not stored unless you save them.</li>
</ul>

<h2>2. How We Use Information</h2>
<ul>
<li>To authenticate you via SMS OTP and create your account.</li>
<li>To display your child's health check-up reports and recommendations.</li>
<li>To send you SMS invitations and notifications about available health reports.</li>
<li>To enable doctors and school administrators to manage camp check-ups and generate reports.</li>
<li>To improve the App's features and AI-based diet and food recognition suggestions.</li>
</ul>

<h2>3. Data Storage</h2>
<p>Your data is stored securely in Google Firebase (Firestore and Firebase Authentication), hosted on Google Cloud infrastructure. Access is restricted to authorised administrators and the doctors assigned to your child's health camp. SMS messages are sent through textbee.dev, our SMS gateway provider, which processes the phone number solely to deliver the message.</p>

<h2>4. Data Sharing</h2>
<p>We do not sell your personal information. We share data only with:</p>
<ul>
<li><b>Partner schools and hospitals:</b> To coordinate health camps and deliver reports to parents.</li>
<li><b>Service providers:</b> Firebase (Google) for authentication and data storage, and textbee.dev for SMS delivery, under their respective privacy policies.</li>
<li><b>Legal authorities:</b> If required by applicable law.</li>
</ul>

<h2>5. Data Retention & Deletion</h2>
<p>We retain your child's health records for as long as your account is active and for a reasonable period thereafter to meet legal or medical record-keeping obligations. You can request deletion of your account and associated data at any time — see the contact section below or visit our <a href="/data-deletion">Data Deletion page</a>.</p>

<h2>6. Children's Privacy</h2>
<p>The App is designed for parents and guardians to manage health information about their children. We do not knowingly collect personal information directly from children under 13. All accounts are created and controlled by a verified parent or guardian. Health data is collected by authorised doctors during school-organised health camps with the school's consent.</p>

<h2>7. Your Rights</h2>
<ul>
<li>Access the health records associated with your account.</li>
<li>Request correction of inaccurate information.</li>
<li>Request deletion of your account and associated data.</li>
<li>Withdraw Health Connect or camera permissions at any time from your Android settings.</li>
</ul>

<h2>8. Security</h2>
<p>We protect your data with industry-standard measures including encrypted transport (HTTPS), Firebase security rules, server-side API key authentication for admin access, and scoped doctor credentials. No method of transmission or storage is 100% secure, but we work to protect your information using reasonable safeguards.</p>

<h2>9. Changes to This Policy</h2>
<p>We may update this Privacy Policy from time to time. We will notify you of significant changes by posting the new policy on this page and updating the "Last updated" date above.</p>

<div class="contact">
<h2>10. Contact Us</h2>
<p>If you have questions about this Privacy Policy or want to request data access, correction, or deletion, please contact:</p>
<ul>
<li>Email: <a href="mailto:support@vitahero.app">support@vitahero.app</a></li>
<li>Admin portal: <a href="/admin">VitaHero Admin Panel</a></li>
</ul>
</div>
</div></body></html>`;
}

function renderDataDeletion(): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>VitaHero — Data Deletion</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Host+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Host Grotesk',system-ui,-apple-system,sans-serif;background:#F8FAFC;color:#0F172A;line-height:1.6}
.wrap{max-width:680px;margin:0 auto;padding:48px 24px 80px}
header{display:flex;align-items:center;gap:12px;margin-bottom:40px;padding-bottom:24px;border-bottom:1px solid #E2E8F0}
.mark{width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#F47B20,#1FA2DD);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:22px}
.name{font-size:22px;font-weight:700}.name span{color:#F47B20}
h1{font-size:28px;font-weight:700;margin:0 0 8px}
.updated{color:#64748B;font-size:14px;margin-bottom:32px}
h2{font-size:19px;font-weight:600;margin:28px 0 10px}
p{margin:0 0 14px;color:#334155;font-size:15px}
ul{margin:0 0 14px 0;padding-left:22px;color:#334155;font-size:15px}
li{margin-bottom:8px}
a{color:#1FA2DD;text-decoration:none}
.card{background:#fff;border:1px solid #E2E8F0;border-radius:16px;padding:28px;margin:24px 0}
.steps{counter-reset:step;padding:0;list-style:none}
.steps li{counter-increment:step;position:relative;padding:14px 0 14px 56px;border-bottom:1px solid #F1F5F9}
.steps li:last-child{border-bottom:none}
.steps li::before{content:counter(step);position:absolute;left:0;top:12px;width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#F47B20,#1FA2DD);color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;font-size:15px}
.btn{display:inline-flex;align-items:center;background:linear-gradient(90deg,#F47B20,#1FA2DD);color:#fff;text-decoration:none;padding:14px 28px;border-radius:14px;font-weight:600;margin-top:16px}
</style></head><body><div class="wrap">
<header><div class="mark">V</div><div class="name">Vita<span>Hero</span></div></header>
<h1>Data Deletion & Account Removal</h1>
<div class="updated">Last updated: July 27, 2026</div>

<p>You can request deletion of your VitaHero account and all associated data at any time. Once a deletion request is processed, your account, your child's health check-up records, and your phone number will be permanently removed from our systems, usually within 30 days.</p>

<h2>What gets deleted</h2>
<ul>
<li>Your parent profile and phone number.</li>
<li>All health check-up reports associated with your children.</li>
<li>SMS invite and notification history tied to your number.</li>
<li>Any locally stored wellness data on your device (you can also clear this from Android Settings → Apps → VitaHero → Storage).</li>
</ul>

<h2>How to request deletion</h2>
<div class="card">
<ol class="steps">
<li><b>Email us</b> at <a href="mailto:support@vitahero.app?subject=Account%20Deletion%20Request">support@vitahero.app</a> with the subject "Account Deletion Request" and the mobile number registered with VitaHero.</li>
<li><b>Use the admin portal</b> — if you have access, sign in at <a href="/admin">/admin</a> and use the parent management tools to remove your record.</li>
<li><b>Withdraw app permissions</b> — open Android Settings → Apps → VitaHero → Permissions, and revoke Camera and Health access at any time.</li>
</ol>
<a class="btn" href="mailto:support@vitahero.app?subject=Account%20Deletion%20Request">Request deletion by email</a>
</div>

<h2>Processing time</h2>
<p>Deletion requests are processed within 30 days of verification. You will receive a confirmation email once your data has been removed. Some aggregated, anonymised analytics may be retained where required by law, but no personally identifiable information will remain.</p>

<h2>Questions?</h2>
<p>Contact us at <a href="mailto:support@vitahero.app">support@vitahero.app</a> or read our full <a href="/privacy">Privacy Policy</a>.</p>
</div></body></html>`;
}

// ─── Main Worker ────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));

    const url = new URL(request.url);
    const path = url.pathname;

    // ── Health check ──
    if (path === "/ping") {
      const hasFs = !!env.FIREBASE_SERVICE_ACCOUNT_KEY;
      return json({ ok: true, firestore: hasFs, dev_mode: isDevMode(env) });
    }

    // ── Admin panel HTML ──
    if (path === "/admin") {
      const html = renderAdminPanel(LOGO_DATA_URI);
      return cors(new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }));
    }

    // ── Android App Links ──
    if (path === "/.well-known/assetlinks.json") {
      const fingerprints = (env.ANDROID_CERT_SHA256 || "").split(",").map(s => s.trim()).filter(Boolean);
      return cors(new Response(JSON.stringify([
        {
          relation: ["delegate_permission/common.handle_all_urls"],
          target: {
            namespace: "android_app",
            package_name: ANDROID_PACKAGE,
            sha256_cert_fingerprints: fingerprints,
          },
        },
      ]), { status: 200, headers: { "Content-Type": "application/json" } }));
    }

    // ── Play Store listing assets (public downloads for Play Console upload) ──
    if (path.startsWith("/playstore/")) {
      const name = decodeURIComponent(path.slice("/playstore/".length));
      const asset = PLAYSTORE_ASSETS[name];
      if (!asset) return cors(new Response("Not found", { status: 404 }));
      const bin = atob(asset.b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new Response(bytes, {
        status: 200,
        headers: {
          "Content-Type": asset.mime,
          "Cache-Control": "public, max-age=86400, immutable",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }
    // ── Play Store assets index (HTML list of all assets with download links) ──
    if (path === "/playstore") {
      const items = Object.keys(PLAYSTORE_ASSETS)
        .map((n) => `<li><a href="/playstore/${encodeURIComponent(n)}">${n}</a></li>`)
        .join("");
      const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VitaHero — Play Store Assets</title><style>body{font-family:system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 20px;color:#0F172A}h1{color:#F47B20}ul{list-style:none;padding:0}li{padding:10px 0;border-bottom:1px solid #eee}a{color:#1FA2DD;text-decoration:none;font-weight:600}a:hover{text-decoration:underline}</style></head><body><h1>VitaHero Play Store Assets</h1><p>Right-click any link and choose “Save link as…” to download.</p><ul>${items}</ul></body></html>`;
      return cors(new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }));
    }

    // ── Invite token resolution ──
    if (path === "/api/invite/resolve" && request.method === "GET") {
      const token = url.searchParams.get("token") || "";
      const last10 = await verifyInviteToken(token, env);
      if (!last10) return json({ valid: false }, 200);
      return json({ valid: true, phone: `+${DEFAULT_COUNTRY_CODE}${last10}`, last10 });
    }

    // ── Privacy policy (required for Play Console + health app data safety) ──
    if (path === "/privacy") {
      const html = renderPrivacyPolicy();
      return cors(new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }));
    }

    // ── Data deletion instructions (required for Play Console data safety form) ──
    if (path === "/data-deletion") {
      const html = renderDataDeletion();
      return cors(new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }));
    }

    // ── Invite landing page ──
    if (path.startsWith("/i/")) {
      const token = path.slice(3);
      const playUrl = env.APP_PLAY_URL || "https://play.google.com/apps/internaltest/4700990678853594044";
      const deepLink = `vitahero://invite?token=${encodeURIComponent(token)}`;
      const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>VitaHero — Open your child's health report</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Host+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Host Grotesk',system-ui,sans-serif;background:linear-gradient(160deg,#F47B20 0%,#1FA2DD 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
.card{background:#fff;color:#0F172A;max-width:440px;width:100%;padding:40px 32px;border-radius:28px;box-shadow:0 24px 80px rgba(15,23,42,.22);text-align:center}
.logo{display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:24px}
.logo .mark{width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,#F47B20,#1FA2DD);display:flex;align-items:center;justify-content:center;color:#fff;font-size:28px;font-weight:700}
.logo .name{font-size:26px;font-weight:700}.logo .name span{color:#F47B20}
.card h1{font-size:21px;margin:0 0 10px;font-weight:600}
.card p{color:#475569;line-height:1.55;font-size:15px;margin-bottom:8px}
a.btn{display:flex;align-items:center;justify-content:center;text-align:center;background:linear-gradient(90deg,#F47B20,#1FA2DD);color:#fff;text-decoration:none;padding:15px;border-radius:14px;font-weight:600;font-size:15px;margin-top:16px}
a.btn.secondary{background:#0F172A}
</style></head><body><div class="card">
<div class="logo"><div class="mark">V</div><div class="name">Vita<span>Hero</span></div></div>
<h1>Your child's health report is ready</h1>
<p>Install the VitaHero app, then sign in with the mobile number this link was sent to.</p>
<a class="btn" href="${playUrl}">Get the app</a>
<a class="btn secondary" href="${deepLink}">Open in app</a></div>
<script>try{window.location.href=${JSON.stringify(deepLink)};}catch(e){}</script>
</body></html>`;
      return cors(new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }));
    }

    // ── Initialize Firestore ──
    if (!env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      return json({ error: "FIREBASE_SERVICE_ACCOUNT_KEY not configured" }, 500);
    }
    const fs = new FirestoreClient(env.FIREBASE_SERVICE_ACCOUNT_KEY);

    // Seed on first request
    await seedFirestore(fs);

    try {
      // ═══════════════════════════════════════════════════
      // ADMIN ENDPOINTS
      // ═══════════════════════════════════════════════════

      // ── Admin verify ──
      if (path === "/api/admin/verify" && request.method === "GET") {
        if (!requireAdmin(request, env)) return json({ error: "Admin authorization required" }, 403);
        return json({ valid: true });
      }

      // ── Admin stats (Firestore) ──
      if (path === "/api/admin/stats" && request.method === "GET") {
        if (!requireAdmin(request, env)) return json({ error: "Admin authorization required" }, 403);
        const parents = await fs.count("provisioned_parents", [{ field: "provisioned", op: "EQUAL", value: true }]);
        // Count imported kids, active parents, and generated links by iterating provisioned parents
        let importedKids = 0;
        let activeParents = 0;
        let invites = 0;
        const provParents = await fs.query("provisioned_parents", [{ field: "provisioned", op: "EQUAL", value: true }], undefined, 500);
        for (const p of provParents) {
          if (p.is_logged_in === true) activeParents++;
          if (p.invited_at) invites += (p.invite_count as number) || 1;
          try {
            const kids = await fs.listDocs(`provisioned_parents/${p.id}/kids`);
            importedKids += kids.length;
          } catch (_) { /* ignore */ }
        }
        return json({
          provisionedParents: parents,
          activeParents: activeParents,
          importedKids: importedKids,
          invitesSent: invites,
        });
      }

      // ── Import data ──
      if (path === "/api/admin/import" && request.method === "POST") {
        if (!requireAdmin(request, env)) return json({ error: "Admin authorization required" }, 403);
        const body: Record<string, unknown> = await request.json();
        const rows = Array.isArray(body.rows) ? body.rows as Record<string, unknown>[] : [];
        if (rows.length === 0) return json({ error: "No rows provided" }, 400);
        if (rows.length > IMPORT_MAX_ROWS) return json({ error: `Too many rows (max ${IMPORT_MAX_ROWS})` }, 413);
        const report = await processImport(fs, env, rows, {
          dryRun: body.dryRun === true,
          generateLinks: body.generateLinks === true,
          filename: (body.filename as string) || "",
          adminId: "admin",
          appOrigin: url.origin,
        });
        return json(report);
      }

      // ── Import history ──
      if (path === "/api/admin/import-batches" && request.method === "GET") {
        if (!requireAdmin(request, env)) return json({ error: "Admin authorization required" }, 403);
        const rows = await fs.query("import_batches", undefined, undefined, 50);
        rows.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
        return json(rows);
      }

      // ── Generate invite link(s) and text them via textbee.dev automatically ──
      if (path === "/api/admin/invite" && request.method === "POST") {
        if (!requireAdmin(request, env)) return json({ error: "Admin authorization required" }, 403);
        const body: Record<string, unknown> = await request.json();
        const phones = Array.isArray(body.phones) ? (body.phones as unknown[]).map(String) : [];
        let linked = 0;
        let smsSentCount = 0;
        const skipped: string[] = [];
        const details: Array<Record<string, unknown>> = [];
        for (const raw of phones) {
          const norm = normalizePhone(raw);
          if (!norm) { skipped.push(raw); details.push({ phone: raw, status: "skipped", reason: "Invalid phone number" }); continue; }
          const prof = await fs.getDoc("provisioned_parents", norm.last10);
          if (!prof || prof.provisioned !== true) { skipped.push(norm.e164); details.push({ phone: norm.e164, status: "skipped", reason: "Not provisioned" }); continue; }
          const token = await signInviteToken(norm.last10, env);
          if (!token) { skipped.push(norm.e164); details.push({ phone: norm.e164, status: "skipped", reason: "Invite token could not be signed" }); continue; }
          const inviteUrl = `${url.origin}/i/${token}`;
          linked++;
          await fs.mergeDoc("provisioned_parents", norm.last10, {
            invited_at: new Date().toISOString(),
            invite_count: ((prof.invite_count as number) || 0) + 1,
          });
          let firstKidName = "";
          try {
            const kids = await fs.listDocs(`provisioned_parents/${norm.last10}/kids`);
            firstKidName = (kids?.[0]?.name as string) || "";
          } catch {
            // personalization is best-effort — fall back to generic wording
          }
          const smsResult = await sendInviteSms(norm.e164, inviteUrl, env, firstKidName, prof.school_name as string);
          if (smsResult.sent) smsSentCount++;
          details.push({ phone: norm.e164, status: "linked", link: inviteUrl, smsSent: smsResult.sent, smsReason: smsResult.reason || "" });
        }
        return json({ linked, smsSent: smsSentCount, smsConfigured: textbeeConfigured(env), skipped, details });
      }

      // ── List provisioned parents ──
      if (path === "/api/admin/parents" && request.method === "GET") {
        if (!requireAdmin(request, env)) return json({ error: "Admin authorization required" }, 403);
        const search = (url.searchParams.get("q") || "").trim();
        const limit = Math.min(parseInt(url.searchParams.get("limit") || "100", 10) || 100, 500);
        let rows = await fs.query("provisioned_parents",
          [{ field: "provisioned", op: "EQUAL", value: true }],
          undefined,
          limit,
        );
        rows.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
        if (search) {
          const q = search.toLowerCase();
          rows = rows.filter(r =>
            String(r.phone || "").includes(q) ||
            String(r.name || "").toLowerCase().includes(q),
          );
        }
        // Enrich with kid count and school name
        const result = [];
        for (const r of rows) {
          const kids = await fs.listDocs(`provisioned_parents/${r.id}/kids`);
          let schoolName = "";
          if (r.school_id) {
            const school = await fs.getDoc("schools", r.school_id as string);
            schoolName = (school?.name as string) || "";
          }
          if (!schoolName && r.school_name) {
            schoolName = String(r.school_name);
          }
          result.push({
            id: r.id,
            phone: r.phone,
            name: r.name,
            school_id: r.school_id,
            school_name: schoolName,
            invited_at: r.invited_at,
            invite_count: r.invite_count,
            is_logged_in: r.is_logged_in,
            provisioned: r.provisioned,
            kid_count: kids.length,
          });
        }
        return json(result);
      }

      // ── List schools ──
      if (path === "/api/admin/schools" && request.method === "GET") {
        if (!requireAdmin(request, env)) return json({ error: "Admin authorization required" }, 403);
        const rows = await fs.query("schools", [{ field: "active", op: "EQUAL", value: true }]);
        rows.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
        return json(rows);
      }

      // ── List hospitals ──
      if (path === "/api/admin/hospitals" && request.method === "GET") {
        if (!requireAdmin(request, env)) return json({ error: "Admin authorization required" }, 403);
        const rows = await fs.query("hospitals", undefined, undefined, 500);
        rows.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
        return json(rows);
      }

      // ── Create hospital ──
      if (path === "/api/admin/hospitals" && request.method === "POST") {
        if (!requireAdmin(request, env)) return json({ error: "Admin authorization required" }, 403);
        const body: Record<string, unknown> = await request.json();
        const name = (body.name as string)?.trim();
        const address = (body.address as string)?.trim();
        if (!name) return json({ error: "name is required" }, 400);
        if (!address) return json({ error: "address is required" }, 400);
        const hospId = `hosp_${crypto.randomUUID().slice(0, 10)}`;
        const lat = body.lat !== undefined && body.lat !== null && body.lat !== "" ? parseFloat(String(body.lat)) : null;
        const lng = body.lng !== undefined && body.lng !== null && body.lng !== "" ? parseFloat(String(body.lng)) : null;
        const hospData = {
          id: hospId,
          name,
          city: (body.city as string)?.trim() || "",
          district: (body.district as string)?.trim() || "",
          address,
          phone: (body.phone as string)?.trim() || "",
          lat: lat != null && !isNaN(lat) ? lat : null,
          lng: lng != null && !isNaN(lng) ? lng : null,
          rating: parseFloat(String(body.rating || 4.5)) || 4.5,
          is_camp_partner: !!body.is_camp_partner,
          active: true,
        };
        await fs.setDoc("hospitals", hospId, hospData);
        return json(hospData);
      }

      // ── Update hospital ──
      if (path.startsWith("/api/admin/hospitals/") && request.method === "PUT") {
        if (!requireAdmin(request, env)) return json({ error: "Admin authorization required" }, 403);
        const hospId = path.split("/")[4];
        const body: Record<string, unknown> = await request.json();
        const update: Record<string, unknown> = {};
        if (body.name !== undefined) update.name = String(body.name).trim();
        if (body.city !== undefined) update.city = String(body.city).trim();
        if (body.district !== undefined) update.district = String(body.district).trim();
        if (body.address !== undefined) update.address = String(body.address).trim();
        if (body.phone !== undefined) update.phone = String(body.phone).trim();
        if (body.lat !== undefined) {
          const lat = body.lat !== null && body.lat !== "" ? parseFloat(String(body.lat)) : null;
          update.lat = lat != null && !isNaN(lat) ? lat : null;
        }
        if (body.lng !== undefined) {
          const lng = body.lng !== null && body.lng !== "" ? parseFloat(String(body.lng)) : null;
          update.lng = lng != null && !isNaN(lng) ? lng : null;
        }
        if (body.rating !== undefined) update.rating = parseFloat(String(body.rating)) || 4.5;
        if (body.is_camp_partner !== undefined) update.is_camp_partner = !!body.is_camp_partner;
        if (body.active !== undefined) update.active = !!body.active;
        if (!Object.prototype.hasOwnProperty.call(update, "address") && update.address === undefined) {
          // no-op guard; explicit checks above already handle presence
        }
        await fs.mergeDoc("hospitals", hospId, update);
        const updated = await fs.getDoc("hospitals", hospId);
        return json(updated || {});
      }

      // ── List camps ──
      if (path === "/api/admin/camps" && request.method === "GET") {
        if (!requireAdmin(request, env)) return json({ error: "Admin authorization required" }, 403);
        let rows = await fs.query("school_camps", undefined, undefined, 200);
        rows.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
        const search = (url.searchParams.get("q") || "").trim().toLowerCase();
        if (search) {
          rows = rows.filter(c =>
            String(c.title || "").toLowerCase().includes(search) ||
            String(c.school_name || "").toLowerCase().includes(search),
          );
        }
        // Enrich with school name and registered count
        const result = [];
        for (const c of rows) {
          let schoolName = "";
          if (c.school_id) {
            const school = await fs.getDoc("schools", c.school_id as string);
            schoolName = (school?.name as string) || "";
          }
          const regCount = await fs.count("camp_registrations", [{ field: "school_camp_id", op: "EQUAL", value: c.id }]);
          result.push({
            ...c,
            school_name: schoolName,
            school_city: "",
            registered_count: regCount,
          });
        }
        return json(result);
      }

      // ── Create camp ──
      if (path === "/api/admin/camps" && request.method === "POST") {
        if (!requireAdmin(request, env)) return json({ error: "Admin authorization required" }, 403);
        const body: Record<string, unknown> = await request.json();
        const schoolId = (body.school_id as string)?.trim();
        const title = (body.title as string)?.trim();
        const date = (body.date as string)?.trim();
        if (!title || !date || !schoolId) return json({ error: "title, date, and school_id are required" }, 400);
        const campId = `sc_${schoolId}_${crypto.randomUUID().slice(0, 8)}`;
        const campData = {
          id: campId,
          school_id: schoolId,
          title,
          description: (body.description as string) || "",
          date,
          time: (body.time as string) || "9:00 AM - 1:00 PM",
          status: (body.status as string) || "UPCOMING",
          checks: Array.isArray(body.checks) ? body.checks : [],
          grades: Array.isArray(body.grades) ? body.grades : [],
          capacity: parseInt(String(body.capacity || 200), 10) || 200,
          registered_count: 0,
          result_summary: "",
          active: true,
        };
        await fs.setDoc("school_camps", campId, campData);
        const school = await fs.getDoc("schools", schoolId);
        return json({ ...campData, school_name: school?.name || "", school_city: school?.city || "" });
      }

      // ── Update camp ──
      if (path.startsWith("/api/admin/camps/") && request.method === "PUT") {
        if (!requireAdmin(request, env)) return json({ error: "Admin authorization required" }, 403);
        const campId = path.split("/")[4];
        const body: Record<string, unknown> = await request.json();
        const update: Record<string, unknown> = {};
        if (body.title !== undefined) update.title = body.title;
        if (body.date !== undefined) update.date = body.date;
        if (body.time !== undefined) update.time = body.time;
        if (body.description !== undefined) update.description = body.description;
        if (body.status !== undefined) update.status = body.status;
        if (body.capacity !== undefined) update.capacity = parseInt(String(body.capacity), 10);
        if (body.checks !== undefined) update.checks = body.checks;
        if (body.grades !== undefined) update.grades = body.grades;
        if (body.active !== undefined) update.active = !!body.active;
        await fs.mergeDoc("school_camps", campId, update);
        const updated = await fs.getDoc("school_camps", campId);
        let schoolName = "";
        if (updated?.school_id) {
          const school = await fs.getDoc("schools", updated.school_id as string);
          schoolName = school?.name as string || "";
        }
        return json({ ...(updated || {}), school_name: schoolName, school_city: "" });
      }

      // ── Delete camp ──
      if (path.startsWith("/api/admin/camps/") && request.method === "DELETE") {
        if (!requireAdmin(request, env)) return json({ error: "Admin authorization required" }, 403);
        const campId = path.split("/")[4];
        await fs.mergeDoc("school_camps", campId, { active: false });
        return json({ success: true, deactivated: campId });
      }

      // ── Generate doctor credential ──
      if (path === "/api/admin/doctors/generate" && request.method === "POST") {
        if (!requireAdmin(request, env)) return json({ error: "Admin authorization required" }, 403);
        const body: Record<string, unknown> = await request.json();
        const doctorName = (body.doctor_name as string)?.trim();
        const phone = (body.phone as string)?.trim();
        const schoolCampId = (body.school_camp_id as string)?.trim();
        const specialty = (body.specialty as string)?.trim() || "General Paediatrics";
        const hospitalId = (body.hospital_id as string)?.trim() || "";
        let hospital = (body.hospital as string)?.trim() || "";
        let hospitalCity = "";
        if (hospitalId) {
          const hospDoc = await fs.getDoc("hospitals", hospitalId);
          if (hospDoc) {
            hospital = (hospDoc.name as string) || hospital;
            hospitalCity = (hospDoc.city as string) || "";
          }
        }
        if (!doctorName || !phone || !schoolCampId) {
          return json({ error: "doctor_name, phone, and school_camp_id are required" }, 400);
        }
        const norm = normalizePhone(phone);
        if (!norm) return json({ error: "Invalid phone number" }, 400);
        const allowedScreens = Array.isArray(body.allowed_screens)
          ? body.allowed_screens.filter((s: string) => typeof s === "string" && s.trim())
          : ["DASHBOARD", "CHECKUP"];
        const assignId = `dca_${norm.last10}_${schoolCampId}`;
        await fs.setDoc("doctor_assignments", assignId, {
          id: assignId,
          phone: norm.e164,
          doctor_name: doctorName,
          specialty,
          doctor_type: specialty,
          hospital,
          hospital_id: hospitalId,
          camp_id: schoolCampId,
          assignment_status: "ACTIVE",
          allowed_screens: allowedScreens,
          assigned_at: new Date().toISOString(),
        });
        // Also create/update doctor directory entry
        const docDirId = `doc_${norm.last10}`;
        await fs.setDoc("doctors", docDirId, {
          id: docDirId,
          name: doctorName,
          specialty,
          hospital,
          hospital_id: hospitalId,
          city: hospitalCity || "Hyderabad",
          rating: 4.5,
          active: true,
        });
        return json({
          success: true,
          phone: norm.e164,
          doctor_name: doctorName,
          school_camp_id: schoolCampId,
          specialty,
          doctor_type: specialty,
          allowed_screens: allowedScreens,
          message: `Doctor credential created for ${doctorName}. They can log in via the VitaHero app with ${norm.e164}.`,
        });
      }

      // ── Batch generate doctor credentials ──
      if (path === "/api/admin/doctors/generate-batch" && request.method === "POST") {
        if (!requireAdmin(request, env)) return json({ error: "Admin authorization required" }, 403);
        const body: Record<string, unknown> = await request.json();
        const doctors = body.doctors as Array<Record<string, string>> | undefined;
        const schoolCampId = (body.school_camp_id as string)?.trim();
        if (!Array.isArray(doctors) || doctors.length === 0) return json({ error: "doctors array is required" }, 400);
        if (!schoolCampId) return json({ error: "school_camp_id is required" }, 400);
        if (doctors.length > 50) return json({ error: "Max 50 doctors per batch" }, 400);
        const results: Array<Record<string, unknown>> = [];
        let created = 0, errors = 0;
        for (let i = 0; i < doctors.length; i++) {
          const doc = doctors[i];
          const doctorName = (doc.doctor_name as string)?.trim();
          const phone = (doc.phone as string)?.trim();
          const specialty = (doc.specialty as string)?.trim() || "General Paediatrics";
          const hospitalId = (doc.hospital_id as string)?.trim() || "";
          let hospital = (doc.hospital as string)?.trim() || "";
          let hospitalCity = "";
          if (hospitalId) {
            const hospDoc = await fs.getDoc("hospitals", hospitalId);
            if (hospDoc) {
              hospital = (hospDoc.name as string) || hospital;
              hospitalCity = (hospDoc.city as string) || "";
            }
          }
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
            const docScreens = Array.isArray(doc.allowed_screens)
              ? doc.allowed_screens.filter((s: string) => typeof s === "string" && s.trim())
              : ["DASHBOARD", "CHECKUP"];
            const assignId = `dca_${norm.last10}_${schoolCampId}`;
            await fs.setDoc("doctor_assignments", assignId, {
              id: assignId,
              phone: norm.e164,
              doctor_name: doctorName,
              specialty,
              doctor_type: specialty,
              hospital,
              hospital_id: hospitalId,
              camp_id: schoolCampId,
              assignment_status: "ACTIVE",
              allowed_screens: docScreens,
              assigned_at: new Date().toISOString(),
            });
            const docDirId = `doc_${norm.last10}`;
            await fs.setDoc("doctors", docDirId, {
              id: docDirId,
              name: doctorName,
              specialty,
              hospital,
              hospital_id: hospitalId,
              city: hospitalCity || "Hyderabad",
              rating: 4.5,
              active: true,
            });
            results.push({ row: i + 1, doctor_name: doctorName, phone: norm.e164, status: "created", specialty: specialty, allowed_screens: docScreens });
            created++;
          } catch (err) {
            results.push({ row: i + 1, doctor_name: doctorName, phone, status: "error", message: (err as Error).message });
            errors++;
          }
        }
        return json({ success: true, total: doctors.length, created, errors, results });
      }

      // ── List doctor credentials ──
      if (path === "/api/admin/doctors" && request.method === "GET") {
        if (!requireAdmin(request, env)) return json({ error: "Admin authorization required" }, 403);
        const assignments = await fs.query("doctor_assignments", undefined, undefined, 200);
        assignments.sort((a, b) => String(b.assigned_at || "").localeCompare(String(a.assigned_at || "")));
        const result = [];
        for (const a of assignments) {
          const campId = a.camp_id as string;
          let campTitle = "", campDate = "", schoolName = "";
          if (campId) {
            const camp = await fs.getDoc("school_camps", campId);
            if (camp) {
              campTitle = camp.title as string || "";
              campDate = camp.date as string || "";
              if (camp.school_id) {
                const school = await fs.getDoc("schools", camp.school_id as string);
                schoolName = school?.name as string || "";
              }
            }
          }
          // Check if doctor has logged in (profile exists with this phone)
          const isLoggedIn = false; // Can't easily check without querying all profiles
          result.push({
            assignment_id: a.id,
            doctor_name: a.doctor_name,
            phone: a.phone,
            specialty: a.specialty,
            doctor_type: a.doctor_type || a.specialty || "General Paediatrics",
            hospital: a.hospital,
            camp_id: campId,
            camp_title: campTitle,
            camp_date: campDate,
            school_name: schoolName,
            assignment_status: a.assignment_status,
            allowed_screens: a.allowed_screens || ["DASHBOARD", "CHECKUP"],
            is_logged_in: isLoggedIn,
          });
        }
        return json(result);
      }

      // ── Revoke doctor ──
      if (path.startsWith("/api/admin/doctors/revoke/") && request.method === "POST") {
        if (!requireAdmin(request, env)) return json({ error: "Admin authorization required" }, 403);
        const assignmentId = path.split("/").pop() || "";
        await fs.mergeDoc("doctor_assignments", assignmentId, { assignment_status: "REVOKED" });
        return json({ success: true });
      }

      // ── Verify phone for login (public, no auth required) ──
      // Checks if a phone number is registered as an active doctor or provisioned parent.
      // Used by the app BEFORE sending Firebase OTP to prevent unauthorized logins.
      if (path === "/api/doctor/verify-phone" && request.method === "POST") {
        const body: Record<string, unknown> = await request.json();
        const phoneRaw = (body.phone as string)?.trim();
        if (!phoneRaw) return json({ valid: false, error: "Phone number required" }, 400);
        const norm = normalizePhone(phoneRaw);
        if (!norm) return json({ valid: false, error: "Invalid phone number" }, 400);

        // Check if this phone has an ACTIVE doctor assignment
        const doctorAssignments = await fs.query("doctor_assignments", [
          { field: "phone", op: "EQUAL", value: norm.e164 },
          { field: "assignment_status", op: "EQUAL", value: "ACTIVE" },
        ], undefined, 50);

        if (doctorAssignments.length > 0) {
          // Collect all allowed_screens from all active assignments
          const allScreens = new Set<string>();
          for (const a of doctorAssignments) {
            const screens = a.allowed_screens as string[] | undefined;
            if (Array.isArray(screens)) {
              screens.forEach(s => allScreens.add(s));
            } else {
              allScreens.add("DASHBOARD");
              allScreens.add("CHECKUP");
            }
          }
          return json({
            valid: true,
            is_doctor: true,
            doctor_name: doctorAssignments[0].doctor_name as string || "Doctor",
            specialty: doctorAssignments[0].doctor_type as string || doctorAssignments[0].specialty as string || "General Paediatrics",
            allowed_screens: [...allScreens],
            assignment_count: doctorAssignments.length,
          });
        }

        // Check if this phone is a provisioned parent
        const provParent = await fs.getDoc("provisioned_parents", norm.last10);
        if (provParent && provParent.provisioned === true) {
          return json({
            valid: true,
            is_doctor: false,
          });
        }

        // Not registered — deny login
        return json({
          valid: false,
          is_doctor: false,
          error: "This phone number is not registered. Please contact your administrator to get access.",
        });
      }

      // ── Resend OTP (not applicable with Firebase Auth — return info message) ──
      if (path === "/api/admin/doctors/resend-otp" && request.method === "POST") {
        if (!requireAdmin(request, env)) return json({ error: "Admin authorization required" }, 403);
        return json({
          success: false,
          message: "OTP is now managed by Firebase Phone Auth. The doctor should open the VitaHero app and enter their phone number to receive an OTP automatically.",
        });
      }

      // ═══════════════════════════════════════════════════
      // AUTHENTICATED ENDPOINTS (Firebase ID token required)
      // ═══════════════════════════════════════════════════

      const token = extractToken(request);
      // In production: verify the Firebase ID token signature via JWKS.
      // In DEV_MODE: decode-only (no signature check) for local testing.
      const decoded = token
        ? (isDevMode(env)
            ? decodeFirebaseToken(token)
            : await verifyFirebaseToken(token, fs.getProjectId()))
        : null;
      const uid = decoded?.uid || "";

      // ── Booking directory ──
      if (path === "/api/booking/directory" && request.method === "GET") {
        if (!uid) return json({ error: "Unauthorized" }, 401);
        const city = (url.searchParams.get("city") || "Hyderabad").trim();
        const specialty = (url.searchParams.get("specialty") || "").trim();
        const latParam = url.searchParams.get("lat");
        const lngParam = url.searchParams.get("lng");
        const userLat = latParam ? parseFloat(latParam) : null;
        const userLng = lngParam ? parseFloat(lngParam) : null;

        // Get user's enrolled schools
        const enrollments = await fs.query("school_enrollments", [{ field: "user_id", op: "EQUAL", value: uid }]);
        const userSchoolIds = enrollments.map(e => e.school_id as string);

        // Get hospitals
        const hospitals = await fs.query("hospitals", [{ field: "active", op: "EQUAL", value: true }]);
        const cityHospitals = hospitals.filter(h => String(h.city || "").toLowerCase().includes(city.toLowerCase()));

        // Get doctors
        const doctors = await fs.query("doctors", [{ field: "active", op: "EQUAL", value: true }]);

        // Get school camps for camp count per hospital
        const schoolCamps = await fs.query("school_camps", [{ field: "active", op: "EQUAL", value: true }]);

        const allSpecialties = new Set<string>();
        const hospitalsOut: Array<Record<string, unknown>> = [];

        for (const h of cityHospitals) {
          const hid = h.id as string;
          const docs = doctors.filter(d => d.hospital_id === hid);
          if (specialty && !docs.some(d => d.specialty === specialty)) continue;

          const conductedCamps = schoolCamps.filter(sc => sc.school_id && userSchoolIds.includes(sc.school_id as string)).length;
          const isCampPartner = h.is_camp_partner === true || conductedCamps > 0;

          const lat = h.lat as number | null;
          const lng = h.lng as number | null;
          const distanceKm = userLat != null && userLng != null && lat != null && lng != null
            ? Math.round(haversineKm(userLat, userLng, lat, lng) * 10) / 10 : null;

          const specialties = [...new Set(docs.map(d => d.specialty as string))].sort();
          for (const s of specialties) allSpecialties.add(s);

          const priorityScore =
            (isCampPartner ? 5000 : 0) +
            conductedCamps * 100 +
            ((h.rating as number) || 0) * 10 -
            (distanceKm ?? 999);

          hospitalsOut.push({
            id: hid,
            name: h.name,
            city: h.city,
            district: h.district,
            address: h.address,
            lat, lng,
            phone: h.phone,
            rating: h.rating,
            is_camp_partner: isCampPartner,
            conducted_camps: conductedCamps,
            user_camp_linked: conductedCamps > 0,
            user_linked_camps: conductedCamps,
            distance_km: distanceKm,
            priority_score: priorityScore,
            specialties,
            doctors: docs
              .filter(d => !specialty || d.specialty === specialty)
              .sort((a, b) => (b.rating || 0) - (a.rating || 0))
              .map(d => ({
                id: d.id,
                name: d.name,
                specialty: d.specialty,
                hospital: h.name,
                hospital_id: hid,
                city: d.city || h.city,
                rating: d.rating,
                is_camp_partner: isCampPartner,
              })),
          });
        }

        hospitalsOut.sort((a, b) => (b.priority_score as number) - (a.priority_score as number));
        return json({ city, hospitals: hospitalsOut, specialties: [...allSpecialties].sort() });
      }

      // ── Doctors list ──
      if (path === "/api/doctors" && request.method === "GET") {
        if (!uid) return json({ error: "Unauthorized" }, 401);
        const city = (url.searchParams.get("city") || "").trim();
        const hospitalId = (url.searchParams.get("hospital_id") || "").trim();
        const specialty = (url.searchParams.get("specialty") || "").trim();
        let doctors = await fs.query("doctors", [{ field: "active", op: "EQUAL", value: true }]);
        if (city) doctors = doctors.filter(d => String(d.city || "").toLowerCase().includes(city.toLowerCase()));
        if (hospitalId) doctors = doctors.filter(d => d.hospital_id === hospitalId);
        if (specialty) doctors = doctors.filter(d => d.specialty === specialty);
        // Enrich with hospital info
        const result = [];
        for (const d of doctors) {
          let hospitalName = "", isCampPartner = false;
          if (d.hospital_id) {
            const h = await fs.getDoc("hospitals", d.hospital_id as string);
            hospitalName = h?.name as string || "";
            isCampPartner = h?.is_camp_partner as boolean || false;
          }
          result.push({
            id: d.id,
            name: d.name,
            specialty: d.specialty,
            hospital: hospitalName || d.hospital,
            hospital_id: d.hospital_id,
            city: d.city,
            rating: d.rating,
            is_camp_partner: isCampPartner,
          });
        }
        return json(result.sort((a, b) => (b.rating || 0) - (a.rating || 0)));
      }

      // ── Booking slots ──
      if (path === "/api/booking/slots" && request.method === "GET") {
        if (!uid) return json({ error: "Unauthorized" }, 401);
        const doctorId = (url.searchParams.get("doctor_id") || "").trim();
        if (!doctorId) return json({ error: "doctor_id required" }, 400);
        const doctor = await fs.getDoc("doctors", doctorId);
        if (!doctor) return json({ error: "Doctor not found" }, 404);
        // Get booked appointments for this doctor (collection group query)
        const booked = await fs.collectionGroup("appointments", [{ field: "doctor_id", op: "EQUAL", value: doctorId }]);
        const bookedKeys = new Set(booked.map(r => `${r.doctor_id}|${r.date}|${r.time}`));
        const slots = generateDoctorSlots(doctorId, bookedKeys);
        return json({ doctor_id: doctorId, slots });
      }

      // ── AI Diet Tips: Generate ──
      if (path === "/api/ai-diet-tips/generate" && request.method === "POST") {
        if (!uid) return json({ error: "Unauthorized" }, 401);
        const body: Record<string, unknown> = await request.json();
        const kidId = (body.kid_id as string)?.trim();
        if (!kidId) return json({ error: "kid_id required" }, 400);
        // Read kid from Firestore
        const kid = await fs.getDocByPath(`profiles/${uid}/kids/${kidId}`);
        if (!kid) return json({ error: "Kid not found" }, 404);
        // Read meals (list all and filter by kid_id in memory to avoid index requirements)
        const allMeals = await fs.listDocs(`profiles/${uid}/meals`);
        const meals = allMeals.filter(m => m.kid_id === kidId);
        // Read streak
        const streak = await fs.getDocByPath(`profiles/${uid}/streaks/${kidId}`);
        // Call AI
        const aiJson = await callToolkitDietTip(env, kid, meals, streak);
        if (!aiJson) {
          return json({ error: "AI not configured", code: "TOOLKIT_NOT_CONFIGURED" }, 503);
        }
        const content = {
          greeting: String(aiJson.greeting || ""),
          insight: String(aiJson.insight || ""),
          suggestion: String(aiJson.suggestion || ""),
          funFact: String(aiJson.funFact || ""),
          generatedAt: `AI-generated for ${kid.name}`,
        };
        // Save to Firestore
        await fs.setDocByPath(`profiles/${uid}/ai_diet_tips/${kidId}`, {
          content,
          generated_at: new Date().toISOString(),
        });
        return json({ content, generated_at: new Date().toISOString() }, 201);
      }

      // ── AI Diet Tips: Get ──
      if (path === "/api/ai-diet-tips" && request.method === "GET") {
        if (!uid) return json({ error: "Unauthorized" }, 401);
        const kidId = url.searchParams.get("kid_id");
        if (!kidId) return json({ error: "Missing kid_id" }, 400);
        const tip = await fs.getDocByPath(`profiles/${uid}/ai_diet_tips/${kidId}`);
        return json(tip || null);
      }

      // ── AI Diet Tips: Save ──
      if (path === "/api/ai-diet-tips" && request.method === "POST") {
        if (!uid) return json({ error: "Unauthorized" }, 401);
        const body: Record<string, unknown> = await request.json();
        const kidId = (body.kid_id as string)?.trim();
        if (!kidId) return json({ error: "kid_id required" }, 400);
        const content = body.content as Record<string, unknown>;
        await fs.setDocByPath(`profiles/${uid}/ai_diet_tips/${kidId}`, {
          content,
          generated_at: new Date().toISOString(),
        });
        return json({ content, generated_at: new Date().toISOString() }, 201);
      }

      // ── Food recognition ──
      if (path === "/api/food-recognition" && request.method === "POST") {
        if (!uid) return json({ error: "Unauthorized" }, 401);
        const body: Record<string, unknown> = await request.json();
        const imageBase64 = String(body.image_base64 || "").trim();
        if (!imageBase64) return json({ error: "Missing image_base64" }, 400);
        const mime = String(body.mime || "image/jpeg");
        const dataUrl = imageBase64.startsWith("data:") ? imageBase64 : `data:${mime};base64,${imageBase64}`;
        const items = await callToolkitFoodVision(env, dataUrl);
        if (items === null) return json({ error: "AI not configured", code: "TOOLKIT_NOT_CONFIGURED" }, 503);
        return json({ items });
      }

      return json({ error: "Not found", path }, 404);

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Worker error:", message);
      return json({ error: message }, 500);
    }
  },
};
