// The ops dashboard — Stage K1, and the anonymised rollup of K2.
//
// The Overview this replaces showed six counters and a list of camps. That is
// not a dashboard; it is a landing page. It could not answer the question the
// programme is actually judged on — of the children we flagged, how many
// actually saw a doctor — nor show where a cohort falls out of the pathway.
//
// Everything here is derived. Nothing is stored, nothing is estimated, and a
// figure that has no data behind it comes back as null rather than zero, so the
// console can say "not measured" instead of drawing a confident line through
// the origin.

import { Sql, isOpsRole } from "./common";
import { Actor } from "./schools";

/** How many months of history the trend covers. */
const TREND_MONTHS = 12;

type Row = Record<string, unknown>;
const n = (v: unknown): number => Number(v) || 0;

/**
 * The pathway as a funnel: every stage from A5 (on the roster) to D6
 * (released), for every camp in scope.
 *
 * Read top to bottom it shows where children are lost — consent never
 * returned, absent on the day, screened but never reviewed, reviewed but never
 * released. Each of those is a different person's problem to fix, which is why
 * they are separate steps rather than one "coverage" percentage.
 */
function funnelOf(r: Row) {
  const rostered = n(r.rostered);
  const pct = (v: number) => (rostered > 0 ? Math.round((v / rostered) * 100) : null);
  const steps = [
    { key: "rostered", label: "On the camp roster", stage: "B7", count: rostered },
    { key: "consented", label: "Consent given", stage: "B3", count: n(r.consented) },
    { key: "present", label: "Present on the day", stage: "C3", count: n(r.present) },
    { key: "screened", label: "Screened", stage: "C8", count: n(r.screened) },
    { key: "reviewed", label: "Clinically reviewed", stage: "D5", count: n(r.reviewed) },
    { key: "released", label: "Released to guardians", stage: "D6", count: n(r.released) },
  ];
  return steps.map((s) => ({ ...s, pct: pct(s.count) }));
}

export async function adminAnalytics(sql: Sql, actor: Actor, opts: { schoolId?: string } = {}) {
  const ops = isOpsRole(actor.role);
  // A school admin sees their own school and nothing else, whatever they ask
  // for. Ops may narrow to one school.
  const schoolId = ops ? opts.schoolId || "" : actor.schoolId || "";
  const all = !schoolId;

  const funnelRows = await sql`
    SELECT
      COUNT(*)::int AS rostered,
      COUNT(*) FILTER (WHERE consent_status IN ('GRANTED','PAPER'))::int AS consented,
      COUNT(*) FILTER (WHERE consent_status = 'DECLINED')::int AS declined,
      COUNT(*) FILTER (WHERE attendance = 'PRESENT')::int AS present,
      COUNT(*) FILTER (WHERE attendance = 'ABSENT')::int AS absent,
      COUNT(*) FILTER (WHERE status <> 'NOT_SCREENED')::int AS screened,
      COUNT(*) FILTER (WHERE reviewed_at IS NOT NULL)::int AS reviewed,
      COUNT(*) FILTER (WHERE released_at IS NOT NULL)::int AS released
    FROM vita_hero.camp_participants
    WHERE (${all} OR school_id = ${schoolId})
  `;

  const refRows = await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'OPEN')::int AS open,
      COUNT(*) FILTER (WHERE status = 'BOOKED')::int AS booked,
      COUNT(*) FILTER (WHERE status = 'ATTENDED')::int AS attended,
      COUNT(*) FILTER (WHERE status = 'CLOSED')::int AS closed,
      COUNT(*) FILTER (WHERE status = 'DECLINED')::int AS declined,
      COUNT(*) FILTER (WHERE status = 'EXPIRED')::int AS expired,
      COUNT(*) FILTER (WHERE urgency = 'URGENT' AND status IN ('OPEN','BOOKED'))::int AS urgent_open,
      COUNT(*) FILTER (WHERE status IN ('OPEN','BOOKED') AND due_by <> ''
        AND due_by < to_char(NOW(), 'YYYY-MM-DD'))::int AS overdue,
      AVG(EXTRACT(EPOCH FROM (closed_at - created_at)) / 86400.0)
        FILTER (WHERE closed_at IS NOT NULL) AS avg_days_to_close
    FROM vita_hero.referrals
    WHERE (${all} OR school_id = ${schoolId})
  `;

  // Prevalence per check. A finding recorded as NOT_MEASURED is counted and
  // reported: a check nobody actually performed must not read as a clean
  // result, here or anywhere else.
  const prevalence = await sql`
    SELECT f.check_type,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE f.flag = 'GOOD')::int AS good,
      COUNT(*) FILTER (WHERE f.flag = 'WATCH')::int AS watch,
      COUNT(*) FILTER (WHERE f.flag = 'ALERT')::int AS alert,
      COUNT(*) FILTER (WHERE f.flag = 'NOT_MEASURED')::int AS not_measured
    FROM vita_hero.camp_findings f
    JOIN vita_hero.school_camps sc ON sc.id = f.camp_id
    WHERE (${all} OR sc.school_id = ${schoolId})
    GROUP BY f.check_type
    ORDER BY COUNT(*) FILTER (WHERE f.flag IN ('WATCH','ALERT')) DESC
  `;

  const screenedByMonth = await sql`
    SELECT to_char(date_trunc('month', screened_at), 'YYYY-MM') AS month,
           COUNT(*)::int AS screened
    FROM vita_hero.camp_participants
    WHERE screened_at IS NOT NULL
      AND screened_at >= date_trunc('month', NOW()) - (${TREND_MONTHS - 1} || ' months')::interval
      AND (${all} OR school_id = ${schoolId})
    GROUP BY 1 ORDER BY 1
  `;

  const referralsByMonth = await sql`
    SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
           COUNT(*)::int AS raised,
           COUNT(*) FILTER (WHERE closed_at IS NOT NULL)::int AS closed
    FROM vita_hero.referrals
    WHERE created_at >= date_trunc('month', NOW()) - (${TREND_MONTHS - 1} || ' months')::interval
      AND (${all} OR school_id = ${schoolId})
    GROUP BY 1 ORDER BY 1
  `;

  // One row per school: how far each got through the pathway, and whether its
  // referrals close. This is the list ops works from.
  const bySchool = await sql`
    SELECT s.id, s.name, s.city, s.district,
      (SELECT COUNT(*)::int FROM vita_hero.kids k WHERE k.school_id = s.id AND k.source = 'ADMIN') AS students,
      COUNT(p.id)::int AS rostered,
      COUNT(p.id) FILTER (WHERE p.status <> 'NOT_SCREENED')::int AS screened,
      COUNT(p.id) FILTER (WHERE p.released_at IS NOT NULL)::int AS released,
      (SELECT COUNT(*)::int FROM vita_hero.referrals r WHERE r.school_id = s.id) AS referrals,
      (SELECT COUNT(*)::int FROM vita_hero.referrals r WHERE r.school_id = s.id AND r.status = 'CLOSED') AS referrals_closed,
      (SELECT MAX(sc.date) FROM vita_hero.school_camps sc WHERE sc.school_id = s.id AND sc.active = true) AS last_camp
    FROM vita_hero.schools s
    LEFT JOIN vita_hero.camp_participants p ON p.school_id = s.id
    WHERE s.active = true AND (${all} OR s.id = ${schoolId})
    GROUP BY s.id, s.name, s.city, s.district
    ORDER BY COUNT(p.id) DESC, s.name
    LIMIT 200
  `;

  // K2 — the district rollup. Ops only, and never per-child: this is the view
  // a health department or a funder is shown, so it carries no name, no
  // identifier and no school small enough to single a child out.
  const byDistrict = ops
    ? await sql`
        SELECT COALESCE(NULLIF(s.district, ''), s.city, 'Unrecorded') AS district,
          COUNT(DISTINCT s.id)::int AS schools,
          COUNT(p.id) FILTER (WHERE p.status <> 'NOT_SCREENED')::int AS screened,
          COUNT(p.id) FILTER (WHERE p.status <> 'NOT_SCREENED'
            AND p.urgency <> 'NONE')::int AS flagged
        FROM vita_hero.schools s
        LEFT JOIN vita_hero.camp_participants p ON p.school_id = s.id
        WHERE s.active = true
        GROUP BY 1
        HAVING COUNT(p.id) FILTER (WHERE p.status <> 'NOT_SCREENED') > 0
        ORDER BY 2 DESC, 1
      `
    : [];

  const f = funnelRows[0] || {};
  const r = refRows[0] || {};

  const refTotal = n(r.total);
  // Declined counts as resolved — the family made a decision. It is reported
  // separately so it cannot hide a programme that simply is not reaching
  // people.
  const actionable = refTotal - n(r.declined);
  const closureRate = actionable > 0 ? Math.round((n(r.closed) / actionable) * 100) : null;

  // Merge the two monthly series onto one axis, filling gaps with zero so a
  // quiet month is visibly quiet rather than absent from the chart.
  const months: string[] = [];
  const now = new Date();
  for (let i = TREND_MONTHS - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push(d.toISOString().slice(0, 7));
  }
  const sMap = new Map(screenedByMonth.map((x) => [x.month as string, n(x.screened)]));
  const rMap = new Map(referralsByMonth.map((x) => [x.month as string, x]));
  const trend = months.map((m) => ({
    month: m,
    screened: sMap.get(m) || 0,
    referralsRaised: n(rMap.get(m)?.raised),
    referralsClosed: n(rMap.get(m)?.closed),
  }));

  return {
    scope: all ? "ALL" : schoolId,
    funnel: funnelOf(f),
    attendance: { absent: n(f.absent), declined: n(f.declined) },
    referrals: {
      total: refTotal,
      open: n(r.open),
      booked: n(r.booked),
      attended: n(r.attended),
      closed: n(r.closed),
      declined: n(r.declined),
      expired: n(r.expired),
      urgentOpen: n(r.urgent_open),
      overdue: n(r.overdue),
      closureRate,
      // Null rather than 0 when nothing has closed yet — an unmeasured
      // average is not a fast one.
      avgDaysToClose:
        r.avg_days_to_close == null ? null : Math.round(Number(r.avg_days_to_close) * 10) / 10,
    },
    prevalence: prevalence.map((p) => ({
      checkType: p.check_type as string,
      total: n(p.total),
      good: n(p.good),
      watch: n(p.watch),
      alert: n(p.alert),
      notMeasured: n(p.not_measured),
    })),
    trend,
    bySchool: bySchool.map((s) => {
      const rf = n(s.referrals);
      return {
        id: s.id as string,
        name: s.name as string,
        city: (s.city as string) || "",
        district: (s.district as string) || "",
        students: n(s.students),
        rostered: n(s.rostered),
        screened: n(s.screened),
        released: n(s.released),
        referrals: rf,
        referralsClosed: n(s.referrals_closed),
        closureRate: rf > 0 ? Math.round((n(s.referrals_closed) / rf) * 100) : null,
        coverage: n(s.students) > 0 ? Math.round((n(s.screened) / n(s.students)) * 100) : null,
        lastCamp: (s.last_camp as string) || "",
      };
    }),
    byDistrict: byDistrict.map((d) => ({
      district: d.district as string,
      schools: n(d.schools),
      screened: n(d.screened),
      flagged: n(d.flagged),
      flaggedPct: n(d.screened) > 0 ? Math.round((n(d.flagged) / n(d.screened)) * 100) : null,
    })),
  };
}
