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
  "meal_items", "ai_diet_tips", "streaks", "kid_badges",
  // A plan is about a child and an assignment is about a school, so both go
  // with the programme. The dietician directory itself is reference data and
  // is handled with the doctors, below.
  "diet_plans", "dietician_schools",
  "school_camps", "camps",
  "invoice_lines", "invoices", "school_contracts", "roster_batches",
  "import_batches", "school_enrollments", "school_classes", "co_parents",
  "kids", "phone_otps", "sms_log", "schools",
];

/**
 * The two things that are a choice rather than a given.
 *
 * Both are reference data rather than programme records: a hospital directory
 * and a set of reading articles are things a new programme may well want to
 * keep. They were simply excluded before, and quietly — somebody who emptied
 * the programme and then found six doctors still listed had no way to tell
 * whether that was a decision or a bug. They are counted in the preview and
 * ticked by default now: a button called "Empty the programme" behind the
 * words DELETE EVERYTHING should mean it unless you say otherwise.
 */
const DIRECTORY = ["doctors", "dieticians", "hospitals"];
const LIBRARY = ["library_articles"];

/** Roles that go. Operations is absent on purpose — see resetProgramme. */
const ROLES_REMOVED = [
  "PARENT", "SCHOOL_ADMIN", "SCREENER", "PHYSICIAN", "DIETICIAN", "REVOKED",
];

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

export type ResetOptions = { directory?: boolean; library?: boolean };

/** Both default to true: the caller opts out, not in. */
function wants(opts: ResetOptions) {
  return {
    directory: opts.directory !== false,
    library: opts.library !== false,
  };
}

/**
 * What a reset would destroy, counted before anything is touched.
 *
 * Read-only. The console shows this and makes somebody type the phrase against
 * it, so nobody is asked to confirm a number they have not seen.
 */
export async function previewReset(sql: Sql, actor: Actor) {
  opsOnly(actor);

  const [
    schools, camps, children, guardians, findings, referrals, photos, staff, questions,
    hospitals, doctors, dieticians, articles,
  ] = await Promise.all([
    countOf(sql, "schools"),
    countOf(sql, "school_camps"),
    countOf(sql, "kids"),
    countOf(sql, "profiles", "WHERE role = 'PARENT'"),
    countOf(sql, "camp_findings"),
    countOf(sql, "referrals"),
    countOf(sql, "finding_photos"),
    countOf(sql, "profiles", "WHERE role IN ('SCHOOL_ADMIN','SCREENER','PHYSICIAN','DIETICIAN')"),
    countOf(sql, "question_threads"),
    countOf(sql, "hospitals"),
    countOf(sql, "doctors"),
    countOf(sql, "dieticians"),
    countOf(sql, "library_articles"),
  ]);

  const counts = { schools, camps, children, guardians, findings, referrals, photos, staff, questions };
  return {
    counts,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
    phrase: RESET_PHRASE,
    // Reference data, counted separately because it is a choice. Each says how
    // much of it there is, so ticking or unticking is an informed decision
    // rather than a guess.
    optional: {
      directory: {
        hospitals, doctors, dieticians,
        total: hospitals + doctors + dieticians,
      },
      library: { articles, total: articles },
    },
    // The one thing that is never a choice, and why.
    keeps: ["Operations sign-ins, including yours — otherwise you would be locked out mid-reset"],
  };
}

/**
 * Do it.
 *
 * Operations sign-ins survive and nothing can opt out of that: without them
 * the person running this locks themselves out halfway through and cannot see
 * whether it worked. Everything else is either removed or explicitly kept by
 * the options.
 *
 * Every statement is wrapped: a deployment missing an optional table should
 * not stop the reset part-way and leave the programme half emptied.
 */
export async function resetProgramme(
  sql: Sql,
  actor: Actor,
  confirm: string,
  opts: ResetOptions = {}
) {
  opsOnly(actor);
  if (String(confirm || "").trim().toUpperCase() !== RESET_PHRASE) {
    throw new ApiError(
      400,
      `Type ${RESET_PHRASE} to confirm. Nothing has been removed.`,
      "CONFIRM_REQUIRED"
    );
  }

  // Counted first: afterwards there is nothing left to count, and whoever
  // pressed this is owed a statement of what went.
  const before = await previewReset(sql, actor);
  const take = wants(opts);

  // The directory goes after everything that names it — referrals and
  // appointments are in IN_ORDER — so nothing is left pointing at a hospital
  // that no longer exists.
  const tables = IN_ORDER
    .concat(take.directory ? DIRECTORY : [])
    .concat(take.library ? LIBRARY : []);

  const cleared: string[] = [];
  for (const table of tables) {
    try {
      await sql.query(`DELETE FROM vita_hero.${table}`, []);
      cleared.push(table);
    } catch {
      // As above — a missing table means there was nothing of ours in it.
    }
  }

  await sql.query(
    `DELETE FROM vita_hero.profiles WHERE role = ANY($1)`, [ROLES_REMOVED]);

  const removed = {
    ...before.counts,
    hospitals: take.directory ? before.optional.directory.hospitals : 0,
    doctors: take.directory ? before.optional.directory.doctors : 0,
    dieticians: take.directory ? before.optional.directory.dieticians : 0,
    articles: take.library ? before.optional.library.articles : 0,
  };

  return {
    cleared: cleared.length,
    removed,
    kept: {
      directory: !take.directory,
      library: !take.library,
    },
    total: Object.values(removed).reduce((a, b) => a + b, 0),
  };
}
