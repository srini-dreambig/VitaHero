// Emptying the programme.
//
// Deliberately its own module, and deliberately not part of demo.ts. Clearing
// the demonstration data is a tidy-up that refuses to touch anything real;
// this is the opposite — every school, camp, child, guardian, screening,
// referral, photograph and question, real records included. The two must never
// be reachable by the same press, so they do not share a file, an endpoint or
// a button.
//
// Irreversible, and no footprint check stands in its way: that is the point of
// it, and the reason it asks for the words to be typed out.

import { Sql, isOpsRole } from "./common";
import { Actor, ApiError } from "./schools";

/** The words somebody has to type. Stated once, used by both halves. */
export const RESET_PHRASE = "DELETE EVERYTHING";

function opsOnly(actor: Actor) {
  if (!isOpsRole(actor.role)) {
    throw new ApiError(403, "Emptying the programme is an operations task", "OPS_ONLY");
  }
}

/**
 * The order rows are cleared in: leaves before the things they hang off.
 *
 * camp_findings points at a camp and a camp points at a school, so a school
 * removed first leaves rows pointing at nothing. Postgres would not stop us —
 * these are not foreign keys — which is exactly why the order is written down
 * rather than left to chance.
 */
const IN_ORDER = [
  "photo_access_log", "finding_photos", "camp_findings", "camp_kid_results",
  "question_messages", "question_threads", "correction_requests", "data_rights_log",
  "record_access", "consent_log", "camp_participants", "camp_registrations",
  "camp_staff", "referrals", "appointments", "growth_points", "symptom_events",
  "meal_items", "ai_diet_tips", "streaks", "school_camps", "camps",
  "invoice_lines", "invoices", "school_contracts", "roster_batches",
  "import_batches", "school_enrollments", "school_classes", "co_parents",
  "kids", "phone_otps", "sms_log", "schools",
];

/** Roles that go. Operations is absent on purpose — see resetProgramme. */
const ROLES_REMOVED = ["PARENT", "SCHOOL_ADMIN", "SCREENER", "PHYSICIAN", "REVOKED"];

async function countOf(sql: Sql, table: string, where = ""): Promise<number> {
  try {
    const r = await sql.query(
      `SELECT COUNT(*)::int AS c FROM vita_hero.${table} ${where}`, []);
    return Number(r[0]?.c) || 0;
  } catch {
    // A table this deployment does not have holds nothing.
    return 0;
  }
}

/**
 * What a reset would destroy, counted before anything is touched.
 *
 * Read-only. The console shows this and makes somebody type the phrase against
 * it, so nobody is asked to confirm a number they have not seen.
 */
export async function previewReset(sql: Sql, actor: Actor) {
  opsOnly(actor);

  const [schools, camps, children, guardians, findings, referrals, photos, staff, questions] =
    await Promise.all([
      countOf(sql, "schools"),
      countOf(sql, "school_camps"),
      countOf(sql, "kids"),
      countOf(sql, "profiles", "WHERE role = 'PARENT'"),
      countOf(sql, "camp_findings"),
      countOf(sql, "referrals"),
      countOf(sql, "finding_photos"),
      countOf(sql, "profiles", "WHERE role IN ('SCHOOL_ADMIN','SCREENER','PHYSICIAN')"),
      countOf(sql, "question_threads"),
    ]);

  const counts = { schools, camps, children, guardians, findings, referrals, photos, staff, questions };
  return {
    counts,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
    phrase: RESET_PHRASE,
    // Said plainly, because "everything" is never quite true and the
    // difference matters to whoever is about to press this.
    keeps: [
      "Operations sign-ins, including yours",
      "The reading library",
      "The hospital and doctor directory",
    ],
  };
}

/**
 * Do it.
 *
 * What survives is as deliberate as what does not. Operations sign-ins stay,
 * because otherwise the person running this locks themselves out halfway
 * through and cannot see whether it worked. The reading library and the
 * hospital directory stay because they are reference content a new programme
 * wants on day one, and each already has its own way to be cleared.
 *
 * Every statement is wrapped: a deployment missing an optional table should
 * not stop the reset part-way and leave the programme half emptied.
 */
export async function resetProgramme(sql: Sql, actor: Actor, confirm: string) {
  opsOnly(actor);
  if (String(confirm || "").trim().toUpperCase() !== RESET_PHRASE) {
    throw new ApiError(
      400,
      `Type ${RESET_PHRASE} to confirm. Nothing has been removed.`,
      "CONFIRM_REQUIRED"
    );
  }

  // Counted first: afterwards there is nothing left to count, and the person
  // who pressed this is owed a statement of what went.
  const before = await previewReset(sql, actor);

  const cleared: string[] = [];
  for (const table of IN_ORDER) {
    try {
      await sql.query(`DELETE FROM vita_hero.${table}`, []);
      cleared.push(table);
    } catch {
      // As above — a missing table means there was nothing of ours in it.
    }
  }

  await sql.query(
    `DELETE FROM vita_hero.profiles WHERE role = ANY($1)`, [ROLES_REMOVED]);

  return { cleared: cleared.length, removed: before.counts, total: before.total };
}
