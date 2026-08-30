// Stage A — roster validation and commit.
//
// Covers pathway steps A5-A8:
//   A5  upload the student roster
//   A6  validate it and return an error report the school can act on
//   A7  preview exactly what will change before committing
//   A8  commit with a stable student reference so re-uploads update, not duplicate
//
// A roster row describes a student and their guardian. It carries no clinical
// data — height, weight, dental and vision belong to a camp (Stage C), not to
// the roster. Keeping the two apart is what stops an office spreadsheet from
// silently becoming a medical record.

import { Actor, ApiError, assertSchoolAccess } from "./schools";
import {
  Sql,
  ageFromIsoDob,
  buildStudentRef,
  chunk,
  normalizeGender,
  normalizePhone,
  parseDob,
  profileIdForPhone,
  rowField,
  slugify,
  tidyName,
  currentAcademicYear,
} from "./common";

export const ROSTER_MAX_ROWS = 3000;

/** Age bounds for a school health programme. Outside this, assume a typo. */
const MIN_AGE = 2;
const MAX_AGE = 21;

/** More children than this on one guardian's number is almost always a bad merge. */
const MAX_CHILDREN_PER_GUARDIAN = 8;

export type Severity = "error" | "warning";

export interface RowIssue {
  field: string;
  severity: Severity;
  message: string;
}

export interface RosterRow {
  row: number;
  action: "create" | "update" | "unchanged" | "skip";
  studentName: string;
  guardianName: string;
  phone: string;
  grade: string;
  section: string;
  gender: string;
  dob: string;
  age: number | null;
  studentRef: string;
  issues: RowIssue[];
}

export interface RosterReport {
  schoolId: string;
  schoolName: string;
  academicYear: string;
  filename: string;
  dryRun: boolean;
  total: number;
  create: number;
  update: number;
  unchanged: number;
  errors: number;
  warnings: number;
  guardians: number;
  knownClasses: string[];
  rows: RosterRow[];
  batchId?: string;
}

interface PreparedRow {
  report: RosterRow;
  profileId: string;
  e164: string;
  kidId: string;
  schoolId: string;
  academicYear: string;
}

// ─── Validation ─────────────────────────────────────────────

/**
 * Validate and classify every row without writing anything.
 *
 * Returns both the human-facing report and the prepared rows, so commit can
 * reuse the exact classification the operator approved rather than re-deriving
 * it and possibly reaching a different answer.
 */
async function analyseRoster(
  sql: Sql,
  schoolId: string,
  academicYear: string,
  rows: Record<string, unknown>[],
  filename: string,
  dryRun: boolean
): Promise<{ report: RosterReport; prepared: PreparedRow[] }> {
  const schoolRows = await sql`
    SELECT id, name, academic_year FROM vita_hero.schools WHERE id = ${schoolId} LIMIT 1
  `;
  if (schoolRows.length === 0) throw new ApiError(404, "School not found", "NOT_FOUND");
  const schoolName = (schoolRows[0].name as string) || "";
  const year =
    academicYear || ((schoolRows[0].academic_year as string) || "") || currentAcademicYear();

  // Configured classes let us flag a grade the school has not declared, which
  // is usually a stray row or a typo rather than a genuinely new class.
  const classRows = await sql`
    SELECT grade, section FROM vita_hero.school_classes
    WHERE school_id = ${schoolId} AND academic_year = ${year}
  `;
  const knownGrades = new Set(classRows.map((r) => normKey(r.grade as string)));
  const knownPairs = new Set(
    classRows.map((r) => `${normKey(r.grade as string)}|${normKey((r.section as string) || "")}`)
  );
  const knownClasses = classRows
    .map((r) => `${r.grade as string} ${(r.section as string) || ""}`.trim())
    .sort();

  // Existing students for this school, keyed by their stable reference.
  const existingRows = await sql`
    SELECT k.id, k.student_ref, k.profile_id, k.name, k.grade, k.section, k.gender,
           k.date_of_birth, k.age, k.guardian_name
    FROM vita_hero.kids k
    WHERE k.school_id = ${schoolId} AND k.student_ref IS NOT NULL
  `;
  const existingByRef = new Map<string, Record<string, unknown>>();
  for (const r of existingRows) existingByRef.set(r.student_ref as string, r);

  const prepared: PreparedRow[] = [];
  const reportRows: RosterRow[] = [];

  const seenRefs = new Map<string, number>(); // studentRef -> first row number
  const guardianChildren = new Map<string, number>(); // phone last10 -> count
  const guardianNames = new Map<string, string>();

  let create = 0;
  let update = 0;
  let unchanged = 0;
  let errorCount = 0;
  let warningCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const rowNo = i + 1;
    const issues: RowIssue[] = [];

    const studentNameRaw = rowField(raw, "studentname", "childname", "kidname", "student", "name");
    const guardianNameRaw = rowField(
      raw, "parentname", "guardianname", "parent", "guardian", "fathername", "mothername"
    );
    const phoneRaw = rowField(
      raw, "phone", "mobile", "mobilenumber", "phonenumber", "contact", "guardianphone", "parentphone"
    );
    const gradeRaw = rowField(raw, "grade", "class", "standard");
    const sectionRaw = rowField(raw, "section", "division", "sec");
    const genderRaw = rowField(raw, "gender", "sex");
    const dobRaw = rowField(raw, "dob", "dateofbirth", "birthdate");
    const ageRaw = rowField(raw, "age");
    const refRaw = rowField(raw, "studentid", "studentref", "rollno", "rollnumber", "admissionno");

    const studentName = tidyName(studentNameRaw);
    const guardianName = tidyName(guardianNameRaw);
    const grade = gradeRaw.trim();
    const section = sectionRaw.trim().toUpperCase();
    const gender = normalizeGender(genderRaw);

    // ── Student name ──
    if (!studentName) {
      issues.push({ field: "studentName", severity: "error", message: "Student name is missing" });
    } else if (studentName.length < 2) {
      issues.push({ field: "studentName", severity: "error", message: "Student name is too short" });
    } else if (/\d/.test(studentName)) {
      issues.push({
        field: "studentName",
        severity: "warning",
        message: "Student name contains digits — check the column mapping",
      });
    }

    // ── Guardian phone ──
    const norm = normalizePhone(phoneRaw);
    if (!phoneRaw) {
      issues.push({ field: "phone", severity: "error", message: "Guardian mobile number is missing" });
    } else if (!norm) {
      issues.push({
        field: "phone",
        severity: "error",
        message: `"${phoneRaw}" is not a valid mobile number`,
      });
    } else if (!/^[6-9]/.test(norm.last10)) {
      // Indian mobile numbers start 6-9. A landline here means the invite SMS
      // will never arrive, so flag it rather than discovering it at camp time.
      issues.push({
        field: "phone",
        severity: "warning",
        message: "Does not look like an Indian mobile number — the SMS invite may not arrive",
      });
    }

    // ── Guardian name ──
    if (!guardianName) {
      issues.push({
        field: "guardianName",
        severity: "warning",
        message: "Guardian name is missing — the invite will read 'Parent'",
      });
    }

    // ── Date of birth / age ──
    const parsedDob = parseDob(dobRaw);
    let age: number | null = null;
    let dobIso = "";

    if (parsedDob) {
      dobIso = parsedDob.iso;
      age = ageFromIsoDob(dobIso);
      if (parsedDob.ambiguous) {
        issues.push({
          field: "dob",
          severity: "warning",
          message: `"${dobRaw}" read as ${dobIso} (day/month order assumed)`,
        });
      }
      if (age != null && age < 0) {
        issues.push({ field: "dob", severity: "error", message: "Date of birth is in the future" });
        age = null;
      }
    } else if (dobRaw) {
      issues.push({
        field: "dob",
        severity: "error",
        message: `"${dobRaw}" is not a date we can read — use DD/MM/YYYY`,
      });
    }

    if (age == null && ageRaw) {
      const a = parseInt(ageRaw, 10);
      if (Number.isFinite(a)) {
        age = a;
        issues.push({
          field: "dob",
          severity: "warning",
          message: "No date of birth — age used instead, so growth percentiles will be less precise",
        });
      }
    }

    if (age == null) {
      issues.push({
        field: "dob",
        severity: "error",
        message: "Neither a readable date of birth nor an age was provided",
      });
    } else if (age < MIN_AGE || age > MAX_AGE) {
      issues.push({
        field: "dob",
        severity: "error",
        message: `Age works out to ${age}, outside the ${MIN_AGE}-${MAX_AGE} range`,
      });
    }

    // ── Grade and section ──
    if (!grade) {
      issues.push({ field: "grade", severity: "error", message: "Class is missing" });
    } else if (knownGrades.size > 0) {
      if (!knownGrades.has(normKey(grade))) {
        issues.push({
          field: "grade",
          severity: "warning",
          message: `"${grade}" is not one of the classes configured for ${year}`,
        });
      } else if (section && !knownPairs.has(`${normKey(grade)}|${normKey(section)}`)) {
        issues.push({
          field: "section",
          severity: "warning",
          message: `Section "${section}" is not configured for ${grade}`,
        });
      }
    }

    if (!gender) {
      issues.push({ field: "gender", severity: "warning", message: "Gender is missing" });
    } else if (gender === "Other" && genderRaw) {
      issues.push({
        field: "gender",
        severity: "warning",
        message: `"${genderRaw}" not recognised as male or female — recorded as Other`,
      });
    }

    // ── Identity and in-file duplicates ──
    const last10 = norm?.last10 || "";
    const studentRef = norm
      ? buildStudentRef(refRaw, last10, studentName, dobIso || ageRaw)
      : "";

    if (!refRaw) {
      issues.push({
        field: "studentRef",
        severity: "warning",
        message: "No roll or admission number — a generated reference will be used, so renaming this student later creates a duplicate",
      });
    }

    if (studentRef) {
      const firstSeen = seenRefs.get(studentRef);
      if (firstSeen != null) {
        issues.push({
          field: "studentRef",
          severity: "error",
          message: `Duplicate of row ${firstSeen} — same student reference`,
        });
      } else {
        seenRefs.set(studentRef, rowNo);
      }
    }

    if (last10) {
      const count = (guardianChildren.get(last10) || 0) + 1;
      guardianChildren.set(last10, count);
      if (count === MAX_CHILDREN_PER_GUARDIAN + 1) {
        issues.push({
          field: "phone",
          severity: "warning",
          message: `More than ${MAX_CHILDREN_PER_GUARDIAN} students share this number — check for a copy-paste error`,
        });
      }
      const priorName = guardianNames.get(last10);
      if (priorName && guardianName && priorName !== guardianName) {
        issues.push({
          field: "guardianName",
          severity: "warning",
          message: `This number is also listed as "${priorName}" on another row`,
        });
      }
      if (guardianName && !priorName) guardianNames.set(last10, guardianName);
    }

    // ── Classify ──
    const hasError = issues.some((it) => it.severity === "error");
    let action: RosterRow["action"] = "skip";

    if (!hasError && studentRef) {
      const existing = existingByRef.get(studentRef);
      if (!existing) {
        action = "create";
      } else {
        const changed =
          (existing.name as string) !== studentName ||
          ((existing.grade as string) || "") !== grade ||
          ((existing.section as string) || "") !== section ||
          ((existing.gender as string) || "") !== gender ||
          ((existing.date_of_birth as string) || "") !== dobIso ||
          ((existing.guardian_name as string) || "") !== guardianName ||
          (existing.age as number) !== (age ?? 0);
        action = changed ? "update" : "unchanged";
      }
    }

    if (action === "create") create++;
    else if (action === "update") update++;
    else if (action === "unchanged") unchanged++;

    errorCount += issues.filter((it) => it.severity === "error").length;
    warningCount += issues.filter((it) => it.severity === "warning").length;

    const reportRow: RosterRow = {
      row: rowNo,
      action,
      studentName: studentName || studentNameRaw,
      guardianName,
      phone: norm?.e164 || phoneRaw,
      grade,
      section,
      gender,
      dob: dobIso,
      age,
      studentRef,
      issues,
    };
    reportRows.push(reportRow);

    if (action !== "skip" && norm) {
      const existing = existingByRef.get(studentRef);
      prepared.push({
        report: reportRow,
        profileId: profileIdForPhone(norm.last10),
        e164: norm.e164,
        kidId: existing
          ? (existing.id as string)
          : `k_${slugify(studentRef).slice(0, 32)}_${Math.random().toString(36).slice(2, 6)}`,
        schoolId,
        academicYear: year,
      });
    }
  }

  const report: RosterReport = {
    schoolId,
    schoolName,
    academicYear: year,
    filename,
    dryRun,
    total: rows.length,
    create,
    update,
    unchanged,
    errors: errorCount,
    warnings: warningCount,
    guardians: guardianChildren.size,
    knownClasses,
    rows: reportRows,
  };

  return { report, prepared };
}

function normKey(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// ─── A6 + A7 · Validate and preview ─────────────────────────

export async function validateRoster(
  sql: Sql,
  actor: Actor,
  schoolId: string,
  body: Record<string, unknown>
): Promise<RosterReport> {
  assertSchoolAccess(actor, schoolId);
  const rows = extractRows(body);
  const { report } = await analyseRoster(
    sql,
    schoolId,
    String(body.academicYear || "").trim(),
    rows,
    String(body.filename || ""),
    true
  );
  return report;
}

// ─── A8 · Commit ────────────────────────────────────────────

/**
 * Write the roster.
 *
 * Rows with errors are skipped, never guessed at. Writes are batched into
 * multi-row statements: the previous per-row approach issued roughly six
 * database round trips per student, which for a 2,000-row roster exceeded a
 * Worker's subrequest budget long before it finished.
 */
export async function commitRoster(
  sql: Sql,
  actor: Actor,
  schoolId: string,
  body: Record<string, unknown>
): Promise<RosterReport> {
  assertSchoolAccess(actor, schoolId);
  const rows = extractRows(body);

  const { report, prepared } = await analyseRoster(
    sql,
    schoolId,
    String(body.academicYear || "").trim(),
    rows,
    String(body.filename || ""),
    false
  );

  // An operator who has not looked at the preview should not be able to commit
  // a file that is mostly broken.
  const writable = prepared.filter((p) => p.report.action !== "unchanged");
  if (report.errors > 0 && body.allowPartial !== true) {
    throw new ApiError(
      422,
      `${report.errors} row${report.errors === 1 ? "" : "s"} could not be read. Fix them, or re-submit with "import the rest" to skip them.`,
      "HAS_ERRORS"
    );
  }

  if (writable.length > 0) {
    // Guardians first — a student row references its guardian profile.
    const guardians = new Map<string, { e164: string; name: string }>();
    for (const p of prepared) {
      if (!guardians.has(p.profileId)) {
        guardians.set(p.profileId, {
          e164: p.e164,
          name: p.report.guardianName || "Parent",
        });
      }
    }

    for (const group of chunk([...guardians.entries()], 100)) {
      const values: string[] = [];
      const params: unknown[] = [];
      group.forEach(([profileId, g], i) => {
        const b = i * 4;
        values.push(
          `($${b + 1}, $${b + 1}, $${b + 2}, $${b + 3}, 'PHONE', 'PARENT', true, $${b + 4}, false)`
        );
        params.push(profileId, g.e164, g.name, schoolId);
      });
      await sql.query(
        `INSERT INTO vita_hero.profiles
           (id, user_id, phone, name, auth_provider, role, provisioned, school_id, is_logged_in)
         VALUES ${values.join(", ")}
         ON CONFLICT (id) DO UPDATE SET
           provisioned = true,
           phone = EXCLUDED.phone,
           name = CASE
             WHEN vita_hero.profiles.name IN ('', 'Parent') THEN EXCLUDED.name
             ELSE vita_hero.profiles.name END,
           school_id = COALESCE(vita_hero.profiles.school_id, EXCLUDED.school_id)
         WHERE vita_hero.profiles.role = 'PARENT'`,
        params
      );
    }

    // Students. The unique index on (profile_id, student_ref) makes this an
    // upsert, which is what makes a re-upload update rather than duplicate.
    for (const group of chunk(writable, 100)) {
      const values: string[] = [];
      const params: unknown[] = [];
      group.forEach((p, i) => {
        const r = p.report;
        const b = i * 12;
        values.push(
          `($${b + 1}, $${b + 2}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, ` +
            `$${b + 7}, $${b + 8}, $${b + 9}, $${b + 10}, $${b + 11}, $${b + 12}, 'ADMIN')`
        );
        params.push(
          p.kidId,
          p.profileId,
          r.studentName,
          r.age ?? 0,
          r.gender,
          r.grade,
          r.section,
          r.dob || null,
          r.guardianName,
          r.studentRef,
          p.schoolId,
          p.academicYear
        );
      });
      await sql.query(
        `INSERT INTO vita_hero.kids
           (id, profile_id, user_id, name, age, gender, grade, section,
            date_of_birth, guardian_name, student_ref, school_id, academic_year, source)
         VALUES ${values.join(", ")}
         ON CONFLICT (profile_id, student_ref) WHERE student_ref IS NOT NULL DO UPDATE SET
           name = EXCLUDED.name,
           age = EXCLUDED.age,
           gender = EXCLUDED.gender,
           grade = EXCLUDED.grade,
           section = EXCLUDED.section,
           date_of_birth = EXCLUDED.date_of_birth,
           guardian_name = EXCLUDED.guardian_name,
           school_id = EXCLUDED.school_id,
           academic_year = EXCLUDED.academic_year`,
        params
      );
    }

    // Enrol each guardian with the school. Without this the parent app's camp
    // list, which keys off school_enrollments, stays empty for an imported
    // family and they never see the camp their child was screened at.
    const guardianIds = [...new Set(prepared.map((p) => p.profileId))];
    for (const group of chunk(guardianIds, 100)) {
      const values: string[] = [];
      const params: unknown[] = [];
      group.forEach((profileId, i) => {
        const b = i * 2;
        values.push(`($${b + 1}, $${b + 2}, $${group.length * 2 + 1}, 'ACTIVE')`);
        params.push(`enr_${profileId}_${schoolId}`.slice(0, 120), profileId);
      });
      params.push(schoolId);
      await sql.query(
        `INSERT INTO vita_hero.school_enrollments (id, profile_id, school_id, status)
         VALUES ${values.join(", ")}
         ON CONFLICT (profile_id, school_id) DO NOTHING`,
        params
      );
    }

    // Denormalised school name on the student row, used by the parent app.
    await sql`
      UPDATE vita_hero.kids SET school = (SELECT name FROM vita_hero.schools WHERE id = ${schoolId})
      WHERE school_id = ${schoolId} AND COALESCE(school, '') = ''
    `;

    // Register any class the roster introduced, so the next upload validates
    // against reality rather than warning about the same grade every time.
    const pairs = new Set<string>();
    for (const p of writable) {
      if (p.report.grade) pairs.add(`${p.report.grade}|${p.report.section}`);
    }
    for (const key of pairs) {
      const [grade, section] = key.split("|");
      const id = `cls_${slugify(schoolId)}_${slugify(report.academicYear)}_${slugify(grade)}_${slugify(section) || "na"}`;
      await sql`
        INSERT INTO vita_hero.school_classes (id, school_id, academic_year, grade, section)
        VALUES (${id}, ${schoolId}, ${report.academicYear}, ${grade}, ${section})
        ON CONFLICT (school_id, academic_year, grade, section) DO NOTHING
      `;
    }
  }

  const batchId = `rb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  await sql`
    INSERT INTO vita_hero.roster_batches
      (id, school_id, academic_year, admin_id, filename, total, created, updated,
       unchanged, errors, warnings, guardians)
    VALUES
      (${batchId}, ${schoolId}, ${report.academicYear}, ${actor.profileId}, ${report.filename},
       ${report.total}, ${report.create}, ${report.update}, ${report.unchanged},
       ${report.errors}, ${report.warnings}, ${report.guardians})
  `;

  return { ...report, dryRun: false, batchId };
}

// ─── Roster listing and history ─────────────────────────────

export async function listRoster(
  sql: Sql,
  actor: Actor,
  schoolId: string,
  academicYear: string,
  search: string,
  limit: number,
  offset: number
) {
  assertSchoolAccess(actor, schoolId);
  const like = `%${(search || "").trim().toLowerCase()}%`;
  const cap = Math.min(Math.max(limit || 100, 1), 500);
  const skip = Math.max(offset || 0, 0);

  const filterYear = (academicYear || "").trim();
  const rows = await sql`
    SELECT k.id, k.name, k.grade, k.section, k.gender, k.age, k.date_of_birth,
           k.student_ref, k.guardian_name, k.academic_year, p.phone, p.is_logged_in,
           k.profile_id
    FROM vita_hero.kids k
    LEFT JOIN vita_hero.profiles p ON p.id = k.profile_id
    WHERE k.school_id = ${schoolId}
      AND (${filterYear} = '' OR k.academic_year = ${filterYear})
      AND (${search === ""} OR LOWER(k.name) LIKE ${like} OR LOWER(COALESCE(k.student_ref,'')) LIKE ${like}
           OR LOWER(COALESCE(k.guardian_name,'')) LIKE ${like} OR COALESCE(p.phone,'') LIKE ${like})
    ORDER BY k.grade, k.section, k.name
    LIMIT ${cap} OFFSET ${skip}
  `;
  const totalRows = await sql`
    SELECT COUNT(*)::int AS n FROM vita_hero.kids
    WHERE school_id = ${schoolId} AND (${filterYear} = '' OR academic_year = ${filterYear})
  `;

  return {
    total: (totalRows[0]?.n as number) || 0,
    limit: cap,
    offset: skip,
    students: rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      grade: (r.grade as string) || "",
      section: (r.section as string) || "",
      gender: (r.gender as string) || "",
      age: (r.age as number) ?? null,
      dob: (r.date_of_birth as string) || "",
      studentRef: (r.student_ref as string) || "",
      guardianName: (r.guardian_name as string) || "",
      guardianPhone: (r.phone as string) || "",
      guardianActivated: r.is_logged_in === true,
      // Needed to invite this one guardian from the roster rather than
      // texting everybody who has not joined.
      profileId: (r.profile_id as string) || "",
      academicYear: (r.academic_year as string) || "",
    })),
  };
}

export async function listRosterBatches(sql: Sql, actor: Actor, schoolId: string) {
  assertSchoolAccess(actor, schoolId);
  const rows = await sql`
    SELECT b.*, p.name AS admin_name
    FROM vita_hero.roster_batches b
    LEFT JOIN vita_hero.profiles p ON p.id = b.admin_id
    WHERE b.school_id = ${schoolId}
    ORDER BY b.created_at DESC LIMIT 50
  `;
  return {
    batches: rows.map((r) => ({
      id: r.id as string,
      academicYear: (r.academic_year as string) || "",
      filename: (r.filename as string) || "",
      adminName: (r.admin_name as string) || (r.admin_id as string) || "",
      total: (r.total as number) || 0,
      created: (r.created as number) || 0,
      updated: (r.updated as number) || 0,
      unchanged: (r.unchanged as number) || 0,
      errors: (r.errors as number) || 0,
      warnings: (r.warnings as number) || 0,
      guardians: (r.guardians as number) || 0,
      createdAt: r.created_at ? String(r.created_at) : "",
    })),
  };
}

// ─── Helpers ────────────────────────────────────────────────

function extractRows(body: Record<string, unknown>): Record<string, unknown>[] {
  const rows = Array.isArray(body.rows) ? (body.rows as Record<string, unknown>[]) : [];
  if (rows.length === 0) {
    throw new ApiError(400, "No rows found in the file", "NO_ROWS");
  }
  if (rows.length > ROSTER_MAX_ROWS) {
    throw new ApiError(
      413,
      `That file has ${rows.length} rows. Split it into files of ${ROSTER_MAX_ROWS} or fewer.`,
      "TOO_MANY_ROWS"
    );
  }
  return rows;
}

/**
 * Add one child, mid-term.
 *
 * A school takes a late admission in September and should not have to
 * re-upload a spreadsheet of four hundred to record it. This is deliberately
 * not a second way into the roster: it builds a single row and hands it to
 * commitRoster, so the one child gets exactly the validation, the guardian
 * provisioning and the stable admission-number matching that the CSV path
 * gets. A separate insert here is how the two would drift.
 */
export async function addStudent(
  sql: Sql,
  actor: Actor,
  schoolId: string,
  body: Record<string, unknown>
): Promise<RosterReport> {
  assertSchoolAccess(actor, schoolId);
  const str = (k: string) => String(body[k] || "").trim();

  const row: Record<string, string> = {
    "Admission No": str("studentRef"),
    "Student Name": str("name"),
    "Date of Birth": str("dob"),
    Gender: str("gender"),
    Class: str("grade"),
    Section: str("section"),
    "Guardian Name": str("guardianName"),
    "Guardian Phone": str("guardianPhone"),
  };

  // Validate first, so one child gets a message about that child rather than
  // the bulk-import wording about how many rows of a spreadsheet failed.
  const check = await validateRoster(sql, actor, schoolId, {
    rows: [row],
    academicYear: str("academicYear"),
    filename: "added by hand",
  });
  if (check.errors > 0) {
    const issues = (check.rows[0]?.issues || [])
      .filter((i) => i.severity === "error")
      .map((i) => i.message);
    throw new ApiError(
      422,
      issues.length ? issues.join(". ") : "That child could not be added.",
      "BAD_STUDENT"
    );
  }

  return commitRoster(sql, actor, schoolId, {
    rows: [row],
    academicYear: str("academicYear"),
    filename: "added by hand",
  });
}

/** The template the portal offers for download, so a school starts from the right shape. */
export const ROSTER_TEMPLATE_HEADERS = [
  "Admission No",
  "Student Name",
  "Date of Birth",
  "Gender",
  "Class",
  "Section",
  "Guardian Name",
  "Guardian Phone",
];

export const ROSTER_TEMPLATE_SAMPLE = [
  ["2026/0412", "Rahul Sharma", "14/03/2016", "Male", "Class 4", "B", "Priya Sharma", "9876543210"],
  ["2026/0413", "Ananya Reddy", "02/11/2015", "Female", "Class 5", "A", "Vikram Reddy", "9876543211"],
];
