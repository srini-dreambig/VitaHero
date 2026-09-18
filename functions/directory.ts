// The hospitals and doctors a family can be referred to, and the invitations
// that get a family into the app in the first place.
//
// Both existed as read-only endpoints the app consumed, seeded once and never
// editable. That is fine until the first real pilot, at which point somebody
// has to add the hospital that is actually next to the school — and there was
// nowhere to do it. This is that surface.

import { Sql, isOpsRole, normalizeMobile, normalizePhone, profileIdForPhone } from "./common";
import { SmsSender, sendToMany } from "./messaging";
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

/**
 * The digits to match a search against.
 *
 * Anything longer than a national number is a number someone pasted with a
 * country code or a trunk zero in front of it, so it narrows to the last ten:
 * those are what is actually stored, and what a person reading a number off a
 * screen would type. Shorter stays as typed, so the last four digits still
 * find someone.
 */
function searchDigits(q: string): string {
  const d = (q || "").replace(/\D/g, "");
  return d.length > 10 ? d.slice(-10) : d;
}

export async function listHospitals(sql: Sql, actor: Actor, search: string) {
  // A school admin picks a partner hospital for their camps, so they may read
  // the directory. Only operations may change it.
  const q = (search || "").toLowerCase();
  const digits = searchDigits(q);
  const rows = await sql`
    SELECT h.*,
      (SELECT COUNT(*)::int FROM vita_hero.doctors d WHERE d.hospital_id = h.id AND d.active) AS doctor_count
    FROM vita_hero.hospitals h
    WHERE (${q === ""}
           OR LOWER(h.name) LIKE ${"%" + q + "%"}
           OR LOWER(h.city) LIKE ${"%" + q + "%"}
           OR LOWER(h.district) LIKE ${"%" + q + "%"}
           OR LOWER(h.address) LIKE ${"%" + q + "%"}
           OR (${digits !== ""} AND REGEXP_REPLACE(COALESCE(h.phone, ''), '[^0-9]', '', 'g') LIKE ${"%" + digits + "%"}))
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

/**
 * Who a doctor is when they sign in.
 *
 * A directory entry and a sign-in were two different things that looked like
 * one. The form demands a mobile and says "it is how they receive a code and
 * sign in"; adding the doctor then wrote a row into `doctors` and nothing
 * else, so the number the form had just insisted on was not registered
 * anywhere the OTP route looks. The doctor typed it in and was told to contact
 * their camp organizer.
 *
 * So: the sign-in is now a real, explicit part of adding a doctor — a field on
 * the form, on by default, that provisions this profile. Unticking it is for a
 * referral-only entry: a hospital's consultant a family is sent to, who has no
 * business in the console.
 *
 * `school_id` stays null. A directory doctor belongs to the programme rather
 * than to one school, and assignDoctorToCamp scopes them to a school when they
 * are actually put on a camp there.
 */
async function grantDoctorSignIn(
  sql: Sql,
  actor: Actor,
  name: string,
  e164: string,
  last10: string
) {
  const profileId = profileIdForPhone(last10);
  const existing = await sql`
    SELECT role FROM vita_hero.profiles WHERE id = ${profileId} LIMIT 1`;
  const role = existing.length ? String(existing[0].role || "") : "";

  // A number belongs to one person. Quietly turning a parent into a physician
  // would hand somebody the console and lose a family their records.
  if (role === "PARENT") {
    throw new ApiError(
      409,
      `${e164} is already registered as a parent. A number can only belong to one person.`,
      "PHONE_IS_PARENT"
    );
  }
  // Ops and school administrators outrank this; never demote them.
  if (role === "ADMIN" || role === "SUPERADMIN" || role === "SCHOOL_ADMIN") {
    return { profileId, role, provisioned: true, demoted: false };
  }

  await sql`
    INSERT INTO vita_hero.profiles
      (id, user_id, phone, name, auth_provider, role, provisioned, school_id,
       is_logged_in, onboarding_complete, created_by)
    VALUES
      (${profileId}, ${profileId}, ${e164}, ${name}, 'PHONE', 'PHYSICIAN',
       true, NULL, false, true, ${actor.profileId})
    ON CONFLICT (id) DO UPDATE SET
      name = ${name}, phone = ${e164}, role = 'PHYSICIAN', provisioned = true
  `;
  return { profileId, role: "PHYSICIAN", provisioned: true, demoted: false };
}

/**
 * Take the sign-in away again.
 *
 * Refused while they are on a camp: revoking here would lock a physician out
 * of a camp they are supposed to be reviewing, and the camp screen would still
 * list them as staff. Take them off the camps first — that is the surface
 * where the consequence is visible.
 */
async function revokeDoctorSignIn(sql: Sql, last10: string, name: string) {
  const profileId = profileIdForPhone(last10);
  const rows = await sql`
    SELECT role FROM vita_hero.profiles WHERE id = ${profileId} LIMIT 1`;
  if (rows.length === 0) return { profileId, removed: false };
  if (String(rows[0].role || "") !== "PHYSICIAN") return { profileId, removed: false };

  const live = await sql`
    SELECT COUNT(*)::int AS c FROM vita_hero.camp_staff
    WHERE profile_id = ${profileId} AND active = true`;
  const n = Number(live[0]?.c) || 0;
  if (n > 0) {
    throw new ApiError(
      409,
      `${name} is on ${n} active camp${n === 1 ? "" : "s"}. Take them off those camps before removing their sign-in.`,
      "DOCTOR_ON_CAMP"
    );
  }
  await sql`
    UPDATE vita_hero.profiles SET provisioned = false, is_logged_in = false,
      session_token = NULL WHERE id = ${profileId}`;
  return { profileId, removed: true };
}

export async function listDoctors(sql: Sql, actor: Actor, hospitalId: string, search = "") {
  // Digits are matched against the number itself, so a phone can be found by
  // the last few digits the way someone reads them off a screen, and with or
  // without spaces, a country code or a trunk zero.
  const q = (search || "").trim().toLowerCase();
  // The last ten digits are a number's identity here, the same rule profile
  // ids use. Without this, pasting a number the way it is stored — with +91,
  // or with the trunk zero people write — finds nothing, because "09876543210"
  // is not a substring of "919876543210".
  const digits = searchDigits(q);
  const rows = await sql`
    SELECT d.*, h.name AS hospital_name,
      (SELECT COUNT(*)::int FROM vita_hero.camp_staff cs
         WHERE cs.doctor_id = d.id AND cs.active) AS camp_count,
      -- Whether this doctor can actually get in, rather than whether their
      -- number looks like it could. A correlated subquery keeps the whole list
      -- to one round trip, which matters on a Worker.
      (SELECT p.provisioned FROM vita_hero.profiles p
         WHERE p.id = 'ph_' || RIGHT(REGEXP_REPLACE(COALESCE(d.phone, ''), '[^0-9]', '', 'g'), 10)
           AND p.role = 'PHYSICIAN' LIMIT 1) AS sign_in,
      (SELECT COUNT(*)::int FROM vita_hero.camp_staff cs2
         WHERE cs2.doctor_id = d.id) AS camps_ever
    FROM vita_hero.doctors d
    LEFT JOIN vita_hero.hospitals h ON h.id = d.hospital_id
    WHERE (${!hospitalId} OR d.hospital_id = ${hospitalId || ""})
      AND (${q === ""}
           OR LOWER(d.name) LIKE ${"%" + q + "%"}
           OR LOWER(d.specialty) LIKE ${"%" + q + "%"}
           OR LOWER(d.city) LIKE ${"%" + q + "%"}
           OR LOWER(COALESCE(h.name, d.hospital, '')) LIKE ${"%" + q + "%"}
           OR (${digits !== ""} AND REGEXP_REPLACE(COALESCE(d.phone, ''), '[^0-9]', '', 'g') LIKE ${"%" + digits + "%"}))
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
      phone: (r.phone as string) || "",
      // Two different facts that used to be one, which is how a doctor came
      // to be added, shown with their number in the sign-in column, and then
      // told at the door that the number was not registered.
      //
      // hasMobile: the number can receive a code at all. A landline or a blank
      //   cannot, so they can never be put on a camp either.
      // canSignIn: they actually have a sign-in. This is what the OTP route
      //   checks, and therefore the only honest thing to show in a column
      //   headed "Sign-in".
      hasMobile: normalizeMobile((r.phone as string) || "") !== null,
      canSignIn: r.sign_in === true,
      campCount: (r.camp_count as number) || 0,
      campsEver: (r.camps_ever as number) || 0,
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

  // Required, and it must be a mobile.
  //
  // This used to be optional, on the reasoning that a directory entry with no
  // number is honest because the family falls back to the hospital's
  // switchboard. That held while the directory was only a list of places to
  // send people. It stopped holding when a directory doctor became someone who
  // signs in: assignDoctorToCamp refuses a doctor with no number, so the gap
  // was discovered at the point of putting them on a camp — by which time the
  // person who knew the number had gone.
  //
  // A landline is refused for the same reason it is refused everywhere else: a
  // one-time code sent to a desk phone is a sign-in that silently never
  // happens.
  const rawPhone = String(body.phone || "").trim();
  if (!rawPhone) {
    throw new ApiError(
      400,
      `${name} needs a mobile number — it is how they receive a code and sign in`,
      "PHONE_REQUIRED"
    );
  }
  // Two different mistakes, told apart. "12" is not a phone number at all;
  // 040 2345 6789 is a perfectly good number that simply cannot receive a
  // text. Saying "that is not a mobile" about the first reads as nonsense, and
  // saying "that is not a valid number" about the second sends someone off to
  // re-check a number that is exactly right.
  const norm = normalizeMobile(rawPhone);
  if (!norm) {
    throw new ApiError(
      400,
      normalizePhone(rawPhone)
        ? `"${rawPhone}" is a landline. It cannot receive the sign-in code — enter a mobile number.`
        : `"${rawPhone}" is not a valid mobile number`,
      "BAD_PHONE"
    );
  }
  const phone = norm.e164;

  // On unless somebody says otherwise. The form asks for a mobile on the
  // grounds that it is how this person signs in, so adding them and leaving
  // them unable to sign in is the surprising outcome, not the safe one.
  // Untick it for a referral-only entry.
  const wantsSignIn = body.canSignIn !== false;

  const id = String(body.id || "").trim() || `doc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  await sql`
    INSERT INTO vita_hero.doctors (id, name, specialty, hospital, hospital_id, city, phone, rating, active)
    VALUES (${id}, ${name}, ${specialty}, ${hospitalName}, ${hospitalId || null},
            ${String(body.city || "")}, ${phone}, ${num(body.rating, 4.5)}, ${body.active !== false})
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, specialty = EXCLUDED.specialty, hospital = EXCLUDED.hospital,
      hospital_id = EXCLUDED.hospital_id, city = EXCLUDED.city, phone = EXCLUDED.phone,
      rating = EXCLUDED.rating, active = EXCLUDED.active
  `;

  // Deliberately after the directory row and deliberately able to throw: a
  // number that already belongs to a parent must stop the sign-in, and the
  // person adding the doctor has to be told, rather than finding out when the
  // parent is locked out of their child's results.
  const signIn = wantsSignIn
    ? await grantDoctorSignIn(sql, actor, name, phone, norm.last10)
    : await revokeDoctorSignIn(sql, norm.last10, name);

  return {
    id,
    name,
    phone,
    canSignIn: wantsSignIn,
    // What to tell whoever just pressed Save. Half of this feature is saying
    // out loud which number now opens the door.
    signInHint: wantsSignIn
      ? `${name} signs in with ${phone}. They will see their camps once a school assigns them to one.`
      : `${name} is a referral entry only and cannot sign in.`,
    profileId: signIn.profileId,
  };
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
    SELECT DISTINCT p.id, p.name, p.phone, p.is_logged_in,
      TO_CHAR(p.invited_at, 'YYYY-MM-DD') AS invited_at,
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
    // Formatted in SQL on purpose: the driver hands timestamptz back as a
    // JS Date, String() renders it like "Sat Aug 30 2026 …", and the panel
    // slices that into "Sat Aug 30" — which JavaScript then parses as the
    // year 2001. A plain YYYY-MM-DD string cannot be misread.
    invitedAt: (r.invited_at as string) || "",
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
  sendSms: SmsSender,
  buildLink: (last10: string) => string,
  opts: { onlyNotJoined?: boolean; profileIds?: string[] } = {}
) {
  assertSchoolAccess(actor, schoolId);
  const only = opts.onlyNotJoined !== false;
  const picked = Array.isArray(opts.profileIds) ? opts.profileIds.filter(Boolean) : [];

  // The guardians to text and the school's name for the text itself are
  // independent; one wait before any SMS goes out.
  const [rows, school] = await Promise.all([
    sql`
      SELECT DISTINCT p.id, p.name, p.phone
      FROM vita_hero.school_enrollments e
      JOIN vita_hero.profiles p ON p.id = e.profile_id
      WHERE e.school_id = ${schoolId} AND e.status = 'ACTIVE' AND p.role = 'PARENT'
        AND (${!only} OR p.is_logged_in IS NOT TRUE)
        AND (${picked.length === 0} OR p.id = ANY(${picked}))
    `,

    sql`SELECT name FROM vita_hero.schools WHERE id = ${schoolId} LIMIT 1`,
  ]);
  const schoolName = (school[0]?.name as string) || "your school";

  const failed: Array<{ name: string; reason: string }> = [];
  const byId = new Map<string, { name: string; last10: string }>();
  const toText: Array<{ id: string; phone: string }> = [];
  for (const r of rows) {
    const who = (r.name as string) || (r.phone as string) || "unknown";
    const norm = normalizePhone(String(r.phone || ""));
    if (!norm) {
      failed.push({ name: who, reason: "That is not a usable mobile number." });
      continue;
    }
    byId.set(r.id as string, { name: (r.name as string) || norm.e164, last10: norm.last10 });
    toText.push({ id: r.id as string, phone: norm.e164 });
  }

  const outcome = await sendToMany(sendSms, toText, (r) =>
    `${schoolName} uses VitaHero for your child's school health check-up. ` +
    `Open your child's results here: ${buildLink(byId.get(r.id)!.last10)}`
  );
  const sent = outcome.sent.length;
  for (const f of outcome.failed) {
    // The reason travels to the screen. "Could not reach" on its own sent an
    // operator hunting through mobile numbers for what was a missing secret.
    failed.push({ name: byId.get(f.id)?.name || f.id, reason: f.reason });
  }
  // One statement for everyone who was reached, rather than one each. Two
  // hundred guardians used to be two hundred writes on top of two hundred
  // sends, in a worker with a budget for neither.
  if (outcome.sent.length > 0) {
    await sql`
      UPDATE vita_hero.profiles
      SET invited_at = NOW(), invite_count = COALESCE(invite_count, 0) + 1
      WHERE id = ANY(${outcome.sent})
    `;
  }

  // One line the console can show above the list, because when nothing is
  // configured every row fails for the same reason and repeating it per row
  // buries it.
  const commonReason = failed.length && failed.every((f) => f.reason === failed[0].reason)
    ? failed[0].reason
    : "";
  return { targeted: rows.length, sent, failed, commonReason };
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

/**
 * Find a phone number anywhere it appears in the programme.
 *
 * The console could search a roster for a guardian and a hospital list by
 * name, and that was all. Someone rings the office saying "I got a message
 * from you" and the only way to find out who they are was to know which list
 * to look in first — parent, school contact, administrator, screener,
 * physician, doctor in the directory, hospital switchboard — and to look in
 * each of them in turn.
 *
 * Matched on digits, so how the number was typed does not matter: with or
 * without +91, with a trunk zero, with spaces. The last ten digits are the
 * identity of a number here, which is the same rule profile ids use.
 *
 * Operations only. This crosses every school, which is exactly what a school
 * administrator must not be able to do.
 */
export async function lookupPhone(sql: Sql, actor: Actor, raw: string) {
  opsOnly(actor, "Looking a number up across the programme");

  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length < 4) {
    throw new ApiError(400, "Enter at least the last four digits", "TOO_SHORT");
  }
  const tail = digits.slice(-10);
  const like = `%${tail}%`;
  const norm = normalizePhone(digits);

  // One round trip per kind rather than a single union: the shapes genuinely
  // differ, and these run together rather than one after another.
  const [people, doctors, hospitals, schools] = await Promise.all([
    sql`
      SELECT p.id, p.name, p.phone, p.role, p.is_logged_in, p.school_id,
             s.name AS school_name,
             (SELECT COUNT(*)::int FROM vita_hero.kids k WHERE k.profile_id = p.id) AS kid_count
      FROM vita_hero.profiles p
      LEFT JOIN vita_hero.schools s ON s.id = p.school_id
      WHERE REGEXP_REPLACE(COALESCE(p.phone, ''), '[^0-9]', '', 'g') LIKE ${like}
      ORDER BY p.role, p.name
      LIMIT 50
    `,
    sql`
      SELECT d.id, d.name, d.phone, d.specialty, d.city, h.name AS hospital_name
      FROM vita_hero.doctors d
      LEFT JOIN vita_hero.hospitals h ON h.id = d.hospital_id
      WHERE REGEXP_REPLACE(COALESCE(d.phone, ''), '[^0-9]', '', 'g') LIKE ${like}
      ORDER BY d.name
      LIMIT 50
    `,
    sql`
      SELECT id, name, phone, city FROM vita_hero.hospitals
      WHERE REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g') LIKE ${like}
      ORDER BY name
      LIMIT 50
    `,
    sql`
      SELECT id, name, contact_name, contact_phone, city FROM vita_hero.schools
      WHERE REGEXP_REPLACE(COALESCE(contact_phone, ''), '[^0-9]', '', 'g') LIKE ${like}
      ORDER BY name
      LIMIT 50
    `,
  ]);

  const matches = [
    ...people.map((r) => ({
      kind: (r.role as string) === "PARENT" ? "Guardian" : roleLabel(r.role as string),
      id: r.id as string,
      name: (r.name as string) || "",
      phone: (r.phone as string) || "",
      detail: [
        (r.school_name as string) || "",
        (r.kid_count as number) ? `${r.kid_count} child${(r.kid_count as number) === 1 ? "" : "ren"}` : "",
        r.is_logged_in === true ? "signed in" : "",
      ].filter(Boolean).join(" · "),
      schoolId: (r.school_id as string) || "",
    })),
    ...doctors.map((r) => ({
      kind: "Doctor (directory)",
      id: r.id as string,
      name: (r.name as string) || "",
      phone: (r.phone as string) || "",
      detail: [(r.specialty as string) || "", (r.hospital_name as string) || "", (r.city as string) || ""]
        .filter(Boolean).join(" · "),
      schoolId: "",
    })),
    ...hospitals.map((r) => ({
      kind: "Hospital",
      id: r.id as string,
      name: (r.name as string) || "",
      phone: (r.phone as string) || "",
      detail: (r.city as string) || "",
      schoolId: "",
    })),
    ...schools.map((r) => ({
      kind: "School contact",
      id: r.id as string,
      name: (r.contact_name as string) || (r.name as string),
      phone: (r.contact_phone as string) || "",
      detail: [(r.name as string) || "", (r.city as string) || ""].filter(Boolean).join(" · "),
      schoolId: r.id as string,
    })),
  ];

  return {
    query: raw,
    normalized: norm ? norm.e164 : "",
    // Said plainly rather than left for the reader to work out from a blank
    // column: this is the difference between "we have no record of them" and
    // "we have a record that can never receive a message".
    isMobile: normalizeMobile(digits) !== null,
    matches,
  };
}

/** The role names the console shows, kept next to the lookup that needs them. */
function roleLabel(role: string): string {
  const m: Record<string, string> = {
    PARENT: "Guardian",
    SCHOOL_ADMIN: "School administrator",
    SCREENER: "Screener",
    PHYSICIAN: "Physician",
    ADMIN: "Operations",
    SUPERADMIN: "Operations",
  };
  return m[role] || role || "Person";
}

/**
 * Every guardian in the programme, or in one school.
 *
 * Guardians were only ever reachable through a school's roster: to answer
 * "is this parent on the app", "how many children has she", "which school",
 * you had to already know the school. They are the largest group of people
 * the programme touches and the only one with no list of its own.
 *
 * Operations sees every school; a school administrator sees theirs, whatever
 * they ask for. The scope is decided here, not by the caller.
 */
export async function listGuardians(
  sql: Sql,
  actor: Actor,
  opts: { q?: string; schoolId?: string; onApp?: string } = {}
) {
  const ops = isOpsRole(actor.role);
  const scope = ops ? (opts.schoolId || "") : (actor.schoolId || "");
  if (!ops && !scope) return { guardians: [], schools: [], canInvite: false };

  const q = (opts.q || "").trim().toLowerCase();
  const digits = searchDigits(q);
  // "yes" and "no" narrow to guardians who have or have not signed in; empty
  // leaves both. A string rather than a boolean because it arrives from a
  // query string, where an absent value and false look the same.
  const onApp = opts.onApp === "yes" ? true : opts.onApp === "no" ? false : null;

  const rows = await sql`
    SELECT p.id, p.name, p.phone, p.is_logged_in, p.email,
           TO_CHAR(p.invited_at, 'YYYY-MM-DD') AS invited_at,
           TO_CHAR(p.created_at, 'YYYY-MM-DD') AS created_at,
           (SELECT COUNT(*)::int FROM vita_hero.kids k WHERE k.profile_id = p.id) AS children,
           (SELECT STRING_AGG(k.name, ', ' ORDER BY k.name)
              FROM vita_hero.kids k WHERE k.profile_id = p.id) AS child_names,
           (SELECT STRING_AGG(DISTINCT s.name, ', ')
              FROM vita_hero.school_enrollments e
              JOIN vita_hero.schools s ON s.id = e.school_id
              WHERE e.profile_id = p.id AND e.status = 'ACTIVE') AS school_names,
           (SELECT MIN(e.school_id) FROM vita_hero.school_enrollments e
              WHERE e.profile_id = p.id AND e.status = 'ACTIVE') AS school_id,
           (SELECT COUNT(*)::int FROM vita_hero.camp_participants cp
              WHERE cp.profile_id = p.id
                AND UPPER(COALESCE(cp.consent_status, '')) IN ('GRANTED','PAPER')) AS consents,
           (SELECT COUNT(*)::int FROM vita_hero.camp_participants cp
              WHERE cp.profile_id = p.id) AS asked
    FROM vita_hero.profiles p
    WHERE p.role = 'PARENT'
      AND (${scope === ""} OR EXISTS (
            SELECT 1 FROM vita_hero.school_enrollments e
            WHERE e.profile_id = p.id AND e.school_id = ${scope} AND e.status = 'ACTIVE'))
      AND (${onApp === null} OR p.is_logged_in = ${onApp === true})
      AND (${q === ""}
           OR LOWER(p.name) LIKE ${"%" + q + "%"}
           OR LOWER(COALESCE(p.email, '')) LIKE ${"%" + q + "%"}
           OR (${digits !== ""} AND REGEXP_REPLACE(COALESCE(p.phone, ''), '[^0-9]', '', 'g') LIKE ${"%" + digits + "%"})
           OR EXISTS (SELECT 1 FROM vita_hero.kids k
                      WHERE k.profile_id = p.id AND LOWER(k.name) LIKE ${"%" + q + "%"}))
    ORDER BY p.is_logged_in, p.name
    LIMIT 500
  `;

  // The schools to filter by, so the console does not have to fetch a second
  // list to draw one dropdown.
  const schools = ops
    ? await sql`SELECT id, name FROM vita_hero.schools WHERE active ORDER BY name`
    : [];

  return {
    canInvite: true,
    schools: schools.map((r) => ({ id: r.id as string, name: (r.name as string) || "" })),
    guardians: rows.map((r) => ({
      profileId: r.id as string,
      name: (r.name as string) || "",
      phone: (r.phone as string) || "",
      email: (r.email as string) || "",
      children: (r.children as number) || 0,
      childNames: (r.child_names as string) || "",
      schoolNames: (r.school_names as string) || "",
      schoolId: (r.school_id as string) || "",
      usingApp: r.is_logged_in === true,
      invitedAt: (r.invited_at as string) || "",
      joinedAt: (r.created_at as string) || "",
      consents: (r.consents as number) || 0,
      asked: (r.asked as number) || 0,
      // A guardian whose number cannot receive a code can never use the app,
      // which is a different problem from one who simply has not yet.
      canSignIn: normalizeMobile((r.phone as string) || "") !== null,
    })),
  };
}
