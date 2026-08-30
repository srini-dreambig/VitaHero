// Stages B, C and D — camp scheduling, consent, screening capture, clinical
// review, and release to guardians.
//
// This is the spine the parent app hangs off. A camp is scheduled against a
// school's classes; the roster of children is materialised from the student
// roster; guardians consent per camp; a screener records findings for the
// children who turned up; a physician confirms every flag; release projects
// the result into the tables the Android app already reads.
//
// Nothing reaches a guardian without passing through releaseCamp().

import {
  Sql,
  chunk,
  currentAcademicYear,
  isOpsRole,
  normalizePhone,
  slugify,
  tidyName,
} from "./common";
import { Actor, ApiError, assertSchoolAccess } from "./schools";
import {
  CHECK_TYPES,
  Flag,
  Urgency,
  draftRecommendation,
  isCheckType,
  proposeFlag,
  summariseForApp,
  worstUrgency,
} from "./clinical";

export const CAMP_STATUSES = ["DRAFT", "SCHEDULED", "IN_PROGRESS", "SCREENED", "RELEASED", "CANCELLED"] as const;
export const CONSENT_STATUSES = ["PENDING", "GRANTED", "DECLINED", "PAPER"] as const;
export const ATTENDANCE = ["UNKNOWN", "PRESENT", "ABSENT", "REFUSED"] as const;
export const PARTICIPANT_STATUSES = ["NOT_SCREENED", "SCREENED", "APPROVED", "RELEASED"] as const;
export const STAFF_ROLES = ["SCREENER", "PHYSICIAN"] as const;

// ─── Schema ─────────────────────────────────────────────────

export async function ensureCampSchema(sql: Sql): Promise<void> {
  await sql`ALTER TABLE vita_hero.school_camps ADD COLUMN IF NOT EXISTS venue TEXT DEFAULT ''`;
  await sql`ALTER TABLE vita_hero.school_camps ADD COLUMN IF NOT EXISTS academic_year TEXT DEFAULT ''`;
  await sql`ALTER TABLE vita_hero.school_camps ADD COLUMN IF NOT EXISTS sections JSONB DEFAULT '[]'::jsonb`;
  await sql`ALTER TABLE vita_hero.school_camps ADD COLUMN IF NOT EXISTS consent_deadline TEXT DEFAULT ''`;
  await sql`ALTER TABLE vita_hero.school_camps ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ`;
  await sql`ALTER TABLE vita_hero.school_camps ADD COLUMN IF NOT EXISTS released_by TEXT DEFAULT ''`;
  await sql`ALTER TABLE vita_hero.school_camps ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT ''`;
  await sql`ALTER TABLE vita_hero.school_camps ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW()`;

  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.camp_staff (
      id TEXT PRIMARY KEY,
      camp_id TEXT NOT NULL,
      profile_id TEXT NOT NULL,
      staff_role TEXT NOT NULL,
      assigned_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (camp_id, profile_id)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS camp_staff_profile ON vita_hero.camp_staff(profile_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.camp_participants (
      id TEXT PRIMARY KEY,
      camp_id TEXT NOT NULL,
      school_id TEXT NOT NULL,
      kid_id TEXT NOT NULL,
      profile_id TEXT NOT NULL,
      consent_status TEXT DEFAULT 'PENDING',
      consent_checks JSONB DEFAULT '[]'::jsonb,
      consent_at TIMESTAMPTZ,
      consent_source TEXT DEFAULT '',
      consent_recorded_by TEXT DEFAULT '',
      attendance TEXT DEFAULT 'UNKNOWN',
      status TEXT DEFAULT 'NOT_SCREENED',
      screened_at TIMESTAMPTZ,
      screened_by TEXT DEFAULT '',
      reviewed_at TIMESTAMPTZ,
      reviewed_by TEXT DEFAULT '',
      released_at TIMESTAMPTZ,
      urgency TEXT DEFAULT 'NONE',
      recommendation TEXT DEFAULT '',
      UNIQUE (camp_id, kid_id)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS camp_participants_camp ON vita_hero.camp_participants(camp_id, status)`;
  await sql`CREATE INDEX IF NOT EXISTS camp_participants_kid ON vita_hero.camp_participants(kid_id)`;
  await sql`CREATE INDEX IF NOT EXISTS camp_participants_profile ON vita_hero.camp_participants(profile_id, consent_status)`;

  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.camp_findings (
      id TEXT PRIMARY KEY,
      camp_id TEXT NOT NULL,
      kid_id TEXT NOT NULL,
      check_type TEXT NOT NULL,
      detail JSONB DEFAULT '{}'::jsonb,
      value_num DOUBLE PRECISION,
      value_text TEXT DEFAULT '',
      auto_flag TEXT DEFAULT 'NOT_MEASURED',
      flag TEXT DEFAULT 'NOT_MEASURED',
      rationale TEXT DEFAULT '',
      urgency TEXT DEFAULT 'NONE',
      screener_note TEXT DEFAULT '',
      recorded_by TEXT DEFAULT '',
      recorded_at TIMESTAMPTZ DEFAULT NOW(),
      reviewed_by TEXT DEFAULT '',
      reviewed_at TIMESTAMPTZ,
      review_note TEXT DEFAULT '',
      UNIQUE (camp_id, kid_id, check_type)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS camp_findings_camp_kid ON vita_hero.camp_findings(camp_id, kid_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.consent_log (
      id TEXT PRIMARY KEY,
      camp_id TEXT NOT NULL,
      kid_id TEXT NOT NULL,
      profile_id TEXT NOT NULL,
      action TEXT NOT NULL,
      source TEXT DEFAULT '',
      actor_id TEXT DEFAULT '',
      note TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS consent_log_camp ON vita_hero.consent_log(camp_id, created_at DESC)`;
}

// ─── Access ─────────────────────────────────────────────────

export interface CampAccess {
  camp: Record<string, unknown>;
  canSchedule: boolean;
  canScreen: boolean;
  canReview: boolean;
}

/**
 * Resolve what this actor may do with this camp.
 *
 * Ops and the school's own administrators can do everything. A screener or
 * physician reaches only the camps they have been assigned to, which is why
 * the check queries camp_staff rather than trusting the role alone.
 */
export async function assertCampAccess(
  sql: Sql,
  actor: Actor,
  campId: string
): Promise<CampAccess> {
  const rows = await sql`
    SELECT sc.*, s.name AS school_name, s.city AS school_city, s.checks_offered AS school_checks
    FROM vita_hero.school_camps sc
    JOIN vita_hero.schools s ON s.id = sc.school_id
    WHERE sc.id = ${campId} LIMIT 1
  `;
  if (rows.length === 0) throw new ApiError(404, "Camp not found", "NOT_FOUND");
  const camp = rows[0];
  const schoolId = camp.school_id as string;

  if (isOpsRole(actor.role)) {
    return { camp, canSchedule: true, canScreen: true, canReview: true };
  }
  if (actor.role === "SCHOOL_ADMIN" && actor.schoolId === schoolId) {
    return { camp, canSchedule: true, canScreen: true, canReview: false };
  }

  const staff = await sql`
    SELECT staff_role FROM vita_hero.camp_staff
    WHERE camp_id = ${campId} AND profile_id = ${actor.profileId} LIMIT 1
  `;
  if (staff.length === 0) {
    throw new ApiError(403, "You are not assigned to this camp", "CAMP_FORBIDDEN");
  }
  const staffRole = staff[0].staff_role as string;
  return {
    camp,
    canSchedule: false,
    canScreen: staffRole === "SCREENER" || staffRole === "PHYSICIAN",
    canReview: staffRole === "PHYSICIAN",
  };
}

function assertCan(ok: boolean, what: string): void {
  if (!ok) throw new ApiError(403, `You do not have permission to ${what}`, "FORBIDDEN");
}

// ─── B1 · Scheduling ────────────────────────────────────────

function mapCamp(r: Record<string, unknown>) {
  const jsonArr = (v: unknown): string[] =>
    Array.isArray(v) ? (v as string[]) : JSON.parse(String(v || "[]"));
  return {
    id: r.id as string,
    schoolId: r.school_id as string,
    schoolName: (r.school_name as string) || "",
    title: r.title as string,
    description: (r.description as string) || "",
    date: (r.date as string) || "",
    time: (r.time as string) || "",
    venue: (r.venue as string) || "",
    status: (r.status as string) || "DRAFT",
    checks: jsonArr(r.checks),
    grades: jsonArr(r.grades),
    sections: jsonArr(r.sections),
    academicYear: (r.academic_year as string) || "",
    capacity: (r.capacity as number) || 0,
    consentDeadline: (r.consent_deadline as string) || "",
    releasedAt: r.released_at ? String(r.released_at) : "",
    resultSummary: (r.result_summary as string) || "",
    participants: typeof r.participant_count === "number" ? r.participant_count : undefined,
    consented: typeof r.consented_count === "number" ? r.consented_count : undefined,
    screened: typeof r.screened_count === "number" ? r.screened_count : undefined,
    approved: typeof r.approved_count === "number" ? r.approved_count : undefined,
  };
}

export async function listCamps(sql: Sql, actor: Actor, schoolId: string) {
  assertSchoolAccess(actor, schoolId);
  const rows = await sql`
    SELECT sc.*, s.name AS school_name,
      (SELECT COUNT(*)::int FROM vita_hero.camp_participants p WHERE p.camp_id = sc.id) AS participant_count,
      (SELECT COUNT(*)::int FROM vita_hero.camp_participants p WHERE p.camp_id = sc.id
         AND p.consent_status IN ('GRANTED','PAPER')) AS consented_count,
      (SELECT COUNT(*)::int FROM vita_hero.camp_participants p WHERE p.camp_id = sc.id
         AND p.status IN ('SCREENED','APPROVED','RELEASED')) AS screened_count,
      (SELECT COUNT(*)::int FROM vita_hero.camp_participants p WHERE p.camp_id = sc.id
         AND p.status IN ('APPROVED','RELEASED')) AS approved_count
    FROM vita_hero.school_camps sc
    JOIN vita_hero.schools s ON s.id = sc.school_id
    WHERE sc.school_id = ${schoolId} AND sc.active = true
    ORDER BY sc.date DESC
  `;
  return { camps: rows.map(mapCamp) };
}

/** Camps this staff member is assigned to — the screener's and physician's home screen. */
export async function listMyCamps(sql: Sql, actor: Actor) {
  if (isOpsRole(actor.role)) {
    const rows = await sql`
      SELECT sc.*, s.name AS school_name,
        (SELECT COUNT(*)::int FROM vita_hero.camp_participants p WHERE p.camp_id = sc.id) AS participant_count,
        (SELECT COUNT(*)::int FROM vita_hero.camp_participants p WHERE p.camp_id = sc.id
           AND p.status IN ('SCREENED','APPROVED','RELEASED')) AS screened_count
      FROM vita_hero.school_camps sc
      JOIN vita_hero.schools s ON s.id = sc.school_id
      WHERE sc.active = true AND sc.status IN ('SCHEDULED','IN_PROGRESS','SCREENED')
      ORDER BY sc.date DESC LIMIT 50
    `;
    return { camps: rows.map(mapCamp) };
  }
  const rows = await sql`
    SELECT sc.*, s.name AS school_name, cs.staff_role,
      (SELECT COUNT(*)::int FROM vita_hero.camp_participants p WHERE p.camp_id = sc.id) AS participant_count,
      (SELECT COUNT(*)::int FROM vita_hero.camp_participants p WHERE p.camp_id = sc.id
         AND p.status IN ('SCREENED','APPROVED','RELEASED')) AS screened_count,
      (SELECT COUNT(*)::int FROM vita_hero.camp_participants p WHERE p.camp_id = sc.id
         AND p.status = 'SCREENED') AS approved_count
    FROM vita_hero.camp_staff cs
    JOIN vita_hero.school_camps sc ON sc.id = cs.camp_id
    JOIN vita_hero.schools s ON s.id = sc.school_id
    WHERE cs.profile_id = ${actor.profileId} AND sc.active = true
    ORDER BY sc.date DESC
  `;
  return {
    camps: rows.map((r) => ({ ...mapCamp(r), staffRole: (r.staff_role as string) || "" })),
  };
}

export async function getCamp(sql: Sql, actor: Actor, campId: string) {
  const access = await assertCampAccess(sql, actor, campId);
  const counts = await sql`
    SELECT
      COUNT(*)::int AS participant_count,
      COUNT(*) FILTER (WHERE consent_status IN ('GRANTED','PAPER'))::int AS consented_count,
      COUNT(*) FILTER (WHERE consent_status = 'DECLINED')::int AS declined_count,
      COUNT(*) FILTER (WHERE consent_status = 'PENDING')::int AS pending_count,
      COUNT(*) FILTER (WHERE attendance = 'PRESENT')::int AS present_count,
      COUNT(*) FILTER (WHERE attendance = 'ABSENT')::int AS absent_count,
      COUNT(*) FILTER (WHERE status IN ('SCREENED','APPROVED','RELEASED'))::int AS screened_count,
      COUNT(*) FILTER (WHERE status = 'SCREENED')::int AS awaiting_review_count,
      COUNT(*) FILTER (WHERE status IN ('APPROVED','RELEASED'))::int AS approved_count,
      COUNT(*) FILTER (WHERE status = 'RELEASED')::int AS released_count,
      COUNT(*) FILTER (WHERE urgency = 'URGENT')::int AS urgent_count
    FROM vita_hero.camp_participants WHERE camp_id = ${campId}
  `;
  const staff = await sql`
    SELECT cs.profile_id, cs.staff_role, p.name, p.phone
    FROM vita_hero.camp_staff cs
    LEFT JOIN vita_hero.profiles p ON p.id = cs.profile_id
    WHERE cs.camp_id = ${campId} ORDER BY cs.staff_role, p.name
  `;
  // Counts come back snake_case from SQL; the rest of the API is camelCase, so
  // normalise here rather than leaving callers to guess which shape they got.
  const c = counts[0] as Record<string, number>;
  return {
    camp: {
      ...mapCamp(access.camp),
      participants: c.participant_count || 0,
      consented: c.consented_count || 0,
      declined: c.declined_count || 0,
      pendingConsent: c.pending_count || 0,
      present: c.present_count || 0,
      absent: c.absent_count || 0,
      screened: c.screened_count || 0,
      awaitingReview: c.awaiting_review_count || 0,
      approved: c.approved_count || 0,
      released: c.released_count || 0,
      urgent: c.urgent_count || 0,
    },
    staff: staff.map((s) => ({
      profileId: s.profile_id as string,
      role: s.staff_role as string,
      name: (s.name as string) || "",
      phone: (s.phone as string) || "",
    })),
    can: {
      schedule: access.canSchedule,
      screen: access.canScreen,
      review: access.canReview,
    },
  };
}

export async function createCamp(
  sql: Sql,
  actor: Actor,
  schoolId: string,
  body: Record<string, unknown>
) {
  assertSchoolAccess(actor, schoolId);
  const schoolRows = await sql`
    SELECT id, name, checks_offered, academic_year FROM vita_hero.schools WHERE id = ${schoolId} LIMIT 1
  `;
  if (schoolRows.length === 0) throw new ApiError(404, "School not found", "NOT_FOUND");
  const school = schoolRows[0];

  const title = String(body.title || "").trim() || "Health Camp";
  const date = String(body.date || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ApiError(400, "Camp date must be YYYY-MM-DD", "BAD_DATE");
  }

  const offered: string[] = Array.isArray(school.checks_offered)
    ? (school.checks_offered as string[])
    : JSON.parse(String(school.checks_offered || "[]"));

  const checks = (Array.isArray(body.checks) ? (body.checks as unknown[]) : [])
    .map(String)
    .filter(isCheckType);
  if (checks.length === 0) {
    throw new ApiError(400, "Choose at least one check for this camp", "NO_CHECKS");
  }
  // A camp cannot measure something the school has not agreed to.
  if (offered.length > 0) {
    const notAgreed = checks.filter((c) => !offered.includes(c));
    if (notAgreed.length > 0) {
      throw new ApiError(
        400,
        `This school has not agreed to: ${notAgreed.join(", ")}. Update the programme first.`,
        "CHECK_NOT_AGREED"
      );
    }
  }

  const grades = (Array.isArray(body.grades) ? (body.grades as unknown[]) : []).map(String).filter(Boolean);
  if (grades.length === 0) {
    throw new ApiError(400, "Choose at least one class for this camp", "NO_GRADES");
  }
  const sections = (Array.isArray(body.sections) ? (body.sections as unknown[]) : [])
    .map((s) => String(s).toUpperCase())
    .filter(Boolean);

  const year = String(body.academicYear || "").trim() || (school.academic_year as string) || currentAcademicYear();
  const campId = `sc_${slugify(schoolId).slice(0, 24)}_${slugify(date)}_${Math.random().toString(36).slice(2, 5)}`;

  await sql`
    INSERT INTO vita_hero.school_camps
      (id, school_id, title, description, date, time, venue, status, checks, grades, sections,
       academic_year, capacity, consent_deadline, active, created_by)
    VALUES
      (${campId}, ${schoolId}, ${title}, ${String(body.description || "")}, ${date},
       ${String(body.time || "")}, ${String(body.venue || "")}, 'DRAFT',
       ${JSON.stringify(checks)}::jsonb, ${JSON.stringify(grades)}::jsonb,
       ${JSON.stringify(sections)}::jsonb, ${year},
       ${Number(body.capacity) || 0}, ${String(body.consentDeadline || "")}, true, ${actor.profileId})
  `;

  return getCamp(sql, actor, campId);
}

export async function updateCamp(
  sql: Sql,
  actor: Actor,
  campId: string,
  body: Record<string, unknown>
) {
  const access = await assertCampAccess(sql, actor, campId);
  assertCan(access.canSchedule, "change this camp");
  const cur = access.camp;

  if ((cur.status as string) === "RELEASED" && body.status !== "RELEASED") {
    throw new ApiError(409, "This camp has been released and can no longer be edited", "RELEASED");
  }

  const status = String(body.status || cur.status || "DRAFT").toUpperCase();
  if (!CAMP_STATUSES.includes(status as (typeof CAMP_STATUSES)[number])) {
    throw new ApiError(400, "Unknown camp status", "BAD_STATUS");
  }

  const checks = Array.isArray(body.checks)
    ? (body.checks as unknown[]).map(String).filter(isCheckType)
    : Array.isArray(cur.checks) ? (cur.checks as string[]) : JSON.parse(String(cur.checks || "[]"));
  const grades = Array.isArray(body.grades)
    ? (body.grades as unknown[]).map(String).filter(Boolean)
    : Array.isArray(cur.grades) ? (cur.grades as string[]) : JSON.parse(String(cur.grades || "[]"));
  const sections = Array.isArray(body.sections)
    ? (body.sections as unknown[]).map((s) => String(s).toUpperCase()).filter(Boolean)
    : Array.isArray(cur.sections) ? (cur.sections as string[]) : JSON.parse(String(cur.sections || "[]"));

  await sql`
    UPDATE vita_hero.school_camps SET
      title = ${String(body.title ?? cur.title ?? "")},
      description = ${String(body.description ?? cur.description ?? "")},
      date = ${String(body.date ?? cur.date ?? "")},
      time = ${String(body.time ?? cur.time ?? "")},
      venue = ${String(body.venue ?? cur.venue ?? "")},
      status = ${status},
      checks = ${JSON.stringify(checks)}::jsonb,
      grades = ${JSON.stringify(grades)}::jsonb,
      sections = ${JSON.stringify(sections)}::jsonb,
      capacity = ${Number(body.capacity ?? cur.capacity ?? 0)},
      consent_deadline = ${String(body.consentDeadline ?? cur.consent_deadline ?? "")},
      result_summary = ${String(body.resultSummary ?? cur.result_summary ?? "")}
    WHERE id = ${campId}
  `;
  return getCamp(sql, actor, campId);
}

// ─── B7 · Materialise the camp roster ───────────────────────

/**
 * Build the camp's list of children from the school roster.
 *
 * This is the step that was missing: without it a camp is a date with no
 * children attached, so a screener signs in and sees nothing. Re-running it is
 * safe — children already on the list keep their consent and findings, and
 * children who no longer match the selected classes are removed only if nothing
 * has been recorded for them.
 */
export async function buildCampRoster(sql: Sql, actor: Actor, campId: string) {
  const access = await assertCampAccess(sql, actor, campId);
  assertCan(access.canSchedule, "build this camp's roster");
  const camp = access.camp;
  const schoolId = camp.school_id as string;
  const year = (camp.academic_year as string) || currentAcademicYear();
  const grades: string[] = Array.isArray(camp.grades)
    ? (camp.grades as string[])
    : JSON.parse(String(camp.grades || "[]"));
  const sections: string[] = Array.isArray(camp.sections)
    ? (camp.sections as string[])
    : JSON.parse(String(camp.sections || "[]"));

  if (grades.length === 0) {
    throw new ApiError(400, "Choose the classes this camp covers first", "NO_GRADES");
  }

  const eligible = await sql`
    SELECT k.id, k.profile_id
    FROM vita_hero.kids k
    WHERE k.school_id = ${schoolId}
      AND (k.academic_year = ${year} OR COALESCE(k.academic_year,'') = '')
      AND k.grade = ANY(${grades})
      AND (${sections.length === 0} OR COALESCE(k.section,'') = ANY(${sections}))
  `;

  const existing = await sql`
    SELECT kid_id, status, consent_status FROM vita_hero.camp_participants WHERE camp_id = ${campId}
  `;
  const existingIds = new Set(existing.map((r) => r.kid_id as string));
  const eligibleIds = new Set(eligible.map((r) => r.id as string));

  const toAdd = eligible.filter((r) => !existingIds.has(r.id as string));
  for (const group of chunk(toAdd, 100)) {
    const values: string[] = [];
    const params: unknown[] = [];
    group.forEach((r, i) => {
      const b = i * 4;
      values.push(`($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4})`);
      params.push(
        `cp_${campId.slice(-12)}_${slugify(String(r.id)).slice(0, 20)}`,
        campId,
        schoolId,
        r.id
      );
    });
    // profile_id is joined in from kids so a guardian change cannot desync it.
    await sql.query(
      `INSERT INTO vita_hero.camp_participants (id, camp_id, school_id, kid_id, profile_id)
       SELECT v.id, v.camp_id, v.school_id, v.kid_id, k.profile_id
       FROM (VALUES ${values.join(", ")}) AS v(id, camp_id, school_id, kid_id)
       JOIN vita_hero.kids k ON k.id = v.kid_id
       ON CONFLICT (camp_id, kid_id) DO NOTHING`,
      params
    );
  }

  // Drop children who no longer match, but never one who has been screened or
  // has consent on file — that would silently discard a real record.
  let removed = 0;
  for (const row of existing) {
    const kidId = row.kid_id as string;
    if (eligibleIds.has(kidId)) continue;
    if ((row.status as string) !== "NOT_SCREENED" || (row.consent_status as string) !== "PENDING") continue;
    await sql`DELETE FROM vita_hero.camp_participants WHERE camp_id = ${campId} AND kid_id = ${kidId}`;
    removed++;
  }

  await sql`
    UPDATE vita_hero.school_camps
    SET registered_count = (SELECT COUNT(*) FROM vita_hero.camp_participants WHERE camp_id = ${campId}),
        status = CASE WHEN status = 'DRAFT' THEN 'SCHEDULED' ELSE status END
    WHERE id = ${campId}
  `;

  return { added: toAdd.length, removed, total: eligibleIds.size };
}

// ─── B2-B6 · Consent ────────────────────────────────────────

export async function listParticipants(
  sql: Sql,
  actor: Actor,
  campId: string,
  opts: { consent?: string; attendance?: string; status?: string; search?: string }
) {
  const access = await assertCampAccess(sql, actor, campId);
  const search = (opts.search || "").toLowerCase();
  const rows = await sql`
    SELECT p.*, k.name, k.grade, k.section, k.gender, k.age, k.date_of_birth, k.student_ref,
           k.guardian_name, pr.phone AS guardian_phone,
           (SELECT COUNT(*)::int FROM vita_hero.camp_findings f
             WHERE f.camp_id = p.camp_id AND f.kid_id = p.kid_id
               AND f.flag <> 'NOT_MEASURED') AS findings_count
    FROM vita_hero.camp_participants p
    JOIN vita_hero.kids k ON k.id = p.kid_id
    LEFT JOIN vita_hero.profiles pr ON pr.id = p.profile_id
    WHERE p.camp_id = ${campId}
      AND (${!opts.consent} OR p.consent_status = ${opts.consent || ""})
      AND (${!opts.attendance} OR p.attendance = ${opts.attendance || ""})
      AND (${!opts.status} OR p.status = ${opts.status || ""})
      AND (${search === ""} OR LOWER(k.name) LIKE ${"%" + search + "%"}
           OR LOWER(COALESCE(k.student_ref,'')) LIKE ${"%" + search + "%"})
    ORDER BY k.grade, k.section, k.name
  `;
  return {
    can: { schedule: access.canSchedule, screen: access.canScreen, review: access.canReview },
    participants: rows.map((r) => ({
      kidId: r.kid_id as string,
      name: r.name as string,
      grade: (r.grade as string) || "",
      section: (r.section as string) || "",
      gender: (r.gender as string) || "",
      age: (r.age as number) ?? null,
      dob: (r.date_of_birth as string) || "",
      studentRef: (r.student_ref as string) || "",
      guardianName: (r.guardian_name as string) || "",
      guardianPhone: (r.guardian_phone as string) || "",
      consentStatus: (r.consent_status as string) || "PENDING",
      attendance: (r.attendance as string) || "UNKNOWN",
      status: (r.status as string) || "NOT_SCREENED",
      urgency: (r.urgency as string) || "NONE",
      recommendation: (r.recommendation as string) || "",
      findingsCount: (r.findings_count as number) || 0,
    })),
  };
}

/** B2 — dispatch consent requests. Returns the numbers to message. */
export async function requestConsent(
  sql: Sql,
  actor: Actor,
  campId: string,
  sendSms: (phone: string, body: string) => Promise<boolean>,
  appOrigin: string
) {
  const access = await assertCampAccess(sql, actor, campId);
  assertCan(access.canSchedule, "request consent for this camp");
  const camp = access.camp;

  const rows = await sql`
    SELECT DISTINCT p.profile_id, pr.phone, pr.name
    FROM vita_hero.camp_participants p
    JOIN vita_hero.profiles pr ON pr.id = p.profile_id
    WHERE p.camp_id = ${campId} AND p.consent_status = 'PENDING' AND COALESCE(pr.phone,'') <> ''
  `;

  const checks: string[] = Array.isArray(camp.checks)
    ? (camp.checks as string[])
    : JSON.parse(String(camp.checks || "[]"));
  const deadline = (camp.consent_deadline as string) || "";
  const message =
    `VitaHero: ${camp.school_name} is holding a health check-up on ${camp.date}` +
    ` (${checks.slice(0, 3).join(", ")}${checks.length > 3 ? " and more" : ""}).` +
    ` Your permission is needed for your child to take part.` +
    (deadline ? ` Please respond by ${deadline}.` : "") +
    ` Open the VitaHero app to give or decline permission. ${appOrigin}/i/consent`;

  let sent = 0;
  for (const r of rows) {
    const ok = await sendSms(r.phone as string, message);
    if (ok) sent++;
  }

  await sql`
    UPDATE vita_hero.school_camps
    SET status = CASE WHEN status = 'DRAFT' THEN 'SCHEDULED' ELSE status END
    WHERE id = ${campId}
  `;

  return { guardians: rows.length, sent };
}

/**
 * Record consent. Used by the guardian's own app and, for B6, by an
 * administrator entering a paper form — which is logged with who entered it.
 */
export async function recordConsent(
  sql: Sql,
  campId: string,
  kidId: string,
  decision: "GRANTED" | "DECLINED" | "PAPER",
  opts: { actorId: string; source: string; checks?: string[]; note?: string; profileId?: string }
) {
  const rows = await sql`
    SELECT profile_id, status FROM vita_hero.camp_participants
    WHERE camp_id = ${campId} AND kid_id = ${kidId} LIMIT 1
  `;
  if (rows.length === 0) {
    throw new ApiError(404, "That child is not on this camp's list", "NOT_ON_CAMP");
  }
  const owner = rows[0].profile_id as string;
  if (opts.profileId && opts.profileId !== owner) {
    throw new ApiError(403, "That is not your child", "NOT_YOUR_CHILD");
  }
  if ((rows[0].status as string) !== "NOT_SCREENED") {
    throw new ApiError(409, "This child has already been screened at this camp", "ALREADY_SCREENED");
  }

  const checks = Array.isArray(opts.checks) ? opts.checks.filter(isCheckType) : [];
  await sql`
    UPDATE vita_hero.camp_participants
    SET consent_status = ${decision},
        consent_checks = ${JSON.stringify(checks)}::jsonb,
        consent_at = NOW(),
        consent_source = ${opts.source},
        consent_recorded_by = ${opts.actorId}
    WHERE camp_id = ${campId} AND kid_id = ${kidId}
  `;
  await sql`
    INSERT INTO vita_hero.consent_log (id, camp_id, kid_id, profile_id, action, source, actor_id, note)
    VALUES (${"cl_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)},
            ${campId}, ${kidId}, ${owner}, ${decision}, ${opts.source}, ${opts.actorId}, ${opts.note || ""})
  `;
  return { kidId, consentStatus: decision };
}

// ─── C · Camp-day capture ───────────────────────────────────

/** C3 — present, absent, or refused on the day. */
export async function setAttendance(
  sql: Sql,
  actor: Actor,
  campId: string,
  kidId: string,
  value: string
) {
  const access = await assertCampAccess(sql, actor, campId);
  assertCan(access.canScreen, "record attendance for this camp");
  const v = value.toUpperCase();
  if (!ATTENDANCE.includes(v as (typeof ATTENDANCE)[number])) {
    throw new ApiError(400, "Attendance must be PRESENT, ABSENT or REFUSED", "BAD_ATTENDANCE");
  }
  const rows = await sql`
    UPDATE vita_hero.camp_participants SET attendance = ${v}
    WHERE camp_id = ${campId} AND kid_id = ${kidId}
    RETURNING kid_id
  `;
  if (rows.length === 0) throw new ApiError(404, "That child is not on this camp's list", "NOT_ON_CAMP");
  await sql`
    UPDATE vita_hero.school_camps SET status = 'IN_PROGRESS'
    WHERE id = ${campId} AND status IN ('DRAFT','SCHEDULED')
  `;
  return { kidId, attendance: v };
}

export async function getScreeningForm(sql: Sql, actor: Actor, campId: string, kidId: string) {
  const access = await assertCampAccess(sql, actor, campId);
  assertCan(access.canScreen, "screen children at this camp");

  const rows = await sql`
    SELECT p.*, k.name, k.grade, k.section, k.gender, k.age, k.date_of_birth, k.student_ref,
           k.guardian_name, k.height_cm AS prev_height, k.weight_kg AS prev_weight
    FROM vita_hero.camp_participants p
    JOIN vita_hero.kids k ON k.id = p.kid_id
    WHERE p.camp_id = ${campId} AND p.kid_id = ${kidId} LIMIT 1
  `;
  if (rows.length === 0) throw new ApiError(404, "That child is not on this camp's list", "NOT_ON_CAMP");
  const p = rows[0];

  const findings = await sql`
    SELECT * FROM vita_hero.camp_findings WHERE camp_id = ${campId} AND kid_id = ${kidId}
  `;
  const campChecks: string[] = Array.isArray(access.camp.checks)
    ? (access.camp.checks as string[])
    : JSON.parse(String(access.camp.checks || "[]"));
  const consentChecks: string[] = Array.isArray(p.consent_checks)
    ? (p.consent_checks as string[])
    : JSON.parse(String(p.consent_checks || "[]"));

  // Partial consent narrows what may be recorded (B4).
  const allowed = consentChecks.length > 0 ? campChecks.filter((c) => consentChecks.includes(c)) : campChecks;

  return {
    child: {
      kidId: p.kid_id as string,
      name: p.name as string,
      grade: (p.grade as string) || "",
      section: (p.section as string) || "",
      gender: (p.gender as string) || "",
      age: (p.age as number) ?? null,
      dob: (p.date_of_birth as string) || "",
      studentRef: (p.student_ref as string) || "",
      guardianName: (p.guardian_name as string) || "",
      previousHeightCm: (p.prev_height as number) || null,
      previousWeightKg: (p.prev_weight as number) || null,
    },
    consentStatus: (p.consent_status as string) || "PENDING",
    attendance: (p.attendance as string) || "UNKNOWN",
    status: (p.status as string) || "NOT_SCREENED",
    checks: allowed,
    excludedByConsent: campChecks.filter((c) => !allowed.includes(c)),
    findings: findings.map((f) => ({
      checkType: f.check_type as string,
      detail: (f.detail as Record<string, unknown>) || {},
      flag: f.flag as string,
      autoFlag: f.auto_flag as string,
      rationale: (f.rationale as string) || "",
      note: (f.screener_note as string) || "",
    })),
  };
}

/**
 * C8 — record findings for one child.
 *
 * Consent is enforced here, not in the UI: a child with no consent on file
 * cannot be screened, and a child with partial consent cannot be screened for
 * a check their guardian declined.
 */
export async function saveScreening(
  sql: Sql,
  actor: Actor,
  campId: string,
  kidId: string,
  body: Record<string, unknown>
) {
  const access = await assertCampAccess(sql, actor, campId);
  assertCan(access.canScreen, "screen children at this camp");

  const pRows = await sql`
    SELECT p.*, k.age, k.gender, k.name, k.date_of_birth
    FROM vita_hero.camp_participants p
    JOIN vita_hero.kids k ON k.id = p.kid_id
    WHERE p.camp_id = ${campId} AND p.kid_id = ${kidId} LIMIT 1
  `;
  if (pRows.length === 0) throw new ApiError(404, "That child is not on this camp's list", "NOT_ON_CAMP");
  const p = pRows[0];

  const consent = (p.consent_status as string) || "PENDING";
  if (consent !== "GRANTED" && consent !== "PAPER") {
    throw new ApiError(
      403,
      consent === "DECLINED"
        ? "This guardian declined consent for this camp"
        : "No consent on file for this child yet",
      "NO_CONSENT"
    );
  }
  if ((p.status as string) === "RELEASED") {
    throw new ApiError(409, "This child's results have already been released", "RELEASED");
  }

  const campChecks: string[] = Array.isArray(access.camp.checks)
    ? (access.camp.checks as string[])
    : JSON.parse(String(access.camp.checks || "[]"));
  const consentChecks: string[] = Array.isArray(p.consent_checks)
    ? (p.consent_checks as string[])
    : JSON.parse(String(p.consent_checks || "[]"));
  const allowed = consentChecks.length > 0 ? campChecks.filter((c) => consentChecks.includes(c)) : campChecks;

  const incoming = Array.isArray(body.findings) ? (body.findings as Record<string, unknown>[]) : [];
  if (incoming.length === 0) throw new ApiError(400, "No findings submitted", "NO_FINDINGS");

  const ctx = {
    ageYears: Number(p.age) || 0,
    gender: String(p.gender || ""),
  };

  const saved: Array<{ checkType: string; flag: Flag; rationale: string }> = [];

  for (const raw of incoming) {
    const checkType = String(raw.checkType || "");
    if (!isCheckType(checkType)) {
      throw new ApiError(400, `Unknown check "${checkType}"`, "BAD_CHECK");
    }
    if (!allowed.includes(checkType)) {
      throw new ApiError(
        403,
        `Consent does not cover "${checkType}" for this child`,
        "CHECK_NOT_CONSENTED"
      );
    }
    const detail = (raw.detail as Record<string, unknown>) || {};
    const proposal = proposeFlag({ checkType, detail }, ctx);

    // C9 — a screener may override the proposal, but must say why.
    const override = raw.flag ? String(raw.flag).toUpperCase() : "";
    const note = String(raw.note || "").trim();
    let flag: Flag = proposal.flag;
    if (override && override !== proposal.flag) {
      if (!["GOOD", "WATCH", "ALERT", "NOT_MEASURED"].includes(override)) {
        throw new ApiError(400, "Unknown flag value", "BAD_FLAG");
      }
      if (!note) {
        throw new ApiError(
          400,
          `Overriding the suggested result for "${checkType}" needs a reason`,
          "OVERRIDE_NEEDS_NOTE"
        );
      }
      flag = override as Flag;
    }

    const id = `cf_${campId.slice(-10)}_${slugify(kidId).slice(0, 16)}_${slugify(checkType)}`;
    await sql`
      INSERT INTO vita_hero.camp_findings
        (id, camp_id, kid_id, check_type, detail, value_num, value_text,
         auto_flag, flag, rationale, urgency, screener_note, recorded_by, recorded_at)
      VALUES
        (${id}, ${campId}, ${kidId}, ${checkType}, ${JSON.stringify(detail)}::jsonb,
         ${proposal.valueNum}, ${proposal.valueText}, ${proposal.flag}, ${flag},
         ${proposal.rationale}, ${proposal.urgency}, ${note}, ${actor.profileId}, NOW())
      ON CONFLICT (camp_id, kid_id, check_type) DO UPDATE SET
        detail = EXCLUDED.detail,
        value_num = EXCLUDED.value_num,
        value_text = EXCLUDED.value_text,
        auto_flag = EXCLUDED.auto_flag,
        flag = EXCLUDED.flag,
        rationale = EXCLUDED.rationale,
        urgency = EXCLUDED.urgency,
        screener_note = EXCLUDED.screener_note,
        recorded_by = EXCLUDED.recorded_by,
        recorded_at = NOW()
    `;
    saved.push({ checkType, flag, rationale: proposal.rationale });
  }

  await sql`
    UPDATE vita_hero.camp_participants
    SET status = CASE WHEN status IN ('APPROVED','RELEASED') THEN status ELSE 'SCREENED' END,
        attendance = CASE WHEN attendance = 'UNKNOWN' THEN 'PRESENT' ELSE attendance END,
        screened_at = NOW(),
        screened_by = ${actor.profileId}
    WHERE camp_id = ${campId} AND kid_id = ${kidId}
  `;
  await sql`
    UPDATE vita_hero.school_camps SET status = 'IN_PROGRESS'
    WHERE id = ${campId} AND status IN ('DRAFT','SCHEDULED')
  `;

  return { kidId, saved };
}

/** C12 — reconciliation: rostered vs screened vs absent. */
export async function campReconciliation(sql: Sql, actor: Actor, campId: string) {
  await assertCampAccess(sql, actor, campId);
  const rows = await sql`
    SELECT
      COUNT(*)::int AS rostered,
      COUNT(*) FILTER (WHERE consent_status IN ('GRANTED','PAPER'))::int AS consented,
      COUNT(*) FILTER (WHERE attendance = 'PRESENT')::int AS present,
      COUNT(*) FILTER (WHERE attendance = 'ABSENT')::int AS absent,
      COUNT(*) FILTER (WHERE attendance = 'REFUSED')::int AS refused,
      COUNT(*) FILTER (WHERE status IN ('SCREENED','APPROVED','RELEASED'))::int AS screened,
      COUNT(*) FILTER (WHERE consent_status IN ('GRANTED','PAPER')
                        AND attendance = 'PRESENT'
                        AND status = 'NOT_SCREENED')::int AS present_not_screened
    FROM vita_hero.camp_participants WHERE camp_id = ${campId}
  `;
  return { reconciliation: rows[0] };
}

// ─── D · Clinical review ────────────────────────────────────

/** D1 — the physician's queue, most severe first. */
export async function reviewQueue(sql: Sql, actor: Actor, campId: string) {
  const access = await assertCampAccess(sql, actor, campId);
  assertCan(access.canReview, "review results for this camp");

  const rows = await sql`
    SELECT p.kid_id, p.status, p.urgency, p.recommendation, p.reviewed_at,
           k.name, k.grade, k.section, k.age, k.gender,
           (SELECT COUNT(*) FILTER (WHERE f.flag = 'ALERT')::int FROM vita_hero.camp_findings f
             WHERE f.camp_id = p.camp_id AND f.kid_id = p.kid_id) AS alerts,
           (SELECT COUNT(*) FILTER (WHERE f.flag = 'WATCH')::int FROM vita_hero.camp_findings f
             WHERE f.camp_id = p.camp_id AND f.kid_id = p.kid_id) AS watches
    FROM vita_hero.camp_participants p
    JOIN vita_hero.kids k ON k.id = p.kid_id
    WHERE p.camp_id = ${campId} AND p.status IN ('SCREENED','APPROVED')
    ORDER BY alerts DESC, watches DESC, k.name
  `;
  return {
    queue: rows.map((r) => ({
      kidId: r.kid_id as string,
      name: r.name as string,
      grade: `${(r.grade as string) || ""} ${(r.section as string) || ""}`.trim(),
      age: (r.age as number) ?? null,
      alerts: (r.alerts as number) || 0,
      watches: (r.watches as number) || 0,
      status: r.status as string,
      urgency: (r.urgency as string) || "NONE",
      recommendation: (r.recommendation as string) || "",
      reviewed: !!r.reviewed_at,
    })),
  };
}

/** Everything a physician needs to decide on one child. */
export async function reviewDetail(sql: Sql, actor: Actor, campId: string, kidId: string) {
  const access = await assertCampAccess(sql, actor, campId);
  assertCan(access.canReview, "review results for this camp");

  const pRows = await sql`
    SELECT p.*, k.name, k.grade, k.section, k.age, k.gender, k.date_of_birth, k.guardian_name
    FROM vita_hero.camp_participants p
    JOIN vita_hero.kids k ON k.id = p.kid_id
    WHERE p.camp_id = ${campId} AND p.kid_id = ${kidId} LIMIT 1
  `;
  if (pRows.length === 0) throw new ApiError(404, "That child is not on this camp's list", "NOT_ON_CAMP");
  const p = pRows[0];

  const fRows = await sql`
    SELECT f.*, sp.name AS screener_name
    FROM vita_hero.camp_findings f
    LEFT JOIN vita_hero.profiles sp ON sp.id = f.recorded_by
    WHERE f.camp_id = ${campId} AND f.kid_id = ${kidId}
    ORDER BY f.check_type
  `;

  const findings = fRows.map((f) => ({
    checkType: f.check_type as string,
    detail: (f.detail as Record<string, unknown>) || {},
    flag: f.flag as Flag,
    autoFlag: f.auto_flag as Flag,
    rationale: (f.rationale as string) || "",
    urgency: (f.urgency as Urgency) || "NONE",
    screenerNote: (f.screener_note as string) || "",
    screenerName: (f.screener_name as string) || "",
    reviewNote: (f.review_note as string) || "",
    overridden: (f.flag as string) !== (f.auto_flag as string),
  }));

  const summary = summariseForApp(findings);
  const existing = (p.recommendation as string) || "";

  return {
    child: {
      kidId,
      name: p.name as string,
      grade: `${(p.grade as string) || ""} ${(p.section as string) || ""}`.trim(),
      age: (p.age as number) ?? null,
      gender: (p.gender as string) || "",
      guardianName: (p.guardian_name as string) || "",
    },
    status: (p.status as string) || "NOT_SCREENED",
    findings,
    summary,
    suggestedUrgency: summary.urgency,
    recommendation: existing || draftRecommendation(String(p.name), summary),
    recommendationIsDraft: !existing,
  };
}

/** D2, D3, D5 — confirm the flags, set urgency, write the parent-facing line. */
export async function reviewParticipant(
  sql: Sql,
  actor: Actor,
  campId: string,
  kidId: string,
  body: Record<string, unknown>
) {
  const access = await assertCampAccess(sql, actor, campId);
  assertCan(access.canReview, "review results for this camp");

  const pRows = await sql`
    SELECT status FROM vita_hero.camp_participants
    WHERE camp_id = ${campId} AND kid_id = ${kidId} LIMIT 1
  `;
  if (pRows.length === 0) throw new ApiError(404, "That child is not on this camp's list", "NOT_ON_CAMP");
  if ((pRows[0].status as string) === "RELEASED") {
    throw new ApiError(409, "Already released to the guardian", "RELEASED");
  }
  if ((pRows[0].status as string) === "NOT_SCREENED") {
    throw new ApiError(409, "This child has not been screened yet", "NOT_SCREENED");
  }

  // Apply per-finding adjustments.
  const adjustments = Array.isArray(body.findings) ? (body.findings as Record<string, unknown>[]) : [];
  for (const a of adjustments) {
    const checkType = String(a.checkType || "");
    if (!isCheckType(checkType)) continue;
    const flag = String(a.flag || "").toUpperCase();
    if (!["GOOD", "WATCH", "ALERT", "NOT_MEASURED"].includes(flag)) {
      throw new ApiError(400, "Unknown flag value", "BAD_FLAG");
    }
    await sql`
      UPDATE vita_hero.camp_findings
      SET flag = ${flag},
          review_note = ${String(a.note || "")},
          reviewed_by = ${actor.profileId},
          reviewed_at = NOW()
      WHERE camp_id = ${campId} AND kid_id = ${kidId} AND check_type = ${checkType}
    `;
  }

  const recommendation = String(body.recommendation || "").trim();
  if (!recommendation) {
    throw new ApiError(400, "Write what the guardian should do next", "NO_RECOMMENDATION");
  }

  const fRows = await sql`
    SELECT check_type, flag, urgency, detail FROM vita_hero.camp_findings
    WHERE camp_id = ${campId} AND kid_id = ${kidId}
  `;
  const findings = fRows.map((f) => ({
    checkType: f.check_type as string,
    flag: f.flag as Flag,
    urgency: (f.urgency as Urgency) || "NONE",
    detail: (f.detail as Record<string, unknown>) || {},
  }));

  const urgencyInput = String(body.urgency || "").toUpperCase();
  const urgency: Urgency = ["NONE", "ROUTINE", "SOON", "URGENT"].includes(urgencyInput)
    ? (urgencyInput as Urgency)
    : worstUrgency(findings.map((f) => f.urgency));

  await sql`
    UPDATE vita_hero.camp_participants
    SET status = 'APPROVED', urgency = ${urgency}, recommendation = ${recommendation},
        reviewed_at = NOW(), reviewed_by = ${actor.profileId}
    WHERE camp_id = ${campId} AND kid_id = ${kidId}
  `;

  return { kidId, status: "APPROVED", urgency };
}

// ─── D6 · Release ───────────────────────────────────────────

/**
 * Release approved results to guardians.
 *
 * This is where camp findings become something a parent can see. It projects
 * into the tables the Android app already reads — camp_kid_results, the kid's
 * flags, and growth_points — so no app change is needed for results to appear.
 *
 * Only APPROVED children are released. A child who was screened but never
 * reviewed stays invisible, which is the point of the gate.
 */
export async function releaseCamp(
  sql: Sql,
  actor: Actor,
  campId: string,
  sendSms: (phone: string, body: string) => Promise<boolean>
) {
  const access = await assertCampAccess(sql, actor, campId);
  assertCan(access.canReview, "release results for this camp");
  const camp = access.camp;

  const approved = await sql`
    SELECT p.kid_id, p.profile_id, p.urgency, p.recommendation, k.name
    FROM vita_hero.camp_participants p
    JOIN vita_hero.kids k ON k.id = p.kid_id
    WHERE p.camp_id = ${campId} AND p.status = 'APPROVED'
  `;
  if (approved.length === 0) {
    throw new ApiError(400, "Nothing has been approved for release yet", "NOTHING_APPROVED");
  }

  const campDate = (camp.date as string) || "";
  let released = 0;

  for (const row of approved) {
    const kidId = row.kid_id as string;
    const profileId = row.profile_id as string;

    const fRows = await sql`
      SELECT check_type, flag, urgency, detail FROM vita_hero.camp_findings
      WHERE camp_id = ${campId} AND kid_id = ${kidId}
    `;
    const findings = fRows.map((f) => ({
      checkType: f.check_type as string,
      flag: f.flag as Flag,
      urgency: (f.urgency as Urgency) || "NONE",
      detail: (f.detail as Record<string, unknown>) || {},
    }));
    const s = summariseForApp(findings);

    // The parent app's camp result row.
    await sql`
      INSERT INTO vita_hero.camp_kid_results
        (id, profile_id, school_camp_id, kid_id, dental, eyesight, nutrition, height_cm, weight_kg, recorded_at)
      VALUES
        (${"ckr_" + campId.slice(-10) + "_" + slugify(kidId).slice(0, 20)},
         ${profileId}, ${campId}, ${kidId}, ${s.dental}, ${s.eyesight}, ${s.nutrition},
         ${s.heightCm}, ${s.weightKg}, NOW())
      ON CONFLICT (school_camp_id, kid_id) DO UPDATE SET
        dental = EXCLUDED.dental, eyesight = EXCLUDED.eyesight, nutrition = EXCLUDED.nutrition,
        height_cm = EXCLUDED.height_cm, weight_kg = EXCLUDED.weight_kg, recorded_at = NOW()
    `;

    // The child's headline flags, as the app reads them.
    await sql`
      UPDATE vita_hero.kids SET
        dental = ${s.dental},
        eyesight = ${s.eyesight},
        nutrition = ${s.nutrition},
        height_cm = COALESCE(${s.heightCm}, height_cm),
        weight_kg = COALESCE(${s.weightKg}, weight_kg),
        overall_score = ${s.overallScore},
        last_checkup = ${campDate || "Camp"}
      WHERE id = ${kidId}
    `;

    // A point on the growth chart, if the camp measured one.
    if (s.heightCm !== null || s.weightKg !== null) {
      await sql`
        INSERT INTO vita_hero.growth_points (id, kid_id, user_id, label, height, weight)
        VALUES (${"gp_" + slugify(kidId).slice(0, 20) + "_" + slugify(campDate || campId)},
                ${kidId}, ${profileId}, ${campDate || "Camp"},
                ${s.heightCm ?? 0}, ${s.weightKg ?? 0})
        ON CONFLICT (id) DO UPDATE SET
          height = EXCLUDED.height, weight = EXCLUDED.weight, recorded_at = NOW()
      `;
    }

    // Registration row, so the app's existing camp screens line up.
    await sql`
      INSERT INTO vita_hero.camp_registrations (id, profile_id, school_camp_id, kid_id)
      VALUES (${"reg_" + slugify(kidId).slice(0, 20) + "_" + campId.slice(-8)}, ${profileId}, ${campId}, ${kidId})
      ON CONFLICT (profile_id, school_camp_id, kid_id) DO NOTHING
    `;

    // The guardian must be enrolled with the school to see partner camps.
    await sql`
      INSERT INTO vita_hero.school_enrollments (id, profile_id, school_id, kid_id, status)
      VALUES (${"enr_" + slugify(profileId).slice(0, 20) + "_" + slugify(String(camp.school_id)).slice(0, 16)},
              ${profileId}, ${camp.school_id as string}, ${kidId}, 'ACTIVE')
      ON CONFLICT (profile_id, school_id) DO NOTHING
    `;

    await sql`
      UPDATE vita_hero.camp_participants
      SET status = 'RELEASED', released_at = NOW()
      WHERE camp_id = ${campId} AND kid_id = ${kidId}
    `;
    released++;
  }

  await sql`
    UPDATE vita_hero.school_camps
    SET status = 'RELEASED', released_at = NOW(), released_by = ${actor.profileId}
    WHERE id = ${campId}
  `;

  // D4 — urgent cases are told now, not left to be discovered in the app.
  const urgent = await sql`
    SELECT p.profile_id, k.name, pr.phone
    FROM vita_hero.camp_participants p
    JOIN vita_hero.kids k ON k.id = p.kid_id
    LEFT JOIN vita_hero.profiles pr ON pr.id = p.profile_id
    WHERE p.camp_id = ${campId} AND p.urgency = 'URGENT' AND COALESCE(pr.phone,'') <> ''
  `;
  let urgentNotified = 0;
  for (const u of urgent) {
    const ok = await sendSms(
      u.phone as string,
      `VitaHero: ${u.name}'s school health check-up found something that needs a doctor's attention soon. Please open the VitaHero app for details.`
    );
    if (ok) urgentNotified++;
  }

  return { released, urgentNotified };
}

// ─── Guardian-facing (parent app) ───────────────────────────

/** Consent requests waiting on this guardian. */
export async function pendingConsents(sql: Sql, profileId: string) {
  const rows = await sql`
    SELECT p.camp_id, p.kid_id, p.consent_status, k.name AS kid_name,
           sc.title, sc.date, sc.time, sc.venue, sc.checks, sc.consent_deadline,
           s.name AS school_name
    FROM vita_hero.camp_participants p
    JOIN vita_hero.kids k ON k.id = p.kid_id
    JOIN vita_hero.school_camps sc ON sc.id = p.camp_id
    JOIN vita_hero.schools s ON s.id = sc.school_id
    WHERE p.profile_id = ${profileId}
      AND sc.active = true
      AND sc.status IN ('SCHEDULED','IN_PROGRESS')
      AND p.consent_status = 'PENDING'
    ORDER BY sc.date
  `;
  return {
    consents: rows.map((r) => ({
      campId: r.camp_id as string,
      kidId: r.kid_id as string,
      kidName: r.kid_name as string,
      schoolName: r.school_name as string,
      title: r.title as string,
      date: (r.date as string) || "",
      time: (r.time as string) || "",
      venue: (r.venue as string) || "",
      deadline: (r.consent_deadline as string) || "",
      checks: Array.isArray(r.checks) ? (r.checks as string[]) : JSON.parse(String(r.checks || "[]")),
    })),
  };
}

/** A released result, in the detail the app's results screen wants. */
export async function guardianCampResult(
  sql: Sql,
  profileId: string,
  campId: string,
  kidId: string
) {
  const pRows = await sql`
    SELECT p.*, k.name, sc.title, sc.date, s.name AS school_name
    FROM vita_hero.camp_participants p
    JOIN vita_hero.kids k ON k.id = p.kid_id
    JOIN vita_hero.school_camps sc ON sc.id = p.camp_id
    JOIN vita_hero.schools s ON s.id = sc.school_id
    WHERE p.camp_id = ${campId} AND p.kid_id = ${kidId} AND p.profile_id = ${profileId}
    LIMIT 1
  `;
  if (pRows.length === 0) throw new ApiError(404, "No result for that child at that camp", "NOT_FOUND");
  const p = pRows[0];
  if ((p.status as string) !== "RELEASED") {
    return { status: "PENDING", message: "Results are being reviewed by a doctor and will appear here soon." };
  }
  const fRows = await sql`
    SELECT check_type, flag, rationale, value_text FROM vita_hero.camp_findings
    WHERE camp_id = ${campId} AND kid_id = ${kidId} ORDER BY check_type
  `;
  return {
    status: "RELEASED",
    kidName: p.name as string,
    schoolName: p.school_name as string,
    campTitle: p.title as string,
    date: (p.date as string) || "",
    urgency: (p.urgency as string) || "NONE",
    recommendation: (p.recommendation as string) || "",
    findings: fRows.map((f) => ({
      checkType: f.check_type as string,
      flag: f.flag as string,
      summary: (f.value_text as string) || "",
      note: (f.rationale as string) || "",
    })),
  };
}

// ─── Dashboard ──────────────────────────────────────────────

export async function adminOverview(sql: Sql, actor: Actor) {
  const scoped = !isOpsRole(actor.role);
  const schoolId = actor.schoolId || "";

  const schools = scoped
    ? await sql`SELECT COUNT(*)::int AS n FROM vita_hero.schools WHERE id = ${schoolId}`
    : await sql`SELECT COUNT(*)::int AS n FROM vita_hero.schools WHERE active = true`;

  const students = scoped
    ? await sql`SELECT COUNT(*)::int AS n FROM vita_hero.kids WHERE school_id = ${schoolId}`
    : await sql`SELECT COUNT(*)::int AS n FROM vita_hero.kids WHERE source = 'ADMIN'`;

  const guardians = scoped
    ? await sql`SELECT COUNT(*)::int AS n FROM vita_hero.profiles WHERE role='PARENT' AND school_id = ${schoolId}`
    : await sql`SELECT COUNT(*)::int AS n FROM vita_hero.profiles WHERE role='PARENT' AND provisioned = true`;

  const activated = scoped
    ? await sql`SELECT COUNT(*)::int AS n FROM vita_hero.profiles WHERE role='PARENT' AND school_id = ${schoolId} AND is_logged_in = true`
    : await sql`SELECT COUNT(*)::int AS n FROM vita_hero.profiles WHERE role='PARENT' AND is_logged_in = true`;

  const camps = scoped
    ? await sql`
        SELECT status, COUNT(*)::int AS n FROM vita_hero.school_camps
        WHERE active = true AND school_id = ${schoolId} GROUP BY status`
    : await sql`
        SELECT status, COUNT(*)::int AS n FROM vita_hero.school_camps
        WHERE active = true GROUP BY status`;

  const upcoming = scoped
    ? await sql`
        SELECT sc.id, sc.title, sc.date, sc.status, s.name AS school_name,
          (SELECT COUNT(*)::int FROM vita_hero.camp_participants p WHERE p.camp_id = sc.id) AS participants,
          (SELECT COUNT(*)::int FROM vita_hero.camp_participants p WHERE p.camp_id = sc.id
             AND p.consent_status IN ('GRANTED','PAPER')) AS consented
        FROM vita_hero.school_camps sc JOIN vita_hero.schools s ON s.id = sc.school_id
        WHERE sc.active = true AND sc.school_id = ${schoolId} AND sc.status <> 'RELEASED'
        ORDER BY sc.date LIMIT 10`
    : await sql`
        SELECT sc.id, sc.title, sc.date, sc.status, s.name AS school_name,
          (SELECT COUNT(*)::int FROM vita_hero.camp_participants p WHERE p.camp_id = sc.id) AS participants,
          (SELECT COUNT(*)::int FROM vita_hero.camp_participants p WHERE p.camp_id = sc.id
             AND p.consent_status IN ('GRANTED','PAPER')) AS consented
        FROM vita_hero.school_camps sc JOIN vita_hero.schools s ON s.id = sc.school_id
        WHERE sc.active = true AND sc.status <> 'RELEASED'
        ORDER BY sc.date LIMIT 10`;

  const campStatus: Record<string, number> = {};
  for (const r of camps) campStatus[(r.status as string) || "DRAFT"] = (r.n as number) || 0;

  return {
    schools: (schools[0]?.n as number) || 0,
    students: (students[0]?.n as number) || 0,
    guardians: (guardians[0]?.n as number) || 0,
    guardiansActivated: (activated[0]?.n as number) || 0,
    campStatus,
    upcoming: upcoming.map((r) => ({
      id: r.id as string,
      title: r.title as string,
      date: (r.date as string) || "",
      status: (r.status as string) || "DRAFT",
      schoolName: (r.school_name as string) || "",
      participants: (r.participants as number) || 0,
      consented: (r.consented as number) || 0,
    })),
  };
}

// ─── Staff ──────────────────────────────────────────────────

/** A3 extended — screeners and physicians, provisioned like school admins. */
export async function addStaffMember(
  sql: Sql,
  actor: Actor,
  schoolId: string,
  body: Record<string, unknown>
) {
  assertSchoolAccess(actor, schoolId);
  const role = String(body.role || "").toUpperCase();
  if (!STAFF_ROLES.includes(role as (typeof STAFF_ROLES)[number])) {
    throw new ApiError(400, "Role must be SCREENER or PHYSICIAN", "BAD_ROLE");
  }
  const name = tidyName(String(body.name || ""));
  if (name.length < 2) throw new ApiError(400, "Name is required", "NAME_REQUIRED");
  const norm = normalizePhone(String(body.phone || ""));
  if (!norm) throw new ApiError(400, "Enter a valid mobile number", "BAD_PHONE");

  const profileId = `ph_${norm.last10}`;
  const existing = await sql`SELECT role FROM vita_hero.profiles WHERE id = ${profileId} LIMIT 1`;
  if (existing.length > 0) {
    const r = (existing[0].role as string) || "PARENT";
    if (r === "PARENT") {
      throw new ApiError(409, "That number is already registered as a parent", "PHONE_IS_PARENT");
    }
  }

  await sql`
    INSERT INTO vita_hero.profiles
      (id, user_id, phone, name, auth_provider, role, provisioned, school_id,
       is_logged_in, onboarding_complete, created_by)
    VALUES
      (${profileId}, ${profileId}, ${norm.e164}, ${name}, 'PHONE', ${role}, true, ${schoolId},
       false, true, ${actor.profileId})
    ON CONFLICT (id) DO UPDATE SET
      name = ${name}, phone = ${norm.e164}, role = ${role},
      school_id = ${schoolId}, provisioned = true
  `;
  return { staff: { profileId, name, phone: norm.e164, role, schoolId } };
}

export async function listStaff(sql: Sql, actor: Actor, schoolId: string) {
  assertSchoolAccess(actor, schoolId);
  const rows = await sql`
    SELECT id, name, phone, role, is_logged_in FROM vita_hero.profiles
    WHERE school_id = ${schoolId} AND role IN ('SCREENER','PHYSICIAN')
    ORDER BY role, name
  `;
  return {
    staff: rows.map((r) => ({
      profileId: r.id as string,
      name: (r.name as string) || "",
      phone: (r.phone as string) || "",
      role: r.role as string,
      hasSignedIn: r.is_logged_in === true,
    })),
  };
}

/** B8 — put a screener or physician on a specific camp. */
export async function assignCampStaff(
  sql: Sql,
  actor: Actor,
  campId: string,
  body: Record<string, unknown>
) {
  const access = await assertCampAccess(sql, actor, campId);
  assertCan(access.canSchedule, "assign staff to this camp");

  const profileId = String(body.profileId || "");
  const rows = await sql`
    SELECT id, role, school_id, name FROM vita_hero.profiles WHERE id = ${profileId} LIMIT 1
  `;
  if (rows.length === 0) throw new ApiError(404, "That person is not registered", "NOT_FOUND");
  const role = (rows[0].role as string) || "";
  if (role !== "SCREENER" && role !== "PHYSICIAN") {
    throw new ApiError(400, "Only screeners and physicians can be assigned to a camp", "BAD_ROLE");
  }
  if ((rows[0].school_id as string) !== (access.camp.school_id as string)) {
    throw new ApiError(403, "That person belongs to a different school", "WRONG_SCHOOL");
  }

  await sql`
    INSERT INTO vita_hero.camp_staff (id, camp_id, profile_id, staff_role)
    VALUES (${"cst_" + campId.slice(-10) + "_" + slugify(profileId).slice(0, 16)}, ${campId}, ${profileId}, ${role})
    ON CONFLICT (camp_id, profile_id) DO UPDATE SET staff_role = EXCLUDED.staff_role
  `;
  return { assigned: { profileId, name: rows[0].name as string, role } };
}

export async function removeCampStaff(sql: Sql, actor: Actor, campId: string, profileId: string) {
  const access = await assertCampAccess(sql, actor, campId);
  assertCan(access.canSchedule, "change staff on this camp");
  await sql`DELETE FROM vita_hero.camp_staff WHERE camp_id = ${campId} AND profile_id = ${profileId}`;
  return { removed: profileId };
}
