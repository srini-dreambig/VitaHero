// The hospitals and doctors a family can be referred to, and the invitations
// that get a family into the app in the first place.
//
// Both existed as read-only endpoints the app consumed, seeded once and never
// editable. That is fine until the first real pilot, at which point somebody
// has to add the hospital that is actually next to the school — and there was
// nowhere to do it. This is that surface.

import { Sql, isOpsRole, normalizePhone } from "./common";
import { Actor, ApiError, assertSchoolAccess } from "./schools";

function opsOnly(actor: Actor, what: string) {
  if (!isOpsRole(actor.role)) {
    throw new ApiError(403, `${what} is managed by VitaHero operations`, "OPS_REQUIRED");
  }
}

const num = (v: unknown, fallback: number | null = null): number | null => {
  if (v === null || v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

// ─── Hospitals ──────────────────────────────────────────────

export async function listHospitals(sql: Sql, actor: Actor, search: string) {
  // A school admin picks a partner hospital for their camps, so they may read
  // the directory. Only operations may change it.
  const q = (search || "").toLowerCase();
  const rows = await sql`
    SELECT h.*,
      (SELECT COUNT(*)::int FROM vita_hero.doctors d WHERE d.hospital_id = h.id AND d.active) AS doctor_count
    FROM vita_hero.hospitals h
    WHERE (${q === ""} OR LOWER(h.name) LIKE ${"%" + q + "%"} OR LOWER(h.city) LIKE ${"%" + q + "%"})
    ORDER BY h.is_camp_partner DESC, h.name
  `;
  return {
    canEdit: isOpsRole(actor.role),
    hospitals: rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      city: (r.city as string) || "",
      district: (r.district as string) || "",
      address: (r.address as string) || "",
      phone: (r.phone as string) || "",
      lat: r.lat === null ? null : Number(r.lat),
      lng: r.lng === null ? null : Number(r.lng),
      rating: Number(r.rating) || 0,
      isCampPartner: r.is_camp_partner === true,
      active: r.active !== false,
      doctorCount: (r.doctor_count as number) || 0,
    })),
  };
}

export async function upsertHospital(sql: Sql, actor: Actor, body: Record<string, unknown>) {
  opsOnly(actor, "The hospital directory");
  const name = String(body.name || "").trim();
  if (name.length < 2) throw new ApiError(400, "A hospital needs a name", "NAME_REQUIRED");
  const city = String(body.city || "").trim();
  if (!city) throw new ApiError(400, "Which city?", "CITY_REQUIRED");

  const id = String(body.id || "").trim() || `hos_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  await sql`
    INSERT INTO vita_hero.hospitals
      (id, name, city, district, address, lat, lng, phone, rating, is_camp_partner, active)
    VALUES (${id}, ${name}, ${city}, ${String(body.district || "")}, ${String(body.address || "")},
            ${num(body.lat)}, ${num(body.lng)}, ${String(body.phone || "")},
            ${num(body.rating, 4.5)}, ${body.isCampPartner === true}, ${body.active !== false})
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, city = EXCLUDED.city, district = EXCLUDED.district,
      address = EXCLUDED.address, lat = EXCLUDED.lat, lng = EXCLUDED.lng,
      phone = EXCLUDED.phone, rating = EXCLUDED.rating,
      is_camp_partner = EXCLUDED.is_camp_partner, active = EXCLUDED.active
  `;
  return { id, name };
}

export async function deleteHospital(sql: Sql, actor: Actor, id: string) {
  opsOnly(actor, "The hospital directory");
  // Doctors point at it and camps may name it, so retire rather than delete:
  // a referral written last month must still say where it sent the family.
  await sql`UPDATE vita_hero.hospitals SET active = false WHERE id = ${id}`;
  await sql`UPDATE vita_hero.doctors SET active = false WHERE hospital_id = ${id}`;
  return { retired: id };
}

// ─── Doctors ────────────────────────────────────────────────

export async function listDoctors(sql: Sql, actor: Actor, hospitalId: string) {
  const rows = await sql`
    SELECT d.*, h.name AS hospital_name
    FROM vita_hero.doctors d
    LEFT JOIN vita_hero.hospitals h ON h.id = d.hospital_id
    WHERE (${!hospitalId} OR d.hospital_id = ${hospitalId || ""})
    ORDER BY d.active DESC, d.name
  `;
  return {
    canEdit: isOpsRole(actor.role),
    doctors: rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      specialty: (r.specialty as string) || "",
      hospitalId: (r.hospital_id as string) || "",
      hospitalName: (r.hospital_name as string) || (r.hospital as string) || "",
      city: (r.city as string) || "",
      rating: Number(r.rating) || 0,
      active: r.active !== false,
    })),
  };
}

export async function upsertDoctor(sql: Sql, actor: Actor, body: Record<string, unknown>) {
  opsOnly(actor, "The doctor directory");
  const name = String(body.name || "").trim();
  if (name.length < 2) throw new ApiError(400, "A doctor needs a name", "NAME_REQUIRED");
  const specialty = String(body.specialty || "").trim();
  if (!specialty) throw new ApiError(400, "Which specialty?", "SPECIALTY_REQUIRED");

  const hospitalId = String(body.hospitalId || "").trim();
  let hospitalName = "";
  if (hospitalId) {
    const h = await sql`SELECT name, city FROM vita_hero.hospitals WHERE id = ${hospitalId} LIMIT 1`;
    if (h.length === 0) throw new ApiError(400, "That hospital is not in the directory", "NO_HOSPITAL");
    hospitalName = h[0].name as string;
  }

  const id = String(body.id || "").trim() || `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  await sql`
    INSERT INTO vita_hero.doctors (id, name, specialty, hospital, hospital_id, city, rating, active)
    VALUES (${id}, ${name}, ${specialty}, ${hospitalName}, ${hospitalId || null},
            ${String(body.city || "")}, ${num(body.rating, 4.5)}, ${body.active !== false})
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, specialty = EXCLUDED.specialty, hospital = EXCLUDED.hospital,
      hospital_id = EXCLUDED.hospital_id, city = EXCLUDED.city,
      rating = EXCLUDED.rating, active = EXCLUDED.active
  `;
  return { id, name };
}

export async function deleteDoctor(sql: Sql, actor: Actor, id: string) {
  opsOnly(actor, "The doctor directory");
  await sql`UPDATE vita_hero.doctors SET active = false WHERE id = ${id}`;
  return { retired: id };
}

// ─── Getting families into the app ──────────────────────────

/**
 * Who has and has not installed the app.
 *
 * A roster import provisions a guardian and can text them a link, but nothing
 * afterwards told anyone whether that worked. This is the number a founder
 * actually needs before a camp: how many families can receive a result at all.
 */
export async function inviteStatus(sql: Sql, actor: Actor, schoolId: string) {
  assertSchoolAccess(actor, schoolId);
  const rows = await sql`
    SELECT DISTINCT p.id, p.name, p.phone, p.is_logged_in, p.invited_at,
      (SELECT COUNT(*)::int FROM vita_hero.kids k WHERE k.profile_id = p.id AND k.school_id = ${schoolId}) AS children
    FROM vita_hero.school_enrollments e
    JOIN vita_hero.profiles p ON p.id = e.profile_id
    WHERE e.school_id = ${schoolId} AND e.status = 'ACTIVE' AND p.role = 'PARENT'
    ORDER BY p.is_logged_in, p.name
  `;
  const guardians = rows.map((r) => ({
    profileId: r.id as string,
    name: (r.name as string) || "",
    phone: (r.phone as string) || "",
    children: (r.children as number) || 0,
    usingApp: r.is_logged_in === true,
    invitedAt: r.invited_at ? String(r.invited_at) : "",
  }));
  const joined = guardians.filter((g) => g.usingApp).length;
  return {
    total: guardians.length,
    joined,
    notJoined: guardians.length - joined,
    neverInvited: guardians.filter((g) => !g.invitedAt).length,
    guardians,
  };
}

/**
 * Text the download link to the families who are not on the app yet.
 *
 * Only ever to guardians of this school, and only to those who have not
 * signed in. Sending to everyone would text people who are already using it,
 * which is how a health service teaches families to ignore its messages.
 */
export async function inviteGuardians(
  sql: Sql,
  actor: Actor,
  schoolId: string,
  sendSms: (phone: string, body: string) => Promise<boolean>,
  buildLink: (last10: string) => string,
  opts: { onlyNotJoined?: boolean; profileIds?: string[] } = {}
) {
  assertSchoolAccess(actor, schoolId);
  const only = opts.onlyNotJoined !== false;
  const picked = Array.isArray(opts.profileIds) ? opts.profileIds.filter(Boolean) : [];

  const rows = await sql`
    SELECT DISTINCT p.id, p.name, p.phone
    FROM vita_hero.school_enrollments e
    JOIN vita_hero.profiles p ON p.id = e.profile_id
    WHERE e.school_id = ${schoolId} AND e.status = 'ACTIVE' AND p.role = 'PARENT'
      AND (${!only} OR p.is_logged_in IS NOT TRUE)
      AND (${picked.length === 0} OR p.id = ANY(${picked}))
  `;

  const school = await sql`SELECT name FROM vita_hero.schools WHERE id = ${schoolId} LIMIT 1`;
  const schoolName = (school[0]?.name as string) || "your school";

  let sent = 0;
  const failed: string[] = [];
  for (const r of rows) {
    const norm = normalizePhone(String(r.phone || ""));
    if (!norm) {
      failed.push((r.name as string) || (r.phone as string) || "unknown");
      continue;
    }
    const ok = await sendSms(
      norm.e164,
      `${schoolName} uses VitaHero for your child's school health check-up. ` +
        `Open your child's results here: ${buildLink(norm.last10)}`
    );
    if (ok) {
      sent++;
      await sql`UPDATE vita_hero.profiles SET invited_at = NOW() WHERE id = ${r.id as string}`;
    } else {
      failed.push((r.name as string) || norm.e164);
    }
  }
  return { targeted: rows.length, sent, failed };
}

// ─── Everyone at one camp, for the office ───────────────────

/**
 * The families of one camp, with the detail a school office needs to chase
 * them: guardian, number, consent, attendance, and whether they can even
 * receive the result. Exportable, because the office lives in a spreadsheet.
 */
export async function campPeople(sql: Sql, actor: Actor, campId: string, schoolId: string) {
  assertSchoolAccess(actor, schoolId);
  const rows = await sql`
    SELECT cp.kid_id, cp.consent_status, cp.consent_photos, cp.attendance, cp.status,
           k.name AS kid_name, k.grade, k.section, k.age, k.gender, k.student_ref,
           k.guardian_name, p.id AS profile_id, p.name AS guardian_account, p.phone,
           p.is_logged_in,
           (SELECT COUNT(*)::int FROM vita_hero.referrals r
             WHERE r.camp_id = cp.camp_id AND r.kid_id = cp.kid_id) AS referrals
    FROM vita_hero.camp_participants cp
    JOIN vita_hero.kids k ON k.id = cp.kid_id
    LEFT JOIN vita_hero.profiles p ON p.id = cp.profile_id
    WHERE cp.camp_id = ${campId}
    ORDER BY k.grade, k.section, k.name
  `;
  return {
    people: rows.map((r) => ({
      kidId: r.kid_id as string,
      kidName: (r.kid_name as string) || "",
      grade: (r.grade as string) || "",
      section: (r.section as string) || "",
      age: (r.age as number) ?? null,
      gender: (r.gender as string) || "",
      studentRef: (r.student_ref as string) || "",
      guardianName: (r.guardian_name as string) || (r.guardian_account as string) || "",
      guardianPhone: (r.phone as string) || "",
      usingApp: r.is_logged_in === true,
      consent: (r.consent_status as string) || "PENDING",
      photoConsent: r.consent_photos === true,
      attendance: (r.attendance as string) || "UNKNOWN",
      status: (r.status as string) || "NOT_SCREENED",
      referrals: (r.referrals as number) || 0,
    })),
  };
}
