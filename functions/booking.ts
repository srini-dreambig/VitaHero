// A parent booking a doctor at one of our hospitals.
//
// Three things went wrong here without anybody seeing them fail:
//
//   * Two parents could book the same doctor at the same time. The clash
//     check was a SELECT followed by an INSERT, so two requests a moment
//     apart both found the slot free. The database now refuses the second.
//   * A child who fell ill in the morning could not be seen that day: slots
//     started tomorrow, and "tomorrow" was worked out in UTC, so for the
//     first five and a half hours of every Indian day it was the wrong day.
//   * Nobody at the hospital heard about a booking. The only reminder was an
//     alarm on the parent's own phone.
//   * Nobody heard about a cancellation either, so the hospital kept the
//     slot and waited for a child who was never coming.

import { Sql, normalizeMobile } from "./common";
import type { SmsSender } from "./messaging";

/** Clinic hours a slot can be booked into, in India time. */
export const SLOT_TIMES = ["10:00 AM", "11:00 AM", "04:30 PM", "05:15 PM"];

/** How long before a same-day slot it stops being offered. */
const SAME_DAY_LEAD_MINUTES = 60;

const IST_OFFSET_MINUTES = 330;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function minutesOf(time: string): number {
  const m = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(time);
  if (!m) return 0;
  const h = (Number(m[1]) % 12) + (m[3] === "PM" ? 12 : 0);
  return h * 60 + Number(m[2]);
}

/**
 * The next free slots for a doctor, today included when there is still time.
 *
 * Dates are written the way they always have been ("05 Nov 2026"), because
 * that text is what existing appointments were stored with and what the
 * clash check compares.
 */
export function generateDoctorSlots(
  doctorId: string,
  bookedKeys: Set<string>,
  now: Date = new Date(),
): Array<{ date: string; time: string; label: string }> {
  const slots: Array<{ date: string; time: string; label: string }> = [];
  // Every getUTC* below reads India's wall clock, not the server's.
  const ist = new Date(now.getTime() + IST_OFFSET_MINUTES * 60_000);
  const nowMinutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();

  for (let offset = 0; offset <= 21 && slots.length < 12; offset++) {
    const day = new Date(ist.getTime() + offset * 86_400_000);
    if (day.getUTCDay() === 0) continue;
    const dateStr =
      `${String(day.getUTCDate()).padStart(2, "0")} ${MONTH_NAMES[day.getUTCMonth()]} ${day.getUTCFullYear()}`;
    const dayLabel = offset === 0 ? "Today" : DAY_NAMES[day.getUTCDay()];
    for (const time of SLOT_TIMES) {
      if (offset === 0 && minutesOf(time) < nowMinutes + SAME_DAY_LEAD_MINUTES) continue;
      if (bookedKeys.has(`${doctorId}|${dateStr}|${time}`)) continue;
      slots.push({ date: dateStr, time, label: `${dayLabel}, ${time}` });
      if (slots.length >= 12) break;
    }
  }
  return slots;
}

export type BookingResult =
  | { status: 201; row: Record<string, unknown>; notified: number }
  | { status: 409; error: string; code: string };

const TAKEN = { status: 409 as const, error: "This slot is no longer available", code: "SLOT_TAKEN" };

/**
 * Write a parent's appointment, and tell the doctor and hospital about it.
 *
 * The same id sent again (the app's sync resends what it holds) is the same
 * appointment, not a clash with itself, and is not announced twice.
 */
export async function bookAppointment(
  sql: Sql,
  who: { profileId: string; userId: string | null },
  body: Record<string, unknown>,
  sendSms: SmsSender,
): Promise<BookingResult> {
  const id = String(body.id || "");
  const doctorId = (body.doctor_id as string) || "";
  const date = body.date as string;
  const time = body.time as string;

  const before = await sql`
    SELECT doctor_id, date, time, kid_name, profile_id FROM vita_hero.appointments WHERE id = ${id}
  `;
  if (doctorId) {
    const clash = await sql`
      SELECT id FROM vita_hero.appointments
      WHERE doctor_id = ${doctorId} AND date = ${date} AND time = ${time} AND id <> ${id}
      LIMIT 1
    `;
    if (clash.length > 0) return TAKEN;
  }

  let row: Record<string, unknown>[];
  try {
    row = await sql`
      INSERT INTO vita_hero.appointments
        (id, profile_id, user_id, doctor_id, doctor_name, specialty, kid_name, date, time)
      VALUES (
        ${id}, ${who.profileId},
        ${who.userId || null}, ${doctorId || null}, ${body.doctor_name as string},
        ${body.specialty as string}, ${body.kid_name as string},
        ${date}, ${time}
      )
      ON CONFLICT (id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        doctor_id = EXCLUDED.doctor_id,
        doctor_name = EXCLUDED.doctor_name, specialty = EXCLUDED.specialty,
        kid_name = EXCLUDED.kid_name, date = EXCLUDED.date, time = EXCLUDED.time
      WHERE vita_hero.appointments.profile_id = ${who.profileId}
      RETURNING *
    `;
  } catch (e) {
    // The slot index: someone else took it between the check and the write.
    if ((e as { code?: string }).code === "23505") return TAKEN;
    throw e;
  }
  if (row.length === 0) {
    return { status: 409, error: "That record belongs to another account", code: "NOT_YOURS" };
  }

  const prev = before[0];
  const isNew = !prev || prev.doctor_id !== (doctorId || null) || prev.date !== date || prev.time !== time;
  // A reschedule frees the old slot: tell whoever was expecting the child.
  if (prev && prev.doctor_id && isNew && prev.profile_id === who.profileId) {
    await announce(sql, who.profileId, prev, sendSms, "cancelled");
  }
  const notified = doctorId && isNew ? await announce(sql, who.profileId, row[0], sendSms, "new") : 0;
  return { status: 201, row: row[0], notified };
}

/**
 * Remove a parent's appointment and tell the doctor and hospital, the same
 * numbers that were told about the booking. Another family's id deletes
 * nothing and texts nobody.
 */
export async function cancelAppointment(
  sql: Sql,
  profileId: string,
  apptId: string,
  sendSms: SmsSender,
): Promise<{ deleted: boolean; notified: number }> {
  const rows = await sql`
    DELETE FROM vita_hero.appointments
    WHERE id = ${apptId} AND profile_id = ${profileId}
    RETURNING *
  `;
  const appt = rows[0];
  if (!appt) return { deleted: false, notified: 0 };
  const notified = appt.doctor_id ? await announce(sql, profileId, appt, sendSms, "cancelled") : 0;
  return { deleted: true, notified };
}

/**
 * Text the doctor and the hospital desk about a booking or a cancellation.
 * A failed text never undoes either; the count says how many actually went.
 */
async function announce(
  sql: Sql,
  profileId: string,
  appt: Record<string, unknown>,
  sendSms: SmsSender,
  kind: "new" | "cancelled",
): Promise<number> {
  const rows = await sql`
    SELECT d.name AS doctor_name, d.phone AS doctor_phone,
           h.name AS hospital_name, h.phone AS hospital_phone,
           p.name AS parent_name, p.phone AS parent_phone
    FROM vita_hero.doctors d
    LEFT JOIN vita_hero.hospitals h ON h.id = d.hospital_id
    LEFT JOIN vita_hero.profiles p ON p.id = ${profileId}
    WHERE d.id = ${appt.doctor_id as string}
  `;
  const r = rows[0];
  if (!r) return 0;
  const parent = [r.parent_name, r.parent_phone].filter(Boolean).join(", ") || "a VitaHero parent";
  const child = (appt.kid_name as string) || "a child";
  const body = kind === "new"
    ? `VitaHero: new appointment for ${child} with ${r.doctor_name} on ${appt.date} at ${appt.time}. ` +
      `Booked by ${parent}.`
    : `VitaHero: CANCELLED - appointment for ${child} with ${r.doctor_name} on ${appt.date} at ${appt.time}. ` +
      `The slot is free. Cancelled by ${parent}.`;

  // A desk landline cannot read a text, so only mobiles are tried; and the
  // same number listed for both is texted once.
  const targets = new Set<string>();
  for (const raw of [r.doctor_phone, r.hospital_phone] as Array<string | null>) {
    const n = normalizeMobile(raw);
    if (n) targets.add(n.e164);
  }
  let sent = 0;
  for (const to of targets) {
    const res = await sendSms(to, body).catch(() => null);
    if (res && res.ok) sent++;
  }
  return sent;
}
