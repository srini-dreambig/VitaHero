// Everyday illness, recorded by the parent.
//
// This is the only clinical thing a guardian may write, and the boundary is
// deliberate. Height, weight, vision and dental findings are measurements: a
// number a parent types at home would sit in the record beside a number a
// nurse took, indistinguishable, and a clinician reading it later could not
// tell which was which. An episode of fever is not a measurement — it is an
// observation only the family can make, the school never sees it, and a
// physician reviewing a child at the next camp genuinely wants it.
//
// Three rules hold that boundary:
//
//   1. A parent picks from a fixed list of everyday complaints. Free text is a
//      note, never the finding, so nobody can enter "diabetes" as a symptom.
//   2. Nothing here is a flag, and nothing here changes a flag. A symptom log
//      is history for a clinician to read, not a result.
//   3. Anything that should be seen today is answered with "see a doctor", not
//      with a saved record. The app is not the place to manage an unwell child.

import { Sql, isOpsRole } from "./common";
import { Actor, ApiError } from "./schools";
import { assertCampAccess } from "./camps";

/**
 * The complaints a parent may record.
 *
 * Everyday, self-limiting, and recognisable without training. Anything a
 * parent cannot reliably identify — a rash they think is measles, a lump —
 * is deliberately absent: it belongs in a doctor's room, not a dropdown.
 */
export const SYMPTOMS = [
  "Fever",
  "Cough",
  "Cold or runny nose",
  "Sore throat",
  "Ear pain",
  "Vomiting",
  "Loose motions",
  "Stomach pain",
  "Headache",
  "Skin rash",
  "Eye redness or watering",
  "Toothache",
  "Injury or fall",
] as const;

export type Symptom = (typeof SYMPTOMS)[number];

export const SEVERITIES = ["MILD", "MODERATE"] as const;

/**
 * Complaints where the honest answer is a doctor, not a form.
 *
 * When one of these is chosen the record is still saved — a parent who is
 * worried should not lose what they typed — but the response carries advice to
 * seek care, and the app shows it before the confirmation.
 */
const SEE_A_DOCTOR: Record<string, string> = {
  Vomiting:
    "If your child cannot keep fluids down, is drowsy, or has been vomiting for more than a day, see a doctor today.",
  "Loose motions":
    "Loose motions dehydrate a child quickly. Give ORS. If they are drinking little, passing very little urine, or there is blood, see a doctor today.",
  Fever:
    "See a doctor today if the fever is above 102°F, has lasted more than three days, or your child is drowsy, breathing fast, or not drinking.",
  "Injury or fall":
    "If your child hit their head, was knocked out even briefly, is vomiting after the fall, or cannot use a limb, go to a hospital now.",
  "Ear pain":
    "Ear pain with fever, or discharge from the ear, needs a doctor rather than waiting.",
};

export async function ensureSymptomSchema(sql: Sql): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.symptom_events (
      id TEXT PRIMARY KEY,
      kid_id TEXT NOT NULL,
      profile_id TEXT NOT NULL,
      symptom TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'MILD',
      started_on TEXT NOT NULL,
      ended_on TEXT,
      note TEXT DEFAULT '',
      saw_doctor BOOLEAN DEFAULT false,
      missed_school BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS symptom_events_kid ON vita_hero.symptom_events(kid_id, started_on DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS symptom_events_profile ON vita_hero.symptom_events(profile_id, started_on DESC)`;
}

function isSymptom(v: string): boolean {
  return (SYMPTOMS as readonly string[]).includes(v);
}

/** YYYY-MM-DD, not in the future, and not older than a year. */
function parseDay(raw: string): string {
  const v = String(raw || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    throw new ApiError(400, "Give the date as YYYY-MM-DD", "BAD_DATE");
  }
  const d = new Date(v + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) throw new ApiError(400, "That is not a real date", "BAD_DATE");
  const now = Date.now();
  if (d.getTime() > now + 86400000) {
    throw new ApiError(400, "That date is in the future", "FUTURE_DATE");
  }
  if (now - d.getTime() > 400 * 86400000) {
    throw new ApiError(400, "That is more than a year ago", "TOO_OLD");
  }
  return v;
}

async function assertOwnsKid(sql: Sql, profileId: string, kidId: string) {
  const rows = await sql`
    SELECT id FROM vita_hero.kids WHERE id = ${kidId} AND profile_id = ${profileId} LIMIT 1
  `;
  if (rows.length === 0) throw new ApiError(403, "That is not your child", "NOT_YOUR_CHILD");
}

/** What the app needs to draw the form: the list, and the safety wording. */
export function symptomOptions() {
  return {
    symptoms: [...SYMPTOMS],
    severities: [...SEVERITIES],
    notice:
      "This is a note for your child's next check-up, not a way to get help now. " +
      "If your child needs a doctor today, take them to one.",
  };
}

export async function recordSymptom(
  sql: Sql,
  profileId: string,
  kidId: string,
  body: Record<string, unknown>
) {
  await assertOwnsKid(sql, profileId, kidId);

  const symptom = String(body.symptom || "").trim();
  if (!isSymptom(symptom)) {
    throw new ApiError(400, "Choose one of the listed complaints", "BAD_SYMPTOM");
  }

  const severity = String(body.severity || "MILD").toUpperCase();
  if (!(SEVERITIES as readonly string[]).includes(severity)) {
    throw new ApiError(400, "Severity must be MILD or MODERATE", "BAD_SEVERITY");
  }

  const startedOn = parseDay(String(body.startedOn || ""));
  let endedOn: string | null = null;
  if (body.endedOn) {
    endedOn = parseDay(String(body.endedOn));
    if (endedOn < startedOn) {
      throw new ApiError(400, "It cannot have ended before it started", "BAD_RANGE");
    }
  }

  // A note, never a diagnosis: capped short, and stored beside the chosen
  // complaint rather than in place of it.
  const note = String(body.note || "").trim().slice(0, 500);

  const id = `sym_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  await sql`
    INSERT INTO vita_hero.symptom_events
      (id, kid_id, profile_id, symptom, severity, started_on, ended_on, note, saw_doctor, missed_school)
    VALUES (${id}, ${kidId}, ${profileId}, ${symptom}, ${severity}, ${startedOn}, ${endedOn},
            ${note}, ${body.sawDoctor === true}, ${body.missedSchool === true})
  `;

  return {
    id,
    symptom,
    startedOn,
    // Present whenever this complaint has a version that needs care today. The
    // app shows it after saving rather than instead of saving.
    advice: SEE_A_DOCTOR[symptom] || "",
  };
}

export async function kidSymptoms(sql: Sql, profileId: string, kidId: string) {
  await assertOwnsKid(sql, profileId, kidId);
  const rows = await sql`
    SELECT * FROM vita_hero.symptom_events
    WHERE kid_id = ${kidId} AND profile_id = ${profileId}
    ORDER BY started_on DESC, created_at DESC LIMIT 200
  `;
  return { events: rows.map(mapEvent) };
}

export async function deleteSymptom(sql: Sql, profileId: string, eventId: string) {
  const rows = await sql`
    DELETE FROM vita_hero.symptom_events
    WHERE id = ${eventId} AND profile_id = ${profileId}
    RETURNING id
  `;
  if (rows.length === 0) throw new ApiError(404, "Not found", "NOT_FOUND");
  return { deleted: eventId };
}

function mapEvent(r: Record<string, unknown>) {
  return {
    id: r.id as string,
    kidId: r.kid_id as string,
    symptom: r.symptom as string,
    severity: (r.severity as string) || "MILD",
    startedOn: (r.started_on as string) || "",
    endedOn: (r.ended_on as string) || "",
    note: (r.note as string) || "",
    sawDoctor: r.saw_doctor === true,
    missedSchool: r.missed_school === true,
  };
}

/**
 * What the clinical team sees at a camp.
 *
 * Presented as the family's own account, clearly labelled, so a physician
 * weighs it as history rather than reading it as a finding. Reachable only by
 * the camp's clinical staff, never by the school office — an office does not
 * need to know a child had loose motions in March.
 */
export async function symptomHistoryForClinician(
  sql: Sql,
  actor: Actor,
  campId: string,
  kidId: string
) {
  if (!isOpsRole(actor.role)) {
    const access = await assertCampAccess(sql, actor, campId);
    if (!access.canScreen && !access.canReview) {
      throw new ApiError(403, "You cannot read this child's history", "FORBIDDEN");
    }
    if (actor.role === "SCHOOL_ADMIN") {
      throw new ApiError(
        403,
        "Illness history is visible to the clinical team and the child's guardian only.",
        "CLINICAL_ONLY"
      );
    }
  }
  const rows = await sql`
    SELECT * FROM vita_hero.symptom_events
    WHERE kid_id = ${kidId}
      AND started_on >= to_char(NOW() - INTERVAL '18 months', 'YYYY-MM-DD')
    ORDER BY started_on DESC LIMIT 100
  `;
  return {
    source: "REPORTED_BY_GUARDIAN",
    caution: "Reported by the family. Not examined or confirmed by a clinician.",
    events: rows.map(mapEvent),
  };
}
