// Stage J — student lifecycle and guardian data rights.
//
// Two things live here that a health programme handling children's data cannot
// ship without:
//
//   Lifecycle   students move up a class each year, leave the school, or age
//               out; guardians change their phone number and, on a phone-only
//               login, are otherwise locked out permanently.
//
//   Data rights export, correction, withdrawal of consent, and deletion that
//               actually erases the clinical record rather than orphaning it.
//               India's DPDP Act treats a child's data as needing more care
//               than most, not less.
//
// Deletion is the sharp one. The previous DELETE /api/kids/:id removed meals,
// streaks, growth points and the child row, but left camp_kid_results and
// camp_registrations behind — a deleted child's dental and vision findings
// stayed in the database, detached from any profile.

import { Sql, currentAcademicYear, isOpsRole, normalizePhone, slugify, tidyName } from "./common";
import { Actor, ApiError, assertSchoolAccess } from "./schools";

export const CORRECTION_STATUSES = ["OPEN", "ACCEPTED", "REJECTED"] as const;

export async function ensureLifecycleSchema(sql: Sql): Promise<void> {
  await sql`ALTER TABLE vita_hero.kids ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE'`;
  await sql`ALTER TABLE vita_hero.kids ADD COLUMN IF NOT EXISTS left_at TIMESTAMPTZ`;
  await sql`ALTER TABLE vita_hero.profiles ADD COLUMN IF NOT EXISTS consent_withdrawn_at TIMESTAMPTZ`;
  await sql`ALTER TABLE vita_hero.profiles ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ`;

  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.correction_requests (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      kid_id TEXT NOT NULL,
      school_id TEXT DEFAULT '',
      field TEXT NOT NULL,
      current_value TEXT DEFAULT '',
      requested_value TEXT DEFAULT '',
      note TEXT DEFAULT '',
      status TEXT DEFAULT 'OPEN',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      resolved_at TIMESTAMPTZ,
      resolved_by TEXT DEFAULT '',
      resolution_note TEXT DEFAULT ''
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS correction_school ON vita_hero.correction_requests(school_id, status)`;

  // Every exercise of a data right is itself auditable.
  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.data_rights_log (
      id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      action TEXT NOT NULL,
      detail TEXT DEFAULT '',
      actor_id TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS data_rights_profile ON vita_hero.data_rights_log(profile_id, created_at DESC)`;
}

async function logRight(sql: Sql, profileId: string, action: string, detail: string, actorId: string) {
  await sql`
    INSERT INTO vita_hero.data_rights_log (id, profile_id, action, detail, actor_id)
    VALUES (${"drl_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)},
            ${profileId}, ${action}, ${detail}, ${actorId})
  `;
}

// ─── J5 · Export ────────────────────────────────────────────

/** Everything VitaHero holds about this family, in one JSON document. */
export async function exportGuardianData(sql: Sql, profileId: string) {
  const profile = await sql`
    SELECT id, phone, name, email, auth_provider, role, locale_code, family_code,
           onboarding_complete, consent_accepted, consent_declined, created_by
    FROM vita_hero.profiles WHERE id = ${profileId} LIMIT 1
  `;
  if (profile.length === 0) throw new ApiError(404, "Profile not found", "NOT_FOUND");

  const kids = await sql`SELECT * FROM vita_hero.kids WHERE profile_id = ${profileId}`;
  const kidIds = kids.map((k) => k.id as string);

  const growth = kidIds.length
    ? await sql`SELECT * FROM vita_hero.growth_points WHERE kid_id = ANY(${kidIds})`
    : [];
  const findings = kidIds.length
    ? await sql`
        SELECT f.*, sc.title AS camp_title, sc.date AS camp_date
        FROM vita_hero.camp_findings f
        LEFT JOIN vita_hero.school_camps sc ON sc.id = f.camp_id
        WHERE f.kid_id = ANY(${kidIds})`
    : [];
  const participation = kidIds.length
    ? await sql`SELECT * FROM vita_hero.camp_participants WHERE kid_id = ANY(${kidIds})`
    : [];
  const referrals = await sql`SELECT * FROM vita_hero.referrals WHERE profile_id = ${profileId}`;
  const appointments = await sql`SELECT * FROM vita_hero.appointments WHERE profile_id = ${profileId}`;
  const meals = await sql`SELECT * FROM vita_hero.meal_items WHERE profile_id = ${profileId}`;
  const consents = await sql`SELECT * FROM vita_hero.consent_log WHERE profile_id = ${profileId}`;
  const rights = await sql`SELECT * FROM vita_hero.data_rights_log WHERE profile_id = ${profileId}`;

  await logRight(sql, profileId, "EXPORT", "Full data export", profileId);

  return {
    generatedAt: new Date().toISOString(),
    notice:
      "This is everything VitaHero holds about your family. Health findings were " +
      "recorded at a school camp and reviewed by a doctor before you saw them.",
    profile: profile[0],
    children: kids,
    growthMeasurements: growth,
    campFindings: findings,
    campParticipation: participation,
    referrals,
    appointments,
    mealLog: meals,
    consentHistory: consents,
    dataRightsHistory: rights,
  };
}

// ─── J6 · Correction ────────────────────────────────────────

const CORRECTABLE = ["name", "date_of_birth", "gender", "grade", "section", "guardian_name", "height_cm", "weight_kg"];

/**
 * A guardian cannot silently rewrite a clinical record, so a correction is a
 * request a school administrator accepts or rejects — with the change recorded
 * either way.
 */
export async function requestCorrection(
  sql: Sql,
  profileId: string,
  body: Record<string, unknown>
) {
  const kidId = String(body.kidId || "");
  const field = String(body.field || "").trim();
  if (!CORRECTABLE.includes(field)) {
    throw new ApiError(400, `You can request a correction to: ${CORRECTABLE.join(", ")}`, "BAD_FIELD");
  }
  // `field` is whitelisted against CORRECTABLE above, so interpolating it as an
  // identifier here cannot carry anything the caller chose.
  const kid = await sql.query(
    `SELECT id, school_id, "${field}" AS current FROM vita_hero.kids
     WHERE id = $1 AND profile_id = $2 LIMIT 1`,
    [kidId, profileId]
  );
  if (kid.length === 0) throw new ApiError(403, "That is not your child", "NOT_YOUR_CHILD");

  const requested = String(body.value || "").trim();
  if (!requested) throw new ApiError(400, "What should it say instead?", "NO_VALUE");

  const id = `cor_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  await sql`
    INSERT INTO vita_hero.correction_requests
      (id, profile_id, kid_id, school_id, field, current_value, requested_value, note)
    VALUES (${id}, ${profileId}, ${kidId}, ${(kid[0].school_id as string) || ""}, ${field},
            ${String(kid[0].current ?? "")}, ${requested}, ${String(body.note || "")})
  `;
  await logRight(sql, profileId, "CORRECTION_REQUESTED", `${field} -> ${requested}`, profileId);
  return { id, status: "OPEN" };
}

export async function listCorrections(sql: Sql, actor: Actor, schoolId: string) {
  assertSchoolAccess(actor, schoolId);
  const rows = await sql`
    SELECT c.*, k.name AS kid_name, k.grade, k.section, p.name AS guardian_name, p.phone
    FROM vita_hero.correction_requests c
    JOIN vita_hero.kids k ON k.id = c.kid_id
    LEFT JOIN vita_hero.profiles p ON p.id = c.profile_id
    WHERE c.school_id = ${schoolId}
    ORDER BY CASE c.status WHEN 'OPEN' THEN 0 ELSE 1 END, c.created_at DESC
    LIMIT 200
  `;
  return {
    corrections: rows.map((r) => ({
      id: r.id as string,
      kidId: r.kid_id as string,
      kidName: r.kid_name as string,
      grade: `${(r.grade as string) || ""} ${(r.section as string) || ""}`.trim(),
      guardianName: (r.guardian_name as string) || "",
      guardianPhone: (r.phone as string) || "",
      field: r.field as string,
      currentValue: (r.current_value as string) || "",
      requestedValue: (r.requested_value as string) || "",
      note: (r.note as string) || "",
      status: (r.status as string) || "OPEN",
      createdAt: r.created_at ? String(r.created_at) : "",
      resolutionNote: (r.resolution_note as string) || "",
    })),
  };
}

export async function resolveCorrection(
  sql: Sql,
  actor: Actor,
  correctionId: string,
  accept: boolean,
  note: string
) {
  const rows = await sql`SELECT * FROM vita_hero.correction_requests WHERE id = ${correctionId} LIMIT 1`;
  if (rows.length === 0) throw new ApiError(404, "Correction request not found", "NOT_FOUND");
  const c = rows[0];
  assertSchoolAccess(actor, (c.school_id as string) || "");
  if ((c.status as string) !== "OPEN") {
    throw new ApiError(409, "That request has already been answered", "ALREADY_RESOLVED");
  }

  if (accept) {
    const field = c.field as string;
    if (!CORRECTABLE.includes(field)) throw new ApiError(400, "That field cannot be corrected", "BAD_FIELD");
    const value = c.requested_value as string;
    const isNumeric = field === "height_cm" || field === "weight_kg";
    let applied: unknown = value;
    if (isNumeric) {
      const n = parseFloat(value);
      if (!Number.isFinite(n)) throw new ApiError(400, "That is not a number", "BAD_VALUE");
      applied = n;
    }
    await sql.query(
      `UPDATE vita_hero.kids SET "${field}" = $1 WHERE id = $2`,
      [applied, c.kid_id as string]
    );
  }

  await sql`
    UPDATE vita_hero.correction_requests
    SET status = ${accept ? "ACCEPTED" : "REJECTED"}, resolved_at = NOW(),
        resolved_by = ${actor.profileId}, resolution_note = ${note}
    WHERE id = ${correctionId}
  `;
  await logRight(sql, c.profile_id as string, accept ? "CORRECTION_ACCEPTED" : "CORRECTION_REJECTED",
    `${c.field as string}: ${note}`, actor.profileId);
  return { id: correctionId, status: accept ? "ACCEPTED" : "REJECTED" };
}

// ─── J7 · Withdraw consent ──────────────────────────────────

/**
 * Withdrawing consent stops future processing: pending camp consents flip to
 * declined and open referrals stop being chased. It does not erase what has
 * already been recorded — that is deletion, which is a separate right.
 */
export async function withdrawConsent(sql: Sql, profileId: string, reason: string) {
  await sql`
    UPDATE vita_hero.camp_participants
    SET consent_status = 'DECLINED', consent_at = NOW(), consent_source = 'WITHDRAWN'
    WHERE profile_id = ${profileId} AND consent_status = 'PENDING'
  `;
  const stopped = await sql`
    UPDATE vita_hero.referrals SET status = 'DECLINED', declined_reason = 'Consent withdrawn',
      closed_at = NOW(), closed_by = ${profileId}
    WHERE profile_id = ${profileId} AND status IN ('OPEN','BOOKED')
    RETURNING id
  `;
  await sql`
    UPDATE vita_hero.profiles
    SET consent_withdrawn_at = NOW(), consent_accepted = false, consent_declined = true,
        notifications_enabled = false, camp_reminders_enabled = false
    WHERE id = ${profileId}
  `;
  await logRight(sql, profileId, "CONSENT_WITHDRAWN", reason, profileId);
  return {
    withdrawn: true,
    referralsClosed: stopped.length,
    note: "No further screening will happen. Records already collected are kept unless you also ask for deletion.",
  };
}

// ─── J8 · Deletion ──────────────────────────────────────────

/**
 * Erase one child, completely.
 *
 * The tables listed here are the full set that ever references a kid_id. The
 * earlier version missed camp_kid_results and camp_registrations, so a deleted
 * child's clinical findings survived, attached to nothing.
 */
export async function deleteChild(sql: Sql, profileId: string, kidId: string, actorId: string) {
  const owns = await sql`
    SELECT id, name FROM vita_hero.kids WHERE id = ${kidId} AND profile_id = ${profileId} LIMIT 1
  `;
  if (owns.length === 0) throw new ApiError(403, "That is not your child", "NOT_YOUR_CHILD");

  await sql`DELETE FROM vita_hero.camp_findings WHERE kid_id = ${kidId}`;
  await sql`DELETE FROM vita_hero.camp_kid_results WHERE kid_id = ${kidId}`;
  await sql`DELETE FROM vita_hero.camp_participants WHERE kid_id = ${kidId}`;
  await sql`DELETE FROM vita_hero.camp_registrations WHERE kid_id = ${kidId}`;
  await sql`DELETE FROM vita_hero.referrals WHERE kid_id = ${kidId}`;
  await sql`DELETE FROM vita_hero.consent_log WHERE kid_id = ${kidId}`;
  await sql`DELETE FROM vita_hero.correction_requests WHERE kid_id = ${kidId}`;
  await sql`DELETE FROM vita_hero.growth_points WHERE kid_id = ${kidId}`;
  await sql`DELETE FROM vita_hero.meal_items WHERE kid_id = ${kidId}`;
  await sql`DELETE FROM vita_hero.streaks WHERE kid_id = ${kidId}`;
  await sql`DELETE FROM vita_hero.ai_diet_tips WHERE kid_id = ${kidId}`;
  await sql`DELETE FROM vita_hero.school_enrollments WHERE kid_id = ${kidId}`;
  await sql`DELETE FROM vita_hero.kids WHERE id = ${kidId}`;

  await logRight(sql, profileId, "CHILD_DELETED", String(owns[0].name), actorId);
  return { deleted: kidId };
}

/** Erase the whole family: every child, then the profile itself. */
export async function deleteAccount(sql: Sql, profileId: string) {
  const kids = await sql`SELECT id FROM vita_hero.kids WHERE profile_id = ${profileId}`;
  for (const k of kids) await deleteChild(sql, profileId, k.id as string, profileId);

  await sql`DELETE FROM vita_hero.appointments WHERE profile_id = ${profileId}`;
  await sql`DELETE FROM vita_hero.co_parents WHERE profile_id = ${profileId}`;
  await sql`DELETE FROM vita_hero.school_enrollments WHERE profile_id = ${profileId}`;
  await sql`DELETE FROM vita_hero.consent_log WHERE profile_id = ${profileId}`;
  await sql`DELETE FROM vita_hero.correction_requests WHERE profile_id = ${profileId}`;
  await sql`DELETE FROM vita_hero.referrals WHERE profile_id = ${profileId}`;

  // The rights log outlives the profile on purpose: it is the evidence that
  // the erasure was asked for and carried out.
  await logRight(sql, profileId, "ACCOUNT_DELETED", "All data erased on request", profileId);
  await sql`DELETE FROM vita_hero.profiles WHERE id = ${profileId}`;
  return { deleted: profileId, childrenDeleted: kids.length };
}

// ─── J1, J2, J3 · Student lifecycle ─────────────────────────

/**
 * J1 — move a year group up at the start of an academic year.
 *
 * Maps each grade to the next per the school's own class list, so "Class 4"
 * becomes "Class 5" without inventing classes the school does not run. A
 * student in the final grade is marked as having left rather than promoted
 * into nothing.
 */
export async function rolloverClasses(
  sql: Sql,
  actor: Actor,
  schoolId: string,
  body: Record<string, unknown>
) {
  assertSchoolAccess(actor, schoolId);
  const fromYear = String(body.fromYear || "").trim();
  const toYear = String(body.toYear || "").trim();
  if (!/^\d{4}-\d{2}$/.test(fromYear) || !/^\d{4}-\d{2}$/.test(toYear)) {
    throw new ApiError(400, "Both years must look like 2026-27", "BAD_YEAR");
  }
  if (fromYear === toYear) throw new ApiError(400, "Those are the same year", "SAME_YEAR");

  const mapping = (body.mapping as Record<string, string>) || {};
  const explicit = Object.keys(mapping).length > 0;

  // Derive the ladder from the school's own grades, ordered naturally.
  const gradeRows = await sql`
    SELECT DISTINCT grade FROM vita_hero.school_classes
    WHERE school_id = ${schoolId} AND academic_year = ${fromYear}
  `;
  const grades = gradeRows
    .map((r) => r.grade as string)
    .sort((a, b) => {
      const na = parseInt((a.match(/\d+/) || ["999"])[0], 10);
      const nb = parseInt((b.match(/\d+/) || ["999"])[0], 10);
      return na - nb || a.localeCompare(b);
    });

  const next: Record<string, string> = {};
  if (explicit) {
    Object.assign(next, mapping);
  } else {
    for (let i = 0; i < grades.length - 1; i++) next[grades[i]] = grades[i + 1];
  }
  const finalGrade = grades.length ? grades[grades.length - 1] : "";

  if (body.dryRun === true) {
    const counts = await sql`
      SELECT grade, COUNT(*)::int AS n FROM vita_hero.kids
      WHERE school_id = ${schoolId} AND academic_year = ${fromYear} AND COALESCE(status,'ACTIVE') = 'ACTIVE'
      GROUP BY grade
    `;
    return {
      dryRun: true,
      fromYear, toYear,
      plan: counts.map((c) => ({
        grade: c.grade as string,
        students: (c.n as number) || 0,
        becomes: next[c.grade as string] || (c.grade === finalGrade ? "LEAVING" : "unchanged"),
      })),
    };
  }

  let promoted = 0;
  let graduated = 0;
  for (const grade of grades) {
    const target = next[grade];
    if (target) {
      const rows = await sql`
        UPDATE vita_hero.kids SET grade = ${target}, academic_year = ${toYear}
        WHERE school_id = ${schoolId} AND academic_year = ${fromYear} AND grade = ${grade}
          AND COALESCE(status,'ACTIVE') = 'ACTIVE'
        RETURNING id
      `;
      promoted += rows.length;
      // Make sure the destination class exists for the new year.
      const sections = await sql`
        SELECT DISTINCT section FROM vita_hero.school_classes
        WHERE school_id = ${schoolId} AND academic_year = ${fromYear} AND grade = ${grade}
      `;
      for (const s of sections) {
        const sec = (s.section as string) || "";
        await sql`
          INSERT INTO vita_hero.school_classes (id, school_id, academic_year, grade, section)
          VALUES (${`cls_${slugify(schoolId)}_${slugify(toYear)}_${slugify(target)}_${slugify(sec) || "na"}`},
                  ${schoolId}, ${toYear}, ${target}, ${sec})
          ON CONFLICT (school_id, academic_year, grade, section) DO NOTHING
        `;
      }
    } else if (grade === finalGrade) {
      const rows = await sql`
        UPDATE vita_hero.kids SET status = 'LEFT', left_at = NOW()
        WHERE school_id = ${schoolId} AND academic_year = ${fromYear} AND grade = ${grade}
          AND COALESCE(status,'ACTIVE') = 'ACTIVE'
        RETURNING id
      `;
      graduated += rows.length;
    }
  }

  await sql`UPDATE vita_hero.schools SET academic_year = ${toYear} WHERE id = ${schoolId}`;
  return { fromYear, toYear, promoted, graduated };
}

/**
 * J2 — a student leaves. The record is archived, not deleted: the guardian
 * keeps access to the history, and the school stops counting them on the roll.
 */
export async function markStudentLeft(
  sql: Sql,
  actor: Actor,
  schoolId: string,
  kidId: string,
  leaving: boolean
) {
  assertSchoolAccess(actor, schoolId);
  const rows = await sql`
    UPDATE vita_hero.kids
    SET status = ${leaving ? "LEFT" : "ACTIVE"}, left_at = ${leaving ? new Date().toISOString() : null}
    WHERE id = ${kidId} AND school_id = ${schoolId}
    RETURNING id, name, status
  `;
  if (rows.length === 0) throw new ApiError(404, "That student is not at this school", "NOT_FOUND");
  return { kidId, status: rows[0].status as string };
}

// ─── J4 · Account recovery ──────────────────────────────────

/**
 * A guardian who changed their number cannot sign in, because the number is
 * the identity. Moving them is an administrative act with an audit trail, not
 * something the guardian can do to themselves — otherwise anyone who knew a
 * child's name could take over the account.
 */
export async function changeGuardianPhone(
  sql: Sql,
  actor: Actor,
  schoolId: string,
  body: Record<string, unknown>
) {
  assertSchoolAccess(actor, schoolId);
  const oldNorm = normalizePhone(String(body.currentPhone || ""));
  const newNorm = normalizePhone(String(body.newPhone || ""));
  if (!oldNorm || !newNorm) throw new ApiError(400, "Both numbers must be valid mobiles", "BAD_PHONE");
  if (oldNorm.last10 === newNorm.last10) throw new ApiError(400, "Those are the same number", "SAME_PHONE");

  const oldId = `ph_${oldNorm.last10}`;
  const newId = `ph_${newNorm.last10}`;

  const existing = await sql`
    SELECT id, name, school_id, role FROM vita_hero.profiles WHERE id = ${oldId} LIMIT 1
  `;
  if (existing.length === 0) throw new ApiError(404, "No account on that number", "NOT_FOUND");
  if (!isOpsRole(actor.role) && (existing[0].school_id as string) !== schoolId) {
    throw new ApiError(403, "That guardian belongs to another school", "WRONG_SCHOOL");
  }

  const clash = await sql`SELECT id FROM vita_hero.profiles WHERE id = ${newId} LIMIT 1`;
  if (clash.length > 0) {
    throw new ApiError(409, "There is already an account on the new number", "PHONE_TAKEN");
  }

  // Insert the new identity, repoint every reference, then drop the old row.
  await sql`
    INSERT INTO vita_hero.profiles
      (id, user_id, phone, name, email, auth_provider, role, provisioned, school_id,
       onboarding_complete, is_logged_in, family_code, locale_code, dark_theme,
       notifications_enabled, camp_reminders_enabled, consent_accepted, consent_declined)
    SELECT ${newId}, ${newId}, ${newNorm.e164}, name, email, auth_provider, role, provisioned,
           school_id, onboarding_complete, false, family_code, locale_code, dark_theme,
           notifications_enabled, camp_reminders_enabled, consent_accepted, consent_declined
    FROM vita_hero.profiles WHERE id = ${oldId}
  `;
  // Fixed list, never caller-supplied.
  const TABLES_WITH_PROFILE_ID = [
    "kids", "appointments", "co_parents", "meal_items", "school_enrollments",
    "camp_participants", "camp_registrations", "camp_kid_results", "referrals",
    "consent_log", "correction_requests", "ai_diet_tips",
  ];
  for (const t of TABLES_WITH_PROFILE_ID) {
    await sql.query(
      `UPDATE vita_hero."${t}" SET profile_id = $1 WHERE profile_id = $2`,
      [newId, oldId]
    );
  }
  await sql`UPDATE vita_hero.kids SET user_id = ${newId} WHERE user_id = ${oldId}`;
  await sql`DELETE FROM vita_hero.profiles WHERE id = ${oldId}`;

  await logRight(sql, newId, "PHONE_CHANGED", `${oldNorm.e164} -> ${newNorm.e164}`, actor.profileId);
  return { from: oldNorm.e164, to: newNorm.e164, profileId: newId, name: existing[0].name as string };
}

// ─── J9 · Retention ─────────────────────────────────────────

/**
 * Report what has aged past the retention window rather than deleting it
 * silently. Erasing a child's health record on a timer, with nobody looking,
 * is not something to automate on a first pass.
 */
export async function retentionReport(sql: Sql, actor: Actor, retainYears = 7) {
  if (!isOpsRole(actor.role)) {
    throw new ApiError(403, "Retention is an operations view", "OPS_REQUIRED");
  }
  const cutoff = new Date();
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - retainYears);
  const iso = cutoff.toISOString();

  const stale = await sql`
    SELECT COUNT(*)::int AS n FROM vita_hero.camp_findings WHERE recorded_at < ${iso}
  `;
  const leftLongAgo = await sql`
    SELECT COUNT(*)::int AS n FROM vita_hero.kids
    WHERE status = 'LEFT' AND left_at IS NOT NULL AND left_at < ${iso}
  `;
  const dormant = await sql`
    SELECT COUNT(*)::int AS n FROM vita_hero.profiles
    WHERE role = 'PARENT' AND is_logged_in = false AND provisioned = true
      AND NOT EXISTS (SELECT 1 FROM vita_hero.kids k WHERE k.profile_id = vita_hero.profiles.id)
  `;
  return {
    retainYears,
    cutoff: iso.slice(0, 10),
    findingsOlderThanWindow: (stale[0]?.n as number) || 0,
    studentsLeftBeyondWindow: (leftLongAgo[0]?.n as number) || 0,
    profilesWithNoChildren: (dormant[0]?.n as number) || 0,
    note: "Nothing is deleted automatically. Review these before erasing.",
  };
}

/** The history behind one family's data-rights requests. */
export async function dataRightsHistory(sql: Sql, profileId: string) {
  const rows = await sql`
    SELECT action, detail, created_at FROM vita_hero.data_rights_log
    WHERE profile_id = ${profileId} ORDER BY created_at DESC LIMIT 100
  `;
  return {
    history: rows.map((r) => ({
      action: r.action as string,
      detail: (r.detail as string) || "",
      at: r.created_at ? String(r.created_at) : "",
    })),
  };
}
