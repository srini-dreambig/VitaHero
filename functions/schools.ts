// Stage A — school onboarding, programme configuration, classes, and school admins.
//
// Covers pathway steps A1-A4:
//   A1  sign the school (programme terms: checks offered, cadence, hospital partner)
//   A2  create the school record and issue its partner code
//   A3  provision a school admin account scoped to that school
//   A4  set the academic year, classes and sections
//
// Every handler returns plain data; the entrypoint wraps it in a JSON response.
// Errors are thrown as ApiError so the entrypoint can map them to status codes.

import { ROLE_ADMIN, ROLE_SCHOOL_ADMIN, ROLE_SUPERADMIN, Sql, currentAcademicYear, generatePartnerCode, insertRows, isOpsRole, normalizeMobile, normalizePhone, profileIdForPhone, slugify, tidyName } from "./common";

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, message: string, code = "ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Who is making the request, once authenticated. */
export interface Actor {
  profileId: string;
  name: string;
  role: string;
  schoolId: string | null;
  /**
   * Which product this session signed in from: 'app' or 'console'.
   *
   * Optional, and absent means neither: a bootstrap API key, or a token
   * minted before sessions recorded it. Clinical writes require 'app', so
   * absent is refused — which is the safe direction for a field whose whole
   * job is to withhold permission.
   */
  surface?: string;
}

/** The check types a camp can offer. Kept here so the portal and the API agree. */
export const CHECK_TYPES = [
  "Height & weight",
  "Vision",
  "Dental",
  "Haemoglobin",
  "ENT",
  "Skin",
  "Spine",
  "Immunisation review",
] as const;

export const CAMP_CADENCES = ["ANNUAL", "BIANNUAL", "QUARTERLY", "ADHOC"] as const;

// ─── Schema ─────────────────────────────────────────────────

/**
 * Stage A schema additions. Runs once per worker isolate, not per request —
 * the entrypoint guards it. All statements are idempotent.
 */
export async function ensureStageASchema(sql: Sql): Promise<void> {
  // A1 — programme configuration on the school record.
  await sql`ALTER TABLE vita_hero.schools ADD COLUMN IF NOT EXISTS academic_year TEXT DEFAULT ''`;
  await sql`ALTER TABLE vita_hero.schools ADD COLUMN IF NOT EXISTS checks_offered JSONB DEFAULT '[]'::jsonb`;
  await sql`ALTER TABLE vita_hero.schools ADD COLUMN IF NOT EXISTS camp_cadence TEXT DEFAULT 'ANNUAL'`;
  await sql`ALTER TABLE vita_hero.schools ADD COLUMN IF NOT EXISTS hospital_id TEXT`;
  await sql`ALTER TABLE vita_hero.schools ADD COLUMN IF NOT EXISTS contact_name TEXT DEFAULT ''`;
  await sql`ALTER TABLE vita_hero.schools ADD COLUMN IF NOT EXISTS contact_phone TEXT DEFAULT ''`;
  await sql`ALTER TABLE vita_hero.schools ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE'`;
  await sql`ALTER TABLE vita_hero.schools ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ DEFAULT NOW()`;
  await sql`ALTER TABLE vita_hero.schools ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT ''`;

  // A4 — classes and sections per academic year.
  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.school_classes (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      academic_year TEXT NOT NULL,
      grade TEXT NOT NULL,
      section TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (school_id, academic_year, grade, section)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS school_classes_school_year
    ON vita_hero.school_classes(school_id, academic_year)
  `;

  // A8 — roster fields on the student record.
  await sql`ALTER TABLE vita_hero.kids ADD COLUMN IF NOT EXISTS date_of_birth TEXT`;
  await sql`ALTER TABLE vita_hero.kids ADD COLUMN IF NOT EXISTS section TEXT DEFAULT ''`;
  await sql`ALTER TABLE vita_hero.kids ADD COLUMN IF NOT EXISTS school_id TEXT`;
  await sql`ALTER TABLE vita_hero.kids ADD COLUMN IF NOT EXISTS academic_year TEXT DEFAULT ''`;
  await sql`ALTER TABLE vita_hero.kids ADD COLUMN IF NOT EXISTS guardian_name TEXT DEFAULT ''`;
  await sql`
    CREATE INDEX IF NOT EXISTS kids_school_year
    ON vita_hero.kids(school_id, academic_year)
  `;
  // Grade is the second column because building a camp roster filters a
  // school's children by class; school_id alone uses the same index. It has to
  // be here rather than in ensureSchema, which runs before kids.school_id
  // exists.
  await sql`CREATE INDEX IF NOT EXISTS kids_school_grade ON vita_hero.kids(school_id, grade)`;

  // A5-A8 — roster upload audit trail, distinct from the camp-results import log.
  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.roster_batches (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      academic_year TEXT NOT NULL DEFAULT '',
      admin_id TEXT DEFAULT '',
      filename TEXT DEFAULT '',
      total INT DEFAULT 0,
      created INT DEFAULT 0,
      updated INT DEFAULT 0,
      unchanged INT DEFAULT 0,
      errors INT DEFAULT 0,
      warnings INT DEFAULT 0,
      guardians INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS roster_batches_school
    ON vita_hero.roster_batches(school_id, created_at DESC)
  `;

  // A3 — a school admin is a profile scoped to one school.
  await sql`ALTER TABLE vita_hero.profiles ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT ''`;
  await sql`
    CREATE INDEX IF NOT EXISTS profiles_school_role
    ON vita_hero.profiles(school_id, role)
  `;
}

// ─── Authorisation ──────────────────────────────────────────

/**
 * Assert the actor may act on `schoolId`.
 *
 * Ops roles reach every school. A school admin reaches exactly one — the check
 * is on the server, not implied by what the portal happens to render.
 */
export function assertSchoolAccess(actor: Actor, schoolId: string): void {
  if (isOpsRole(actor.role)) return;
  if (actor.role === ROLE_SCHOOL_ADMIN && actor.schoolId && actor.schoolId === schoolId) return;
  throw new ApiError(403, "You do not have access to this school", "SCHOOL_FORBIDDEN");
}

export function assertOps(actor: Actor): void {
  if (!isOpsRole(actor.role)) {
    throw new ApiError(403, "This action requires a VitaHero operations account", "OPS_REQUIRED");
  }
}

// ─── A2 · Schools ───────────────────────────────────────────

interface SchoolRow {
  [k: string]: unknown;
}

function mapSchool(r: SchoolRow) {
  return {
    id: r.id as string,
    name: r.name as string,
    city: (r.city as string) || "",
    district: (r.district as string) || "",
    partnerCode: (r.partner_code as string) || "",
    contactName: (r.contact_name as string) || "",
    contactEmail: (r.contact_email as string) || "",
    contactPhone: (r.contact_phone as string) || "",
    description: (r.description as string) || "",
    academicYear: (r.academic_year as string) || "",
    checksOffered: Array.isArray(r.checks_offered)
      ? (r.checks_offered as string[])
      : JSON.parse(String(r.checks_offered || "[]")),
    campCadence: (r.camp_cadence as string) || "ANNUAL",
    hospitalId: (r.hospital_id as string) || "",
    status: (r.status as string) || "ACTIVE",
    active: r.active !== false,
    onboardedAt: r.onboarded_at ? String(r.onboarded_at) : "",
    studentCount: typeof r.student_count === "number" ? r.student_count : 0,
    adminCount: typeof r.admin_count === "number" ? r.admin_count : 0,
    // How the programme is actually going at this school. Counted in the same
    // statement as the row itself — six correlated subqueries are still one
    // round trip, and the alternative is a query per school in a loop.
    campCount: num(r.camp_count),
    campsRun: num(r.camps_run),
    participants: num(r.participant_count),
    consented: num(r.consented_count),
    screened: num(r.screened_count),
    openReferrals: num(r.open_referrals),
    // Ratios are derived here so that no screen has to remember which
    // denominator is the right one — and a denominator of zero reads as "not
    // started" rather than as nought per cent, which looks like a failure.
    consentRate: pct(num(r.consented_count), num(r.participant_count)),
    coverage: pct(num(r.screened_count), num(r.participant_count)),
  };
}

function num(v: unknown): number {
  return typeof v === "number" ? v : Number(v) || 0;
}

/** A percentage, or null when there is nothing to take a percentage of. */
function pct(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

/** List schools the actor can see, with roster and admin counts. */
export async function listSchools(sql: Sql, actor: Actor) {
  const scoped = !isOpsRole(actor.role);
  if (scoped && !actor.schoolId) return { schools: [] };

  const rows = scoped
    ? await sql`
        SELECT s.*,
          (SELECT COUNT(*)::int FROM vita_hero.kids k WHERE k.school_id = s.id) AS student_count,
          (SELECT COUNT(*)::int FROM vita_hero.profiles p
             WHERE p.school_id = s.id AND p.role = 'SCHOOL_ADMIN') AS admin_count,
          (SELECT COUNT(*)::int FROM vita_hero.school_camps sc
             WHERE sc.school_id = s.id) AS camp_count,
          (SELECT COUNT(*)::int FROM vita_hero.school_camps sc
             WHERE sc.school_id = s.id
               AND UPPER(COALESCE(sc.status, '')) NOT IN ('DRAFT','SCHEDULED','CANCELLED')) AS camps_run,
          (SELECT COUNT(*)::int FROM vita_hero.camp_participants cp
             WHERE cp.school_id = s.id) AS participant_count,
          (SELECT COUNT(*)::int FROM vita_hero.camp_participants cp
             WHERE cp.school_id = s.id
               AND UPPER(COALESCE(cp.consent_status, '')) IN ('GRANTED','PAPER')) AS consented_count,
          (SELECT COUNT(DISTINCT cp.kid_id)::int FROM vita_hero.camp_participants cp
             WHERE cp.school_id = s.id
               AND UPPER(COALESCE(cp.status, '')) IN ('SCREENED','RELEASED')) AS screened_count,
          (SELECT COUNT(*)::int FROM vita_hero.referrals r
             WHERE r.school_id = s.id
               AND UPPER(COALESCE(r.status, '')) IN ('OPEN','BOOKED')) AS open_referrals
        FROM vita_hero.schools s
        WHERE s.id = ${actor.schoolId}
        ORDER BY s.name
      `
    : await sql`
        SELECT s.*,
          (SELECT COUNT(*)::int FROM vita_hero.kids k WHERE k.school_id = s.id) AS student_count,
          (SELECT COUNT(*)::int FROM vita_hero.profiles p
             WHERE p.school_id = s.id AND p.role = 'SCHOOL_ADMIN') AS admin_count,
          (SELECT COUNT(*)::int FROM vita_hero.school_camps sc
             WHERE sc.school_id = s.id) AS camp_count,
          (SELECT COUNT(*)::int FROM vita_hero.school_camps sc
             WHERE sc.school_id = s.id
               AND UPPER(COALESCE(sc.status, '')) NOT IN ('DRAFT','SCHEDULED','CANCELLED')) AS camps_run,
          (SELECT COUNT(*)::int FROM vita_hero.camp_participants cp
             WHERE cp.school_id = s.id) AS participant_count,
          (SELECT COUNT(*)::int FROM vita_hero.camp_participants cp
             WHERE cp.school_id = s.id
               AND UPPER(COALESCE(cp.consent_status, '')) IN ('GRANTED','PAPER')) AS consented_count,
          (SELECT COUNT(DISTINCT cp.kid_id)::int FROM vita_hero.camp_participants cp
             WHERE cp.school_id = s.id
               AND UPPER(COALESCE(cp.status, '')) IN ('SCREENED','RELEASED')) AS screened_count,
          (SELECT COUNT(*)::int FROM vita_hero.referrals r
             WHERE r.school_id = s.id
               AND UPPER(COALESCE(r.status, '')) IN ('OPEN','BOOKED')) AS open_referrals
        FROM vita_hero.schools s
        ORDER BY s.name
      `;
  return { schools: rows.map(mapSchool) };
}

export async function getSchool(sql: Sql, actor: Actor, schoolId: string) {
  assertSchoolAccess(actor, schoolId);
  const rows = await sql`
    SELECT s.*,
      (SELECT COUNT(*)::int FROM vita_hero.kids k WHERE k.school_id = s.id) AS student_count,
      (SELECT COUNT(*)::int FROM vita_hero.profiles p
         WHERE p.school_id = s.id AND p.role = 'SCHOOL_ADMIN') AS admin_count
    FROM vita_hero.schools s WHERE s.id = ${schoolId} LIMIT 1
  `;
  if (rows.length === 0) throw new ApiError(404, "School not found", "NOT_FOUND");
  return { school: mapSchool(rows[0]) };
}

/**
 * A1 + A2 — create the school record and issue its partner code.
 * Ops only: a school admin cannot create another school.
 */
export async function createSchool(
  sql: Sql,
  actor: Actor,
  body: Record<string, unknown>
) {
  assertOps(actor);

  const name = tidyName(String(body.name || ""));
  if (name.length < 3) {
    throw new ApiError(400, "School name is required", "NAME_REQUIRED");
  }

  const city = String(body.city || "Hyderabad").trim();
  const district = String(body.district || "").trim();
  const contactName = String(body.contactName || "").trim();
  const contactEmail = String(body.contactEmail || "").trim();
  const description = String(body.description || "").trim();
  const cadence = String(body.campCadence || "ANNUAL").toUpperCase();
  const academicYear = String(body.academicYear || "").trim() || currentAcademicYear();
  const hospitalId = String(body.hospitalId || "").trim();

  if (!CAMP_CADENCES.includes(cadence as (typeof CAMP_CADENCES)[number])) {
    throw new ApiError(400, `Camp cadence must be one of ${CAMP_CADENCES.join(", ")}`, "BAD_CADENCE");
  }

  let contactPhone = "";
  if (body.contactPhone) {
    const norm = normalizeMobile(String(body.contactPhone));
    if (!norm) throw new ApiError(400, "Contact phone is not a valid mobile number", "BAD_PHONE");
    contactPhone = norm.e164;
  }

  const checks = Array.isArray(body.checksOffered)
    ? (body.checksOffered as unknown[]).map(String).filter((c) => CHECK_TYPES.includes(c as (typeof CHECK_TYPES)[number]))
    : [];

  const schoolId = `sch_${slugify(name)}_${Math.random().toString(36).slice(2, 6)}`;

  // Partner codes are what a parent types; a collision would link them to the
  // wrong school, so retry rather than trusting one draw.
  let partnerCode = "";
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = generatePartnerCode(name);
    const clash = await sql`
      SELECT id FROM vita_hero.schools WHERE partner_code = ${candidate} LIMIT 1
    `;
    if (clash.length === 0) {
      partnerCode = candidate;
      break;
    }
  }
  if (!partnerCode) {
    throw new ApiError(500, "Could not allocate a unique partner code, please retry", "CODE_CLASH");
  }

  await sql`
    INSERT INTO vita_hero.schools
      (id, name, city, district, partner_code, contact_name, contact_email, contact_phone,
       description, academic_year, checks_offered, camp_cadence, hospital_id,
       status, active, created_by)
    VALUES
      (${schoolId}, ${name}, ${city}, ${district}, ${partnerCode}, ${contactName}, ${contactEmail},
       ${contactPhone}, ${description}, ${academicYear}, ${JSON.stringify(checks)}::jsonb,
       ${cadence}, ${hospitalId || null}, 'ACTIVE', true, ${actor.profileId})
  `;

  return getSchool(sql, actor, schoolId);
}

/** A1 — update programme configuration. Partner code and id are immutable. */
export async function updateSchool(
  sql: Sql,
  actor: Actor,
  schoolId: string,
  body: Record<string, unknown>
) {
  assertSchoolAccess(actor, schoolId);

  const existing = await sql`SELECT * FROM vita_hero.schools WHERE id = ${schoolId} LIMIT 1`;
  if (existing.length === 0) throw new ApiError(404, "School not found", "NOT_FOUND");
  const cur = existing[0];

  // A school admin may correct contact details but not the commercial terms.
  const opsOnlyKeys = ["campCadence", "hospitalId", "status", "active", "name"];
  if (!isOpsRole(actor.role)) {
    for (const k of opsOnlyKeys) {
      if (k in body) {
        throw new ApiError(403, `Only VitaHero operations can change "${k}"`, "OPS_REQUIRED");
      }
    }
  }

  const name = "name" in body ? tidyName(String(body.name || "")) : (cur.name as string);
  if (!name || name.length < 3) throw new ApiError(400, "School name is required", "NAME_REQUIRED");

  const cadence =
    "campCadence" in body ? String(body.campCadence).toUpperCase() : (cur.camp_cadence as string) || "ANNUAL";
  if (!CAMP_CADENCES.includes(cadence as (typeof CAMP_CADENCES)[number])) {
    throw new ApiError(400, `Camp cadence must be one of ${CAMP_CADENCES.join(", ")}`, "BAD_CADENCE");
  }

  let contactPhone = (cur.contact_phone as string) || "";
  if ("contactPhone" in body) {
    const raw = String(body.contactPhone || "").trim();
    if (!raw) contactPhone = "";
    else {
      const norm = normalizeMobile(raw);
      if (!norm) throw new ApiError(400, "Contact phone is not a valid mobile number", "BAD_PHONE");
      contactPhone = norm.e164;
    }
  }

  const checks = Array.isArray(body.checksOffered)
    ? (body.checksOffered as unknown[]).map(String).filter((c) => CHECK_TYPES.includes(c as (typeof CHECK_TYPES)[number]))
    : Array.isArray(cur.checks_offered)
      ? (cur.checks_offered as string[])
      : JSON.parse(String(cur.checks_offered || "[]"));

  const status = "status" in body ? String(body.status).toUpperCase() : (cur.status as string) || "ACTIVE";
  const active = "active" in body ? body.active !== false : cur.active !== false;

  await sql`
    UPDATE vita_hero.schools SET
      name = ${name},
      city = ${"city" in body ? String(body.city || "").trim() : (cur.city as string) || ""},
      district = ${"district" in body ? String(body.district || "").trim() : (cur.district as string) || ""},
      contact_name = ${"contactName" in body ? String(body.contactName || "").trim() : (cur.contact_name as string) || ""},
      contact_email = ${"contactEmail" in body ? String(body.contactEmail || "").trim() : (cur.contact_email as string) || ""},
      contact_phone = ${contactPhone},
      description = ${"description" in body ? String(body.description || "").trim() : (cur.description as string) || ""},
      academic_year = ${"academicYear" in body ? String(body.academicYear || "").trim() : (cur.academic_year as string) || ""},
      checks_offered = ${JSON.stringify(checks)}::jsonb,
      camp_cadence = ${cadence},
      hospital_id = ${"hospitalId" in body ? String(body.hospitalId || "").trim() || null : (cur.hospital_id as string) || null},
      status = ${status},
      active = ${active}
    WHERE id = ${schoolId}
  `;

  return getSchool(sql, actor, schoolId);
}

// ─── A4 · Classes and sections ──────────────────────────────

/** Natural sort for grades so "Class 2" precedes "Class 10". */
function gradeSortKey(grade: string): [number, string] {
  const m = grade.match(/\d+/);
  return [m ? parseInt(m[0], 10) : 999, grade.toLowerCase()];
}

export async function listClasses(
  sql: Sql,
  actor: Actor,
  schoolId: string,
  academicYear: string
) {
  assertSchoolAccess(actor, schoolId);
  const year = academicYear || (await resolveSchoolYear(sql, schoolId));
  const rows = await sql`
    SELECT id, grade, section, academic_year,
      (SELECT COUNT(*)::int FROM vita_hero.kids k
        WHERE k.school_id = ${schoolId}
          AND k.academic_year = vita_hero.school_classes.academic_year
          AND k.grade = vita_hero.school_classes.grade
          AND COALESCE(k.section, '') = vita_hero.school_classes.section) AS student_count
    FROM vita_hero.school_classes
    WHERE school_id = ${schoolId} AND academic_year = ${year}
  `;
  const classes = rows
    .map((r) => ({
      id: r.id as string,
      grade: r.grade as string,
      section: (r.section as string) || "",
      academicYear: r.academic_year as string,
      studentCount: (r.student_count as number) || 0,
    }))
    .sort((a, b) => {
      const [an, as_] = gradeSortKey(a.grade);
      const [bn, bs] = gradeSortKey(b.grade);
      if (an !== bn) return an - bn;
      if (as_ !== bs) return as_ < bs ? -1 : 1;
      return a.section < b.section ? -1 : a.section > b.section ? 1 : 0;
    });
  // A school that imported a roster but never filled in the class grid still
  // has classes — every child carries a grade and a section. Deriving them
  // here is what stops the camp form from offering nothing to choose while the
  // server rejects the camp for choosing nothing.
  if (classes.length === 0) {
    const fromRoster = await sql`
      SELECT grade, COALESCE(section, '') AS section, COUNT(*)::int AS student_count
      FROM vita_hero.kids
      WHERE school_id = ${schoolId} AND grade <> ''
        AND (academic_year = ${year} OR academic_year IS NULL OR academic_year = '')
        AND status <> 'GRADUATED'
      GROUP BY grade, COALESCE(section, '')
    `;
    const derived = fromRoster
      .map((r) => ({
        id: "",
        grade: r.grade as string,
        section: (r.section as string) || "",
        academicYear: year,
        studentCount: (r.student_count as number) || 0,
      }))
      .sort((a, b) => {
        const [an, as_] = gradeSortKey(a.grade);
        const [bn, bs] = gradeSortKey(b.grade);
        if (an !== bn) return an - bn;
        if (as_ !== bs) return as_ < bs ? -1 : 1;
        return a.section < b.section ? -1 : a.section > b.section ? 1 : 0;
      });
    // `derived` says these came from the roster rather than the class grid, so
    // the console can offer to save them rather than pretending they are set.
    return { academicYear: year, classes: derived, derived: derived.length > 0 };
  }

  return { academicYear: year, classes, derived: false };
}

/**
 * A4 — replace the class list for an academic year.
 *
 * Accepts either an explicit list of {grade, section} pairs, or a grid of
 * grades × sections which is what a school office actually thinks in.
 * Existing classes that still appear are kept, so student counts survive.
 */
export async function setClasses(
  sql: Sql,
  actor: Actor,
  schoolId: string,
  body: Record<string, unknown>
) {
  assertSchoolAccess(actor, schoolId);

  const year = String(body.academicYear || "").trim() || (await resolveSchoolYear(sql, schoolId));
  if (!/^\d{4}-\d{2}$/.test(year)) {
    throw new ApiError(400, "Academic year must look like 2026-27", "BAD_YEAR");
  }

  let pairs: Array<{ grade: string; section: string }> = [];

  if (Array.isArray(body.classes)) {
    pairs = (body.classes as Array<Record<string, unknown>>)
      .map((c) => ({
        grade: String(c.grade || "").trim(),
        section: String(c.section || "").trim().toUpperCase(),
      }))
      .filter((c) => c.grade);
  } else if (Array.isArray(body.grades)) {
    const grades = (body.grades as unknown[]).map((g) => String(g).trim()).filter(Boolean);
    const sections = Array.isArray(body.sections)
      ? (body.sections as unknown[]).map((s) => String(s).trim().toUpperCase()).filter(Boolean)
      : [];
    for (const g of grades) {
      if (sections.length === 0) pairs.push({ grade: g, section: "" });
      else for (const s of sections) pairs.push({ grade: g, section: s });
    }
  } else {
    throw new ApiError(400, "Provide either classes[] or grades[] with sections[]", "BAD_BODY");
  }

  // Deduplicate — a grid plus a manual list can overlap.
  const seen = new Set<string>();
  pairs = pairs.filter((p) => {
    const k = `${p.grade}|${p.section}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  if (pairs.length > 400) {
    throw new ApiError(400, "That is more than 400 classes — check the sections list", "TOO_MANY");
  }

  const keep = pairs.map((p) => `${schoolId}|${year}|${p.grade}|${p.section}`);

  // Remove classes no longer listed, but never one that still holds students —
  // deleting it would orphan those children from the roster view.
  const existing = await sql`
    SELECT id, grade, section FROM vita_hero.school_classes
    WHERE school_id = ${schoolId} AND academic_year = ${year}
  `;
  const removed: string[] = [];
  const blocked: string[] = [];
  const dropping = existing.filter((row) => {
    const key = `${schoolId}|${year}|${row.grade as string}|${(row.section as string) || ""}`;
    return !keep.includes(key);
  });

  // Which of the classes being dropped still have a child in them — asked once
  // for all of them rather than once each. A secondary school with twelve
  // grades and four sections was two statements a class, on an ordinary
  // administrative save.
  const inUse = dropping.length
    ? await sql`
        SELECT DISTINCT grade, COALESCE(section, '') AS section
        FROM vita_hero.kids
        WHERE school_id = ${schoolId} AND academic_year = ${year}
          AND grade = ANY(${dropping.map((r) => r.grade as string)})
      `
    : [];
  const occupied = new Set(inUse.map((r) => `${r.grade as string}|${r.section as string}`));

  const toDelete: string[] = [];
  for (const row of dropping) {
    const label = `${row.grade as string} ${(row.section as string) || ""}`.trim();
    if (occupied.has(`${row.grade as string}|${(row.section as string) || ""}`)) {
      blocked.push(label);
      continue;
    }
    toDelete.push(row.id as string);
    removed.push(label);
  }
  if (toDelete.length > 0) {
    await sql`DELETE FROM vita_hero.school_classes WHERE id = ANY(${toDelete})`;
  }

  if (pairs.length > 0) {
    await insertRows(
      sql,
      `INSERT INTO vita_hero.school_classes (id, school_id, academic_year, grade, section)
       SELECT v.id, v.school_id, v.academic_year, v.grade, v.section
       FROM (VALUES %VALUES%) AS v(id, school_id, academic_year, grade, section)
       ON CONFLICT (school_id, academic_year, grade, section) DO NOTHING`,
      pairs.map((p) => [
        `cls_${slugify(schoolId)}_${slugify(year)}_${slugify(p.grade)}_${slugify(p.section) || "na"}`,
        schoolId, year, p.grade, p.section,
      ])
    );
  }

  // Keep the school's headline year in step with the classes just defined.
  await sql`UPDATE vita_hero.schools SET academic_year = ${year} WHERE id = ${schoolId}`;

  const listed = await listClasses(sql, actor, schoolId, year);
  return { ...listed, removed, keptBecauseInUse: blocked };
}

async function resolveSchoolYear(sql: Sql, schoolId: string): Promise<string> {
  const rows = await sql`SELECT academic_year FROM vita_hero.schools WHERE id = ${schoolId} LIMIT 1`;
  const stored = rows.length ? ((rows[0].academic_year as string) || "") : "";
  return stored || currentAcademicYear();
}

// ─── A3 · School administrators ─────────────────────────────

/**
 * A3 — provision a school admin.
 *
 * They sign in exactly as parents do, with a phone OTP, so there is no second
 * credential system to run. What differs is the role and the school scope.
 * A phone already registered as a parent is refused rather than silently
 * upgraded: one number should not be both a guardian and an administrator.
 */
export async function addSchoolAdmin(
  sql: Sql,
  actor: Actor,
  schoolId: string,
  body: Record<string, unknown>
) {
  assertSchoolAccess(actor, schoolId);

  const school = await sql`SELECT id, name FROM vita_hero.schools WHERE id = ${schoolId} LIMIT 1`;
  if (school.length === 0) throw new ApiError(404, "School not found", "NOT_FOUND");

  const name = tidyName(String(body.name || ""));
  if (name.length < 2) throw new ApiError(400, "Administrator name is required", "NAME_REQUIRED");

  // An administrator signs in with a one-time code, so this has to be a
  // number that can receive one.
  const norm = normalizeMobile(String(body.phone || ""));
  if (!norm) throw new ApiError(400, "Enter a valid mobile number — a landline cannot receive the sign-in code", "BAD_PHONE");

  const profileId = profileIdForPhone(norm.last10);
  const email = String(body.email || "").trim();

  const existing = await sql`
    SELECT id, role, school_id, name FROM vita_hero.profiles WHERE id = ${profileId} LIMIT 1
  `;

  if (existing.length > 0) {
    const role = (existing[0].role as string) || "PARENT";
    const heldSchool = (existing[0].school_id as string) || "";
    if (role === "PARENT") {
      throw new ApiError(
        409,
        "That number is already registered as a parent. Use a different number for the administrator.",
        "PHONE_IS_PARENT"
      );
    }
    if (isOpsRole(role)) {
      throw new ApiError(
        409,
        "That number belongs to a VitaHero operations account and already has access.",
        "PHONE_IS_OPS"
      );
    }
    if (role === ROLE_SCHOOL_ADMIN && heldSchool && heldSchool !== schoolId) {
      throw new ApiError(
        409,
        "That number already administers another school.",
        "PHONE_OTHER_SCHOOL"
      );
    }
  }

  await sql`
    INSERT INTO vita_hero.profiles
      (id, user_id, phone, name, email, auth_provider, role, provisioned, school_id,
       is_logged_in, onboarding_complete, created_by)
    VALUES
      (${profileId}, ${profileId}, ${norm.e164}, ${name}, ${email || null}, 'PHONE',
       ${ROLE_SCHOOL_ADMIN}, true, ${schoolId}, false, true, ${actor.profileId})
    ON CONFLICT (id) DO UPDATE SET
      name = ${name},
      phone = ${norm.e164},
      email = COALESCE(NULLIF(${email || null}, ''), vita_hero.profiles.email),
      role = ${ROLE_SCHOOL_ADMIN},
      school_id = ${schoolId},
      provisioned = true
  `;

  return {
    admin: { profileId, name, phone: norm.e164, email, schoolId },
    signInHint: "They sign in at the portal with this mobile number and an OTP.",
  };
}

export async function listSchoolAdmins(sql: Sql, actor: Actor, schoolId: string) {
  assertSchoolAccess(actor, schoolId);
  const rows = await sql`
    SELECT id, name, phone, email, is_logged_in, created_by
    FROM vita_hero.profiles
    WHERE school_id = ${schoolId} AND role = ${ROLE_SCHOOL_ADMIN}
    ORDER BY name
  `;
  return {
    admins: rows.map((r) => ({
      profileId: r.id as string,
      name: (r.name as string) || "",
      phone: (r.phone as string) || "",
      email: (r.email as string) || "",
      hasSignedIn: r.is_logged_in === true,
      addedBy: (r.created_by as string) || "",
    })),
  };
}

/**
 * Revoke a school administrator. The profile is retained but demoted and
 * de-scoped, so their sign-in stops working while the audit trail on any
 * roster batch they ran still resolves to a real person.
 */
export async function removeSchoolAdmin(
  sql: Sql,
  actor: Actor,
  schoolId: string,
  profileId: string
) {
  assertSchoolAccess(actor, schoolId);

  if (profileId === actor.profileId) {
    throw new ApiError(400, "You cannot remove your own administrator access", "SELF_REMOVE");
  }

  const rows = await sql`
    SELECT id, role, school_id FROM vita_hero.profiles WHERE id = ${profileId} LIMIT 1
  `;
  if (rows.length === 0) throw new ApiError(404, "Administrator not found", "NOT_FOUND");
  if ((rows[0].role as string) !== ROLE_SCHOOL_ADMIN || (rows[0].school_id as string) !== schoolId) {
    throw new ApiError(404, "That person does not administer this school", "NOT_FOUND");
  }

  await sql`
    UPDATE vita_hero.profiles
    SET role = 'REVOKED', school_id = NULL, session_token = NULL,
        is_logged_in = false, provisioned = false
    WHERE id = ${profileId}
  `;
  return { removed: profileId };
}

/** Bootstrap helper: promote a phone to ops. Only reachable with the admin API key. */
export async function grantOpsRole(sql: Sql, phone: string, name: string) {
  const norm = normalizePhone(phone);
  if (!norm) throw new ApiError(400, "Enter a valid mobile number", "BAD_PHONE");
  const profileId = profileIdForPhone(norm.last10);
  await sql`
    INSERT INTO vita_hero.profiles
      (id, user_id, phone, name, auth_provider, role, provisioned, is_logged_in, onboarding_complete)
    VALUES
      (${profileId}, ${profileId}, ${norm.e164}, ${tidyName(name) || "VitaHero Ops"}, 'PHONE',
       ${ROLE_ADMIN}, true, false, true)
    ON CONFLICT (id) DO UPDATE SET
      role = CASE WHEN vita_hero.profiles.role = ${ROLE_SUPERADMIN}
                  THEN ${ROLE_SUPERADMIN} ELSE ${ROLE_ADMIN} END,
      provisioned = true,
      phone = ${norm.e164}
  `;
  return { profileId, phone: norm.e164, role: ROLE_ADMIN };
}

// ─── A9 · Closing a school down ─────────────────────────────
//
// The console could create a school and never get rid of one. In practice the
// list fills with duplicates and pilot rows typed in during a demo, and the
// only way to clear one was a hand-written SQL statement against production.
//
// Two different acts were hiding behind the single word "delete", so there are
// two operations here:
//
//   archive   The school stops running. Parents no longer see it, no camp can
//             be scheduled, staff lose their sign-in. Everything recorded
//             about a child stays exactly where it is, and the school can be
//             reopened. This is what closing a partnership actually means and
//             it is the one to reach for.
//
//   delete    The row and its configuration are gone for good. Allowed only
//             while the school has no clinical footprint — no camp has run, no
//             finding, referral or photograph exists. That restriction is the
//             point: a screening programme's records are not ops' to erase by
//             clicking through a dialog, and a guardian's erasure right is a
//             separate, per-child pathway that already exists in lifecycle.ts.
//
// A school that has screened children and is finished is archived, not
// deleted. The console says so rather than leaving you to guess.

/** Tables that hold a school's own configuration, cleared by a hard delete. */
const SCHOOL_OWNED_TABLES = [
  "school_classes",
  "roster_batches",
  "school_enrollments",
  "school_camps",
  "correction_requests",
  "question_messages",
  "question_threads",
  "school_contracts",
] as const;

export interface SchoolFootprint {
  students: number;
  camps: number;
  campsRun: number;
  findings: number;
  referrals: number;
  photos: number;
  staff: number;
  /** True when deleting would destroy a record of something done to a child. */
  clinical: boolean;
}

/**
 * What is attached to this school, counted before anything is removed.
 *
 * Every count is taken defensively: a table that a given deployment has not
 * migrated yet must not turn "can I delete this?" into a 500. An uncounted
 * table reads as zero, which is why `campsRun` — the one that actually gates
 * the delete — is derived from camps and findings together rather than from a
 * single optional table.
 */
export async function schoolFootprint(sql: Sql, schoolId: string): Promise<SchoolFootprint> {
  const count = async (run: () => Promise<Record<string, unknown>[]>): Promise<number> => {
    try {
      const rows = await run();
      return Number(rows[0]?.c) || 0;
    } catch {
      return 0;
    }
  };

  const students = await count(() => sql`
    SELECT COUNT(*)::int AS c FROM vita_hero.kids WHERE school_id = ${schoolId}`);
  // school_camps, not camps.
  //
  // vita_hero.camps is the parent app's own table — a family's saved camps,
  // keyed by profile_id, with the school as free text. The school programme's
  // camps have always lived in school_camps. Querying camps.school_id asks for
  // a column that has never existed, and count() turns any failure into zero,
  // so every school reported nought camps and nought findings no matter what
  // it had run. `clinical` then rested on referrals and photos alone: a school
  // that had screened four hundred children but raised no referral and took no
  // photograph read as having no clinical record at all.
  const camps = await count(() => sql`
    SELECT COUNT(*)::int AS c FROM vita_hero.school_camps WHERE school_id = ${schoolId}`);
  const campsRun = await count(() => sql`
    SELECT COUNT(*)::int AS c FROM vita_hero.school_camps
    WHERE school_id = ${schoolId} AND UPPER(COALESCE(status, '')) NOT IN ('DRAFT', 'SCHEDULED', 'CANCELLED')`);
  const findings = await count(() => sql`
    SELECT COUNT(*)::int AS c FROM vita_hero.camp_findings f
    JOIN vita_hero.school_camps c ON c.id = f.camp_id WHERE c.school_id = ${schoolId}`);
  const referrals = await count(() => sql`
    SELECT COUNT(*)::int AS c FROM vita_hero.referrals WHERE school_id = ${schoolId}`);
  const photos = await count(() => sql`
    SELECT COUNT(*)::int AS c FROM vita_hero.finding_photos WHERE school_id = ${schoolId}`);
  const staff = await count(() => sql`
    SELECT COUNT(*)::int AS c FROM vita_hero.profiles
    WHERE school_id = ${schoolId} AND role IN ('SCHOOL_ADMIN', 'SCREENER', 'PHYSICIAN')`);

  return {
    students,
    camps,
    campsRun,
    findings,
    referrals,
    photos,
    staff,
    clinical: campsRun > 0 || findings > 0 || referrals > 0 || photos > 0,
  };
}

/** Ops-facing preview: what a delete would take, and whether it is allowed. */
export async function schoolDeletionPreview(sql: Sql, actor: Actor, schoolId: string) {
  assertOps(actor);
  const rows = await sql`SELECT id, name, active, status FROM vita_hero.schools WHERE id = ${schoolId} LIMIT 1`;
  if (rows.length === 0) throw new ApiError(404, "School not found", "NOT_FOUND");
  const footprint = await schoolFootprint(sql, schoolId);
  return {
    school: {
      id: rows[0].id as string,
      name: (rows[0].name as string) || "",
      active: rows[0].active !== false,
      status: (rows[0].status as string) || "ACTIVE",
    },
    footprint,
    canDelete: !footprint.clinical,
    // The console shows this verbatim, so it says what is true of this school
    // rather than reciting the rule in the abstract.
    reason: footprint.clinical
      ? "This school has screening records. Archive it instead — the records stay, and nobody can sign in or schedule a camp."
      : "",
  };
}

/**
 * Stop a school running, or start it again.
 *
 * Archiving revokes staff sessions on the way out. Leaving a physician signed
 * in to a school that has closed is the kind of quiet leftover access that a
 * children's health programme cannot defend, and it costs one statement here.
 */
export async function setSchoolArchived(
  sql: Sql,
  actor: Actor,
  schoolId: string,
  archived: boolean
) {
  assertOps(actor);

  const rows = await sql`SELECT id, name FROM vita_hero.schools WHERE id = ${schoolId} LIMIT 1`;
  if (rows.length === 0) throw new ApiError(404, "School not found", "NOT_FOUND");

  await sql`
    UPDATE vita_hero.schools
    SET active = ${!archived}, status = ${archived ? "ARCHIVED" : "ACTIVE"}
    WHERE id = ${schoolId}
  `;

  if (archived) {
    await sql`
      UPDATE vita_hero.profiles
      SET session_token = NULL, is_logged_in = false
      WHERE school_id = ${schoolId} AND role IN ('SCHOOL_ADMIN', 'SCREENER', 'PHYSICIAN')
    `;
    try {
      await sql`
        UPDATE vita_hero.sessions SET revoked_at = NOW()
        WHERE revoked_at IS NULL AND profile_id IN (
          SELECT id FROM vita_hero.profiles
          WHERE school_id = ${schoolId} AND role IN ('SCHOOL_ADMIN', 'SCREENER', 'PHYSICIAN'))
      `;
    } catch {
      // Pre-migration database: profiles.session_token above is the whole story.
    }
  }

  return getSchool(sql, actor, schoolId);
}

/**
 * Delete a school for good.
 *
 * `confirmName` must match the school's name. It is not ceremony: the console
 * lists schools by name and the ids are opaque, so typing the name is the only
 * check that proves the row being deleted is the row that was read.
 */
export async function deleteSchool(
  sql: Sql,
  actor: Actor,
  schoolId: string,
  confirmName: string
) {
  assertOps(actor);

  const rows = await sql`SELECT id, name FROM vita_hero.schools WHERE id = ${schoolId} LIMIT 1`;
  if (rows.length === 0) throw new ApiError(404, "School not found", "NOT_FOUND");
  const name = (rows[0].name as string) || "";

  if (tidyName(confirmName).toLowerCase() !== tidyName(name).toLowerCase()) {
    throw new ApiError(400, `Type the school's name exactly — "${name}" — to confirm`, "CONFIRM_NAME");
  }

  const footprint = await schoolFootprint(sql, schoolId);
  if (footprint.clinical) {
    throw new ApiError(
      409,
      "This school has screening records and cannot be deleted. Archive it instead — that stops it running and keeps the records.",
      "HAS_RECORDS"
    );
  }

  // Camps first: only drafts and cancelled camps can exist at this point, but
  // their staff assignments and consent rows still reference them.
  const camps = await sql`SELECT id FROM vita_hero.school_camps WHERE school_id = ${schoolId}`;
  for (const camp of camps) {
    const campId = camp.id as string;
    for (const table of ["camp_staff", "camp_participants", "consent_log", "camp_registrations"]) {
      try {
        await sql.query(`DELETE FROM vita_hero.${table} WHERE camp_id = $1`, [campId]);
      } catch {
        // Not every deployment has every optional table.
      }
    }
  }
  await sql`DELETE FROM vita_hero.school_camps WHERE school_id = ${schoolId}`;

  for (const table of SCHOOL_OWNED_TABLES) {
    try {
      await sql.query(`DELETE FROM vita_hero.${table} WHERE school_id = $1`, [schoolId]);
    } catch {
      // As above — a missing table means there was nothing of ours in it.
    }
  }

  // Children keep their profile and their parents; they simply stop belonging
  // to a school that no longer exists. Deleting a child's record is a separate
  // right with its own pathway, and this is not it.
  await sql`UPDATE vita_hero.kids SET school_id = NULL WHERE school_id = ${schoolId}`;

  // Staff of a school that is gone are de-scoped the same way a removed
  // administrator is: the profile survives so audit trails still resolve.
  await sql`
    UPDATE vita_hero.profiles
    SET role = 'REVOKED', school_id = NULL, session_token = NULL,
        is_logged_in = false, provisioned = false
    WHERE school_id = ${schoolId} AND role IN ('SCHOOL_ADMIN', 'SCREENER', 'PHYSICIAN')
  `;

  await sql`DELETE FROM vita_hero.schools WHERE id = ${schoolId}`;

  return { deleted: schoolId, name, footprint };
}

/**
 * Revoke a screener's or physician's access to a school.
 *
 * The People tab could add clinical staff and only ever remove an
 * administrator, so a doctor who left the school kept a working sign-in
 * indefinitely. Same treatment as `removeSchoolAdmin`: demote and de-scope,
 * never delete, so "who screened this child" still answers.
 */
export async function removeStaffMember(
  sql: Sql,
  actor: Actor,
  schoolId: string,
  profileId: string
) {
  assertSchoolAccess(actor, schoolId);

  if (profileId === actor.profileId) {
    throw new ApiError(400, "You cannot remove your own access", "SELF_REMOVE");
  }

  const rows = await sql`
    SELECT id, name, role, school_id FROM vita_hero.profiles WHERE id = ${profileId} LIMIT 1
  `;
  if (rows.length === 0) throw new ApiError(404, "That person was not found", "NOT_FOUND");

  const role = (rows[0].role as string) || "";
  if ((rows[0].school_id as string) !== schoolId || !["SCREENER", "PHYSICIAN"].includes(role)) {
    throw new ApiError(404, "That person is not clinical staff at this school", "NOT_FOUND");
  }

  await sql`
    UPDATE vita_hero.profiles
    SET role = 'REVOKED', school_id = NULL, session_token = NULL,
        is_logged_in = false, provisioned = false
    WHERE id = ${profileId}
  `;

  // Their camp assignments are revoked rather than dropped, which is the rule
  // camp_staff already follows for a doctor removed from a single camp.
  try {
    await sql`
      UPDATE vita_hero.camp_staff
      SET active = false, revoked_at = NOW(), revoked_by = ${actor.profileId}
      WHERE profile_id = ${profileId} AND active IS NOT false
    `;
  } catch {
    // Older schema without the revocation columns: the profile change is enough.
  }

  try {
    await sql`
      UPDATE vita_hero.sessions SET revoked_at = NOW()
      WHERE profile_id = ${profileId} AND revoked_at IS NULL
    `;
  } catch {
    // Pre-migration database.
  }

  return { removed: profileId, name: (rows[0].name as string) || "", role };
}
