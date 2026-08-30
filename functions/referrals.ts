// Stage G — the referral loop.
//
// Screening that never closes a referral has not helped anyone. This module
// turns a flagged finding into a tracked object with a life of its own:
//
//   OPEN      created at release, the guardian has been told
//   BOOKED    an appointment exists
//   ATTENDED  the child was seen
//   CLOSED    a clinician recorded what happened
//   DECLINED  the guardian chose not to act, and said so
//   EXPIRED   nobody acted and the window passed
//
// Closure rate — CLOSED over created — is the number a school, a hospital
// partner and a funder actually care about, and it is the one number the
// programme could not previously produce for a single child.

import { Sql, isOpsRole, slugify } from "./common";
import { Actor, ApiError, assertSchoolAccess } from "./schools";
import { assertCampAccess } from "./camps";
import { Flag, Urgency } from "./clinical";

export const REFERRAL_STATUSES = ["OPEN", "BOOKED", "ATTENDED", "CLOSED", "DECLINED", "EXPIRED"] as const;
export const OUTCOMES = ["RESOLVED", "ONGOING", "REFERRED_ON", "NO_ISSUE"] as const;

/** Which kind of clinician a flagged check should send the child to. */
const SPECIALTY: Record<string, string> = {
  "Vision": "Ophthalmology",
  "Dental": "Dental",
  "Height & weight": "Nutrition",
  "Haemoglobin": "Paediatrics",
  "ENT": "ENT",
  "Skin": "Dermatology",
  "Spine": "Orthopaedics",
  "Immunisation review": "Paediatrics",
};

/** How long a guardian has before we stop nudging and call it expired. */
const EXPIRY_DAYS: Record<string, number> = { URGENT: 14, SOON: 45, ROUTINE: 120, NONE: 120 };

export async function ensureReferralSchema(sql: Sql): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.referrals (
      id TEXT PRIMARY KEY,
      camp_id TEXT NOT NULL,
      kid_id TEXT NOT NULL,
      profile_id TEXT NOT NULL,
      school_id TEXT NOT NULL,
      check_type TEXT NOT NULL,
      specialty TEXT DEFAULT '',
      flag TEXT DEFAULT 'WATCH',
      urgency TEXT DEFAULT 'ROUTINE',
      reason TEXT DEFAULT '',
      status TEXT DEFAULT 'OPEN',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      created_by TEXT DEFAULT '',
      due_by TEXT DEFAULT '',
      appointment_id TEXT,
      booked_at TIMESTAMPTZ,
      attended_at TIMESTAMPTZ,
      attended_source TEXT DEFAULT '',
      outcome TEXT DEFAULT '',
      diagnosis TEXT DEFAULT '',
      treatment TEXT DEFAULT '',
      clinician_note TEXT DEFAULT '',
      clinician_name TEXT DEFAULT '',
      closed_at TIMESTAMPTZ,
      closed_by TEXT DEFAULT '',
      declined_reason TEXT DEFAULT '',
      nudge_count INT DEFAULT 0,
      last_nudge_at TIMESTAMPTZ,
      generation INT DEFAULT 1
    )
  `;
  // A child referred onward needs a second referral for the same check, so the
  // uniqueness that stops release duplicating referrals has to include the
  // generation. Without it "referred on" silently did nothing.
  await sql`ALTER TABLE vita_hero.referrals ADD COLUMN IF NOT EXISTS generation INT DEFAULT 1`;
  await sql`ALTER TABLE vita_hero.referrals DROP CONSTRAINT IF EXISTS referrals_camp_id_kid_id_check_type_key`;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS referrals_camp_kid_check_gen
    ON vita_hero.referrals(camp_id, kid_id, check_type, generation)
  `;
  await sql`CREATE INDEX IF NOT EXISTS referrals_school ON vita_hero.referrals(school_id, status)`;
  await sql`CREATE INDEX IF NOT EXISTS referrals_profile ON vita_hero.referrals(profile_id, status)`;
  await sql`CREATE INDEX IF NOT EXISTS referrals_kid ON vita_hero.referrals(kid_id)`;
}

function dueDate(urgency: string, from = new Date()): string {
  const days = EXPIRY_DAYS[urgency] ?? 120;
  const d = new Date(from.getTime() + days * 86400000);
  return d.toISOString().slice(0, 10);
}

/**
 * G1 — open a referral for every finding a physician flagged.
 *
 * Called from releaseCamp, inside the same pass that publishes results, so a
 * guardian never sees "see a doctor" without a matching tracked referral.
 * Idempotent on (camp, kid, check) so re-releasing does not duplicate.
 */
export async function openReferralsForChild(
  sql: Sql,
  opts: {
    campId: string;
    kidId: string;
    profileId: string;
    schoolId: string;
    createdBy: string;
    urgency: Urgency;
    findings: Array<{ checkType: string; flag: Flag; rationale: string }>;
  }
): Promise<number> {
  const needing = opts.findings.filter((f) => f.flag === "WATCH" || f.flag === "ALERT");
  let opened = 0;
  for (const f of needing) {
    const id = `ref_${opts.campId.slice(-8)}_${slugify(opts.kidId).slice(0, 16)}_${slugify(f.checkType)}`;
    // A WATCH is routine unless the physician marked the whole child urgent.
    const urgency = f.flag === "ALERT" ? opts.urgency === "NONE" ? "SOON" : opts.urgency : "ROUTINE";
    const rows = await sql`
      INSERT INTO vita_hero.referrals
        (id, camp_id, kid_id, profile_id, school_id, check_type, specialty, flag,
         urgency, reason, status, created_by, due_by)
      VALUES
        (${id}, ${opts.campId}, ${opts.kidId}, ${opts.profileId}, ${opts.schoolId},
         ${f.checkType}, ${SPECIALTY[f.checkType] || "Paediatrics"}, ${f.flag},
         ${urgency}, ${f.rationale}, 'OPEN', ${opts.createdBy}, ${dueDate(urgency)})
      ON CONFLICT (camp_id, kid_id, check_type, generation) DO NOTHING
      RETURNING id
    `;
    if (rows.length > 0) opened++;
  }
  return opened;
}

// ─── Guardian side ──────────────────────────────────────────

function mapReferral(r: Record<string, unknown>) {
  return {
    id: r.id as string,
    campId: r.camp_id as string,
    kidId: r.kid_id as string,
    kidName: (r.kid_name as string) || "",
    checkType: r.check_type as string,
    specialty: (r.specialty as string) || "",
    flag: (r.flag as string) || "WATCH",
    urgency: (r.urgency as string) || "ROUTINE",
    reason: (r.reason as string) || "",
    status: (r.status as string) || "OPEN",
    dueBy: (r.due_by as string) || "",
    createdAt: r.created_at ? String(r.created_at) : "",
    attendedAt: r.attended_at ? String(r.attended_at) : "",
    outcome: (r.outcome as string) || "",
    diagnosis: (r.diagnosis as string) || "",
    treatment: (r.treatment as string) || "",
    clinicianNote: (r.clinician_note as string) || "",
    clinicianName: (r.clinician_name as string) || "",
    declinedReason: (r.declined_reason as string) || "",
    schoolName: (r.school_name as string) || "",
    campTitle: (r.camp_title as string) || "",
  };
}

/** What the parent app shows under "follow-ups". */
export async function guardianReferrals(sql: Sql, profileId: string, includeClosed = false) {
  const rows = await sql`
    SELECT r.*, k.name AS kid_name, s.name AS school_name, sc.title AS camp_title
    FROM vita_hero.referrals r
    JOIN vita_hero.kids k ON k.id = r.kid_id
    LEFT JOIN vita_hero.schools s ON s.id = r.school_id
    LEFT JOIN vita_hero.school_camps sc ON sc.id = r.camp_id
    WHERE r.profile_id = ${profileId}
      AND (${includeClosed} OR r.status NOT IN ('CLOSED','DECLINED','EXPIRED'))
    ORDER BY
      CASE r.urgency WHEN 'URGENT' THEN 0 WHEN 'SOON' THEN 1 WHEN 'ROUTINE' THEN 2 ELSE 3 END,
      r.created_at DESC
  `;
  return { referrals: rows.map(mapReferral) };
}

async function ownedReferral(sql: Sql, referralId: string, profileId: string) {
  const rows = await sql`
    SELECT * FROM vita_hero.referrals WHERE id = ${referralId} LIMIT 1
  `;
  if (rows.length === 0) throw new ApiError(404, "Referral not found", "NOT_FOUND");
  if ((rows[0].profile_id as string) !== profileId) {
    throw new ApiError(403, "That referral is not yours", "NOT_YOURS");
  }
  return rows[0];
}

/** G3 — the guardian booked through the app, or says they will use their own doctor. */
export async function markReferralBooked(
  sql: Sql,
  profileId: string,
  referralId: string,
  appointmentId: string | null
) {
  const r = await ownedReferral(sql, referralId, profileId);
  if (["CLOSED", "DECLINED"].includes(r.status as string)) {
    throw new ApiError(409, "This referral is already finished", "FINISHED");
  }
  await sql`
    UPDATE vita_hero.referrals
    SET status = 'BOOKED', appointment_id = ${appointmentId}, booked_at = NOW()
    WHERE id = ${referralId}
  `;
  return { id: referralId, status: "BOOKED" };
}

/**
 * G5 — the guardian confirms the visit happened.
 *
 * This is deliberately allowed without a clinician: most families in a school
 * programme will see their own doctor, and a referral that can only be closed
 * by a partner hospital would under-report closure badly. A guardian-confirmed
 * visit is recorded as such, so the two can be told apart in reporting.
 */
export async function markReferralAttended(
  sql: Sql,
  profileId: string,
  referralId: string,
  note: string
) {
  const r = await ownedReferral(sql, referralId, profileId);
  if (["CLOSED", "DECLINED"].includes(r.status as string)) {
    throw new ApiError(409, "This referral is already finished", "FINISHED");
  }
  await sql`
    UPDATE vita_hero.referrals
    SET status = 'ATTENDED', attended_at = NOW(), attended_source = 'GUARDIAN',
        clinician_note = COALESCE(NULLIF(${note}, ''), clinician_note)
    WHERE id = ${referralId}
  `;
  return { id: referralId, status: "ATTENDED" };
}

/** A guardian may decline to act. Recording it is better than nudging forever. */
export async function declineReferral(
  sql: Sql,
  profileId: string,
  referralId: string,
  reason: string
) {
  const r = await ownedReferral(sql, referralId, profileId);
  if ((r.status as string) === "CLOSED") {
    throw new ApiError(409, "This referral is already closed", "FINISHED");
  }
  await sql`
    UPDATE vita_hero.referrals
    SET status = 'DECLINED', declined_reason = ${reason}, closed_at = NOW(), closed_by = ${profileId}
    WHERE id = ${referralId}
  `;
  return { id: referralId, status: "DECLINED" };
}

// ─── Clinician / admin side ─────────────────────────────────

/**
 * G6, G7 — a clinician records what happened, which closes the loop.
 *
 * Open to the camp's physician and to the school's administrators, because in
 * practice the outcome often arrives as a note the family brings back to
 * school rather than through a partner hospital's own system.
 */
export async function recordReferralOutcome(
  sql: Sql,
  actor: Actor,
  referralId: string,
  body: Record<string, unknown>
) {
  const rows = await sql`SELECT * FROM vita_hero.referrals WHERE id = ${referralId} LIMIT 1`;
  if (rows.length === 0) throw new ApiError(404, "Referral not found", "NOT_FOUND");
  const r = rows[0];

  if (!isOpsRole(actor.role)) {
    if (actor.role === "SCHOOL_ADMIN") {
      assertSchoolAccess(actor, r.school_id as string);
    } else {
      // A physician must be on the camp this referral came from.
      const access = await assertCampAccess(sql, actor, r.camp_id as string);
      if (!access.canReview) {
        throw new ApiError(403, "You cannot record outcomes for this camp", "FORBIDDEN");
      }
    }
  }

  const outcome = String(body.outcome || "").toUpperCase();
  if (!OUTCOMES.includes(outcome as (typeof OUTCOMES)[number])) {
    throw new ApiError(400, `Outcome must be one of ${OUTCOMES.join(", ")}`, "BAD_OUTCOME");
  }
  const diagnosis = String(body.diagnosis || "").trim();
  if (!diagnosis && outcome !== "NO_ISSUE") {
    throw new ApiError(400, "Record what was found", "NO_DIAGNOSIS");
  }

  await sql`
    UPDATE vita_hero.referrals SET
      status = 'CLOSED',
      outcome = ${outcome},
      diagnosis = ${diagnosis},
      treatment = ${String(body.treatment || "").trim()},
      clinician_note = ${String(body.note || "").trim()},
      clinician_name = ${String(body.clinicianName || actor.name || "").trim()},
      attended_at = COALESCE(attended_at, NOW()),
      attended_source = CASE WHEN attended_source = '' THEN 'CLINICIAN' ELSE attended_source END,
      closed_at = NOW(),
      closed_by = ${actor.profileId}
    WHERE id = ${referralId}
  `;

  // A referral onward keeps the loop open under a new record, one generation
  // along, so it does not collide with the referral it came from.
  if (outcome === "REFERRED_ON") {
    const generation = ((r.generation as number) || 1) + 1;
    const nextId = `${referralId}_g${generation}`;
    await sql`
      INSERT INTO vita_hero.referrals
        (id, camp_id, kid_id, profile_id, school_id, check_type, specialty, flag,
         urgency, reason, status, created_by, due_by, generation)
      VALUES
        (${nextId}, ${r.camp_id as string}, ${r.kid_id as string}, ${r.profile_id as string},
         ${r.school_id as string}, ${r.check_type as string},
         ${String(body.referredTo || r.specialty || "Paediatrics")}, ${r.flag as string},
         'SOON', ${"Referred on: " + diagnosis}, 'OPEN', ${actor.profileId}, ${dueDate("SOON")},
         ${generation})
      ON CONFLICT (camp_id, kid_id, check_type, generation) DO NOTHING
    `;
  }

  return { id: referralId, status: "CLOSED", outcome };
}

/** G9 — the school's and ops' view of whether screening is actually helping. */
export async function referralDashboard(
  sql: Sql,
  actor: Actor,
  schoolId: string,
  opts: { status?: string; campId?: string }
) {
  assertSchoolAccess(actor, schoolId);

  const totals = await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'OPEN')::int AS open,
      COUNT(*) FILTER (WHERE status = 'BOOKED')::int AS booked,
      COUNT(*) FILTER (WHERE status = 'ATTENDED')::int AS attended,
      COUNT(*) FILTER (WHERE status = 'CLOSED')::int AS closed,
      COUNT(*) FILTER (WHERE status = 'DECLINED')::int AS declined,
      COUNT(*) FILTER (WHERE status = 'EXPIRED')::int AS expired,
      COUNT(*) FILTER (WHERE urgency = 'URGENT' AND status IN ('OPEN','BOOKED'))::int AS urgent_open,
      COUNT(*) FILTER (WHERE status IN ('OPEN','BOOKED') AND due_by <> '' AND due_by < ${new Date().toISOString().slice(0, 10)})::int AS overdue
    FROM vita_hero.referrals
    WHERE school_id = ${schoolId} AND (${!opts.campId} OR camp_id = ${opts.campId || ""})
  `;

  const bySpecialty = await sql`
    SELECT specialty,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'CLOSED')::int AS closed
    FROM vita_hero.referrals
    WHERE school_id = ${schoolId} AND (${!opts.campId} OR camp_id = ${opts.campId || ""})
    GROUP BY specialty ORDER BY total DESC
  `;

  const rows = await sql`
    SELECT r.*, k.name AS kid_name, k.grade, k.section, p.phone AS guardian_phone,
           k.guardian_name, sc.title AS camp_title
    FROM vita_hero.referrals r
    JOIN vita_hero.kids k ON k.id = r.kid_id
    LEFT JOIN vita_hero.profiles p ON p.id = r.profile_id
    LEFT JOIN vita_hero.school_camps sc ON sc.id = r.camp_id
    WHERE r.school_id = ${schoolId}
      AND (${!opts.status} OR r.status = ${opts.status || ""})
      AND (${!opts.campId} OR r.camp_id = ${opts.campId || ""})
    ORDER BY
      CASE r.status WHEN 'OPEN' THEN 0 WHEN 'BOOKED' THEN 1 WHEN 'ATTENDED' THEN 2 ELSE 3 END,
      CASE r.urgency WHEN 'URGENT' THEN 0 WHEN 'SOON' THEN 1 ELSE 2 END,
      r.created_at DESC
    LIMIT 500
  `;

  const t = totals[0] as Record<string, number>;
  // Declined counts as resolved for the purpose of "did we chase everyone" —
  // the family made a decision. It is reported separately so it cannot hide a
  // programme that is simply failing to reach people.
  const actionable = (t.total || 0) - (t.declined || 0);
  const closureRate = actionable > 0 ? Math.round(((t.closed || 0) / actionable) * 100) : null;

  return {
    totals: { ...t, closureRate },
    bySpecialty: bySpecialty.map((s) => ({
      specialty: (s.specialty as string) || "Other",
      total: (s.total as number) || 0,
      closed: (s.closed as number) || 0,
    })),
    referrals: rows.map((r) => ({
      ...mapReferral(r),
      grade: `${(r.grade as string) || ""} ${(r.section as string) || ""}`.trim(),
      guardianName: (r.guardian_name as string) || "",
      guardianPhone: (r.guardian_phone as string) || "",
    })),
  };
}

/** Everything known about one referral, for the outcome form. */
export async function referralDetail(sql: Sql, actor: Actor, referralId: string) {
  const rows = await sql`
    SELECT r.*, k.name AS kid_name, k.grade, k.section, k.age, k.gender,
           k.guardian_name, p.phone AS guardian_phone, sc.title AS camp_title, sc.date AS camp_date,
           s.name AS school_name
    FROM vita_hero.referrals r
    JOIN vita_hero.kids k ON k.id = r.kid_id
    LEFT JOIN vita_hero.profiles p ON p.id = r.profile_id
    LEFT JOIN vita_hero.school_camps sc ON sc.id = r.camp_id
    LEFT JOIN vita_hero.schools s ON s.id = r.school_id
    WHERE r.id = ${referralId} LIMIT 1
  `;
  if (rows.length === 0) throw new ApiError(404, "Referral not found", "NOT_FOUND");
  const r = rows[0];
  if (!isOpsRole(actor.role)) assertSchoolAccessOrCamp(actor, r);

  const finding = await sql`
    SELECT detail, rationale, value_text FROM vita_hero.camp_findings
    WHERE camp_id = ${r.camp_id as string} AND kid_id = ${r.kid_id as string}
      AND check_type = ${r.check_type as string} LIMIT 1
  `;

  return {
    referral: {
      ...mapReferral(r),
      grade: `${(r.grade as string) || ""} ${(r.section as string) || ""}`.trim(),
      age: (r.age as number) ?? null,
      gender: (r.gender as string) || "",
      guardianName: (r.guardian_name as string) || "",
      guardianPhone: (r.guardian_phone as string) || "",
      campDate: (r.camp_date as string) || "",
    },
    finding: finding.length
      ? {
          summary: (finding[0].value_text as string) || "",
          rationale: (finding[0].rationale as string) || "",
          detail: (finding[0].detail as Record<string, unknown>) || {},
        }
      : null,
  };
}

function assertSchoolAccessOrCamp(actor: Actor, r: Record<string, unknown>): void {
  if (actor.role === "SCHOOL_ADMIN" && actor.schoolId === (r.school_id as string)) return;
  if (actor.role === "PHYSICIAN" || actor.role === "SCREENER") return; // camp check happens on write
  throw new ApiError(403, "You do not have access to this referral", "FORBIDDEN");
}

/**
 * G8 — chase the families who have not acted, then hand the stubborn ones to
 * the school. Expiry is applied first so a referral nobody can act on any more
 * stops appearing in the chase list.
 */
export async function nudgeReferrals(
  sql: Sql,
  actor: Actor,
  schoolId: string,
  sendSms: (phone: string, body: string) => Promise<boolean>
) {
  assertSchoolAccess(actor, schoolId);
  const today = new Date().toISOString().slice(0, 10);

  const expired = await sql`
    UPDATE vita_hero.referrals
    SET status = 'EXPIRED'
    WHERE school_id = ${schoolId} AND status IN ('OPEN','BOOKED')
      AND due_by <> '' AND due_by < ${today}
    RETURNING id
  `;

  const due = await sql`
    SELECT r.id, r.urgency, r.specialty, k.name AS kid_name, p.phone
    FROM vita_hero.referrals r
    JOIN vita_hero.kids k ON k.id = r.kid_id
    LEFT JOIN vita_hero.profiles p ON p.id = r.profile_id
    WHERE r.school_id = ${schoolId} AND r.status = 'OPEN'
      AND COALESCE(p.phone,'') <> ''
      AND (r.last_nudge_at IS NULL OR r.last_nudge_at < NOW() - INTERVAL '7 days')
      AND r.nudge_count < 3
  `;

  let sent = 0;
  for (const r of due) {
    const ok = await sendSms(
      r.phone as string,
      "VitaHero: " + (r.kid_name as string) + " still needs a " +
        String(r.specialty || "doctor").toLowerCase() + " check-up from the school health camp. " +
        "Open the VitaHero app to book, or tell us if you have already been."
    );
    if (ok) {
      sent++;
      await sql`
        UPDATE vita_hero.referrals
        SET nudge_count = nudge_count + 1, last_nudge_at = NOW()
        WHERE id = ${r.id as string}
      `;
    }
  }

  // Anyone nudged three times without acting is now the school's problem, not
  // an SMS problem.
  const stuck = await sql`
    SELECT COUNT(*)::int AS n FROM vita_hero.referrals
    WHERE school_id = ${schoolId} AND status = 'OPEN' AND nudge_count >= 3
  `;

  return {
    expired: expired.length,
    nudged: sent,
    needsSchoolFollowUp: (stuck[0]?.n as number) || 0,
  };
}

/**
 * G2 — the specialties this family has an open referral for, so the app's
 * booking screen opens on the right kind of doctor instead of a full list.
 */
export async function openReferralSpecialties(sql: Sql, profileId: string) {
  const rows = await sql`
    SELECT DISTINCT r.specialty, r.kid_id, k.name AS kid_name, r.urgency, r.id
    FROM vita_hero.referrals r
    JOIN vita_hero.kids k ON k.id = r.kid_id
    WHERE r.profile_id = ${profileId} AND r.status IN ('OPEN','BOOKED')
    ORDER BY CASE r.urgency WHEN 'URGENT' THEN 0 WHEN 'SOON' THEN 1 ELSE 2 END
  `;
  return {
    specialties: [...new Set(rows.map((r2) => r2.specialty as string))].filter(Boolean),
    forChildren: rows.map((r2) => ({
      referralId: r2.id as string,
      kidId: r2.kid_id as string,
      kidName: r2.kid_name as string,
      specialty: (r2.specialty as string) || "",
      urgency: (r2.urgency as string) || "ROUTINE",
    })),
  };
}

/** Per-child referral history, for the app's child detail screen. */
export async function kidReferrals(sql: Sql, profileId: string, kidId: string) {
  const owns = await sql`
    SELECT id FROM vita_hero.kids WHERE id = ${kidId} AND profile_id = ${profileId} LIMIT 1
  `;
  if (owns.length === 0) throw new ApiError(403, "That is not your child", "NOT_YOUR_CHILD");
  const rows = await sql`
    SELECT r.*, k.name AS kid_name, sc.title AS camp_title, s.name AS school_name
    FROM vita_hero.referrals r
    JOIN vita_hero.kids k ON k.id = r.kid_id
    LEFT JOIN vita_hero.school_camps sc ON sc.id = r.camp_id
    LEFT JOIN vita_hero.schools s ON s.id = r.school_id
    WHERE r.kid_id = ${kidId} ORDER BY r.created_at DESC
  `;
  return { referrals: rows.map(mapReferral) };
}
