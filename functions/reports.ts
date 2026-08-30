// Stages I and K — longitudinal comparison and cohort reporting.
//
// Three audiences, three questions:
//
//   Guardian  is my child better or worse than at the last camp?
//   School    what did we find across the year, and did families act on it?
//   Ops       which schools are working, and what is the picture across them?
//
// The school report is the artefact that renews a contract, and the closure
// rate inside it is the only number that shows screening changed anything.

import { Sql, isOpsRole } from "./common";
import { Actor, ApiError, assertSchoolAccess } from "./schools";
import { Flag } from "./clinical";

const CHECK_ORDER = [
  "Height & weight", "Vision", "Dental", "Haemoglobin", "ENT", "Skin", "Spine", "Immunisation review",
];

// ─── I2, F4 · One child over time ───────────────────────────

/**
 * Every camp this child has been screened at, newest first, with the change
 * since the previous one. Used by the app's child detail screen and by the
 * physician when a flag is not the first of its kind.
 */
export async function kidHealthHistory(sql: Sql, profileId: string, kidId: string) {
  const owns = await sql`
    SELECT id, name, age, gender FROM vita_hero.kids
    WHERE id = ${kidId} AND profile_id = ${profileId} LIMIT 1
  `;
  if (owns.length === 0) throw new ApiError(403, "That is not your child", "NOT_YOUR_CHILD");

  const rows = await sql`
    SELECT p.camp_id, p.released_at, p.urgency, p.recommendation,
           sc.title, sc.date, s.name AS school_name
    FROM vita_hero.camp_participants p
    JOIN vita_hero.school_camps sc ON sc.id = p.camp_id
    LEFT JOIN vita_hero.schools s ON s.id = sc.school_id
    WHERE p.kid_id = ${kidId} AND p.status = 'RELEASED'
    ORDER BY sc.date DESC
  `;

  const camps = [];
  for (const r of rows) {
    const f = await sql`
      SELECT check_type, flag, value_text, rationale, detail FROM vita_hero.camp_findings
      WHERE camp_id = ${r.camp_id as string} AND kid_id = ${kidId}
    `;
    camps.push({
      campId: r.camp_id as string,
      title: r.title as string,
      date: (r.date as string) || "",
      schoolName: (r.school_name as string) || "",
      urgency: (r.urgency as string) || "NONE",
      recommendation: (r.recommendation as string) || "",
      findings: f.map((x) => ({
        checkType: x.check_type as string,
        flag: x.flag as Flag,
        summary: (x.value_text as string) || "",
        note: (x.rationale as string) || "",
        detail: (x.detail as Record<string, unknown>) || {},
      })),
    });
  }

  // I2 — pair each camp with the one before it and say what moved.
  const SEV: Record<string, number> = { NOT_MEASURED: -1, GOOD: 0, WATCH: 1, ALERT: 2 };
  for (let i = 0; i < camps.length - 1; i++) {
    const now = camps[i];
    const prev = camps[i + 1];
    const changes: Array<{ checkType: string; from: string; to: string; direction: string }> = [];
    for (const f of now.findings) {
      const before = prev.findings.find((p) => p.checkType === f.checkType);
      if (!before || before.flag === "NOT_MEASURED" || f.flag === "NOT_MEASURED") continue;
      if (before.flag === f.flag) continue;
      changes.push({
        checkType: f.checkType,
        from: before.flag,
        to: f.flag,
        direction: SEV[f.flag] < SEV[before.flag] ? "improved" : "worse",
      });
    }
    (now as Record<string, unknown>).changesSinceLast = changes;
  }

  const growth = await sql`
    SELECT label, height, weight, recorded_at FROM vita_hero.growth_points
    WHERE kid_id = ${kidId} ORDER BY recorded_at
  `;

  return {
    child: {
      kidId,
      name: owns[0].name as string,
      age: (owns[0].age as number) ?? null,
      gender: (owns[0].gender as string) || "",
    },
    camps,
    growth: growth.map((g) => ({
      label: (g.label as string) || "",
      heightCm: Number(g.height) || null,
      weightKg: Number(g.weight) || null,
      at: g.recorded_at ? String(g.recorded_at) : "",
    })),
  };
}

// ─── I5 · The school's cohort report ────────────────────────

/**
 * What the programme found and what happened next, for one school and one
 * academic year. Deliberately aggregate: a school sees prevalence and
 * follow-through, not individual clinical records beyond what it needs to
 * chase families.
 */
export async function schoolReport(
  sql: Sql,
  actor: Actor,
  schoolId: string,
  academicYear: string
) {
  assertSchoolAccess(actor, schoolId);

  const schoolRows = await sql`
    SELECT name, city, academic_year FROM vita_hero.schools WHERE id = ${schoolId} LIMIT 1
  `;
  if (schoolRows.length === 0) throw new ApiError(404, "School not found", "NOT_FOUND");
  const year = academicYear || (schoolRows[0].academic_year as string) || "";

  const camps = await sql`
    SELECT id, title, date, status FROM vita_hero.school_camps
    WHERE school_id = ${schoolId} AND active = true
      AND (${year === ""} OR academic_year = ${year})
    ORDER BY date
  `;
  const campIds = camps.map((c) => c.id as string);

  if (campIds.length === 0) {
    return {
      school: { name: schoolRows[0].name as string, city: (schoolRows[0].city as string) || "" },
      academicYear: year,
      camps: [],
      coverage: null,
      prevalence: [],
      referrals: null,
      improvement: null,
      note: "No camps have run for this year yet.",
    };
  }

  // Coverage: of the children on the roll, how many were actually screened.
  const coverage = await sql`
    SELECT
      COUNT(DISTINCT p.kid_id)::int AS rostered,
      COUNT(DISTINCT p.kid_id) FILTER (WHERE p.consent_status IN ('GRANTED','PAPER'))::int AS consented,
      COUNT(DISTINCT p.kid_id) FILTER (WHERE p.status IN ('SCREENED','APPROVED','RELEASED'))::int AS screened,
      COUNT(DISTINCT p.kid_id) FILTER (WHERE p.status = 'RELEASED')::int AS released,
      COUNT(DISTINCT p.kid_id) FILTER (WHERE p.attendance = 'ABSENT')::int AS absent
    FROM vita_hero.camp_participants p WHERE p.camp_id = ANY(${campIds})
  `;

  // Prevalence per check, over released results only.
  const prevalence = await sql`
    SELECT f.check_type,
      COUNT(*) FILTER (WHERE f.flag <> 'NOT_MEASURED')::int AS measured,
      COUNT(*) FILTER (WHERE f.flag = 'GOOD')::int AS good,
      COUNT(*) FILTER (WHERE f.flag = 'WATCH')::int AS watch,
      COUNT(*) FILTER (WHERE f.flag = 'ALERT')::int AS alert
    FROM vita_hero.camp_findings f
    JOIN vita_hero.camp_participants p ON p.camp_id = f.camp_id AND p.kid_id = f.kid_id
    WHERE f.camp_id = ANY(${campIds}) AND p.status = 'RELEASED'
    GROUP BY f.check_type
  `;

  const referrals = await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'CLOSED')::int AS closed,
      COUNT(*) FILTER (WHERE status = 'DECLINED')::int AS declined,
      COUNT(*) FILTER (WHERE status IN ('OPEN','BOOKED'))::int AS outstanding,
      COUNT(*) FILTER (WHERE status = 'EXPIRED')::int AS expired,
      COUNT(*) FILTER (WHERE outcome = 'RESOLVED')::int AS resolved,
      COUNT(*) FILTER (WHERE outcome = 'ONGOING')::int AS ongoing
    FROM vita_hero.referrals WHERE camp_id = ANY(${campIds})
  `;

  // Improvement: children screened at two or more camps in this set, and
  // whether their worst flag moved.
  const improvement = await sql`
    WITH ranked AS (
      SELECT f.kid_id, f.camp_id, sc.date,
        MAX(CASE f.flag WHEN 'ALERT' THEN 2 WHEN 'WATCH' THEN 1 ELSE 0 END) AS severity,
        ROW_NUMBER() OVER (PARTITION BY f.kid_id ORDER BY sc.date DESC) AS rn
      FROM vita_hero.camp_findings f
      JOIN vita_hero.school_camps sc ON sc.id = f.camp_id
      JOIN vita_hero.camp_participants p ON p.camp_id = f.camp_id AND p.kid_id = f.kid_id
      WHERE f.camp_id = ANY(${campIds}) AND p.status = 'RELEASED' AND f.flag <> 'NOT_MEASURED'
      GROUP BY f.kid_id, f.camp_id, sc.date
    )
    SELECT
      COUNT(*)::int AS compared,
      COUNT(*) FILTER (WHERE latest.severity < prev.severity)::int AS improved,
      COUNT(*) FILTER (WHERE latest.severity = prev.severity)::int AS unchanged,
      COUNT(*) FILTER (WHERE latest.severity > prev.severity)::int AS worse
    FROM ranked latest
    JOIN ranked prev ON prev.kid_id = latest.kid_id AND prev.rn = 2
    WHERE latest.rn = 1
  `;

  const cov = coverage[0] as Record<string, number>;
  const ref = referrals[0] as Record<string, number>;
  const actionable = (ref.total || 0) - (ref.declined || 0);

  return {
    school: { name: schoolRows[0].name as string, city: (schoolRows[0].city as string) || "" },
    academicYear: year,
    camps: camps.map((c) => ({
      id: c.id as string,
      title: c.title as string,
      date: (c.date as string) || "",
      status: (c.status as string) || "",
    })),
    coverage: {
      ...cov,
      screenedRate: cov.rostered ? Math.round((cov.screened / cov.rostered) * 100) : null,
      consentRate: cov.rostered ? Math.round((cov.consented / cov.rostered) * 100) : null,
    },
    prevalence: prevalence
      .map((p) => {
        const measured = (p.measured as number) || 0;
        const flagged = ((p.watch as number) || 0) + ((p.alert as number) || 0);
        return {
          checkType: p.check_type as string,
          measured,
          good: (p.good as number) || 0,
          watch: (p.watch as number) || 0,
          alert: (p.alert as number) || 0,
          flaggedRate: measured ? Math.round((flagged / measured) * 100) : null,
        };
      })
      .sort((a, b) => CHECK_ORDER.indexOf(a.checkType) - CHECK_ORDER.indexOf(b.checkType)),
    referrals: {
      ...ref,
      closureRate: actionable > 0 ? Math.round(((ref.closed || 0) / actionable) * 100) : null,
    },
    improvement: improvement[0] || { compared: 0, improved: 0, unchanged: 0, worse: 0 },
  };
}

// ─── K1, K2 · Across every school ───────────────────────────

/**
 * The operations picture: which schools are actually running, and the
 * anonymised prevalence across all of them. No child is identifiable here —
 * it is the shape a district health office or a funder can be shown.
 */
export async function programmeReport(sql: Sql, actor: Actor) {
  if (!isOpsRole(actor.role)) {
    throw new ApiError(403, "This is an operations view", "OPS_REQUIRED");
  }

  const schools = await sql`
    SELECT s.id, s.name, s.city, s.district, s.status,
      (SELECT COUNT(*)::int FROM vita_hero.kids k WHERE k.school_id = s.id
        AND COALESCE(k.status,'ACTIVE') = 'ACTIVE') AS students,
      (SELECT COUNT(*)::int FROM vita_hero.school_camps c WHERE c.school_id = s.id AND c.active = true) AS camps,
      (SELECT COUNT(*)::int FROM vita_hero.school_camps c
        WHERE c.school_id = s.id AND c.status = 'RELEASED') AS camps_released,
      (SELECT COUNT(*)::int FROM vita_hero.referrals r WHERE r.school_id = s.id) AS referrals,
      (SELECT COUNT(*)::int FROM vita_hero.referrals r WHERE r.school_id = s.id AND r.status = 'CLOSED') AS referrals_closed,
      (SELECT COUNT(*)::int FROM vita_hero.profiles p
        WHERE p.school_id = s.id AND p.role = 'PARENT' AND p.is_logged_in = true) AS guardians_active
    FROM vita_hero.schools s
    WHERE s.active = true
    ORDER BY s.name
  `;

  const prevalence = await sql`
    SELECT f.check_type,
      COUNT(*) FILTER (WHERE f.flag <> 'NOT_MEASURED')::int AS measured,
      COUNT(*) FILTER (WHERE f.flag IN ('WATCH','ALERT'))::int AS flagged
    FROM vita_hero.camp_findings f
    JOIN vita_hero.camp_participants p ON p.camp_id = f.camp_id AND p.kid_id = f.kid_id
    WHERE p.status = 'RELEASED'
    GROUP BY f.check_type
  `;

  const byDistrict = await sql`
    SELECT COALESCE(NULLIF(s.district,''), s.city) AS area,
      COUNT(DISTINCT s.id)::int AS schools,
      COUNT(DISTINCT p.kid_id) FILTER (WHERE p.status = 'RELEASED')::int AS children_screened
    FROM vita_hero.schools s
    LEFT JOIN vita_hero.school_camps sc ON sc.school_id = s.id
    LEFT JOIN vita_hero.camp_participants p ON p.camp_id = sc.id
    WHERE s.active = true
    GROUP BY area ORDER BY children_screened DESC
  `;

  const totals = await sql`
    SELECT
      (SELECT COUNT(*)::int FROM vita_hero.schools WHERE active = true) AS schools,
      (SELECT COUNT(*)::int FROM vita_hero.kids WHERE source = 'ADMIN'
        AND COALESCE(status,'ACTIVE') = 'ACTIVE') AS students,
      (SELECT COUNT(DISTINCT kid_id)::int FROM vita_hero.camp_participants WHERE status = 'RELEASED') AS screened,
      (SELECT COUNT(*)::int FROM vita_hero.referrals) AS referrals,
      (SELECT COUNT(*)::int FROM vita_hero.referrals WHERE status = 'CLOSED') AS referrals_closed
  `;

  const t = totals[0] as Record<string, number>;
  return {
    totals: {
      ...t,
      closureRate: t.referrals ? Math.round((t.referrals_closed / t.referrals) * 100) : null,
    },
    schools: schools.map((s) => {
      const total = (s.referrals as number) || 0;
      const closed = (s.referrals_closed as number) || 0;
      return {
        id: s.id as string,
        name: s.name as string,
        city: (s.city as string) || "",
        district: (s.district as string) || "",
        students: (s.students as number) || 0,
        camps: (s.camps as number) || 0,
        campsReleased: (s.camps_released as number) || 0,
        referrals: total,
        referralsClosed: closed,
        closureRate: total ? Math.round((closed / total) * 100) : null,
        guardiansActive: (s.guardians_active as number) || 0,
      };
    }),
    prevalence: prevalence
      .map((p) => {
        const measured = (p.measured as number) || 0;
        return {
          checkType: p.check_type as string,
          measured,
          flagged: (p.flagged as number) || 0,
          flaggedRate: measured ? Math.round((((p.flagged as number) || 0) / measured) * 100) : null,
        };
      })
      .sort((a, b) => CHECK_ORDER.indexOf(a.checkType) - CHECK_ORDER.indexOf(b.checkType)),
    byArea: byDistrict.map((d) => ({
      area: (d.area as string) || "Unknown",
      schools: (d.schools as number) || 0,
      childrenScreened: (d.children_screened as number) || 0,
    })),
  };
}

// ─── K6 · Who has looked at a child's record ────────────────

/**
 * Reconstructed from the records themselves rather than a separate access log:
 * who screened, who reviewed, who released, who acted on a referral. It answers
 * the question a parent is entitled to ask without adding a write on every read.
 */
export async function childAccessTrail(sql: Sql, actor: Actor, kidId: string) {
  const kid = await sql`SELECT id, name, school_id FROM vita_hero.kids WHERE id = ${kidId} LIMIT 1`;
  if (kid.length === 0) throw new ApiError(404, "Child not found", "NOT_FOUND");
  if (!isOpsRole(actor.role)) assertSchoolAccess(actor, (kid[0].school_id as string) || "");

  const events: Array<{ at: string; action: string; by: string; detail: string }> = [];

  const parts = await sql`
    SELECT p.screened_at, p.reviewed_at, p.released_at, p.consent_at, p.consent_source,
           sc.title, sp.name AS screener, rp.name AS reviewer
    FROM vita_hero.camp_participants p
    JOIN vita_hero.school_camps sc ON sc.id = p.camp_id
    LEFT JOIN vita_hero.profiles sp ON sp.id = p.screened_by
    LEFT JOIN vita_hero.profiles rp ON rp.id = p.reviewed_by
    WHERE p.kid_id = ${kidId}
  `;
  for (const p of parts) {
    if (p.consent_at) events.push({ at: String(p.consent_at), action: "Consent recorded",
      by: (p.consent_source as string) || "", detail: p.title as string });
    if (p.screened_at) events.push({ at: String(p.screened_at), action: "Screened",
      by: (p.screener as string) || "", detail: p.title as string });
    if (p.reviewed_at) events.push({ at: String(p.reviewed_at), action: "Reviewed by physician",
      by: (p.reviewer as string) || "", detail: p.title as string });
    if (p.released_at) events.push({ at: String(p.released_at), action: "Released to guardian",
      by: (p.reviewer as string) || "", detail: p.title as string });
  }

  const refs = await sql`
    SELECT r.created_at, r.closed_at, r.check_type, r.outcome, cp.name AS closer
    FROM vita_hero.referrals r
    LEFT JOIN vita_hero.profiles cp ON cp.id = r.closed_by
    WHERE r.kid_id = ${kidId}
  `;
  for (const r of refs) {
    if (r.created_at) events.push({ at: String(r.created_at), action: "Referral opened",
      by: "", detail: r.check_type as string });
    if (r.closed_at) events.push({ at: String(r.closed_at), action: "Referral closed",
      by: (r.closer as string) || "", detail: `${r.check_type as string}: ${(r.outcome as string) || ""}` });
  }

  events.sort((a, b) => (a.at < b.at ? 1 : -1));
  return { child: { kidId, name: kid[0].name as string }, events };
}
