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

import {
  Sql,
  ROLE_ADMIN,
  ROLE_SCHOOL_ADMIN,
  ROLE_SUPERADMIN,
  isOpsRole,
  normalizePhone,
  profileIdForPhone,
  slugify,
  tidyName,
  generatePartnerCode,
  currentAcademicYear,
} from "./common";

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
  };
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
             WHERE p.school_id = s.id AND p.role = 'SCHOOL_ADMIN') AS admin_count
        FROM vita_hero.schools s
        WHERE s.id = ${actor.schoolId}
        ORDER BY s.name
      `
    : await sql`
        SELECT s.*,
          (SELECT COUNT(*)::int FROM vita_hero.kids k WHERE k.school_id = s.id) AS student_count,
          (SELECT COUNT(*)::int FROM vita_hero.profiles p
             WHERE p.school_id = s.id AND p.role = 'SCHOOL_ADMIN') AS admin_count
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
    const norm = normalizePhone(String(body.contactPhone));
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
      const norm = normalizePhone(raw);
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
  return { academicYear: year, classes };
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
  for (const row of existing) {
    const key = `${schoolId}|${year}|${row.grade as string}|${(row.section as string) || ""}`;
    if (keep.includes(key)) continue;
    const inUse = await sql`
      SELECT 1 FROM vita_hero.kids
      WHERE school_id = ${schoolId} AND academic_year = ${year}
        AND grade = ${row.grade as string} AND COALESCE(section, '') = ${(row.section as string) || ""}
      LIMIT 1
    `;
    if (inUse.length > 0) {
      blocked.push(`${row.grade as string} ${(row.section as string) || ""}`.trim());
      continue;
    }
    await sql`DELETE FROM vita_hero.school_classes WHERE id = ${row.id as string}`;
    removed.push(`${row.grade as string} ${(row.section as string) || ""}`.trim());
  }

  for (const p of pairs) {
    const id = `cls_${slugify(schoolId)}_${slugify(year)}_${slugify(p.grade)}_${slugify(p.section) || "na"}`;
    await sql`
      INSERT INTO vita_hero.school_classes (id, school_id, academic_year, grade, section)
      VALUES (${id}, ${schoolId}, ${year}, ${p.grade}, ${p.section})
      ON CONFLICT (school_id, academic_year, grade, section) DO NOTHING
    `;
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

  const norm = normalizePhone(String(body.phone || ""));
  if (!norm) throw new ApiError(400, "Enter a valid mobile number", "BAD_PHONE");

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
