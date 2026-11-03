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
import { assessmentSheet, dobText, growthSummary, type SheetChild } from "./parent-sheet";
import { Actor, ApiError, assertSchoolAccess } from "./schools";
import { openReferralsForCamp } from "./referrals";
import { logRecordAccess } from "./oversight";
// symptoms.ts imports this file too. Safe: each only calls the other's
// functions at request time, never while the modules are loading.
import { symptomHistoryForClinician } from "./symptoms";
import {
  CHECK_TYPES,
  missingRequired,
  Flag,
  Urgency,
  draftRecommendation,
  isCheckType,
  isDesignedCheck,
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
  // Children taken off this camp by hand. The roster is rebuilt from the
  // camp's classes, so without this a removed child would come straight back.
  await sql`ALTER TABLE vita_hero.school_camps ADD COLUMN IF NOT EXISTS excluded_kids JSONB DEFAULT '[]'::jsonb`;
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
  // What this person records at this camp. Set on the assignment rather than
  // read only from the directory: a school's own physician has no directory
  // entry, and without it they were given every check — so a dentist added
  // that way had to fill in (or mark not done) the eye check to save, and the
  // eye doctor's list then showed the child as done.
  await sql`ALTER TABLE vita_hero.camp_staff ADD COLUMN IF NOT EXISTS specialty TEXT DEFAULT ''`;

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
  // When a release took this family to text about the result. Two releases
  // at the same moment both found every parent untold and both texted them;
  // releaseCamp now claims a family here before sending.
  await sql`ALTER TABLE vita_hero.camp_participants ADD COLUMN IF NOT EXISTS result_notified_at TIMESTAMPTZ`;
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

  // One row per clinician who signed off part of a child: the checks they
  // answer for and what they tell the family about them. A child is approved
  // once every consented check sits in some row, and the guardian reads the
  // rows put together. A check re-recorded after the row was signed drops out
  // of it (see validSignoffs) and has to be signed again.
  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.camp_signoffs (
      camp_id TEXT NOT NULL,
      kid_id TEXT NOT NULL,
      signed_by TEXT NOT NULL,
      checks JSONB NOT NULL DEFAULT '[]'::jsonb,
      urgency TEXT DEFAULT 'NONE',
      recommendation TEXT DEFAULT '',
      signed_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (camp_id, kid_id, signed_by)
    )
  `;

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
 * A clinician's specialty from the doctor directory, by the entry they were
 * assigned from or, failing that, by their mobile number (a provisioned login
 * is ph_<last ten digits>). "" when there is no entry. Never throws: camp work
 * must not stop because the directory is unavailable.
 */
async function directorySpecialty(sql: Sql, doctorId: string, profileId: string): Promise<string> {
  try {
    if (doctorId) {
      const d = await sql`SELECT specialty FROM vita_hero.doctors WHERE id = ${doctorId} LIMIT 1`;
      const s = normaliseSpecialty(String(d[0]?.specialty || ""));
      if (s) return s;
    }
    const last10 = /^ph_\d{10}$/.test(profileId) ? profileId.slice(3) : "";
    if (!last10) return "";
    const d = await sql`
      SELECT specialty FROM vita_hero.doctors
      WHERE active = true AND RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10) = ${last10}
      LIMIT 1
    `;
    return normaliseSpecialty(String(d[0]?.specialty || ""));
  } catch {
    return "";
  }
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
    SELECT staff_role, active, doctor_id, specialty FROM vita_hero.camp_staff
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

  // Looked up separately rather than joined: camp access must not depend on
  // the directory existing.
  const doctorId = (staff[0].doctor_id as string) || "";
  // The assignment's own specialty first, then the directory entry it came
  // from, then a directory entry with the same number. Only when none of
  // those exists is this person the school's generalist.
  let specialty = normaliseSpecialty(String(staff[0].specialty || ""));
  if (!specialty) {
    specialty = await directorySpecialty(sql, doctorId, actor.profileId);
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
    checks: jsonArr(r.checks).filter(isDesignedCheck),
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
      -- Only camps there is still work on: a released or cancelled camp is
      -- locked and only crowded the doctor's list.
      AND sc.status NOT IN ('RELEASED','CANCELLED')
    ORDER BY sc.date DESC
  `;
  // The counts on each card are this clinician's own: "12 of 40 screened"
  // meant children anyone had touched, so the eye doctor arrived to a camp
  // that said done because the dentist had been through it.
  const camps = [];
  for (const r of rows) {
    const base = { ...mapCamp(r), staffRole: (r.staff_role as string) || "" };
    try {
      const access = await assertCampAccess(sql, actor, r.id as string);
      const campChecks = campCheckList(access.camp);
      const parts = await sql`
        SELECT p.status, p.consent_status, p.attendance, p.consent_checks,
          (SELECT COALESCE(json_agg(DISTINCT f.check_type), '[]'::json) FROM vita_hero.camp_findings f
            WHERE f.camp_id = p.camp_id AND f.kid_id = p.kid_id
              AND (f.flag <> 'NOT_MEASURED' OR COALESCE(f.screener_note, '') <> '')) AS recorded_checks
        FROM vita_hero.camp_participants p WHERE p.camp_id = ${r.id as string}
      `;
      let mine = 0, done = 0, todo = 0;
      for (const p of parts) {
        const st = screeningProgress(p, campChecks, access.checkScope,
          new Set((p.recorded_checks as string[]) || [])).screeningState;
        if (st === "NOT_MINE" || st === "NO_CONSENT") continue;
        mine++;
        if (st === "DONE") done++;
        else if (st === "TODO") todo++;
      }
      camps.push({
        ...base,
        screened: done,
        myChildren: mine,
        myTodo: todo,
        myDone: done,
        myChecks: access.checkScope ?? campChecks,
        specialty: access.specialty || "",
      });
    } catch {
      camps.push(base);
    }
  }
  return { camps };
}

export async function getCamp(sql: Sql, actor: Actor, campId: string) {
  const access = await assertCampAccess(sql, actor, campId);
  // The tallies, the assigned staff and the school's dietician are
  // independent; one wait.
  const [counts, staff, dieticians] = await Promise.all([
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
             COALESCE(cs.specialty, '') AS specialty, p.name, p.phone
      FROM vita_hero.camp_staff cs
      LEFT JOIN vita_hero.profiles p ON p.id = cs.profile_id
      WHERE cs.camp_id = ${campId}
      ORDER BY cs.active DESC, cs.staff_role, p.name
    `,
    // Growth and haemoglobin findings are followed up by the school's
    // dietician, who is assigned to the school rather than to a camp. Shown on
    // the camp so whoever runs it can see the follow-up has somebody — and
    // can see when it has nobody.
    sql`
      SELECT d.name, d.phone, d.qualification
      FROM vita_hero.dietician_schools ds
      JOIN vita_hero.dieticians d ON d.id = ds.dietician_id
      WHERE ds.school_id = ${access.camp.school_id as string} AND ds.active AND d.active
      ORDER BY d.name
    `,
  ]);
  const staffSpecialty = await Promise.all(staff.map(async (st) =>
    normaliseSpecialty(String(st.specialty || "")) ||
    (st.staff_role === "PHYSICIAN"
      ? await directorySpecialty(sql, (st.doctor_id as string) || "", st.profile_id as string)
      : "")));
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
    staff: staff.map((s, i) => ({
      profileId: s.profile_id as string,
      role: s.staff_role as string,
      name: (s.name as string) || "",
      phone: (s.phone as string) || "",
      // Revoked assignments stay on the list, marked. They are how the school
      // knows who screened at this camp after access has ended.
      active: s.active !== false,
      doctorId: (s.doctor_id as string) || "",
      revokedAt: s.revoked_at ? new Date(s.revoked_at as string).toISOString() : "",
      // What they record here. "" with checks null is a generalist who
      // records every check — the console shows that as a warning, since a
      // specialist left like that marks other doctors' checks done.
      specialty: staffSpecialty[i] || "",
      checks: staffSpecialty[i] ? screeningChecksFor(staffSpecialty[i]) : null,
    })),
    // The number only for those who run the camp; a screener needs to know
    // there is a dietician, not how to ring them.
    dieticians: dieticians.map((d) => ({
      name: d.name as string,
      qualification: (d.qualification as string) || "",
      phone: access.canSchedule ? (d.phone as string) || "" : "",
    })),
    can: {
      schedule: access.canSchedule,
      screen: access.canScreen,
      review: access.canReview,
      viewClinical: access.canViewClinical,
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
    .filter(isDesignedCheck);
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
    ? (body.checks as unknown[]).map(String).filter(isDesignedCheck)
    : campCheckList(cur);
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
  const excluded = new Set(jsonList(camp.excluded_kids));
  const eligibleIds = new Set(
    eligible.map((r) => r.id as string).filter((id) => !excluded.has(id))
  );

  const toAdd = eligible.filter(
    (r) => !existingIds.has(r.id as string) && eligibleIds.has(r.id as string)
  );
  for (const group of chunk(toAdd, 100)) {
    const values: string[] = [];
    const params: unknown[] = [];
    group.forEach((r, i) => {
      const b = i * 4;
      values.push(`($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4})`);
      params.push(
        `cp_${campId}_${String(r.id)}`,
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
       ON CONFLICT DO NOTHING`,
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

function jsonList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  try {
    const parsed = JSON.parse(String(v || "[]"));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * Take children off a camp who were put on it by mistake.
 *
 * Only a child who has not been screened and has nothing recorded against
 * them can go; a screened child is a clinical record, not a list entry. Any
 * consent on file goes with the row, which is the point: the child is not
 * part of this camp. They are remembered as excluded so a rebuild of the
 * roster does not put them straight back.
 */
export async function removeFromCamp(sql: Sql, actor: Actor, campId: string, kidIds: string[]) {
  const access = await assertCampAccess(sql, actor, campId);
  assertCan(access.canSchedule, "change this camp's list of children");
  const ids = [...new Set(kidIds.map(String).filter(Boolean))];
  if (ids.length === 0) throw new ApiError(400, "Choose at least one child", "NO_KIDS");

  const gone = await sql`
    DELETE FROM vita_hero.camp_participants p
    WHERE p.camp_id = ${campId} AND p.kid_id = ANY(${ids})
      AND p.status = 'NOT_SCREENED'
      AND NOT EXISTS (SELECT 1 FROM vita_hero.camp_findings f
                      WHERE f.camp_id = p.camp_id AND f.kid_id = p.kid_id)
    RETURNING p.kid_id
  `;
  const removed = gone.map((r) => r.kid_id as string);
  if (removed.length) {
    const excluded = new Set(jsonList(access.camp.excluded_kids));
    removed.forEach((id) => excluded.add(id));
    await sql`
      UPDATE vita_hero.school_camps
      SET excluded_kids = ${JSON.stringify([...excluded])}::jsonb,
          registered_count = (SELECT COUNT(*) FROM vita_hero.camp_participants WHERE camp_id = ${campId})
      WHERE id = ${campId}
    `;
  }
  return { removed: removed.length, kept: ids.length - removed.length };
}

/** Undo removeFromCamp: forget the exclusion and rebuild the roster. */
export async function restoreToCamp(sql: Sql, actor: Actor, campId: string, kidIds: string[]) {
  const access = await assertCampAccess(sql, actor, campId);
  assertCan(access.canSchedule, "change this camp's list of children");
  const back = new Set(kidIds.map(String));
  const excluded = jsonList(access.camp.excluded_kids).filter((id) => !back.has(id));
  await sql`
    UPDATE vita_hero.school_camps SET excluded_kids = ${JSON.stringify(excluded)}::jsonb
    WHERE id = ${campId}
  `;
  return buildCampRoster(sql, actor, campId);
}

/** The children taken off this camp by hand, so the console can put them back. */
export async function excludedFromCamp(sql: Sql, campId: string, schoolId: string) {
  const [camp] = await sql`
    SELECT excluded_kids FROM vita_hero.school_camps WHERE id = ${campId} AND school_id = ${schoolId}
  `;
  const ids = jsonList(camp?.excluded_kids);
  if (ids.length === 0) return [];
  const rows = await sql`
    SELECT id, name, grade, section FROM vita_hero.kids
    WHERE id = ANY(${ids}) AND school_id = ${schoolId}
    ORDER BY grade, section, name
  `;
  return rows.map((r) => ({
    kidId: r.id as string,
    kidName: (r.name as string) || "",
    grade: (r.grade as string) || "",
    section: (r.section as string) || "",
  }));
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
               AND f.flag <> 'NOT_MEASURED') AS findings_count,
           -- The same rule as recordedChecks, in this statement: the roster
           -- is the console's busiest read and gets no second round trip.
           (SELECT COALESCE(json_agg(DISTINCT f.check_type), '[]'::json) FROM vita_hero.camp_findings f
             WHERE f.camp_id = p.camp_id AND f.kid_id = p.kid_id
               AND (f.flag <> 'NOT_MEASURED' OR COALESCE(f.screener_note, '') <> '')) AS recorded_checks
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
  // Done is per clinician, not per child. Once the dentist saves, the child's
  // own status reads SCREENED, but the eye doctor has not seen them yet: their
  // list must still say To do. So each row carries the caller's share of the
  // checks and what of it is still outstanding.
  const campChecks = campCheckList(access.camp);
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
      ...screeningProgress(r, campChecks, access.checkScope, new Set((r.recorded_checks as string[]) || [])),
    })),
  };
}

/**
 * Where a child stands for the clinician asking.
 *
 * TODO and DONE are about this clinician's checks only. NOT_MINE is a child
 * with none of their checks consented; ABSENT and NO_CONSENT are children they
 * cannot screen today. A released child is DONE: the record is locked.
 */
function screeningProgress(
  r: Record<string, unknown>,
  campChecks: string[],
  scope: string[] | null,
  done: Set<string> | undefined
) {
  const consented = consentedChecks(r, campChecks);
  const mine = myChecks(r, campChecks, { checks: scope });
  const outstanding = mine.filter((c) => !done?.has(c));
  const consent = (r.consent_status as string) || "PENDING";
  const attendance = (r.attendance as string) || "UNKNOWN";
  let state: string;
  if (consent !== "GRANTED" && consent !== "PAPER") state = "NO_CONSENT";
  else if (mine.length === 0) state = "NOT_MINE";
  else if (outstanding.length === 0 || r.status === "RELEASED") state = "DONE";
  else if (attendance === "ABSENT" || attendance === "REFUSED") state = "ABSENT";
  else state = "TODO";
  return {
    myChecks: mine,
    myOutstanding: outstanding,
    checksTotal: consented.length,
    checksDone: consented.filter((c) => done?.has(c)).length,
    screeningState: state,
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

  // Choosing who to remind and recording the reminder are one statement.
  // Read first and written after the sends, an operator clicking twice a
  // moment apart had both clicks find the same guardians and text each twice.
  // A claim that did not turn into a text is handed back after the sends.
  const claimed = await sql`
    UPDATE vita_hero.camp_participants p
    SET consent_reminded_at = NOW(),
        consent_reminder_count = COALESCE(p.consent_reminder_count, 0) + 1
    FROM vita_hero.profiles pr
    WHERE pr.id = p.profile_id
      AND p.camp_id = ${campId} AND p.consent_status = 'PENDING' AND COALESCE(pr.phone,'') <> ''
      AND (${picked.length === 0} OR p.profile_id = ANY(${picked}))
      -- Reminding everyone is throttled; reminding one named guardian is a
      -- deliberate act by someone who has just spoken to them, and is only
      -- kept from going twice on a double tap.
      AND (p.consent_reminded_at IS NULL
           OR p.consent_reminded_at < NOW() - INTERVAL '1 minute')
      AND (${picked.length > 0}
           OR ((p.consent_reminded_at IS NULL
                OR p.consent_reminded_at < NOW() - INTERVAL '2 days')
               AND COALESCE(p.consent_reminder_count, 0) < 3))
    RETURNING p.id, p.profile_id, pr.phone
  `;
  // One text per guardian, however many of their children are waiting.
  const rows = [...new Map(claimed.map((r) => [r.profile_id as string, r])).values()];

  const checks = campCheckList(camp);
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

  // A reminder that did not go out does not count against the guardian's
  // three, and they are due again straight away.
  const unsent = new Set(outcome.failed.map((f) => f.id));
  const handBack = claimed.filter((r) => unsent.has(r.profile_id as string)).map((r) => r.id as string);
  if (handBack.length > 0) {
    await sql`
      UPDATE vita_hero.camp_participants
      SET consent_reminded_at = NULL,
          consent_reminder_count = GREATEST(COALESCE(consent_reminder_count, 0) - 1, 0)
      WHERE id = ANY(${handBack})
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

/** The most children one bulk entry may touch: a large school's whole camp. */
export const BULK_CONSENT_LIMIT = 500;

/**
 * Key in a class's worth of paper slips at once.
 *
 * Only children still PENDING and not yet screened change. A guardian who
 * answered in the app has answered, and a bulk click must never turn their
 * "no" into a "yes"; those children come back counted as skipped instead. The
 * claim is the UPDATE itself, so two people entering the same pile at the same
 * moment write each child once and log each child once.
 */
export async function recordConsentBulk(
  sql: Sql,
  actor: Actor,
  campId: string,
  body: Record<string, unknown>,
) {
  const access = await assertCampAccess(sql, actor, campId);
  assertCan(access.canSchedule, "record consent for this camp");

  const decision = String(body.decision || "").toUpperCase();
  if (decision !== "PAPER" && decision !== "DECLINED") {
    throw new ApiError(400, "Decision must be PAPER or DECLINED", "BAD_DECISION");
  }
  const kidIds = [...new Set(
    (Array.isArray(body.kidIds) ? body.kidIds : []).map((k) => String(k || "").trim()).filter(Boolean),
  )];
  if (kidIds.length === 0) throw new ApiError(400, "Choose at least one child", "NO_CHILDREN");
  if (kidIds.length > BULK_CONSENT_LIMIT) {
    throw new ApiError(
      400,
      `At most ${BULK_CONSENT_LIMIT} children at a time — narrow it by class`,
      "TOO_MANY",
    );
  }
  // Photographs only where the camp asks the question at all.
  const photos = decision === "PAPER" && body.consentPhotos === true
    && access.camp.photos_enabled === true;
  const note = String(body.note || "").trim().slice(0, 500) || "Bulk paper entry in the console";

  const claimed = await sql`
    UPDATE vita_hero.camp_participants
    SET consent_status = ${decision},
        consent_checks = '[]'::jsonb,
        consent_photos = ${photos},
        consent_at = NOW(),
        consent_source = 'PAPER',
        consent_recorded_by = ${actor.profileId}
    WHERE camp_id = ${campId} AND kid_id = ANY(${kidIds}::text[])
      AND consent_status = 'PENDING' AND status = 'NOT_SCREENED'
    RETURNING kid_id, profile_id
  `;
  if (claimed.length > 0) {
    const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await sql`
      INSERT INTO vita_hero.consent_log (id, camp_id, kid_id, profile_id, action, source, actor_id, note)
      SELECT 'cl_' || ${stamp} || '_' || u.kid_id, ${campId}, u.kid_id, u.profile_id,
             ${decision}, 'PAPER', ${actor.profileId}, ${note}
      FROM UNNEST(${claimed.map((r) => r.kid_id as string)}::text[],
                  ${claimed.map((r) => (r.profile_id as string) || "")}::text[]) AS u(kid_id, profile_id)
    `;
  }

  // Say why the rest were left alone, so "12 of 40" is not a mystery.
  const done = new Set(claimed.map((r) => r.kid_id as string));
  const rest = kidIds.filter((k) => !done.has(k));
  const skipped = { alreadyAnswered: 0, alreadyScreened: 0, notOnCamp: 0 };
  if (rest.length > 0) {
    const found = await sql`
      SELECT kid_id, consent_status, status FROM vita_hero.camp_participants
      WHERE camp_id = ${campId} AND kid_id = ANY(${rest}::text[])
    `;
    skipped.notOnCamp = rest.length - found.length;
    for (const r of found) {
      if ((r.status as string) !== "NOT_SCREENED") skipped.alreadyScreened++;
      else skipped.alreadyAnswered++;
    }
  }
  return {
    decision,
    consentPhotos: photos,
    updated: claimed.length,
    kidIds: [...done],
    skipped,
  };
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
  const campChecks = campCheckList(access.camp);
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
      dob: dobText(p.date_of_birth),
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
      detail: findingDetail(f.check_type as string, f.detail),
      flag: f.flag as string,
      autoFlag: f.auto_flag as string,
      rationale: (f.rationale as string) || "",
      note: (f.screener_note as string) || "",
    })),
    // The illnesses the family logged in the app. A parent's only way to tell
    // the doctor anything, and it reached nobody until now.
    illnessHistory: await illnessHistoryOrNull(sql, actor, campId, kidId),
  };
}

/**
 * The guardian's illness log for a clinician, or null for anybody else.
 *
 * The office can open the screening form; it is not told about the loose
 * motions in March, and is not refused the whole form because of them.
 */
async function illnessHistoryOrNull(sql: Sql, actor: Actor, campId: string, kidId: string) {
  try {
    return await symptomHistoryForClinician(sql, actor, campId, kidId);
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) return null;
    throw e;
  }
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

  const allowed = consentedChecks(participant, campChecks);

  const ctx = {
    ageYears: Number(participant.age) || 0,
    gender: String(participant.gender || ""),
    dob: dobText(participant.date_of_birth),
  };

  // The app's form has a history and lab card that is not a check of its own:
  // it describes the child, and goes with whatever was examined. Sent on its
  // own it used to be refused as an unknown check, which lost the whole save.
  const context: Record<string, Record<string, unknown>> = {};
  const checks = incoming.filter((raw) => {
    const key = CONTEXT_SECTIONS[String(raw.checkType || "")];
    if (!key) return true;
    context[key] = (raw.detail as Record<string, unknown>) || {};
    return false;
  });
  if (checks.length === 0 && incoming.length > 0) {
    throw new ApiError(
      400,
      "Record at least one examination with the history and lab orders",
      "CONTEXT_ONLY"
    );
  }

  const out: EvaluatedFinding[] = [];
  for (const raw of checks) {
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
    const detail = findingDetail(checkType, NO_CONTEXT_CHECKS.has(checkType)
      ? (raw.detail as Record<string, unknown>) || {}
      : { ...((raw.detail as Record<string, unknown>) || {}), ...context });
    const proposal = proposeFlag({ checkType, detail }, ctx);

    // C9 — a screener may override the proposal, but must say why.
    const override = raw.flag ? String(raw.flag).toUpperCase() : "";
    const note = String(raw.note || "").trim();

    // A check is either done properly or declared not done, with a reason.
    // Never half done: that is how a camp's heights went missing unnoticed.
    if (override === "NOT_MEASURED") {
      if (!note) {
        throw new ApiError(
          400,
          `Say why "${checkType}" could not be done`,
          "NOT_DONE_NEEDS_REASON"
        );
      }
    } else {
      const incomplete = missingRequired(checkType, detail);
      if (incomplete) throw new ApiError(400, incomplete, "INCOMPLETE_CHECK");
    }
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
    // Not done is about the instrument, not the child. Severe pallor seen at a
    // camp with no Hb meter is still an ALERT: released as "not measured" it
    // opened no referral and the parent saw nothing flagged.
    if (override === "NOT_MEASURED") {
      detail.notDone = true;
      if (proposal.flag === "WATCH" || proposal.flag === "ALERT") flag = proposal.flag;
    }

    out.push({
      // Whole ids, not prefixes: children added from admission numbers share
      // their first characters, and a cut id made the second child's save collide.
      // The suffix is for two screeners saving the same check at once: the
      // upsert arbitrates on (camp, kid, check), and a shared id made the
      // second insert fail on the primary key instead of updating the row.
      id: `cf_${campId}_${kidId}_${slugify(checkType)}_${crypto.randomUUID().slice(0, 8)}`,
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

/** The camp's checks this child's guardian agreed to. No list on the consent means all of them. */
function consentedChecks(participant: Record<string, unknown>, campChecks: string[]): string[] {
  const consentChecks: string[] = Array.isArray(participant.consent_checks)
    ? (participant.consent_checks as string[])
    : JSON.parse(String(participant.consent_checks || "[]"));
  return consentChecks.length > 0
    ? campChecks.filter((c) => consentChecks.includes(c))
    : campChecks;
}

/**
 * Checks already on record for each child: measured, or declared not done
 * with a reason. A bare NOT_MEASURED row is the old half-empty save and does
 * not count as done.
 */
async function recordedChecks(sql: Sql, campId: string, kidIds: string[]) {
  const rows = kidIds.length === 0 ? [] : await sql`
    SELECT kid_id, check_type FROM vita_hero.camp_findings
    WHERE camp_id = ${campId} AND kid_id = ANY(${kidIds})
      AND (flag <> 'NOT_MEASURED' OR COALESCE(screener_note, '') <> '')
  `;
  const byKid = new Map<string, Set<string>>();
  for (const r of rows) {
    const k = r.kid_id as string;
    if (!byKid.has(k)) byKid.set(k, new Set());
    byKid.get(k)!.add(r.check_type as string);
  }
  return byKid;
}

/**
 * Refuse a save that leaves one of this clinician's checks unrecorded.
 *
 * The app sends only the checks somebody touched, so per-field rules alone
 * could not notice a whole check skipped. What counts as done includes what
 * was saved earlier, so a doctor correcting one check is not made to retype
 * the rest.
 */
function assertChecksComplete(
  needed: string[],
  findings: EvaluatedFinding[],
  alreadyDone: Set<string> | undefined
) {
  const sent = new Set(findings.map((f) => f.checkType));
  const missing = needed.filter((c) => !sent.has(c) && !alreadyDone?.has(c));
  if (missing.length > 0) {
    throw new ApiError(
      400,
      `Still to record: ${missing.join(", ")}. Fill ${missing.length === 1 ? "it" : "them"} in, ` +
        `or mark ${missing.length === 1 ? "it" : "each"} "could not be done" with a reason.`,
      "MISSING_CHECKS"
    );
  }
}

/** This clinician's share of a child's checks: what consent allows, cut to their specialty. */
function myChecks(
  participant: Record<string, unknown>,
  campChecks: string[],
  scope: { checks: string[] | null }
): string[] {
  const allowed = consentedChecks(participant, campChecks);
  return scope.checks ? allowed.filter((c) => scope.checks!.includes(c)) : allowed;
}

/** The app's form sections that ride along with the checks rather than being one. */
const CONTEXT_SECTIONS: Record<string, string> = {
  Systemic: "history",
  Investigations: "investigations",
};

/**
 * The checks the history and lab orders never ride on. Birth history,
 * systemic illness and blood tests are the physician's; on an eye or a dental
 * record they only read as findings nobody took.
 */
const NO_CONTEXT_CHECKS = new Set(["Vision", "Dental"]);

/**
 * A finding's detail as it is shown. Records saved before the forms were
 * trimmed to the sheets carry the birth history, systemic illness and lab
 * orders that were merged into every check. No form asks for them any more,
 * so they are dropped on the way out of every check: no clinician screen
 * shows them and no app sends them back.
 */
export function findingDetail(_checkType: string, detail: unknown): Record<string, unknown> {
  const d = (detail && typeof detail === "object" ? detail : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const context = new Set(Object.values(CONTEXT_SECTIONS));
  for (const [k, v] of Object.entries(d)) if (!context.has(k)) out[k] = v;
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
      SET status = CASE WHEN status = 'RELEASED' THEN status ELSE 'SCREENED' END,
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

  // Each check reaches the family as soon as its doctor submits it, rather
  // than after every doctor has been and a physician has released the camp.
  // A failure here must not lose a doctor's save that has already been
  // written: it is logged, and the next save for the child projects again.
  try {
    await shareWithFamilies(sql, campId, screened);
  } catch (e) {
    console.error("shareWithFamilies", campId, e);
  }
}

/**
 * Put what has been recorded for these children so far where the family's
 * app reads it: the camp result row, the child's headline flags and the
 * growth chart. The same projection releaseCamp makes, for the checks done so
 * far — an area not checked yet keeps whatever the child had before.
 *
 * It does not open referrals or text anyone: those stay with the physician's
 * review and release, which still happen and still lock the record.
 */
export async function shareWithFamilies(sql: Sql, campId: string, kidIds: string[]): Promise<void> {
  if (kidIds.length === 0) return;
  const [camp] = await sql`SELECT date, school_id FROM vita_hero.school_camps WHERE id = ${campId} LIMIT 1`;
  if (!camp) return;
  const campDate = (camp.date as string) || "";
  const schoolId = camp.school_id as string;
  const parts = await sql`
    SELECT kid_id, profile_id FROM vita_hero.camp_participants
    WHERE camp_id = ${campId} AND kid_id = ANY(${kidIds})
      AND status <> 'RELEASED' AND COALESCE(profile_id, '') <> ''
  `;
  if (parts.length === 0) return;
  const found = await sql`
    SELECT kid_id, check_type, flag, urgency, detail FROM vita_hero.camp_findings
    WHERE camp_id = ${campId} AND kid_id = ANY(${parts.map((p) => p.kid_id as string)})
      AND flag <> 'NOT_MEASURED'
  `;
  const byKid = new Map<string, Array<{ checkType: string; flag: Flag; urgency: Urgency; detail: Record<string, unknown> }>>();
  for (const f of found) {
    const list = byKid.get(f.kid_id as string) || [];
    list.push({
      checkType: f.check_type as string,
      flag: f.flag as Flag,
      urgency: (f.urgency as Urgency) || "NONE",
      detail: findingDetail(f.check_type as string, f.detail),
    });
    byKid.set(f.kid_id as string, list);
  }
  const rows = parts
    .filter((p) => (byKid.get(p.kid_id as string) || []).length > 0)
    .map((p) => {
      const sm = summariseForApp(byKid.get(p.kid_id as string)!);
      return {
        id: `ckr_${campId}_${p.kid_id as string}_${crypto.randomUUID().slice(0, 8)}`,
        gp_id: `gp_${p.kid_id as string}_${slugify(campDate || campId)}`,
        profile_id: p.profile_id as string,
        kid_id: p.kid_id as string,
        dental: sm.dental, eyesight: sm.eyesight, nutrition: sm.nutrition,
        height_cm: sm.heightCm, weight_kg: sm.weightKg, overall_score: sm.overallScore,
      };
    });
  if (rows.length === 0) return;
  const data = JSON.stringify(rows);
  await sql`
    INSERT INTO vita_hero.camp_kid_results
      (id, profile_id, school_camp_id, kid_id, dental, eyesight, nutrition, height_cm, weight_kg, recorded_at)
    SELECT v.id, v.profile_id, ${campId}, v.kid_id, v.dental, v.eyesight, v.nutrition, v.height_cm, v.weight_kg, NOW()
    FROM jsonb_to_recordset(${data}::jsonb) AS v(id text, gp_id text, profile_id text, kid_id text,
      dental text, eyesight text, nutrition text, height_cm numeric, weight_kg numeric, overall_score int)
    ON CONFLICT (school_camp_id, kid_id) DO UPDATE SET
      dental = EXCLUDED.dental, eyesight = EXCLUDED.eyesight, nutrition = EXCLUDED.nutrition,
      height_cm = EXCLUDED.height_cm, weight_kg = EXCLUDED.weight_kg, recorded_at = NOW()
  `;
  await sql`
    UPDATE vita_hero.kids k SET
      dental = CASE WHEN v.dental <> 'NOT_MEASURED' THEN v.dental ELSE k.dental END,
      eyesight = CASE WHEN v.eyesight <> 'NOT_MEASURED' THEN v.eyesight ELSE k.eyesight END,
      nutrition = CASE WHEN v.nutrition <> 'NOT_MEASURED' THEN v.nutrition ELSE k.nutrition END,
      height_cm = COALESCE(v.height_cm, k.height_cm),
      weight_kg = COALESCE(v.weight_kg, k.weight_kg),
      overall_score = v.overall_score,
      last_checkup = ${campDate || "Camp"}
    FROM jsonb_to_recordset(${data}::jsonb) AS v(id text, gp_id text, profile_id text, kid_id text,
      dental text, eyesight text, nutrition text, height_cm numeric, weight_kg numeric, overall_score int)
    WHERE k.id = v.kid_id
  `;
  await sql`
    INSERT INTO vita_hero.growth_points (id, kid_id, user_id, label, height, weight)
    SELECT v.gp_id, v.kid_id, v.profile_id, ${campDate || "Camp"}, COALESCE(v.height_cm, 0), COALESCE(v.weight_kg, 0)
    FROM jsonb_to_recordset(${data}::jsonb) AS v(id text, gp_id text, profile_id text, kid_id text,
      dental text, eyesight text, nutrition text, height_cm numeric, weight_kg numeric, overall_score int)
    WHERE v.height_cm IS NOT NULL OR v.weight_kg IS NOT NULL
    ON CONFLICT (id) DO UPDATE SET
      height = EXCLUDED.height, weight = EXCLUDED.weight, recorded_at = NOW()
  `;
  await sql`
    INSERT INTO vita_hero.camp_registrations (id, profile_id, school_camp_id, kid_id)
    SELECT 'reg_' || v.kid_id || '_' || ${campId}, v.profile_id, ${campId}, v.kid_id
    FROM jsonb_to_recordset(${data}::jsonb) AS v(id text, gp_id text, profile_id text, kid_id text,
      dental text, eyesight text, nutrition text, height_cm numeric, weight_kg numeric, overall_score int)
    ON CONFLICT DO NOTHING
  `;
  await sql`
    INSERT INTO vita_hero.school_enrollments (id, profile_id, school_id, kid_id, status)
    SELECT DISTINCT ON (v.profile_id) 'enr_' || v.profile_id || '_' || ${schoolId}, v.profile_id, ${schoolId}, v.kid_id, 'ACTIVE'
    FROM jsonb_to_recordset(${data}::jsonb) AS v(id text, gp_id text, profile_id text, kid_id text,
      dental text, eyesight text, nutrition text, height_cm numeric, weight_kg numeric, overall_score int)
    ON CONFLICT DO NOTHING
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

/**
 * What a camp still asks its doctors to record. A camp set up with a check
 * since retired (haemoglobin) keeps it in its row; it is dropped here, so
 * nobody is held up by a check the camp can no longer do.
 */
function campCheckList(camp: Record<string, unknown>): string[] {
  const list: string[] = Array.isArray(camp.checks)
    ? (camp.checks as string[])
    : JSON.parse(String(camp.checks || "[]"));
  return list.filter(isDesignedCheck);
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

  const campChecks = campCheckList(access.camp);
  const findings = evaluateChild(campId, kidId, p, campChecks, incoming,
    actor.profileId, { checks: access.checkScope, specialty: access.specialty });
  const done = await recordedChecks(sql, campId, [kidId]);
  assertChecksComplete(myChecks(p, campChecks, { checks: access.checkScope }), findings, done.get(kidId));
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
      detail: findingDetail(f.check_type as string, f.detail),
      flag: f.flag as string,
      rationale: (f.rationale as string) || "",
      note: (f.screener_note as string) || "",
    });
    byKid.set(k, list);
  }
  // The same rule as recordedChecks, from rows already in hand.
  const recorded = new Map<string, Set<string>>();
  for (const f of findings) {
    if (f.flag === "NOT_MEASURED" && !String(f.screener_note || "")) continue;
    const k = f.kid_id as string;
    if (!recorded.has(k)) recorded.set(k, new Set());
    recorded.get(k)!.add(f.check_type as string);
  }

  const campChecks = campCheckList(camp);

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
        dob: dobText(p.date_of_birth),
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
        ...screeningProgress(p, campChecks, access.checkScope, recorded.get(p.kid_id as string)),
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
  const done = await recordedChecks(sql, campId, wanted);

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
      // Attendance alone (absent, refused) records no checks and needs none.
      if (findings.length > 0) {
        assertChecksComplete(myChecks(p, campChecks, { checks: access.checkScope }), findings, done.get(kidId));
      }

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
    SELECT p.kid_id, p.status, p.urgency, p.recommendation, p.reviewed_at, p.consent_checks,
           k.name, k.grade, k.section, k.age, k.gender,
           (SELECT COALESCE(json_agg(DISTINCT f.check_type), '[]'::json) FROM vita_hero.camp_findings f
             WHERE f.camp_id = p.camp_id AND f.kid_id = p.kid_id
               AND (f.flag <> 'NOT_MEASURED' OR COALESCE(f.screener_note, '') <> '')) AS recorded_checks,
           (SELECT COALESCE(json_object_agg(f.check_type, f.flag), '{}'::json) FROM vita_hero.camp_findings f
             WHERE f.camp_id = p.camp_id AND f.kid_id = p.kid_id) AS flags,
           (SELECT COALESCE(json_agg((
               SELECT COALESCE(json_agg(c.v), '[]'::json) FROM jsonb_array_elements_text(s.checks) AS c(v)
               WHERE EXISTS (SELECT 1 FROM vita_hero.camp_findings f
                 WHERE f.camp_id = s.camp_id AND f.kid_id = s.kid_id AND f.check_type = c.v
                   AND f.recorded_at <= s.signed_at))), '[]'::json)
             FROM vita_hero.camp_signoffs s
             WHERE s.camp_id = p.camp_id AND s.kid_id = p.kid_id) AS signoffs,
           (SELECT COALESCE(json_agg(json_build_object('d', COALESCE(cs.doctor_id, ''), 's', COALESCE(cs.specialty, ''))), '[]'::json) FROM vita_hero.camp_staff cs
             WHERE cs.camp_id = ${campId} AND cs.staff_role = 'PHYSICIAN' AND cs.active IS NOT FALSE) AS signer_doctors
    FROM vita_hero.camp_participants p
    JOIN vita_hero.kids k ON k.id = p.kid_id
    WHERE p.camp_id = ${campId} AND p.status IN ('SCREENED','APPROVED')
  `;
  const campChecks = campCheckList(access.camp);

  // Who on this camp can sign what. A check no assigned physician covers
  // would wait for ever, so the queue names it rather than leave it waiting.
  const signers = (rows[0]?.signer_doctors as Array<{ d: string; s: string }>) || [];
  const doctorIds = signers.filter((x) => !normaliseSpecialty(x.s) && x.d).map((x) => x.d);
  const specialties = doctorIds.length === 0 ? [] : await sql`
    SELECT specialty FROM vita_hero.doctors WHERE id = ANY(${doctorIds})
  `;
  const scopes: Array<string[] | null> = [
    ...signers.filter((x) => normaliseSpecialty(x.s)).map((x) => screeningChecksFor(x.s)),
    ...signers.filter((x) => !normaliseSpecialty(x.s) && !x.d).map(() => null),
    ...specialties.map((d) => {
      const name = normaliseSpecialty(String(d.specialty || ""));
      return name ? screeningChecksFor(name) : null;
    }),
  ];
  const coverable = (c: string) => scopes.some((sc) => sc === null || sc.includes(c));

  const queue = [];
  for (const r of rows) {
    const consented = consentedChecks(r, campChecks);
    const mine = access.checkScope ? consented.filter((c) => access.checkScope!.includes(c)) : consented;
    // A child with none of this specialist's checks is not theirs to review.
    if (access.checkScope && mine.length === 0) continue;
    const recorded = new Set((r.recorded_checks as string[]) || []);
    const signed = new Set(((r.signoffs as Array<string[] | null>) || []).flatMap((x) => x || []));
    // Only this clinician's own flags: the dentist is not shown the eye result.
    const flags = (r.flags as Record<string, string>) || {};
    const shown = Object.entries(flags).filter(([c]) => !access.checkScope || access.checkScope.includes(c));
    const state =
      r.status === "APPROVED" ? "APPROVED"
        : mine.every((c) => signed.has(c)) ? "SIGNED"
          : mine.some((c) => !recorded.has(c)) ? "NOT_READY"
            : "TO_SIGN";
    queue.push({
      kidId: r.kid_id as string,
      name: r.name as string,
      grade: `${(r.grade as string) || ""} ${(r.section as string) || ""}`.trim(),
      age: (r.age as number) ?? null,
      alerts: shown.filter(([, f]) => f === "ALERT").length,
      watches: shown.filter(([, f]) => f === "WATCH").length,
      status: r.status as string,
      urgency: (r.urgency as string) || "NONE",
      recommendation: access.checkScope ? "" : (r.recommendation as string) || "",
      reviewed: !!r.reviewed_at,
      // TO_SIGN: yours, ready. NOT_READY: one of your checks is not recorded.
      // SIGNED: you have signed, others have not. APPROVED: everyone has.
      reviewState: state,
      myChecks: mine,
      checks: consented,
      signedChecks: consented.filter((c) => signed.has(c)),
      // The other specialties this child still needs a sign-off from.
      waitingFor: consented.filter((c) => !signed.has(c) && !mine.includes(c)),
      // Checks nobody assigned to this camp can sign off.
      noSigner: consented.filter((c) => !signed.has(c) && !coverable(c)),
    });
  }
  queue.sort((a, b) => b.alerts - a.alerts || b.watches - a.watches || a.name.localeCompare(b.name));
  return { queue };
}

/** Sign-offs for one child, keeping only the checks not re-recorded since. */
async function validSignoffs(sql: Sql, campId: string, kidId: string) {
  const rows = await sql`
    SELECT s.signed_by, s.urgency, s.recommendation, s.signed_at, pr.name AS signer_name,
           (SELECT COALESCE(json_agg(c.v), '[]'::json) FROM jsonb_array_elements_text(s.checks) AS c(v)
             WHERE EXISTS (SELECT 1 FROM vita_hero.camp_findings f
               WHERE f.camp_id = s.camp_id AND f.kid_id = s.kid_id AND f.check_type = c.v
                 AND f.recorded_at <= s.signed_at)) AS valid_checks
    FROM vita_hero.camp_signoffs s
    LEFT JOIN vita_hero.profiles pr ON pr.id = s.signed_by
    WHERE s.camp_id = ${campId} AND s.kid_id = ${kidId}
  `;
  return rows.map((r) => ({
    profileId: r.signed_by as string,
    checks: (r.valid_checks as string[]) || [],
    urgency: ((r.urgency as string) || "NONE") as Urgency,
    recommendation: (r.recommendation as string) || "",
    signedAt: r.signed_at ? new Date(r.signed_at as string).toISOString() : "",
    signerName: (r.signer_name as string) || "",
  }));
}

/**
 * What the guardian reads: each specialist's words, in the camp's order of
 * checks. One sign-off covering everything reads as it was written.
 */
export function combineSignoffs(
  rows: Array<{ checks: string[]; recommendation: string }>,
  campChecks: string[]
): string {
  const order = (r: { checks: string[] }) =>
    Math.min(...r.checks.map((c) => (campChecks.indexOf(c) + 1) || 999));
  const parts = rows.filter((r) => r.checks.length > 0).sort((a, b) => order(a) - order(b));
  if (parts.length <= 1) return parts[0]?.recommendation || "";
  return parts.map((r) => `${r.checks.join(", ")}: ${r.recommendation}`).join("\n\n");
}

/**
 * Where a general physician starts: what the specialists signed, plus a draft
 * for the checks nobody has signed yet — those are the physician's to cover,
 * and leaving them out had a flagged ear read as if only vision and teeth
 * were checked. Empty when no specialist has signed, so the caller drafts the
 * whole check-up.
 */
export function physicianDraft(
  name: string,
  signoffs: Array<{ checks: string[]; recommendation: string }>,
  unsigned: string[],
  findings: Array<{ checkType: string; flag: Flag; detail: Record<string, unknown>; urgency: Urgency }>,
  campChecks: string[]
): string {
  const signed = signoffs.filter((so) => so.checks.length > 0);
  if (signed.length === 0) return "";
  if (unsigned.length === 0) return combineSignoffs(signed, campChecks);
  const rest = findings.filter((f) => unsigned.includes(f.checkType));
  const draft = draftRecommendation(name, summariseForApp(rest), rest, unsigned.join(" and "));
  return combineSignoffs([...signed, { checks: unsigned, recommendation: draft }], campChecks);
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

  // A specialist reviews their own checks only. The rest of the child is
  // somebody else's to read and sign; they see only whether it is done.
  const campChecks = campCheckList(access.camp);
  const consented = consentedChecks(p, campChecks);
  const mine = access.checkScope ? consented.filter((c) => access.checkScope!.includes(c)) : consented;
  const recordedSet = new Set(fRows
    .filter((f) => f.flag !== "NOT_MEASURED" || String(f.screener_note || "") !== "")
    .map((f) => f.check_type as string));
  const signoffs = await validSignoffs(sql, campId, kidId);
  const signerOf = new Map<string, string>();
  for (const so of signoffs) for (const c of so.checks) signerOf.set(c, so.signerName || "A clinician");
  const mySignoff = signoffs.find((so) => so.profileId === actor.profileId && so.checks.length > 0) || null;

  // The child as the assessment sheets read them, as the guardian sees them.
  const sheetChild: SheetChild = {
    ageYears: p.age === null || p.age === undefined ? null : Number(p.age),
    gender: (p.gender as string) || "",
    dob: dobText(p.date_of_birth),
  };
  const findings = fRows
    .filter((f) => !access.checkScope || access.checkScope.includes(f.check_type as string))
    .map((f) => ({
    checkType: f.check_type as string,
    detail: reviewGrowth(f.check_type as string, findingDetail(f.check_type as string, f.detail), sheetChild),
    sheet: assessmentSheet(f.check_type as string, f.detail, sheetChild) ?? undefined,
    flag: f.flag as Flag,
    autoFlag: f.auto_flag as Flag,
    rationale: (f.rationale as string) || "",
    urgency: (f.urgency as Urgency) || "NONE",
    screenerNote: (f.screener_note as string) || "",
    screenerName: (f.screener_name as string) || "",
    reviewNote: (f.review_note as string) || "",
    overridden: (f.flag as string) !== (f.auto_flag as string),
    signedBy: signerOf.get(f.check_type as string) || "",
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
  // A specialist starts from their own earlier words, or a draft about their
  // own checks; a general physician from the child's whole message, with a
  // draft for the checks no specialist has signed.
  const existing = mySignoff?.recommendation || (access.checkScope ? "" :
    physicianDraft(String(p.name), signoffs, consented.filter((c) => !signerOf.has(c)), findings, campChecks) ||
    (p.recommendation as string) || "");
  const area = access.checkScope ? mine.join(" and ") : "";

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
    suggestedUrgency: mySignoff?.urgency || summary.urgency,
    recommendation: existing || draftRecommendation(String(p.name), summary, findings, area),
    recommendationIsDraft: !existing,
    myChecks: mine,
    mySignedAt: mySignoff?.signedAt || "",
    // Everyone else's share, without their results: done or not, and by whom.
    otherChecks: consented.filter((c) => !mine.includes(c)).map((c) => ({
      checkType: c,
      recorded: recordedSet.has(c),
      signedBy: signerOf.get(c) || "",
    })),
    waitingFor: consented.filter((c) => !signerOf.has(c) && !mine.includes(c)),
    // What the family has logged since the last camp, for the doctor
    // signing off. Null when this reader is not one of the clinical team.
    illnessHistory: await illnessHistoryOrNull(sql, actor, campId, kidId),
  };
}

/**
 * A growth record as the reviewing doctor reads it: height and weight, then
 * the BMI and the nutritional status worked out from them, so the physician
 * signs off on the reading and not only on the two numbers.
 */
function reviewGrowth(checkType: string, detail: Record<string, unknown>, child: SheetChild) {
  if (checkType !== "Height & weight") return detail;
  const g = growthSummary(detail, child);
  if (!g.bmi) return detail;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(detail)) {
    if (k === "bmi" || k === "nutritionalStatus") continue;
    out[k] = v;
    if (k === "weightKg") {
      out.bmi = g.bmi;
      if (g.nutritionalStatus) out.nutritionalStatus = g.nutritionalStatus;
    }
  }
  if (!("bmi" in out)) {
    out.bmi = g.bmi;
    if (g.nutritionalStatus) out.nutritionalStatus = g.nutritionalStatus;
  }
  return out;
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
    SELECT status, urgency, consent_checks FROM vita_hero.camp_participants
    WHERE camp_id = ${campId} AND kid_id = ${kidId} LIMIT 1
  `;
  if (pRows.length === 0) throw new ApiError(404, "That child is not on this camp's list", "NOT_ON_CAMP");
  if ((pRows[0].status as string) === "RELEASED") {
    throw new ApiError(409, "Already released to the guardian", "RELEASED");
  }
  if ((pRows[0].status as string) === "NOT_SCREENED") {
    throw new ApiError(409, "This child has not been screened yet", "NOT_SCREENED");
  }

  // Each clinician signs off their own share: a specialist the checks of their
  // specialty, a general physician all of them. The child is approved when
  // every check the guardian agreed to has been signed by somebody.
  const campChecks = campCheckList(access.camp);
  const consented = consentedChecks(pRows[0], campChecks);
  const mine = access.checkScope ? consented.filter((c) => access.checkScope!.includes(c)) : consented;
  if (mine.length === 0) {
    throw new ApiError(
      403,
      "None of this child's checks are in your specialty, so there is nothing for you to sign off.",
      "NOT_YOUR_CHILD"
    );
  }
  const done = (await recordedChecks(sql, campId, [kidId])).get(kidId);
  const outstanding = mine.filter((c) => !done?.has(c));
  if (outstanding.length > 0) {
    throw new ApiError(
      409,
      `Not yet recorded for this child: ${outstanding.join(", ")}. ` +
        "Record it, or mark it could not be done with a reason, before you sign off.",
      "CHECKS_OUTSTANDING"
    );
  }

  // Apply per-finding adjustments, to this clinician's own checks only: a
  // dentist must not turn a vision ALERT to GOOD.
  const adjustments = Array.isArray(body.findings) ? (body.findings as Record<string, unknown>[]) : [];
  for (const a of adjustments) {
    const checkType = String(a.checkType || "");
    if (!isCheckType(checkType)) continue;
    const flag = String(a.flag || "").toUpperCase();
    if (!["GOOD", "WATCH", "ALERT", "NOT_MEASURED"].includes(flag)) {
      throw new ApiError(400, "Unknown flag value", "BAD_FLAG");
    }
    if (!mine.includes(checkType)) {
      throw new ApiError(
        403,
        `${checkType} is signed off by the clinician whose specialty it is, not by you.`,
        "NOT_YOUR_CHECK"
      );
    }
    await sql`
      UPDATE vita_hero.camp_findings
      SET flag = ${flag}, review_note = ${String(a.note || "")}
      WHERE camp_id = ${campId} AND kid_id = ${kidId} AND check_type = ${checkType}
    `;
  }

  const recommendation = String(body.recommendation || "").trim();
  if (!recommendation) {
    throw new ApiError(400, "Write what the guardian should do next", "NO_RECOMMENDATION");
  }

  const fRows = await sql`
    SELECT check_type, urgency FROM vita_hero.camp_findings
    WHERE camp_id = ${campId} AND kid_id = ${kidId} AND check_type = ANY(${mine})
  `;
  const urgencyInput = String(body.urgency || "").toUpperCase();
  const urgency: Urgency = ["NONE", "ROUTINE", "SOON", "URGENT"].includes(urgencyInput)
    ? (urgencyInput as Urgency)
    : worstUrgency(fRows.map((f) => ((f.urgency as Urgency) || "NONE")));

  const wasUrgent = (pRows[0].urgency as string) === "URGENT";

  await sql`
    UPDATE vita_hero.camp_findings SET reviewed_by = ${actor.profileId}, reviewed_at = NOW()
    WHERE camp_id = ${campId} AND kid_id = ${kidId} AND check_type = ANY(${mine})
  `;
  await sql`
    INSERT INTO vita_hero.camp_signoffs (camp_id, kid_id, signed_by, checks, urgency, recommendation, signed_at)
    VALUES (${campId}, ${kidId}, ${actor.profileId}, ${JSON.stringify(mine)}::jsonb, ${urgency}, ${recommendation}, NOW())
    ON CONFLICT (camp_id, kid_id, signed_by) DO UPDATE SET
      checks = EXCLUDED.checks, urgency = EXCLUDED.urgency,
      recommendation = EXCLUDED.recommendation, signed_at = NOW()
  `;
  // These checks are now this clinician's; whoever signed them before no
  // longer answers for them, so the family does not read both. Only older
  // sign-offs give way: two clinicians signing at the same moment each
  // stripped the other, nobody held the check, and the child stayed
  // unapproved while both were told it had worked.
  await sql`
    UPDATE vita_hero.camp_signoffs s
    SET checks = (SELECT COALESCE(jsonb_agg(c.v), '[]'::jsonb)
                  FROM jsonb_array_elements_text(s.checks) AS c(v) WHERE NOT (c.v = ANY(${mine})))
    WHERE s.camp_id = ${campId} AND s.kid_id = ${kidId} AND s.signed_by <> ${actor.profileId}
      AND s.signed_at < (SELECT m.signed_at FROM vita_hero.camp_signoffs m
                         WHERE m.camp_id = ${campId} AND m.kid_id = ${kidId}
                           AND m.signed_by = ${actor.profileId})
  `;

  const signoffs = await validSignoffs(sql, campId, kidId);
  const signed = new Set(signoffs.flatMap((so) => so.checks));
  const complete = consented.every((c) => signed.has(c));
  const overall = worstUrgency(signoffs.filter((so) => so.checks.length > 0).map((so) => so.urgency));
  const combined = combineSignoffs(signoffs, campChecks);

  if (complete) {
    await sql`
      UPDATE vita_hero.camp_participants
      SET status = 'APPROVED', urgency = ${overall}, recommendation = ${combined},
          reviewed_at = NOW(), reviewed_by = ${actor.profileId}
      WHERE camp_id = ${campId} AND kid_id = ${kidId}
    `;
  } else {
    // Not approved yet, but the urgency is kept so an urgent part is told
    // once, now, and not again when the next specialist signs.
    await sql`
      UPDATE vita_hero.camp_participants SET urgency = ${overall}, recommendation = ${combined}
      WHERE camp_id = ${campId} AND kid_id = ${kidId}
    `;
  }

  // D4 — an urgent case is told now, not batched with everyone else at release.
  // Waiting for the whole camp to be reviewed could be days.
  let escalated = false;
  if (urgency === "URGENT" && !wasUrgent && sendSms) {
    // Two clinicians signing the same child at once both read it as not yet
    // urgent, and both texted the family. The log row is the claim: its id is
    // the child's, so only one of them writes it and only that one texts.
    const claim = await sql`
      INSERT INTO vita_hero.consent_log (id, camp_id, kid_id, profile_id, action, source, actor_id, note)
      SELECT ${"esc_" + campId + "_" + kidId},
             ${campId}, ${kidId}, p.profile_id, 'URGENT_ESCALATED', 'SMS', ${actor.profileId},
             'No mobile on file — school must call'
      FROM vita_hero.camp_participants p WHERE p.camp_id = ${campId} AND p.kid_id = ${kidId}
      ON CONFLICT DO NOTHING
      RETURNING id
    `;
    if (claim.length > 0) {
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
      if (escalated) {
        await sql`
          UPDATE vita_hero.consent_log SET note = 'Guardian notified immediately'
          WHERE id = ${claim[0].id as string}
        `;
      }
    }
  }

  return {
    kidId,
    status: complete ? "APPROVED" : (pRows[0].status as string),
    urgency: overall,
    escalated,
    signedChecks: mine,
    // The checks still to be signed, by others, before the child is approved.
    waitingFor: consented.filter((c) => !signed.has(c)),
  };
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
  sendSms: SmsSender,
  opts: { kidIds?: string[] } = {}
) {
  const access = await assertCampAccess(sql, actor, campId);
  assertCan(access.canReview, "release results for this camp");
  const camp = access.camp;
  // One child, released the moment their doctor approves them, so a family is
  // not kept waiting on the rest of the school. Leaving it out releases every
  // approved child, as the camp-wide button always has.
  const only = Array.isArray(opts.kidIds) && opts.kidIds.length > 0 ? opts.kidIds.map(String) : null;

  const approved = await sql`
    SELECT p.kid_id, p.profile_id, p.urgency, p.recommendation, k.name
    FROM vita_hero.camp_participants p
    JOIN vita_hero.kids k ON k.id = p.kid_id
    WHERE p.camp_id = ${campId} AND p.status = 'APPROVED'
      AND (${!only} OR p.kid_id = ANY(${only || []}))
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
      detail: findingDetail(f.check_type as string, f.detail),
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
  //
  // The statements below run alongside any other release of the same camp,
  // which a doctor approving one child while another releases the school
  // does. Each one's id is derived from its key, and an upsert or skip only
  // arbitrates on the key it names: the second insert of the same id failed
  // on the primary key and the release answered 500. So ids here are unique
  // per write, and the skips skip on any key.
  await writeBatched(
    plan.map((p) => [
      `ckr_${campId}_${p.kidId}_${crypto.randomUUID().slice(0, 8)}`,
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
        // Whole kid id: this row is keyed on id, so a cut one let a classmate's
        // release overwrite this child's height and weight. Not slugified
        // either: that cuts at 40 characters, and imported ids run to 47.
        `gp_${p.kidId}_${slugify(campDate || campId)}`,
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
      `reg_${p.kidId}_${campId}`, p.profileId, campId, p.kidId,
    ]),
    (values) => `
      INSERT INTO vita_hero.camp_registrations (id, profile_id, school_camp_id, kid_id)
      VALUES ${values}
      ON CONFLICT DO NOTHING`
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
        `enr_${p.profileId}_${schoolId}`,
        p.profileId, schoolId, p.kidId, "ACTIVE",
      ]);
    }
  }
  await writeBatched(
    [...enrolments.values()],
    (values) => `
      INSERT INTO vita_hero.school_enrollments (id, profile_id, school_id, kid_id, status)
      VALUES ${values}
      ON CONFLICT DO NOTHING`
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
      AND (${!only} OR kid_id = ANY(${only || []}))
  `;

  // Releasing one child does not finish the camp: its RELEASED status locks
  // the camp and tells every unscreened family their child was missed.
  if (!only) {
    await sql`
      UPDATE vita_hero.school_camps
      SET status = 'RELEASED', released_at = NOW(), released_by = ${actor.profileId}
      WHERE id = ${campId}
    `;
  }

  // Everybody is told their child's results exist.
  //
  // This used to text only the urgent cases and leave everyone else to
  // discover the result by opening the app. That is defensible in a pilot
  // where the school also tells parents in the playground, and it stops being
  // defensible at any size: most parents never open the app again after
  // consenting, so for most children the result was screened, reviewed,
  // approved, released — and read by nobody.
  //
  // The wording follows the finding rather than being one message for all.
  // Telling a parent whose child is fine that something "needs a doctor's
  // attention" is a frightening lie; telling a parent whose child is not that
  // "results are ready" buries the one sentence that mattered.
  //
  // The URGENT_ESCALATED guard stays and now covers everyone: a camp released
  // twice — which happens, because approving a straggler and releasing again
  // is the normal way to finish one — must not text the same family twice.
  //
  // Reading who is untold and then texting them was not enough on its own:
  // two releases at the same moment both read every family as untold before
  // either had logged a text, and every parent got two. So a family is
  // claimed first, in one statement, and a release that loses the row to
  // another skips it. A claim that is old and never became a logged text
  // (the worker died mid-send) is free to be taken again.
  const toTell = await sql`
    UPDATE vita_hero.camp_participants p SET result_notified_at = NOW()
    FROM vita_hero.kids k, vita_hero.profiles pr
    WHERE k.id = p.kid_id AND pr.id = p.profile_id
      AND p.camp_id = ${campId} AND p.status = 'RELEASED'
      AND (${!only} OR p.kid_id = ANY(${only || []}))
      AND COALESCE(pr.phone,'') <> ''
      AND (p.result_notified_at IS NULL OR p.result_notified_at < NOW() - INTERVAL '15 minutes')
      AND NOT EXISTS (
        SELECT 1 FROM vita_hero.consent_log cl
        WHERE cl.camp_id = p.camp_id AND cl.kid_id = p.kid_id
          AND cl.action IN ('URGENT_ESCALATED','RESULT_NOTIFIED')
      )
    RETURNING p.kid_id, p.profile_id, p.urgency, k.name, pr.phone
  `;

  const messageFor = (name: string, urgency: string): string =>
    urgency === "URGENT"
      ? `VitaHero: ${name}'s school health check-up found something that needs a doctor's attention soon. Please open the VitaHero app for details.`
      : `VitaHero: ${name}'s school health check-up results are ready. Open the VitaHero app to read them.`;

  // An SMS is one subrequest each and there is no bulk endpoint, so these go
  // eight at a time rather than strictly one after another — a camp of four
  // hundred would otherwise run out of wall clock before the last parent is
  // told.
  const landedAll: Record<string, unknown>[] = [];
  for (const group of chunk(toTell, 8)) {
    const sent = await Promise.all(
      group.map(async (u) => {
        const ok = await sendSms(
          u.phone as string,
          messageFor(u.name as string, String(u.urgency || "NONE"))
        ).catch(() => null);
        // The sender reports a refusal as {ok: false} rather than throwing, and
        // an object is truthy: testing it whole counted every failed text as
        // delivered, so the parent was never retried.
        return ok && ok.ok ? u : null;
      })
    );
    landedAll.push(...(sent.filter(Boolean) as Record<string, unknown>[]));
  }
  // A text that did not go is let go of, so the next release tries it again.
  const landedIds = new Set(landedAll.map((u) => u.kid_id as string));
  const unsent = toTell.map((u) => u.kid_id as string).filter((id) => !landedIds.has(id));
  if (unsent.length > 0) {
    await sql`
      UPDATE vita_hero.camp_participants SET result_notified_at = NULL
      WHERE camp_id = ${campId} AND kid_id = ANY(${unsent})
    `;
  }
  const notified = landedAll.length;
  const urgentNotified = landedAll.filter((u) => u.urgency === "URGENT").length;

  // Written for exactly the rows that sent, against the child they were about.
  //
  // Three things have to be right here or a camp of four hundred gets texted
  // twice. The kid_id must be the real one, because the guard above matches on
  // it — a blank would make that NOT EXISTS unsatisfiable and every re-release
  // would text everybody again. It must be the rows that actually landed, not
  // a count of them, because a failed text should be retried by the next
  // release rather than recorded as delivered. And it covers the urgent ones
  // too: a child who became urgent without ever being escalated at review has
  // no URGENT_ESCALATED row to stop them.
  if (landedAll.length > 0) {
    await insertRows(
      sql,
      `INSERT INTO vita_hero.consent_log
         (id, camp_id, kid_id, profile_id, action, source, actor_id, note)
       VALUES %VALUES%`,
      landedAll.map((u, i) => [
        `cl_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 6)}`,
        campId,
        u.kid_id as string,
        (u.profile_id as string) || "",
        "RESULT_NOTIFIED",
        "SMS",
        actor.profileId,
        u.urgency === "URGENT" ? "Urgent result" : "Results ready",
      ])
      // A failed audit write must not fail a release that has already
      // happened. The cost of swallowing it is that the next release texts
      // these families again, which is the safer of the two directions.
    ).catch(() => undefined);
  }

  return { released: plan.length, referralsOpened, notified, urgentNotified };
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
      checks: campCheckList(r),
      // When true the app must ask the photography question as well, as its own
      // yes/no. When false it must not show it at all.
      photosAsked: r.photos_enabled === true,
    })),
  };
}

/**
 * Where a child is in the camp, for their guardian, at any moment: which of
 * the camp's checks have been done, which are still to come, and who has the
 * result now. It says nothing about what any check found. A reading nobody has
 * reviewed can be wrong, and an alert with no doctor's words beside it only
 * frightens; the findings themselves still wait for release.
 */
export function guardianProgress(
  p: Record<string, unknown>,
  campChecks: string[],
  recorded: Map<string, boolean>
) {
  const consent = (p.consent_status as string) || "PENDING";
  const attendance = (p.attendance as string) || "UNKNOWN";
  const status = (p.status as string) || "NOT_SCREENED";
  const campStatus = (p.camp_status as string) || "";
  const agreed = consent === "GRANTED" || consent === "PAPER";
  const consented = new Set(agreed ? consentedChecks(p, campChecks) : []);
  // Absent, refused, or the camp has closed without them: nothing more is coming.
  const finished = status === "RELEASED" || attendance === "ABSENT" || attendance === "REFUSED" ||
    campStatus === "RELEASED";
  const checks = campChecks.map((c) => {
    let state: string;
    if (!consented.has(c)) state = "NOT_CONSENTED";
    else if (recorded.get(c) === true) state = "DONE";
    // Recorded as not done, with the screener's reason.
    else if (recorded.has(c) || finished) state = "NOT_DONE";
    else state = "PENDING";
    return { checkType: c, state };
  });
  const asked = checks.filter((c) => c.state !== "NOT_CONSENTED");
  const done = asked.filter((c) => c.state === "DONE").length;
  let stage: string;
  if (status === "RELEASED") stage = "RELEASED";
  else if (consent === "DECLINED") stage = "DECLINED";
  else if (!agreed) stage = "CONSENT_NEEDED";
  else if (status === "SCREENED" || status === "APPROVED") {
    // Screened children whose remaining checks will never happen are with the
    // doctor too: the camp is not waiting on them any more.
    stage = asked.some((c) => c.state === "PENDING") && !finished ? "SCREENING" : "WITH_DOCTOR";
  } else if (finished) stage = "NOT_SCREENED";
  else stage = done > 0 ? "SCREENING" : "WAITING";
  return { stage, done, total: asked.length, checks };
}

/**
 * The newest growth, vision and dental sheets a guardian may read for one
 * child, whichever camp each came from.
 *
 * The child's own screen used to show only the flag and a stock sentence
 * ("some plaque was noted") whatever the doctor wrote. It now shows what was
 * tested. Each camp is read through guardianCampResult, so a check the
 * parent cannot yet see there is not shown here either.
 */
export async function guardianLatestSheets(sql: Sql, profileId: string, kidId: string) {
  const camps = await sql`
    SELECT p.camp_id FROM vita_hero.camp_participants p
    JOIN vita_hero.school_camps sc ON sc.id = p.camp_id
    WHERE p.kid_id = ${kidId} AND p.profile_id = ${profileId}
    ORDER BY sc.date DESC NULLS LAST, p.camp_id DESC
    LIMIT 6
  `;
  const wanted = ["Height & weight", "Vision", "Dental"];
  const found = new Map<string, Record<string, unknown>>();
  for (const c of camps) {
    const r = await guardianCampResult(sql, profileId, c.camp_id as string, kidId);
    if (!("findings" in r) || !r.findings) continue;
    for (const f of r.findings) {
      if (!wanted.includes(f.checkType) || found.has(f.checkType) || !f.sheet) continue;
      found.set(f.checkType, f);
    }
    if (found.size === wanted.length) break;
  }
  return { findings: wanted.filter((w) => found.has(w)).map((w) => found.get(w)!) };
}

/** A released result, in the detail the app's results screen wants. */
export async function guardianCampResult(
  sql: Sql,
  profileId: string,
  campId: string,
  kidId: string
) {
  const pRows = await sql`
    SELECT p.*, k.name, k.gender, k.age, k.date_of_birth,
           sc.title, sc.date, sc.status AS camp_status, sc.checks AS camp_checks,
           s.name AS school_name
    FROM vita_hero.camp_participants p
    JOIN vita_hero.kids k ON k.id = p.kid_id
    JOIN vita_hero.school_camps sc ON sc.id = p.camp_id
    JOIN vita_hero.schools s ON s.id = sc.school_id
    WHERE p.camp_id = ${campId} AND p.kid_id = ${kidId} AND p.profile_id = ${profileId}
    LIMIT 1
  `;
  if (pRows.length === 0) throw new ApiError(404, "No result for that child at that camp", "NOT_FOUND");
  const p = pRows[0];
  // The child as the sheets and the WHO chart read them.
  const child: SheetChild = {
    ageYears: p.age === null || p.age === undefined ? null : Number(p.age),
    gender: (p.gender as string) || "",
    dob: dobText(p.date_of_birth),
  };
  const finding = (f: Record<string, unknown>) => ({
    checkType: f.check_type as string,
    flag: f.flag as string,
    summary: (f.value_text as string) || "",
    // The reviewing doctor's own words win over the rule's, which they read
    // and may have overruled.
    note: String(f.review_note || "").trim() || (f.rationale as string) || "",
    // The paper sheet's columns for growth, vision and dental; absent for the rest.
    sheet: assessmentSheet(f.check_type as string, f.detail, child) ?? undefined,
    // The camp the values were taken at, for the child screen's latest sheets.
    campTitle: (p.title as string) || "",
    date: (p.date as string) || "",
  });
  const childInfo = { gender: child.gender, dob: child.dob, age: child.ageYears };
  // Measured, or declared not done with a reason (false). The same rule as
  // recordedChecks, but with the difference kept for the guardian.
  const rec = await sql`
    SELECT check_type, flag FROM vita_hero.camp_findings
    WHERE camp_id = ${campId} AND kid_id = ${kidId}
      AND (flag <> 'NOT_MEASURED' OR COALESCE(screener_note, '') <> '')
  `;
  const recorded = new Map<string, boolean>(
    rec.map((r) => [r.check_type as string, (r.flag as string) !== "NOT_MEASURED"])
  );
  const progress = guardianProgress(p, campCheckList({ checks: p.camp_checks }), recorded);
  if ((p.status as string) !== "RELEASED") {
    // A child who was away, refused, or was never reached will not have a
    // result, and telling the parent a doctor is reviewing it kept them
    // waiting for something that was never coming.
    const attendance = (p.attendance as string) || "UNKNOWN";
    const neverSeen = (p.status as string) === "NOT_SCREENED" &&
      (attendance === "ABSENT" || attendance === "REFUSED" || (p.camp_status as string) === "RELEASED");
    if (neverSeen) {
      return {
        status: "NOT_SCREENED",
        progress,
        message: attendance === "REFUSED"
          ? "Your child did not take part in this check-up, so there is no result. Ask the school about the next camp."
          : "Your child was not checked at this camp, so there is no result. Ask the school about the next camp.",
      };
    }
    // Each check is shown the moment its doctor submits it. The ones still
    // to come are listed in progress as PENDING.
    if (progress.done > 0) {
      const fRows = await sql`
        SELECT check_type, flag, rationale, review_note, value_text, detail FROM vita_hero.camp_findings
        WHERE camp_id = ${campId} AND kid_id = ${kidId}
          AND (flag <> 'NOT_MEASURED' OR COALESCE(screener_note, '') <> '')
        ORDER BY check_type
      `;
      const pending = progress.checks.filter((c) => c.state === "PENDING").map((c) => c.checkType);
      return {
        // RELEASED so an app that knows only that word shows the findings; partial
        // says more checks are still to come.
        status: "RELEASED",
        partial: pending.length > 0,
        pendingChecks: pending,
        progress,
        kidName: p.name as string,
        schoolName: p.school_name as string,
        campTitle: p.title as string,
        date: (p.date as string) || "",
        urgency: (p.urgency as string) || "NONE",
        recommendation: (p.recommendation as string) || "",
        message: pending.length > 0
          ? `Results so far. Still to be done: ${pending.join(", ")}.`
          : "Every check is done. The doctor may add a note when they review the results.",
        child: childInfo,
        findings: fRows.map(finding),
      };
    }
    const message = progress.stage === "WITH_DOCTOR"
      ? "Every check is done. A doctor is reviewing the results, which will appear here once they sign them off."
      : progress.stage === "CONSENT_NEEDED"
        ? "The school is waiting for your consent before your child can be checked."
        : progress.stage === "DECLINED"
          ? "You declined consent for this camp, so your child will not be checked."
          : "Your child's check-up is under way. Each check shows here as it is done; results follow once a doctor has reviewed them.";
    return { status: "PENDING", progress, message };
  }
  const fRows = await sql`
    SELECT check_type, flag, rationale, review_note, value_text, detail FROM vita_hero.camp_findings
    WHERE camp_id = ${campId} AND kid_id = ${kidId} ORDER BY check_type
  `;
  return {
    status: "RELEASED",
    partial: false,
    pendingChecks: [] as string[],
    progress,
    kidName: p.name as string,
    schoolName: p.school_name as string,
    campTitle: p.title as string,
    date: (p.date as string) || "",
    urgency: (p.urgency as string) || "NONE",
    recommendation: (p.recommendation as string) || "",
    child: childInfo,
    findings: fRows.map(finding),
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

  // The same specialty rule assignDoctorToCamp enforces, applied to the other
  // door. That one refuses a dermatologist because VitaHero has no skin check
  // to record; this one took a profile id and asked only about the role, so
  // the identical assignment succeeded by coming in the side entrance. The
  // doctor then signs in, finds the child, opens the form and there is
  // nothing in it — which is discovered in a school hall rather than here.
  //
  // Matched on the number, because that is what ties a profile to a directory
  // entry: assignDoctorToCamp mints the profile as ph_<last ten digits>.
  // What they record here. The console sends it ("What they check"); a
  // directory doctor with the same number fills it in when it doesn't. A
  // physician with neither is the school's generalist and records every check
  // — that has to be a choice, because a dentist who silently became one had
  // to fill in the eye check to save, and the eye doctor then found the child
  // already done.
  //
  // The directory lookup is wrapped: a failure means "no entry to judge by",
  // never a camp nobody can be staffed for.
  const dir = role === "PHYSICIAN"
    ? await sql`
        SELECT id, name, specialty FROM vita_hero.doctors
        WHERE active = true AND RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10)
              = ${profileId.replace(/^ph_/, "")}
        LIMIT 1
      `.catch(() => [] as Record<string, unknown>[])
    : [];
  const asked = String(body.specialty ?? "").trim();
  let specialty = "";
  {
    if (asked) {
      specialty = normaliseSpecialty(asked);
      if (!specialty || screeningChecksFor(specialty).length === 0) {
        throw new ApiError(
          400,
          `VitaHero has no screening form for "${asked}", so there would be nothing ` +
            `for them to record at this camp.`,
          "SPECIALTY_NOT_SCREENED"
        );
      }
    } else if (role === "PHYSICIAN" && dir.length > 0) {
      // Same rule assignDoctorToCamp enforces, so the side door can't seat a
      // dermatologist with an empty form either.
      const raw = String(dir[0].specialty || "");
      specialty = normaliseSpecialty(raw);
      if (screeningChecksFor(raw).length === 0) {
        throw new ApiError(
          400,
          `${dir[0].name as string} is ${raw || "a doctor"} and VitaHero has no ` +
            `screening form for that yet, so there would be nothing for them to record ` +
            `at this camp.`,
          "SPECIALTY_NOT_SCREENED"
        );
      }
    }
  }
  const doctorId = dir.length > 0 ? String(dir[0].id) : null;

  await sql`
    INSERT INTO vita_hero.camp_staff (id, camp_id, profile_id, staff_role, doctor_id, specialty)
    VALUES (${"cst_" + campId + "_" + profileId + "_" + crypto.randomUUID().slice(0, 8)}, ${campId}, ${profileId}, ${role}, ${doctorId}, ${specialty})
    ON CONFLICT (camp_id, profile_id) DO UPDATE SET
      staff_role = EXCLUDED.staff_role,
      doctor_id = COALESCE(EXCLUDED.doctor_id, vita_hero.camp_staff.doctor_id),
      specialty = CASE WHEN EXCLUDED.specialty <> '' THEN EXCLUDED.specialty ELSE vita_hero.camp_staff.specialty END
  `;
  return {
    assigned: {
      profileId, name: rows[0].name as string, role, specialty,
      checks: specialty ? screeningChecksFor(specialty) : null,
    },
  };
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
    VALUES (${"cst_" + campId + "_" + profileId + "_" + crypto.randomUUID().slice(0, 8)},
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

/**
 * Set what someone records at this camp. "" makes them the generalist who
 * records every check. Refused for a specialty with no screening form.
 */
export async function setCampStaffSpecialty(
  sql: Sql,
  actor: Actor,
  campId: string,
  profileId: string,
  value: string
) {
  const access = await assertCampAccess(sql, actor, campId);
  assertCan(access.canSchedule, "change staff on this camp");
  const raw = String(value || "").trim();
  const specialty = raw ? normaliseSpecialty(raw) : "";
  if (raw && (!specialty || screeningChecksFor(specialty).length === 0)) {
    throw new ApiError(
      400,
      `VitaHero has no screening form for "${raw}", so there would be nothing for them to record.`,
      "SPECIALTY_NOT_SCREENED"
    );
  }
  const rows = await sql`
    UPDATE vita_hero.camp_staff SET specialty = ${specialty}
    WHERE camp_id = ${campId} AND profile_id = ${profileId}
    RETURNING profile_id
  `;
  if (rows.length === 0) {
    throw new ApiError(404, "That person is not on this camp", "NOT_ASSIGNED");
  }
  return { profileId, specialty, checks: specialty ? screeningChecksFor(specialty) : null };
}

export async function removeCampStaff(sql: Sql, actor: Actor, campId: string, profileId: string) {
  return setCampStaffActive(sql, actor, campId, profileId, false);
}
