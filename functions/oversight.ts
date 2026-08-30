// Stage K4 and K6 — the two the programme is accountable for, and the two
// that were never actually built.
//
// K4, hospital partner performance: referrals sent, seen, closed, and how long
// it took. A partnership is only worth having if children who are sent there
// are seen, and until now nothing in the product could tell you whether that
// was true of any given hospital.
//
// K6, the access log: who opened a child's record and when. Photograph views
// were already recorded because that is the artefact someone obviously asks
// about; the clinical record itself was not. A screener opening a screening
// form and a physician opening a review are both reads of a child's medical
// record and belong in the same ledger.

import { Sql, isOpsRole } from "./common";
import { Actor, ApiError } from "./schools";

const n = (v: unknown): number => Number(v) || 0;

export async function ensureOversightSchema(sql: Sql): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.record_access (
      id TEXT PRIMARY KEY,
      kid_id TEXT NOT NULL,
      school_id TEXT DEFAULT '',
      camp_id TEXT DEFAULT '',
      actor_id TEXT NOT NULL,
      actor_name TEXT DEFAULT '',
      actor_role TEXT DEFAULT '',
      surface TEXT NOT NULL,
      viewed_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS record_access_kid ON vita_hero.record_access(kid_id, viewed_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS record_access_actor ON vita_hero.record_access(actor_id, viewed_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS record_access_when ON vita_hero.record_access(viewed_at DESC)`;
}

let seq = 0;
function accessId(): string {
  seq = (seq + 1) % 100000;
  return "ra_" + Date.now().toString(36) + "_" + seq.toString(36);
}

/**
 * Record that someone opened a child's record.
 *
 * Deliberately best-effort: a failure to write the log must never stop a
 * physician seeing the child in front of them. That is the right trade for a
 * clinical screen, and it is the reason the log is a record of what happened
 * rather than a permission gate — the gate is the role check that ran before
 * this was called.
 */
export async function logRecordAccess(
  sql: Sql,
  actor: Actor,
  what: { kidId: string; schoolId?: string; campId?: string; surface: string }
): Promise<void> {
  if (!what.kidId) return;
  try {
    await sql`
      INSERT INTO vita_hero.record_access
        (id, kid_id, school_id, camp_id, actor_id, actor_name, actor_role, surface)
      VALUES (${accessId()}, ${what.kidId}, ${what.schoolId || ""}, ${what.campId || ""},
              ${actor.profileId}, ${actor.name || ""}, ${actor.role}, ${what.surface})
    `;
  } catch {
    // Swallowed on purpose — see above.
  }
}

function assertOps(actor: Actor, what: string): void {
  if (!isOpsRole(actor.role)) {
    throw new ApiError(403, what + " is an operations view.", "OPS_ONLY");
  }
}

/**
 * K6 — who has opened a child's record.
 *
 * Photograph views live in their own table and are folded in here, so the
 * question "who has looked at this child" has one answer rather than two
 * places to check.
 */
export async function recordAccessLog(
  sql: Sql,
  actor: Actor,
  opts: { kidId?: string; actorId?: string; days?: number; limit?: number } = {}
) {
  assertOps(actor, "The access log");
  const days = Math.min(Math.max(opts.days || 30, 1), 365);
  const limit = Math.min(Math.max(opts.limit || 200, 1), 1000);
  const kidId = opts.kidId || "";
  const actorId = opts.actorId || "";

  const rows = await sql`
    SELECT r.id, r.kid_id, r.camp_id, r.actor_id, r.actor_name, r.actor_role,
           r.surface, r.viewed_at, k.name AS kid_name, s.name AS school_name
    FROM vita_hero.record_access r
    LEFT JOIN vita_hero.kids k ON k.id = r.kid_id
    LEFT JOIN vita_hero.schools s ON s.id = r.school_id
    WHERE r.viewed_at >= NOW() - (${days} || ' days')::interval
      AND (${!kidId} OR r.kid_id = ${kidId})
      AND (${!actorId} OR r.actor_id = ${actorId})

    UNION ALL

    SELECT l.id, p.kid_id, p.camp_id, l.actor_id,
           COALESCE(pr.name, '') AS actor_name, l.actor_role,
           'PHOTOGRAPH' AS surface, l.viewed_at, k.name AS kid_name, s.name AS school_name
    FROM vita_hero.photo_access_log l
    JOIN vita_hero.finding_photos p ON p.id = l.photo_id
    LEFT JOIN vita_hero.kids k ON k.id = p.kid_id
    LEFT JOIN vita_hero.profiles pr ON pr.id = l.actor_id
    LEFT JOIN vita_hero.schools s ON s.id = k.school_id
    WHERE l.viewed_at >= NOW() - (${days} || ' days')::interval
      AND (${!kidId} OR p.kid_id = ${kidId})
      AND (${!actorId} OR l.actor_id = ${actorId})

    ORDER BY viewed_at DESC
    LIMIT ${limit}
  `;

  const summary = await sql`
    SELECT actor_id, MAX(actor_name) AS actor_name, MAX(actor_role) AS actor_role,
           COUNT(*)::int AS reads, COUNT(DISTINCT kid_id)::int AS children,
           MAX(viewed_at) AS last_at
    FROM vita_hero.record_access
    WHERE viewed_at >= NOW() - (${days} || ' days')::interval
    GROUP BY actor_id
    ORDER BY COUNT(*) DESC
    LIMIT 50
  `;

  return {
    days,
    entries: rows.map((r) => ({
      id: r.id as string,
      kidId: (r.kid_id as string) || "",
      kidName: (r.kid_name as string) || "",
      schoolName: (r.school_name as string) || "",
      campId: (r.camp_id as string) || "",
      actorId: r.actor_id as string,
      actorName: (r.actor_name as string) || "",
      actorRole: (r.actor_role as string) || "",
      surface: r.surface as string,
      at: r.viewed_at ? new Date(r.viewed_at as string).toISOString() : "",
    })),
    byActor: summary.map((s) => ({
      actorId: s.actor_id as string,
      actorName: (s.actor_name as string) || "",
      actorRole: (s.actor_role as string) || "",
      reads: n(s.reads),
      children: n(s.children),
      lastAt: s.last_at ? new Date(s.last_at as string).toISOString() : "",
    })),
    note:
      "Every read of a child's screening record, review or photograph. " +
      "Kept for as long as the record is; never deleted to tidy the view.",
  };
}

/**
 * K4 — did the hospitals we send children to actually see them?
 *
 * A referral reaches a hospital through the appointment the family booked, so
 * that is the join. Referrals where the family said they would use their own
 * doctor have no hospital and are reported on their own line: attributing them
 * to a partner would flatter every partner's numbers.
 */
export async function hospitalPerformance(
  sql: Sql,
  actor: Actor,
  opts: { schoolId?: string } = {}
) {
  assertOps(actor, "Partner performance");
  const schoolId = opts.schoolId || "";
  const all = !schoolId;

  const rows = await sql`
    SELECT h.id, h.name, h.city, h.district, h.is_camp_partner, h.rating,
      COUNT(r.id)::int AS sent,
      COUNT(r.id) FILTER (WHERE r.attended_at IS NOT NULL)::int AS seen,
      COUNT(r.id) FILTER (WHERE r.status = 'CLOSED')::int AS closed,
      COUNT(r.id) FILTER (WHERE r.status IN ('OPEN','BOOKED'))::int AS outstanding,
      COUNT(r.id) FILTER (WHERE r.status = 'EXPIRED')::int AS expired,
      AVG(EXTRACT(EPOCH FROM (r.closed_at - r.created_at)) / 86400.0)
        FILTER (WHERE r.closed_at IS NOT NULL) AS avg_days
    FROM vita_hero.hospitals h
    LEFT JOIN vita_hero.doctors d ON d.hospital_id = h.id
    LEFT JOIN vita_hero.appointments ap ON ap.doctor_id = d.id
    LEFT JOIN vita_hero.referrals r ON r.appointment_id = ap.id
      AND (${all} OR r.school_id = ${schoolId})
    WHERE h.active = true
    GROUP BY h.id, h.name, h.city, h.district, h.is_camp_partner, h.rating
    ORDER BY COUNT(r.id) DESC, h.name
  `;

  // The referrals that never reached a partner at all. This is the line that
  // says whether the referral loop is working, so it is reported next to the
  // partners rather than left out of the picture.
  const unrouted = await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'CLOSED')::int AS closed,
      COUNT(*) FILTER (WHERE status IN ('OPEN','BOOKED'))::int AS outstanding,
      COUNT(*) FILTER (WHERE status = 'DECLINED')::int AS declined
    FROM vita_hero.referrals
    WHERE appointment_id IS NULL AND (${all} OR school_id = ${schoolId})
  `;

  const u = unrouted[0] || {};
  return {
    hospitals: rows.map((h) => {
      const sent = n(h.sent);
      return {
        id: h.id as string,
        name: h.name as string,
        city: (h.city as string) || "",
        district: (h.district as string) || "",
        isCampPartner: h.is_camp_partner === true,
        rating: h.rating === null ? null : Number(h.rating),
        sent,
        seen: n(h.seen),
        closed: n(h.closed),
        outstanding: n(h.outstanding),
        expired: n(h.expired),
        // Rates only exist once something was sent. A partner nobody has used
        // is not a partner with a 0% record.
        seenRate: sent > 0 ? Math.round((n(h.seen) / sent) * 100) : null,
        closureRate: sent > 0 ? Math.round((n(h.closed) / sent) * 100) : null,
        avgDaysToClose: h.avg_days == null ? null : Math.round(Number(h.avg_days) * 10) / 10,
      };
    }),
    notBooked: {
      total: n(u.total),
      closed: n(u.closed),
      outstanding: n(u.outstanding),
      declined: n(u.declined),
    },
    note:
      "A referral is attributed to a hospital through the appointment the " +
      "family booked. Families using their own doctor are counted separately.",
  };
}
