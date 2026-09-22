// Getting the demonstration data out of a live programme, once.
//
// A fresh database is seeded with four fictional Hyderabad schools, six camps
// against them, four hospitals, five doctors and a set of library articles.
// That is the right thing for someone opening the console for the first time
// and the wrong thing for a school district's real deployment, where it sits
// among the real schools looking exactly like one of them.
//
// Two halves, deliberately separate:
//
//   - preview() counts what is there and says, per record, whether it can go.
//     Nothing is removed by looking.
//   - purge() removes what preview said it could, and nothing else.
//
// The safety rule is the one deleteSchool already enforces and this does not
// get to override: a school that holds screening records is never deleted, by
// this or anything else. If a demo school somehow has real children screened
// against it, it is reported and left alone.

import { Sql, isOpsRole } from "./common";
import { Actor, ApiError, deleteSchool, schoolFootprint } from "./schools";

/**
 * The ids the seed writes. Hard-coded rather than pattern-matched on purpose:
 * "anything that looks like a demo id" is how a real school called
 * "Oakridge" gets deleted by a regular expression. These are the exact rows
 * seedPartnerSchools, seedDoctorsIfEmpty and seedLibraryIfEmpty create.
 */
export const DEMO_SCHOOL_IDS = ["sch_oak", "sch_dps", "sch_jgs", "sch_chirec"];
export const DEMO_HOSPITAL_IDS = [
  "hosp_rainbow", "hosp_apollo", "hosp_lvp", "hosp_kims",
  "hosp_continental", "hosp_smile", "hosp_care", "hosp_yashoda",
];
// d1-d5 come from seedDoctorsIfEmpty, d6-d10 from seedDirectoryIfEmpty. Both
// used to be written unconditionally by a DDL step, which is why deleting one
// achieved nothing: the next migration put it straight back.
export const DEMO_DOCTOR_IDS = ["d1", "d2", "d3", "d4", "d5", "d6", "d7", "d8", "d9", "d10"];

function opsOnly(actor: Actor) {
  if (!isOpsRole(actor.role)) {
    throw new ApiError(403, "Clearing demonstration data is an operations task", "OPS_ONLY");
  }
}

type Item = {
  kind: string;
  id: string;
  name: string;
  detail: string;
  removable: boolean;
  reason: string;
};

/**
 * What is still here, and what would happen to each of it.
 *
 * Read-only. The console shows this before offering the button, so nobody is
 * asked to confirm a deletion whose contents they cannot see.
 */
/**
 * Read a COUNT(*) that came back without a row.
 *
 * A count always returns one row against a real database, so `rows[0].c` was
 * a fair assumption — right up until something asks this handler a question
 * without one. The route-reachability suite does exactly that: it drives every
 * admin URL with no stubbed queries, so every result is empty, and this was
 * the one handler that threw on it rather than answering. It still answered
 * 200-not-404, so the test passed while the handler was failing.
 *
 * Not a crash anyone has seen in production. It is a handler that assumed its
 * way out of a shape it could be handed, which is the cheaper half of the same
 * bug.
 */
function count(rows: Record<string, unknown>[]): number {
  return (rows[0]?.c as number) || 0;
}

export async function previewDemoData(sql: Sql, actor: Actor) {
  opsOnly(actor);

  const [schools, hospitals, doctors, articles] = await Promise.all([
    sql`SELECT id, name, city FROM vita_hero.schools WHERE id = ANY(${DEMO_SCHOOL_IDS})`,
    sql`SELECT id, name, city FROM vita_hero.hospitals WHERE id = ANY(${DEMO_HOSPITAL_IDS})`,
    sql`SELECT id, name, specialty FROM vita_hero.doctors WHERE id = ANY(${DEMO_DOCTOR_IDS})`,
    sql`SELECT COUNT(*)::int AS c FROM vita_hero.library_articles`,
  ]);

  const items: Item[] = [];

  // A school's footprint decides its fate, so ask for all of them at once
  // rather than one after another.
  const prints = await Promise.all(
    schools.map((s) => schoolFootprint(sql, s.id as string))
  );
  schools.forEach((s, i) => {
    const fp = prints[i];
    items.push({
      kind: "School",
      id: s.id as string,
      name: (s.name as string) || "",
      detail: `${fp.students} on roll · ${fp.camps} camp${fp.camps === 1 ? "" : "s"}`,
      removable: !fp.clinical,
      reason: fp.clinical
        ? "Has screening records — this is real data now, and will not be deleted"
        : "",
    });
  });

  // A hospital named by a camp or by a school stays: deleting it would leave
  // a referral pointing at a hospital that no longer exists, and a referral
  // written last month has to keep saying where it sent the family.
  for (const h of hospitals) {
    const id = h.id as string;
    const [byCamp, bySchool, byDoctor] = await Promise.all([
      sql`SELECT COUNT(*)::int AS c FROM vita_hero.school_camps WHERE hospital_id = ${id}`,
      sql`SELECT COUNT(*)::int AS c FROM vita_hero.schools WHERE hospital_id = ${id}`,
      sql`SELECT COUNT(*)::int AS c FROM vita_hero.doctors WHERE hospital_id = ${id} AND id <> ALL(${DEMO_DOCTOR_IDS})`,
    ]);
    const used = (byCamp[0].c as number) + (bySchool[0].c as number) + (byDoctor[0].c as number);
    items.push({
      kind: "Hospital",
      id,
      name: (h.name as string) || "",
      detail: (h.city as string) || "",
      removable: used === 0,
      reason: used === 0 ? "" : "In use by a camp, school or doctor you added — will be retired, not deleted",
    });
  }

  for (const d of doctors) {
    const id = d.id as string;
    const booked = await sql`SELECT COUNT(*)::int AS c FROM vita_hero.appointments WHERE doctor_id = ${id}`;
    const used = count(booked);
    items.push({
      kind: "Doctor",
      id,
      name: (d.name as string) || "",
      detail: (d.specialty as string) || "",
      removable: used === 0,
      reason: used === 0 ? "" : `${used} appointment${used === 1 ? "" : "s"} booked — will be retired, not deleted`,
    });
  }

  return {
    items,
    articles: count(articles),
    // What the button will actually do, counted for the confirmation.
    removable: items.filter((i) => i.removable).length,
    blocked: items.filter((i) => !i.removable).length,
    empty: items.length === 0,
  };
}

/**
 * Remove it.
 *
 * Schools go through deleteSchool so that the footprint check, the camp and
 * consent cleanup, the de-scoping of staff and the detaching of children all
 * happen exactly as they do when someone deletes a school by hand. Nothing
 * here writes its own version of that.
 *
 * `articles` is opt-in: the reading library is content rather than fictional
 * records, and a programme that has edited the seeded articles into real ones
 * would not thank us for assuming.
 */
export async function purgeDemoData(
  sql: Sql,
  actor: Actor,
  opts: { articles?: boolean } = {}
) {
  opsOnly(actor);

  const plan = await previewDemoData(sql, actor);
  const removed: string[] = [];
  const kept: { id: string; name: string; reason: string }[] = [];

  for (const item of plan.items) {
    if (!item.removable) {
      kept.push({ id: item.id, name: item.name, reason: item.reason });
      if (item.kind === "Hospital") {
        await sql`UPDATE vita_hero.hospitals SET active = false WHERE id = ${item.id}`;
      } else if (item.kind === "Doctor") {
        await sql`UPDATE vita_hero.doctors SET active = false WHERE id = ${item.id}`;
      }
      continue;
    }
    if (item.kind === "School") {
      // deleteSchool asks for the name typed back as a guard against a
      // mis-click. Here the name came out of the database a moment ago and
      // the confirmation was the button itself.
      await deleteSchool(sql, actor, item.id, item.name);
    } else if (item.kind === "Hospital") {
      await sql`DELETE FROM vita_hero.doctors WHERE hospital_id = ${item.id} AND id = ANY(${DEMO_DOCTOR_IDS})`;
      await sql`DELETE FROM vita_hero.hospitals WHERE id = ${item.id}`;
    } else if (item.kind === "Doctor") {
      await sql`DELETE FROM vita_hero.doctors WHERE id = ${item.id}`;
    }
    removed.push(`${item.kind}: ${item.name}`);
  }

  let articles = 0;
  if (opts.articles) {
    const r = await sql`
      DELETE FROM vita_hero.library_articles RETURNING slug
    `;
    articles = r.length;
  }

  return { removed, kept, articles };
}
