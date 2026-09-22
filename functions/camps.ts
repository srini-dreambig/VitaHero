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
  insertRows,
  isOpsRole,
  normalizeMobile,
  normalizePhone,
  slugify,
  tidyName,
} from "./common";
import { SmsSender, sendToMany } from "./messaging";
import { Actor, ApiError, assertSchoolAccess } from "./schools";
import { openReferralsForCamp } from "./referrals";
import { logRecordAccess } from "./oversight";
import {
  CHECK_TYPES,
  Flag,
  Urgency,
  draftRecommendation,
  isCheckType,
  normaliseSpecialty,
  proposeFlag,
  screeningChecksFor,
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
  // Off by default and for almost every camp; see media.ts.
  await sql`ALTER TABLE vita_hero.school_camps ADD COLUMN IF NOT EXISTS photos_enabled BOOLEAN DEFAULT false`;
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
  // Revoked rather than deleted. A camp ends and the doctor's access to it
  // ends with it, but "Dr Iyer screened at Oakridge in September" is part of
  // the clinical record and must survive the revocation. It is also what lets
  // the console show a doctor every camp they have been on, active or not.
  await sql`ALTER TABLE vita_hero.camp_staff ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true`;
  await sql`ALTER TABLE vita_hero.camp_staff ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ`;
  await sql`ALTER TABLE vita_hero.camp_staff ADD COLUMN IF NOT EXISTS revoked_by TEXT DEFAULT ''`;
  // The directory entry and the login are the same person.
  await sql`ALTER TABLE vita_hero.camp_staff ADD COLUMN IF NOT EXISTS doctor_id TEXT`;

  // 'UPCOMING' predates the camp lifecycle and is not one of CAMP_STATUSES, so
  // a camp carrying it could be listed but never advanced: no consent round,
  // no camp day, no release. It means the same thing as SCHEDULED, so it
  // becomes that. The column default moves to DRAFT, which is where a camp the
  // lifecycle created actually starts.
  await sql`UPDATE vita_hero.school_camps SET status = 'SCHEDULED' WHERE status = 'UPCOMING'`;
  await sql`ALTER TABLE vita_hero.school_camps ALTER COLUMN status SET DEFAULT 'DRAFT'`;

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
  // Photography is asked for separately from the check-up itself. The column
  // lives here, with the rest of the participant row, so recordConsent can
  // always write it; media.ts is what actually reads it.
  await sql`ALTER TABLE vita_hero.camp_participants ADD COLUMN IF NOT EXISTS consent_photos BOOLEAN DEFAULT false`;
  // What has already been asked of this guardian about this camp, so a second
  // click on "remind everyone" does not text the school again.
  await sql`ALTER TABLE vita_hero.camp_participants ADD COLUMN IF NOT EXISTS consent_reminded_at TIMESTAMPTZ`;
  await sql`ALTER TABLE vita_hero.camp_participants ADD COLUMN IF NOT EXISTS consent_reminder_count INT DEFAULT 0`;
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
  /**
   * May look at clinical records: the review queue, a child's findings, the
   * offline pack.
   *
   * Separate from canScreen and canReview because reading and writing are
   * now different questions. Recording a measurement and signing one off
   * belong to the clinicians at the camp; seeing what the programme found
   * belongs to whoever runs it. Collapsing the two took the review queue
   * away from operations along with the approve button, which is oversight
   * removed by accident.
   */
  canViewClinical: boolean;
  /**
   * The checks this person may record, or null for "all of them".
   *
   * Null is ops, a school administrator, and a screener: a generalist doing
   * the whole round. A doctor assigned from the directory is scoped to their
   * specialty — an ophthalmologist gets the vision form and not the dental
   * one — because handing every clinician every form is how a dentist ends up
   * entering a haemoglobin reading they did not take.
   */
  checkScope: string[] | null;
  /** The specialty that scope came from, for saying so on screen. */
  specialty: string;
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

  // Organising a camp and screening at one are different jobs, and only the
  // second is clinical. Operations and a school's administrator run the
  // programme — they build the roster, chase consent, read the report — and
  // they no longer record, sign off or release a finding. Asked for directly:
  // clinicians only, and only from the app.
  //
  // Note this is not the same gate as the surface check in index.ts, and
  // both are wanted. This one says a school administrator is the wrong
  // person; that one says the console is the wrong place. A physician using
  // the console fails the second; an administrator using the app fails this.
  if (isOpsRole(actor.role)) {
    return {
      camp, canSchedule: true, canScreen: false, canReview: false,
      canViewClinical: true, checkScope: null, specialty: "",
    };
  }
  if (actor.role === "SCHOOL_ADMIN" && actor.schoolId === schoolId) {
    return {
      camp, canSchedule: true, canScreen: false, canReview: false,
      canViewClinical: true, checkScope: null, specialty: "",
    };
  }

  const staff = await sql`
    SELECT staff_role, active, doctor_id FROM vita_hero.camp_staff
    WHERE camp_id = ${campId} AND profile_id = ${actor.profileId} LIMIT 1
  `;
  if (staff.length === 0) {
    throw new ApiError(403, "You are not assigned to this camp", "CAMP_FORBIDDEN");
  }
  // A revoked assignment is not a missing one, and the difference matters to
  // whoever is standing in the hall being told no.
  if (staff[0].active === false) {
    throw new ApiError(
      403,
      "Your access to this camp has ended. Ask the school to restore it if this is wrong.",
      "CAMP_REVOKED"
    );
  }
  const staffRole = staff[0].staff_role as string;

  // doctor_id is set only when this person was put on the camp from the
  // directory, which is also the only place a specialty is recorded. Looked up
  // separately rather than joined: camp access must not depend on the
  // directory existing, and this costs a second round trip only for the one
  // case that needs it.
  const doctorId = (staff[0].doctor_id as string) || "";
  let specialty = "";
  if (doctorId) {
    const d = await sql`SELECT specialty FROM vita_hero.doctors WHERE id = ${doctorId} LIMIT 1`;
    specialty = normaliseSpecialty(String(d[0]?.specialty || ""));
  }
  return {
    camp,
    canSchedule: false,
    canScreen: staffRole === "SCREENER" || staffRole === "PHYSICIAN",
    canReview: staffRole === "PHYSICIAN",
    canViewClinical: true,
    // A screener is the school's own generalist and has no specialty; a
    // directory doctor does, and it decides which forms they see.
    checkScope: specialty ? screeningChecksFor(specialty) : null,
    specialty,
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
    photosEnabled: r.photos_enabled === true,
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
    JOIN vita_hero.school_camps sc ON sc.id = cs.camp_id AND cs.active = true
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
  // The tallies and the assigned staff are independent; one wait.
  const [counts, staff] = await Promise.all([
    sql`
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
    `,
    sql`
      SELECT cs.profile_id, cs.staff_role, cs.active, cs.doctor_id, cs.revoked_at,
             p.name, p.phone
      FROM vita_hero.camp_staff cs
      LEFT JOIN vita_hero.profiles p ON p.id = cs.profile_id
      WHERE cs.camp_id = ${campId}
      ORDER BY cs.active DESC, cs.staff_role, p.name
    `,
  ]);
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
      // Revoked assignments stay on the list, marked. They are how the school
      // knows who screened at this camp after access has ended.
      active: s.active !== false,
      doctorId: (s.doctor_id as string) || "",
      revokedAt: s.revoked_at ? new Date(s.revoked_at as string).toISOString() : "",
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

  // Who is eligible and who is already on the camp are two independent reads,
  // and the diff between them needs both anyway; one wait.
  const [eligible, existing] = await Promise.all([
    sql`
      SELECT k.id, k.profile_id
      FROM vita_hero.kids k
      WHERE k.school_id = ${schoolId}
        AND (k.academic_year = ${year} OR COALESCE(k.academic_year,'') = '')
        AND k.grade = ANY(${grades})
        AND (${sections.length === 0} OR COALESCE(k.section,'') = ANY(${sections}))
    `,

    sql`
      SELECT kid_id, status, consent_status FROM vita_hero.camp_participants WHERE camp_id = ${campId}
    `,
  ]);
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
  //
  // One statement, not one per child. Usually this removes a handful, but after
  // a year rollover or a change to the camp's classes it can be the whole
  // roster, and a delete per child is the same fan-out that made releasing a
  // camp impossible: on Cloudflare each one is an outbound subrequest against a
  // hard cap.
  const toRemove = existing
    .filter((row) => !eligibleIds.has(row.kid_id as string))
    .filter((row) => (row.status as string) === "NOT_SCREENED" && (row.consent_status as string) === "PENDING")
    .map((row) => row.kid_id as string);

  let removed = 0;
  for (const group of chunk(toRemove, 500)) {
    const gone = await sql`
      DELETE FROM vita_hero.camp_participants
      WHERE camp_id = ${campId} AND kid_id = ANY(${group})
      RETURNING kid_id
    `;
    removed += gone.length;
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
           pr.is_logged_in AS guardian_using_app, pr.id AS guardian_profile_id,
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
    can: {
      schedule: access.canSchedule,
      screen: access.canScreen,
      review: access.canReview,
      // Reading the clinical record, which is not the same as writing one.
      // The console shows the queue and a child's findings to whoever runs
      // the programme; only a camp's clinicians, on the app, change them.
      viewClinical: access.canViewClinical,
    },
    photosEnabled: access.camp.photos_enabled === true,
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
      guardianProfileId: (r.guardian_profile_id as string) || "",
      // Whether this guardian can actually open a consent request. A reminder
      // to somebody who has never installed the app is a wasted text.
      guardianUsingApp: r.guardian_using_app === true,
      consentStatus: (r.consent_status as string) || "PENDING",
      consentPhotos: r.consent_photos === true,
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
  sendSms: SmsSender,
  appOrigin: string,
  opts: { profileIds?: string[] } = {}
) {
  const access = await assertCampAccess(sql, actor, campId);
  assertCan(access.canSchedule, "request consent for this camp");
  const camp = access.camp;

  // Optionally narrowed to named guardians. Chasing one family who has not
  // replied should not re-text the forty who already have.
  const picked = Array.isArray(opts.profileIds) ? opts.profileIds.filter(Boolean) : [];

  const rows = await sql`
    SELECT DISTINCT p.profile_id, pr.phone, pr.name
    FROM vita_hero.camp_participants p
    JOIN vita_hero.profiles pr ON pr.id = p.profile_id
    WHERE p.camp_id = ${campId} AND p.consent_status = 'PENDING' AND COALESCE(pr.phone,'') <> ''
      AND (${picked.length === 0} OR p.profile_id = ANY(${picked}))
      -- Reminding everyone is throttled; reminding one named guardian is a
      -- deliberate act by someone who has just spoken to them, and is not.
      AND (${picked.length > 0}
           OR ((p.consent_reminded_at IS NULL
                OR p.consent_reminded_at < NOW() - INTERVAL '2 days')
               AND COALESCE(p.consent_reminder_count, 0) < 3))
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

  const outcome = await sendToMany(
    sendSms,
    rows.map((r) => ({ id: r.profile_id as string, phone: r.phone as string })),
    () => message
  );
  const sent = outcome.sent.length;

  // One statement for everyone reached. It also gives this the restraint the
  // referral nudge already had and this did not: nothing recorded that a
  // guardian had been reminded, so an operator clicking the button twice
  // texted a whole school's waiting families twice, immediately, with no cap
  // and no interval.
  if (outcome.sent.length > 0) {
    await sql`
      UPDATE vita_hero.camp_participants
      SET consent_reminded_at = NOW(),
          consent_reminder_count = COALESCE(consent_reminder_count, 0) + 1
      WHERE camp_id = ${campId} AND profile_id = ANY(${outcome.sent})
    `;
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
  opts: {
    actorId: string;
    source: string;
    checks?: string[];
    note?: string;
    profileId?: string;
    /**
     * Photography is a separate question. Absent means "not asked", which is
     * not the same as "yes" — it stays false. Declining the check-up clears it,
     * because there is nothing left to photograph.
     */
    consentPhotos?: boolean;
  }
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
  const photos = decision === "DECLINED" ? false : opts.consentPhotos === true;
  await sql`
    UPDATE vita_hero.camp_participants
    SET consent_status = ${decision},
        consent_checks = ${JSON.stringify(checks)}::jsonb,
        consent_photos = ${photos},
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
  return { kidId, consentStatus: decision, consentPhotos: photos };
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
  assertCan(access.canViewClinical, "see this camp's records");
  // K6. Opening a screening form is a read of a child's medical record, and is
  // logged as one. Best-effort by design — see logRecordAccess.
  await logRecordAccess(sql, actor, {
    kidId, campId, schoolId: (access.camp.school_id as string) || "", surface: "SCREENING",
  });

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
  const consented = consentChecks.length > 0 ? campChecks.filter((c) => consentChecks.includes(c)) : campChecks;

  // And the clinician's specialty narrows it again. An ophthalmologist at this
  // camp records the vision check; the dental one is somebody else's round and
  // showing it to them invites a reading nobody took.
  const allowed = access.checkScope
    ? consented.filter((c) => access.checkScope!.includes(c))
    : consented;

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
    // Both must be true before the console offers a camera at all, and the
    // server checks them again on upload.
    photosEnabled: access.camp.photos_enabled === true,
    consentPhotos: p.consent_photos === true,
    attendance: (p.attendance as string) || "UNKNOWN",
    status: (p.status as string) || "NOT_SCREENED",
    checks: allowed,
    excludedByConsent: campChecks.filter((c) => !consented.includes(c)),
    // What this camp offers that belongs to another specialty. Named rather
    // than hidden: a doctor who cannot see the dental check needs to know it
    // is somebody else's to do, not that the camp forgot it.
    otherSpecialties: consented.filter((c) => !allowed.includes(c)),
    // Whose round this is, so the screen can say so.
    specialty: access.specialty,
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
/** One finding, decided but not yet written. */
interface EvaluatedFinding {
  id: string;
  checkType: string;
  detail: Record<string, unknown>;
  valueNum: number | null;
  valueText: string;
  autoFlag: Flag;
  flag: Flag;
  rationale: string;
  urgency: string;
  note: string;
}

/**
 * Everything that decides what a child's findings become, with no database in
 * it: consent, what the camp offers, the flag the measurement proposes, and a
 * screener's override of it.
 *
 * Shared by the one-child form and the offline queue, because the rules a camp
 * day is judged by must not depend on whether there was signal in the hall.
 * They used to be written once and called in a loop, which was the same rules
 * but 2338 statements for a 200-child camp — more than the platform allows, so
 * a full school's screening could not be synced at all.
 */
function evaluateChild(
  campId: string,
  kidId: string,
  participant: Record<string, unknown>,
  campChecks: string[],
  incoming: Record<string, unknown>[],
  actorId: string,
  /**
   * The clinician's own round, or null for a generalist.
   *
   * A parameter rather than a lookup, because this function is also the offline
   * queue's path: the rules a camp day is judged by must not depend on whether
   * there was signal in the hall, and a doctor's specialty is one of those
   * rules now.
   */
  scope: { checks: string[] | null; specialty: string } = { checks: null, specialty: "" }
): EvaluatedFinding[] {
  const consent = (participant.consent_status as string) || "PENDING";
  if (consent !== "GRANTED" && consent !== "PAPER") {
    throw new ApiError(
      403,
      consent === "DECLINED"
        ? "This guardian declined consent for this camp"
        : "No consent on file for this child yet",
      "NO_CONSENT"
    );
  }
  if ((participant.status as string) === "RELEASED") {
    throw new ApiError(409, "This child's results have already been released", "RELEASED");
  }

  const consentChecks: string[] = Array.isArray(participant.consent_checks)
    ? (participant.consent_checks as string[])
    : JSON.parse(String(participant.consent_checks || "[]"));
  const allowed = consentChecks.length > 0
    ? campChecks.filter((c) => consentChecks.includes(c))
    : campChecks;

  const ctx = {
    ageYears: Number(participant.age) || 0,
    gender: String(participant.gender || ""),
  };

  const out: EvaluatedFinding[] = [];
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
    // Enforced here and not only by the form that hides it. The screening form
    // is offline-capable and posts a queue, so "the UI did not offer it" is
    // not a control — a stale pack on somebody's tablet would carry the whole
    // camp's checks and be accepted on sync.
    if (scope.checks && !scope.checks.includes(checkType)) {
      throw new ApiError(
        403,
        scope.specialty
          ? `"${checkType}" is not part of ${scope.specialty}. Another clinician at this camp records it.`
          : `"${checkType}" is not yours to record at this camp`,
        "CHECK_NOT_MY_SPECIALTY"
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

    out.push({
      id: `cf_${campId.slice(-10)}_${slugify(kidId).slice(0, 16)}_${slugify(checkType)}`,
      checkType,
      detail,
      valueNum: proposal.valueNum,
      valueText: proposal.valueText,
      autoFlag: proposal.flag,
      flag,
      rationale: proposal.rationale,
      urgency: proposal.urgency,
      note,
    });
  }
  return out;
}

/** One child's captures, already judged, waiting to be written. */
interface PreparedChild {
  kidId: string;
  findings: EvaluatedFinding[];
  attendance: string;
}

/**
 * Write a whole camp day at once.
 *
 * The cost is a handful of statements per hundred children rather than eleven
 * per child, which is the difference between a school's morning syncing and
 * being cut off by the platform partway through.
 */
async function writeScreenings(
  sql: Sql,
  actor: Actor,
  campId: string,
  children: PreparedChild[]
): Promise<void> {
  const rows = children.flatMap((c) =>
    c.findings.map((f) => [
      f.id, campId, c.kidId, f.checkType, JSON.stringify(f.detail),
      f.valueNum, f.valueText, f.autoFlag, f.flag, f.rationale, f.urgency,
      f.note, actor.profileId,
    ])
  );
  await insertRows(
    sql,
    `INSERT INTO vita_hero.camp_findings
       (id, camp_id, kid_id, check_type, detail, value_num, value_text,
        auto_flag, flag, rationale, urgency, screener_note, recorded_by, recorded_at)
     SELECT v.id, v.camp_id, v.kid_id, v.check_type, v.detail::jsonb,
            v.value_num::double precision, v.value_text, v.auto_flag, v.flag,
            v.rationale, v.urgency, v.screener_note, v.recorded_by, NOW()
     FROM (VALUES %VALUES%) AS v(id, camp_id, kid_id, check_type, detail, value_num,
            value_text, auto_flag, flag, rationale, urgency, screener_note, recorded_by)
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
       recorded_at = NOW()`,
    rows
  );

  // Attendance, grouped by what it was set to: three statements at most,
  // whatever the size of the camp.
  for (const value of ATTENDANCE) {
    const ids = children.filter((c) => c.attendance === value).map((c) => c.kidId);
    if (ids.length === 0) continue;
    await sql`
      UPDATE vita_hero.camp_participants SET attendance = ${value}
      WHERE camp_id = ${campId} AND kid_id = ANY(${ids})
    `;
  }

  const screened = children.filter((c) => c.findings.length > 0).map((c) => c.kidId);
  if (screened.length > 0) {
    await sql`
      UPDATE vita_hero.camp_participants
      SET status = CASE WHEN status IN ('APPROVED','RELEASED') THEN status ELSE 'SCREENED' END,
          attendance = CASE WHEN attendance = 'UNKNOWN' THEN 'PRESENT' ELSE attendance END,
          screened_at = NOW(),
          screened_by = ${actor.profileId}
      WHERE camp_id = ${campId} AND kid_id = ANY(${screened})
    `;
  }

  await sql`
    UPDATE vita_hero.school_camps SET status = 'IN_PROGRESS'
    WHERE id = ${campId} AND status IN ('DRAFT','SCHEDULED')
  `;
}

/** The camp's participants, keyed by child, for the children in one batch. */
async function participantsFor(sql: Sql, campId: string, kidIds: string[]) {
  const rows = await sql`
    SELECT p.*, k.age, k.gender, k.name, k.date_of_birth
    FROM vita_hero.camp_participants p
    JOIN vita_hero.kids k ON k.id = p.kid_id
    WHERE p.camp_id = ${campId} AND p.kid_id = ANY(${kidIds})
  `;
  const byKid = new Map<string, Record<string, unknown>>();
  for (const r of rows) byKid.set(r.kid_id as string, r);
  return byKid;
}

function campCheckList(camp: Record<string, unknown>): string[] {
  return Array.isArray(camp.checks)
    ? (camp.checks as string[])
    : JSON.parse(String(camp.checks || "[]"));
}

export async function saveScreening(
  sql: Sql,
  actor: Actor,
  campId: string,
  kidId: string,
  body: Record<string, unknown>
) {
  const access = await assertCampAccess(sql, actor, campId);
  assertCan(access.canScreen, "screen children at this camp");

  const incoming = Array.isArray(body.findings) ? (body.findings as Record<string, unknown>[]) : [];
  if (incoming.length === 0) throw new ApiError(400, "No findings submitted", "NO_FINDINGS");

  const byKid = await participantsFor(sql, campId, [kidId]);
  const p = byKid.get(kidId);
  if (!p) throw new ApiError(404, "That child is not on this camp's list", "NOT_ON_CAMP");

  const findings = evaluateChild(campId, kidId, p, campCheckList(access.camp), incoming,
    actor.profileId, { checks: access.checkScope, specialty: access.specialty });
  await writeScreenings(sql, actor, campId, [{ kidId, findings, attendance: "" }]);

  return {
    kidId,
    saved: findings.map((f) => ({ checkType: f.checkType, flag: f.flag, rationale: f.rationale })),
  };
}

/**
 * C1 — everything a screener needs for a whole camp, in one request.
 *
 * School halls do not have reliable connectivity, so the console downloads this
 * before the camp starts and works from it. It carries the camp's config, every
 * participant with their consent state, and any findings already recorded, so
 * a device that has been offline all morning still shows the truth as of the
 * last sync.
 */
export async function campPack(sql: Sql, actor: Actor, campId: string) {
  const access = await assertCampAccess(sql, actor, campId);
  assertCan(access.canViewClinical, "see this camp's records");
  const camp = access.camp;

  // The roll and the findings already recorded against it are independent, so
  // a screener on a school's wifi waits once for the pack, not twice.
  const [participants, findings] = await Promise.all([
    sql`
      SELECT p.kid_id, p.consent_status, p.consent_checks, p.attendance, p.status,
             k.name, k.grade, k.section, k.gender, k.age, k.date_of_birth, k.student_ref,
             k.guardian_name, k.height_cm AS prev_height, k.weight_kg AS prev_weight
      FROM vita_hero.camp_participants p
      JOIN vita_hero.kids k ON k.id = p.kid_id
      WHERE p.camp_id = ${campId}
      ORDER BY k.grade, k.section, k.name
    `,
    sql`
      SELECT kid_id, check_type, detail, flag, rationale, screener_note
      FROM vita_hero.camp_findings WHERE camp_id = ${campId}
    `,
  ]);

  const byKid = new Map<string, Array<Record<string, unknown>>>();
  for (const f of findings) {
    const k = f.kid_id as string;
    const list = byKid.get(k) || [];
    list.push({
      checkType: f.check_type as string,
      detail: (f.detail as Record<string, unknown>) || {},
      flag: f.flag as string,
      rationale: (f.rationale as string) || "",
      note: (f.screener_note as string) || "",
    });
    byKid.set(k, list);
  }

  const campChecks: string[] = Array.isArray(camp.checks)
    ? (camp.checks as string[])
    : JSON.parse(String(camp.checks || "[]"));

  return {
    downloadedAt: new Date().toISOString(),
    camp: {
      id: campId,
      title: camp.title as string,
      date: (camp.date as string) || "",
      venue: (camp.venue as string) || "",
      schoolName: (camp.school_name as string) || "",
      checks: campChecks,
      // The pack is what a camp day runs on with no signal, so it carries the
      // same specialty scope the online form uses. Without it, downloading a
      // camp would quietly widen a doctor back out to every check and the sync
      // would then reject half of what they had recorded — at the end of the
      // day, with the children gone home.
      specialty: access.specialty,
      otherSpecialties: access.checkScope
        ? campChecks.filter((c) => !access.checkScope!.includes(c))
        : [],
    },
    participants: participants.map((p) => {
      const consentChecks: string[] = Array.isArray(p.consent_checks)
        ? (p.consent_checks as string[])
        : JSON.parse(String(p.consent_checks || "[]"));
      return {
        kidId: p.kid_id as string,
        name: p.name as string,
        grade: (p.grade as string) || "",
        section: (p.section as string) || "",
        gender: (p.gender as string) || "",
        age: (p.age as number) ?? null,
        dob: (p.date_of_birth as string) || "",
        studentRef: (p.student_ref as string) || "",
        guardianName: (p.guardian_name as string) || "",
        consentStatus: (p.consent_status as string) || "PENDING",
        attendance: (p.attendance as string) || "UNKNOWN",
        status: (p.status as string) || "NOT_SCREENED",
        previousHeightCm: (p.prev_height as number) || null,
        previousWeightKg: (p.prev_weight as number) || null,
        // Partial consent narrows the checks for this child, and the
        // clinician's specialty narrows them again.
        checks: (consentChecks.length > 0
          ? campChecks.filter((c) => consentChecks.includes(c))
          : campChecks
        ).filter((c) => !access.checkScope || access.checkScope.includes(c)),
        findings: byKid.get(p.kid_id as string) || [],
      };
    }),
  };
}

/**
 * C11 — apply a batch of offline captures.
 *
 * Every entry is applied independently and reported on independently: one
 * child whose consent was withdrawn while the device was offline must not
 * discard the other forty-nine the screener recorded. The server stays
 * authoritative on consent, so a queued finding for a child who has since
 * declined is rejected rather than written.
 */
/**
 * A whole offline queue, applied in one go.
 *
 * Every child is judged on its own so one refusal — a guardian who withdrew
 * consent while the screener was in the hall — does not take the morning's
 * other captures with it. What survives that is written together.
 */
export async function saveScreeningBulk(
  sql: Sql,
  actor: Actor,
  campId: string,
  entries: Array<Record<string, unknown>>
) {
  const access = await assertCampAccess(sql, actor, campId);
  assertCan(access.canScreen, "screen children at this camp");

  const applied: Array<{ kidId: string; saved: number }> = [];
  const rejected: Array<{ kidId: string; reason: string; code: string }> = [];
  const prepared: PreparedChild[] = [];

  const wanted = entries.map((e) => String(e.kidId || "")).filter(Boolean);
  const byKid = await participantsFor(sql, campId, wanted);
  const campChecks = campCheckList(access.camp);

  for (const entry of entries) {
    const kidId = String(entry.kidId || "");
    if (!kidId) continue;
    try {
      const p = byKid.get(kidId);
      if (!p) throw new ApiError(404, "That child is not on this camp's list", "NOT_ON_CAMP");

      let attendance = "";
      if (entry.attendance) {
        attendance = String(entry.attendance).toUpperCase();
        if (!ATTENDANCE.includes(attendance as (typeof ATTENDANCE)[number])) {
          throw new ApiError(400, "Attendance must be PRESENT, ABSENT or REFUSED", "BAD_ATTENDANCE");
        }
      }

      const incoming = Array.isArray(entry.findings) ? (entry.findings as Record<string, unknown>[]) : [];
      const findings = incoming.length > 0
        ? evaluateChild(campId, kidId, p, campChecks, incoming, actor.profileId,
            { checks: access.checkScope, specialty: access.specialty })
        : [];

      // An entry that says nothing is not a capture. It used to be dropped
      // here without being applied or rejected — and the console keeps only
      // what was refused, so it was deleted from the queue having never been
      // written anywhere.
      if (findings.length === 0 && !attendance) {
        throw new ApiError(400, "Nothing recorded for this child", "NO_FINDINGS");
      }

      prepared.push({ kidId, findings, attendance });
      applied.push({ kidId, saved: findings.length });
    } catch (e) {
      const err = e as ApiError;
      rejected.push({
        kidId,
        reason: err.message || "Could not save",
        code: err.code || "ERROR",
      });
    }
  }

  if (prepared.length > 0) await writeScreenings(sql, actor, campId, prepared);

  return { applied: applied.length, rejected, appliedDetail: applied };
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
  assertCan(access.canViewClinical, "see this camp's records");

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
  assertCan(access.canViewClinical, "see this camp's records");
  await logRecordAccess(sql, actor, {
    kidId, campId, schoolId: (access.camp.school_id as string) || "", surface: "CLINICAL_REVIEW",
  });

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

  // I4 — the same flag at a previous camp changes what this one means. Pull the
  // child's earlier released findings so the physician is not deciding blind.
  const priorRows = await sql`
    SELECT f.check_type, f.flag, sc.date, sc.title
    FROM vita_hero.camp_findings f
    JOIN vita_hero.school_camps sc ON sc.id = f.camp_id
    JOIN vita_hero.camp_participants pp ON pp.camp_id = f.camp_id AND pp.kid_id = f.kid_id
    WHERE f.kid_id = ${kidId} AND f.camp_id <> ${campId}
      AND pp.status = 'RELEASED' AND f.flag IN ('WATCH','ALERT')
    ORDER BY sc.date DESC
  `;
  const priorByCheck = new Map<string, Array<{ flag: string; date: string; title: string }>>();
  for (const r of priorRows) {
    const key = r.check_type as string;
    const list = priorByCheck.get(key) || [];
    list.push({ flag: r.flag as string, date: (r.date as string) || "", title: (r.title as string) || "" });
    priorByCheck.set(key, list);
  }
  for (const f of findings) {
    (f as Record<string, unknown>).previous = priorByCheck.get(f.checkType) || [];
    (f as Record<string, unknown>).recurring =
      (f.flag === "WATCH" || f.flag === "ALERT") && (priorByCheck.get(f.checkType) || []).length > 0;
  }
  const recurring = findings.filter((f) => (f as Record<string, unknown>).recurring);

  const summary = summariseForApp(findings);
  // A problem that did not resolve since the last camp warrants moving faster.
  if (recurring.length > 0 && (summary.urgency === "NONE" || summary.urgency === "ROUTINE")) {
    summary.urgency = "SOON";
  }
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
    recurring: recurring.map((f) => ({
      checkType: f.checkType,
      timesBefore: ((f as Record<string, unknown>).previous as unknown[]).length,
    })),
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
  body: Record<string, unknown>,
  sendSms?: SmsSender
) {
  const access = await assertCampAccess(sql, actor, campId);
  assertCan(access.canReview, "review results for this camp");

  const pRows = await sql`
    SELECT status, urgency FROM vita_hero.camp_participants
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

  const wasUrgent = (pRows[0].urgency as string) === "URGENT";

  await sql`
    UPDATE vita_hero.camp_participants
    SET status = 'APPROVED', urgency = ${urgency}, recommendation = ${recommendation},
        reviewed_at = NOW(), reviewed_by = ${actor.profileId}
    WHERE camp_id = ${campId} AND kid_id = ${kidId}
  `;

  // D4 — an urgent case is told now, not batched with everyone else at release.
  // Waiting for the whole camp to be reviewed could be days.
  let escalated = false;
  if (urgency === "URGENT" && !wasUrgent && sendSms) {
    const who = await sql`
      SELECT k.name, pr.phone, s.name AS school_name
      FROM vita_hero.camp_participants p
      JOIN vita_hero.kids k ON k.id = p.kid_id
      LEFT JOIN vita_hero.profiles pr ON pr.id = p.profile_id
      LEFT JOIN vita_hero.school_camps sc ON sc.id = p.camp_id
      LEFT JOIN vita_hero.schools s ON s.id = sc.school_id
      WHERE p.camp_id = ${campId} AND p.kid_id = ${kidId} LIMIT 1
    `;
    const phone = (who[0]?.phone as string) || "";
    if (phone) {
      escalated = (await sendSms(
        phone,
        "VitaHero: the doctor reviewing " + String(who[0]?.name || "your child") +
          "'s school health check-up has flagged something that needs attention within a few days. " +
          "Please open the VitaHero app, or call the school."
      )).ok;
    }
    await sql`
      INSERT INTO vita_hero.consent_log (id, camp_id, kid_id, profile_id, action, source, actor_id, note)
      SELECT ${"esc_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)},
             ${campId}, ${kidId}, p.profile_id, 'URGENT_ESCALATED', 'SMS', ${actor.profileId},
             ${escalated ? "Guardian notified immediately" : "No mobile on file — school must call"}
      FROM vita_hero.camp_participants p WHERE p.camp_id = ${campId} AND p.kid_id = ${kidId}
    `;
  }

  return { kidId, status: "APPROVED", urgency, escalated };
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
/**
 * Publish a camp's approved results to the families.
 *
 * This is the moment the whole programme exists for, and it used to be written
 * as a loop over children with seven sequential statements inside it: read that
 * child's findings, write the app's result row, update the child, add a growth
 * point, add a registration, enrol the guardian, open referrals, mark released.
 *
 * On Cloudflare every one of those is an outbound subrequest, and the platform
 * allows 50 on the free plan and 1000 on the paid one. A camp of forty children
 * blew the free limit; around a hundred and forty blew the paid one. Long
 * before either, the wall time did it — a few hundred sequential round trips to
 * Neon is minutes, not milliseconds. So "release the results" worked on the
 * handful of children a demo has and failed on a real school, which is the
 * worst possible shape for a bug to have.
 *
 * It is the same fan-out problem the schema migration had, and the fix is the
 * same one `buildCampRoster` and `commitRoster` already use: read everything
 * once, decide in memory, and write in batches. A camp of five hundred children
 * now costs about thirty statements instead of three and a half thousand.
 */
export async function releaseCamp(
  sql: Sql,
  actor: Actor,
  campId: string,
  sendSms: SmsSender
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
  const schoolId = camp.school_id as string;

  // Every finding for the camp in one read, then grouped by child. This single
  // query replaces one per child.
  const allFindings = await sql`
    SELECT kid_id, check_type, flag, urgency, detail, rationale
    FROM vita_hero.camp_findings WHERE camp_id = ${campId}
  `;
  const findingsByKid = new Map<string, Array<{
    checkType: string; flag: Flag; urgency: Urgency;
    detail: Record<string, unknown>; rationale: string;
  }>>();
  for (const f of allFindings) {
    const kidId = f.kid_id as string;
    const list = findingsByKid.get(kidId) || [];
    list.push({
      checkType: f.check_type as string,
      flag: f.flag as Flag,
      urgency: (f.urgency as Urgency) || "NONE",
      detail: (f.detail as Record<string, unknown>) || {},
      rationale: (f.rationale as string) || "",
    });
    findingsByKid.set(kidId, list);
  }

  // Everything each child needs written, worked out before anything is written.
  const plan = approved.map((row) => {
    const kidId = row.kid_id as string;
    const findings = findingsByKid.get(kidId) || [];
    return {
      kidId,
      profileId: row.profile_id as string,
      urgency: (row.urgency as Urgency) || "NONE",
      findings,
      summary: summariseForApp(findings),
    };
  });

  /** Send one batched statement per hundred rows. */
  const writeBatched = async (
    rows: unknown[][],
    build: (values: string, count: number) => string
  ): Promise<void> => {
    if (rows.length === 0) return;
    const width = rows[0].length;
    for (const group of chunk(rows, 100)) {
      const values = group
        .map((_, i) => `(${Array.from({ length: width }, (_, k) => "$" + (i * width + k + 1)).join(", ")})`)
        .join(", ");
      await sql.query(build(values, group.length), group.flat());
    }
  };

  // The parent app's camp result row.
  await writeBatched(
    plan.map((p) => [
      `ckr_${campId.slice(-10)}_${slugify(p.kidId).slice(0, 20)}`,
      p.profileId, campId, p.kidId,
      p.summary.dental, p.summary.eyesight, p.summary.nutrition,
      p.summary.heightCm, p.summary.weightKg,
    ]),
    (values) => `
      INSERT INTO vita_hero.camp_kid_results
        (id, profile_id, school_camp_id, kid_id, dental, eyesight, nutrition, height_cm, weight_kg, recorded_at)
      SELECT v.id, v.profile_id, v.school_camp_id, v.kid_id, v.dental, v.eyesight, v.nutrition,
             v.height_cm::numeric, v.weight_kg::numeric, NOW()
      FROM (VALUES ${values}) AS v(id, profile_id, school_camp_id, kid_id, dental, eyesight, nutrition, height_cm, weight_kg)
      ON CONFLICT (school_camp_id, kid_id) DO UPDATE SET
        dental = EXCLUDED.dental, eyesight = EXCLUDED.eyesight, nutrition = EXCLUDED.nutrition,
        height_cm = EXCLUDED.height_cm, weight_kg = EXCLUDED.weight_kg, recorded_at = NOW()`
  );

  // The child's headline flags, as the app reads them.
  await writeBatched(
    plan.map((p) => [
      p.kidId, p.summary.dental, p.summary.eyesight, p.summary.nutrition,
      p.summary.heightCm, p.summary.weightKg, p.summary.overallScore, campDate || "Camp",
    ]),
    (values) => `
      UPDATE vita_hero.kids k SET
        dental = v.dental, eyesight = v.eyesight, nutrition = v.nutrition,
        height_cm = COALESCE(v.height_cm::numeric, k.height_cm),
        weight_kg = COALESCE(v.weight_kg::numeric, k.weight_kg),
        overall_score = v.overall_score::int,
        last_checkup = v.last_checkup
      FROM (VALUES ${values}) AS v(kid_id, dental, eyesight, nutrition, height_cm, weight_kg, overall_score, last_checkup)
      WHERE k.id = v.kid_id`
  );

  // A point on the growth chart, for the children the camp actually measured.
  await writeBatched(
    plan
      .filter((p) => p.summary.heightCm !== null || p.summary.weightKg !== null)
      .map((p) => [
        `gp_${slugify(p.kidId).slice(0, 20)}_${slugify(campDate || campId)}`,
        p.kidId, p.profileId, campDate || "Camp",
        p.summary.heightCm ?? 0, p.summary.weightKg ?? 0,
      ]),
    (values) => `
      INSERT INTO vita_hero.growth_points (id, kid_id, user_id, label, height, weight)
      SELECT v.id, v.kid_id, v.user_id, v.label, v.height::numeric, v.weight::numeric
      FROM (VALUES ${values}) AS v(id, kid_id, user_id, label, height, weight)
      ON CONFLICT (id) DO UPDATE SET
        height = EXCLUDED.height, weight = EXCLUDED.weight, recorded_at = NOW()`
  );

  // Registration rows, so the app's existing camp screens line up.
  await writeBatched(
    plan.map((p) => [
      `reg_${slugify(p.kidId).slice(0, 20)}_${campId.slice(-8)}`, p.profileId, campId, p.kidId,
    ]),
    (values) => `
      INSERT INTO vita_hero.camp_registrations (id, profile_id, school_camp_id, kid_id)
      VALUES ${values}
      ON CONFLICT (profile_id, school_camp_id, kid_id) DO NOTHING`
  );

  // The guardian must be enrolled with the school to see partner camps. One
  // guardian can have several children here, and the conflict target is
  // (profile, school), so the duplicates have to go before the statement does —
  // Postgres rejects a row affecting the same key twice in one command.
  const enrolments = new Map<string, unknown[]>();
  for (const p of plan) {
    const key = `${p.profileId}|${schoolId}`;
    if (!enrolments.has(key)) {
      enrolments.set(key, [
        `enr_${slugify(p.profileId).slice(0, 20)}_${slugify(schoolId).slice(0, 16)}`,
        p.profileId, schoolId, p.kidId, "ACTIVE",
      ]);
    }
  }
  await writeBatched(
    [...enrolments.values()],
    (values) => `
      INSERT INTO vita_hero.school_enrollments (id, profile_id, school_id, kid_id, status)
      VALUES ${values}
      ON CONFLICT (profile_id, school_id) DO NOTHING`
  );

  // G1 — every flag a physician confirmed becomes a tracked referral, so a
  // guardian is never told "see a doctor" without something following it up.
  const referralsOpened = await openReferralsForCamp(
    sql, campId, schoolId, actor.profileId,
    plan.map((p) => ({
      kidId: p.kidId,
      profileId: p.profileId,
      urgency: p.urgency,
      findings: p.findings.map((f) => ({ checkType: f.checkType, flag: f.flag, rationale: f.rationale })),
    }))
  );

  // One statement for the whole camp: these are exactly the rows just written.
  await sql`
    UPDATE vita_hero.camp_participants
    SET status = 'RELEASED', released_at = NOW()
    WHERE camp_id = ${campId} AND status = 'APPROVED'
  `;

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
      AND NOT EXISTS (
        SELECT 1 FROM vita_hero.consent_log cl
        WHERE cl.camp_id = p.camp_id AND cl.kid_id = p.kid_id AND cl.action = 'URGENT_ESCALATED'
      )
  `;
  // Every urgent parent is still texted — an SMS is one subrequest each and
  // there is no bulk endpoint — but eight at a time rather than strictly one
  // after another, so a camp with a bad day does not run out of wall clock
  // before the last parent is told.
  let urgentNotified = 0;
  for (const group of chunk(urgent, 8)) {
    const sent = await Promise.all(
      group.map((u) =>
        sendSms(
          u.phone as string,
          `VitaHero: ${u.name}'s school health check-up found something that needs a doctor's attention soon. Please open the VitaHero app for details.`
        ).catch(() => false)
      )
    );
    urgentNotified += sent.filter(Boolean).length;
  }

  return { released: plan.length, referralsOpened, urgentNotified };
}
// ─── Guardian-facing (parent app) ───────────────────────────

/** Consent requests waiting on this guardian. */
export async function pendingConsents(sql: Sql, profileId: string) {
  const rows = await sql`
    SELECT p.camp_id, p.kid_id, p.consent_status, k.name AS kid_name,
           sc.title, sc.date, sc.time, sc.venue, sc.checks, sc.consent_deadline,
           sc.photos_enabled, s.name AS school_name
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
      // When true the app must ask the photography question as well, as its own
      // yes/no. When false it must not show it at all.
      photosAsked: r.photos_enabled === true,
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

  // Six counts that know nothing about each other, so they go together. Each
  // one is a separate round trip to Neon from a worker that may be an ocean
  // away; awaiting them in turn made the console's first screen pay six
  // latencies to draw five numbers.
  const [schools, students, guardians, activated, camps, upcoming] = await Promise.all([
    scoped
      ? sql`SELECT COUNT(*)::int AS n FROM vita_hero.schools WHERE id = ${schoolId}`
      : sql`SELECT COUNT(*)::int AS n FROM vita_hero.schools WHERE active = true`,

    scoped
      ? sql`SELECT COUNT(*)::int AS n FROM vita_hero.kids WHERE school_id = ${schoolId}`
      : sql`SELECT COUNT(*)::int AS n FROM vita_hero.kids WHERE source = 'ADMIN'`,

    scoped
      ? sql`SELECT COUNT(*)::int AS n FROM vita_hero.profiles WHERE role='PARENT' AND school_id = ${schoolId}`
      : sql`SELECT COUNT(*)::int AS n FROM vita_hero.profiles WHERE role='PARENT' AND provisioned = true`,

    scoped
      ? sql`SELECT COUNT(*)::int AS n FROM vita_hero.profiles WHERE role='PARENT' AND school_id = ${schoolId} AND is_logged_in = true`
      : sql`SELECT COUNT(*)::int AS n FROM vita_hero.profiles WHERE role='PARENT' AND is_logged_in = true`,

    scoped
      ? sql`
          SELECT status, COUNT(*)::int AS n FROM vita_hero.school_camps
          WHERE active = true AND school_id = ${schoolId} GROUP BY status`
      : sql`
          SELECT status, COUNT(*)::int AS n FROM vita_hero.school_camps
          WHERE active = true GROUP BY status`,

    scoped
      ? sql`
          SELECT sc.id, sc.title, sc.date, sc.status, s.name AS school_name,
            (SELECT COUNT(*)::int FROM vita_hero.camp_participants p WHERE p.camp_id = sc.id) AS participants,
            (SELECT COUNT(*)::int FROM vita_hero.camp_participants p WHERE p.camp_id = sc.id
               AND p.consent_status IN ('GRANTED','PAPER')) AS consented
          FROM vita_hero.school_camps sc JOIN vita_hero.schools s ON s.id = sc.school_id
          WHERE sc.active = true AND sc.school_id = ${schoolId} AND sc.status <> 'RELEASED'
          ORDER BY sc.date LIMIT 10`
      : sql`
          SELECT sc.id, sc.title, sc.date, sc.status, s.name AS school_name,
            (SELECT COUNT(*)::int FROM vita_hero.camp_participants p WHERE p.camp_id = sc.id) AS participants,
            (SELECT COUNT(*)::int FROM vita_hero.camp_participants p WHERE p.camp_id = sc.id
               AND p.consent_status IN ('GRANTED','PAPER')) AS consented
          FROM vita_hero.school_camps sc JOIN vita_hero.schools s ON s.id = sc.school_id
          WHERE sc.active = true AND sc.status <> 'RELEASED'
          ORDER BY sc.date LIMIT 10`,
  ]);

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
  const norm = normalizeMobile(String(body.phone || ""));
  if (!norm) throw new ApiError(400, "Enter a valid mobile number — a landline cannot receive the sign-in code", "BAD_PHONE");

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

/**
 * End someone's access to a camp, or give it back.
 *
 * Not a delete: the assignment is how we know who screened whom, so it is
 * marked inactive and kept. Revoking the last active assignment a clinician
 * has is also what stops them signing in at all — see canClinicianSignIn.
 */
/**
 * May this clinician sign in at all?
 *
 * Once every assignment has been revoked there is nothing for them to open and
 * no reason for them to hold a session, so the OTP is refused at the door
 * rather than letting them in to an empty app.
 *
 * The case this originally got wrong is the one before any of that: a doctor
 * who has never been on a camp. Treating them the same as a revoked one meant
 * a doctor added to the directory this morning was turned away as though their
 * access had ended — and "My camps" already has a proper empty state telling
 * them a school will assign them. So: never assigned lets them in, revoked
 * does not. The distinction is the difference between "not yet" and "no
 * longer", and only one of those is a closed door.
 *
 * Deliberately does not apply to ops or school administrators: their job
 * outlives any one camp.
 */
export async function canClinicianSignIn(
  sql: Sql,
  profileId: string,
  role: string
): Promise<boolean> {
  if (role !== "SCREENER" && role !== "PHYSICIAN") return true;
  const rows = await sql`
    SELECT COUNT(*) FILTER (WHERE active) AS live, COUNT(*)::int AS ever
    FROM vita_hero.camp_staff WHERE profile_id = ${profileId}
  `;
  const live = Number(rows[0]?.live) || 0;
  const ever = Number(rows[0]?.ever) || 0;
  return live > 0 || ever === 0;
}

/**
 * Put a doctor from the directory onto a camp, and give them a way in.
 *
 * This is the join the product was missing. The directory held doctors with
 * no login; `camp_staff` held logins with no connection to the directory. A
 * doctor was therefore someone you could describe but never let through the
 * door.
 *
 * Assigning one here provisions the profile their phone number signs in with,
 * scopes it to the camp's school, and records which directory entry it came
 * from. Access is the assignment: revoke every active assignment and the
 * sign-in stops working, which is exactly what "the camp is over" should mean.
 */
export async function assignDoctorToCamp(
  sql: Sql,
  actor: Actor,
  campId: string,
  doctorId: string
) {
  const access = await assertCampAccess(sql, actor, campId);
  assertCan(access.canSchedule, "change staff on this camp");

  const docs = await sql`
    SELECT id, name, phone, specialty FROM vita_hero.doctors
    WHERE id = ${doctorId} AND active = true LIMIT 1
  `;
  if (docs.length === 0) throw new ApiError(404, "That doctor is not in the directory", "NO_DOCTOR");
  const doc = docs[0];

  const norm = normalizeMobile(String(doc.phone || ""));
  if (!norm) {
    throw new ApiError(
      400,
      `${doc.name as string} has no usable mobile number in the directory. Add one first — it is how they sign in, and a landline cannot receive the code.`,
      "DOCTOR_NO_PHONE"
    );
  }

  // A specialty with no screening screen has nothing for them to do on the
  // day. Refused here rather than discovered by a doctor standing in a school
  // hall with an empty form: a dermatologist is a good referral entry and not
  // a camp clinician, because VitaHero has no skin check to record yet.
  const mine = screeningChecksFor(String(doc.specialty || ""));
  if (mine.length === 0) {
    throw new ApiError(
      400,
      `${doc.name as string} is ${String(doc.specialty || "a doctor")} and VitaHero has no screening form for that yet, so there would be nothing for them to record at this camp.`,
      "SPECIALTY_NOT_SCREENED"
    );
  }

  const profileId = `ph_${norm.last10}`;
  const existing = await sql`SELECT role FROM vita_hero.profiles WHERE id = ${profileId} LIMIT 1`;
  if (existing.length > 0 && (existing[0].role as string) === "PARENT") {
    throw new ApiError(409, "That number is already registered as a parent", "PHONE_IS_PARENT");
  }

  const schoolId = access.camp.school_id as string;
  await sql`
    INSERT INTO vita_hero.profiles
      (id, user_id, phone, name, auth_provider, role, provisioned, school_id,
       is_logged_in, onboarding_complete, created_by)
    VALUES
      (${profileId}, ${profileId}, ${norm.e164}, ${doc.name as string}, 'PHONE', 'PHYSICIAN',
       true, ${schoolId}, false, true, ${actor.profileId})
    ON CONFLICT (id) DO UPDATE SET
      name = ${doc.name as string}, phone = ${norm.e164}, role = 'PHYSICIAN',
      school_id = ${schoolId}, provisioned = true
  `;

  await sql`
    INSERT INTO vita_hero.camp_staff (id, camp_id, profile_id, staff_role, doctor_id, active)
    VALUES (${"cst_" + campId.slice(-10) + "_" + slugify(profileId).slice(0, 16)},
            ${campId}, ${profileId}, 'PHYSICIAN', ${doctorId}, true)
    ON CONFLICT (camp_id, profile_id) DO UPDATE SET
      staff_role = 'PHYSICIAN', doctor_id = ${doctorId},
      active = true, revoked_at = NULL, revoked_by = ''
  `;

  return {
    assigned: {
      doctorId,
      profileId,
      name: doc.name as string,
      specialty: (doc.specialty as string) || "",
      phone: norm.e164,
      role: "PHYSICIAN",
    },
    signInHint: `${doc.name as string} signs in at the console with ${norm.e164}, and records ${mine.join(" and ")} at this camp.`,
    screens: mine,
  };
}

/**
 * Every camp a doctor has been put on, active or not.
 *
 * The revoked ones are the point: a school needs to see that Dr Iyer screened
 * at three camps and can currently reach none of them.
 */
export async function doctorCamps(sql: Sql, actor: Actor, doctorId: string) {
  if (!isOpsRole(actor.role) && actor.role !== "SCHOOL_ADMIN") {
    throw new ApiError(403, "Only staff can see a doctor's camps", "FORBIDDEN");
  }
  const rows = await sql`
    SELECT cs.camp_id, cs.active, cs.revoked_at, cs.staff_role,
           sc.title, sc.date, sc.status, sc.school_id, s.name AS school_name
    FROM vita_hero.camp_staff cs
    JOIN vita_hero.school_camps sc ON sc.id = cs.camp_id
    JOIN vita_hero.schools s ON s.id = sc.school_id
    WHERE cs.doctor_id = ${doctorId}
      AND (${isOpsRole(actor.role)} OR sc.school_id = ${actor.schoolId || ""})
    ORDER BY sc.date DESC
  `;
  return {
    camps: rows.map((r) => ({
      campId: r.camp_id as string,
      title: (r.title as string) || "",
      date: (r.date as string) || "",
      status: (r.status as string) || "",
      schoolId: (r.school_id as string) || "",
      schoolName: (r.school_name as string) || "",
      role: (r.staff_role as string) || "",
      active: r.active !== false,
      revokedAt: r.revoked_at ? new Date(r.revoked_at as string).toISOString() : "",
    })),
  };
}

export async function setCampStaffActive(
  sql: Sql,
  actor: Actor,
  campId: string,
  profileId: string,
  active: boolean
) {
  const access = await assertCampAccess(sql, actor, campId);
  assertCan(access.canSchedule, "change staff on this camp");
  const rows = await sql`
    UPDATE vita_hero.camp_staff
    SET active = ${active},
        revoked_at = ${active ? null : new Date().toISOString()},
        revoked_by = ${active ? "" : actor.profileId}
    WHERE camp_id = ${campId} AND profile_id = ${profileId}
    RETURNING profile_id
  `;
  if (rows.length === 0) {
    throw new ApiError(404, "That person is not on this camp", "NOT_ASSIGNED");
  }
  return { profileId, active };
}

export async function removeCampStaff(sql: Sql, actor: Actor, campId: string, profileId: string) {
  return setCampStaffActive(sql, actor, campId, profileId, false);
}
