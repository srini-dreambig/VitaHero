// D3 — VitaHero of the month.
//
// The one box on the flow diagram with nothing behind it, and the reason it
// stayed empty is not that it is hard to build. It is that a school programme
// publishing a named child's health achievement to other families is a consent
// question wearing a feature's clothes.
//
// So the naming is the design, not a detail of it:
//
//   * Winning and being named are separate. A child can win on the strength of
//     what they actually did and appear as "a pupil in Class 5" — the
//     recognition is real, the identification is optional.
//   * The guardian is asked, per child, and can change their mind. Revoking
//     takes the name off a month that has already been published, because a
//     consent you cannot withdraw is not consent.
//   * First name and class only. Never a surname, never a photograph, and
//     never the finding that got them there: "ate every meal for three weeks"
//     is an achievement, "their haemoglobin came up" is a medical record.
//
// Who wins is computed from the durable badge and streak data rather than
// whatever a phone was holding — which is only possible because badges moved
// to the server. Nothing is published automatically: the programme picks from
// a shortlist and writes the story, because a paragraph about a child is not
// something to generate.

import { Sql, isOpsRole } from "./common";
import { Actor, ApiError } from "./schools";

export async function ensureHeroSchema(sql: Sql): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.hero_of_month (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      -- YYYY-MM. A text month rather than a date, because "which month" is
      -- the identity here and a date would invite questions about the day.
      month TEXT NOT NULL,
      kid_id TEXT NOT NULL,
      story TEXT DEFAULT '',
      achievement TEXT DEFAULT '',
      published BOOLEAN DEFAULT false,
      chosen_by TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (school_id, month)
    )
  `;
  // Naming consent, per child, independent of any one month. A guardian who
  // says yes in March has said yes in April too, and a guardian who revokes
  // has revoked everywhere at once.
  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.hero_name_consent (
      kid_id TEXT PRIMARY KEY,
      profile_id TEXT NOT NULL,
      granted BOOLEAN NOT NULL,
      decided_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
}

/** The month a date falls in, in India, as YYYY-MM. */
export function monthOf(now = new Date()): string {
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 7);
}

function opsOnly(actor: Actor) {
  if (!isOpsRole(actor.role) && actor.role !== "SCHOOL_ADMIN") {
    throw new ApiError(403, "Choosing a VitaHero is the programme's job", "OPS_REQUIRED");
  }
}

/**
 * Who could be this month's hero at one school.
 *
 * Ranked on badges earned and the current streak — both durable, both on the
 * server, both comparable between children, none of which was true before
 * badges moved off the phone. Deliberately a shortlist rather than a winner:
 * a person picks, because the numbers cannot see the child who turned their
 * year around from a bad start.
 */
export async function heroShortlist(
  sql: Sql, actor: Actor, schoolId: string, limit = 10,
) {
  opsOnly(actor);
  if (actor.role === "SCHOOL_ADMIN" && actor.schoolId !== schoolId) {
    throw new ApiError(403, "That is not your school", "FORBIDDEN");
  }
  const rows = await sql`
    SELECT k.id, k.name, k.grade, k.section,
      (SELECT COUNT(*)::int FROM vita_hero.kid_badges b WHERE b.kid_id = k.id) AS badges,
      COALESCE(s.current_streak, 0)::int AS streak,
      COALESCE(s.best_streak, 0)::int AS best_streak,
      EXISTS (
        SELECT 1 FROM vita_hero.hero_name_consent c
        WHERE c.kid_id = k.id AND c.granted
      ) AS may_be_named
    FROM vita_hero.kids k
    LEFT JOIN vita_hero.streaks s ON s.kid_id = k.id
    WHERE k.school_id = ${schoolId} AND COALESCE(k.status,'ACTIVE') = 'ACTIVE'
    ORDER BY badges DESC, streak DESC, best_streak DESC, k.name
    LIMIT ${Math.max(1, Math.min(limit, 25))}
  `;
  // Who is already up this month, if anybody. Without this the console draws
  // the same shortlist before and after a choice, so whoever opens it next
  // cannot see that the month is taken and overwrites it without meaning to.
  const month = monthOf();
  const chosen = await sql`
    SELECT h.kid_id, k.name, k.grade, k.section, h.achievement, h.story, h.published,
      EXISTS (
        SELECT 1 FROM vita_hero.hero_name_consent c
        WHERE c.kid_id = h.kid_id AND c.granted
      ) AS may_be_named
    FROM vita_hero.hero_of_month h
    JOIN vita_hero.kids k ON k.id = h.kid_id
    WHERE h.school_id = ${schoolId} AND h.month = ${month}
    LIMIT 1
  `;
  return {
    schoolId,
    month,
    current: chosen.length === 0 ? null : {
      kidId: chosen[0].kid_id as string,
      name: chosen[0].name as string,
      grade: (chosen[0].grade as string) || "",
      section: (chosen[0].section as string) || "",
      achievement: (chosen[0].achievement as string) || "",
      story: (chosen[0].story as string) || "",
      published: chosen[0].published === true,
      mayBeNamed: chosen[0].may_be_named === true,
    },
    candidates: rows.map((r) => ({
      kidId: r.id as string,
      name: r.name as string,
      grade: (r.grade as string) || "",
      section: (r.section as string) || "",
      badges: (r.badges as number) || 0,
      streak: (r.streak as number) || 0,
      bestStreak: (r.best_streak as number) || 0,
      // Shown so whoever picks knows, before they write a paragraph, whether
      // this child's story can carry their name.
      mayBeNamed: r.may_be_named === true,
    })),
  };
}

/** Choose the month's hero and write their story. One per school per month. */
export async function setHeroOfMonth(
  sql: Sql, actor: Actor, body: Record<string, unknown>,
) {
  opsOnly(actor);
  const schoolId = String(body.schoolId || "").trim();
  const kidId = String(body.kidId || "").trim();
  if (!schoolId || !kidId) throw new ApiError(400, "Which school and which child?", "BAD_REQUEST");
  if (actor.role === "SCHOOL_ADMIN" && actor.schoolId !== schoolId) {
    throw new ApiError(403, "That is not your school", "FORBIDDEN");
  }
  const kid = await sql`
    SELECT id FROM vita_hero.kids
    WHERE id = ${kidId} AND school_id = ${schoolId} AND COALESCE(status,'ACTIVE') = 'ACTIVE'
    LIMIT 1
  `;
  if (kid.length === 0) throw new ApiError(404, "That child is not at that school", "NOT_FOUND");

  const story = String(body.story || "").trim();
  if (story.length < 20) {
    throw new ApiError(
      400,
      "A hero needs a few sentences about what they did",
      "STORY_REQUIRED"
    );
  }
  const month = String(body.month || "").trim() || monthOf();
  const id = `hom_${schoolId}_${month}`;
  await sql`
    INSERT INTO vita_hero.hero_of_month
      (id, school_id, month, kid_id, story, achievement, published, chosen_by)
    VALUES (${id}, ${schoolId}, ${month}, ${kidId}, ${story},
            ${String(body.achievement || "").slice(0, 120)},
            ${body.published !== false}, ${actor.profileId})
    ON CONFLICT (school_id, month) DO UPDATE SET
      kid_id = EXCLUDED.kid_id, story = EXCLUDED.story,
      achievement = EXCLUDED.achievement, published = EXCLUDED.published,
      chosen_by = EXCLUDED.chosen_by
  `;
  return { schoolId, month, kidId, published: body.published !== false };
}

/**
 * The hero as a family reads it.
 *
 * The consent is read here, at the moment of display, rather than baked in
 * when the month was chosen. That is the whole point: a guardian who revokes
 * in May takes their child's name off April's story too, without anybody
 * having to remember to go and edit it.
 */
export async function heroForSchool(sql: Sql, schoolId: string, month = "") {
  const wanted = month || monthOf();
  const rows = await sql`
    SELECT h.month, h.story, h.achievement, k.name, k.grade, k.section,
      EXISTS (
        SELECT 1 FROM vita_hero.hero_name_consent c
        WHERE c.kid_id = h.kid_id AND c.granted
      ) AS may_be_named
    FROM vita_hero.hero_of_month h
    JOIN vita_hero.kids k ON k.id = h.kid_id
    WHERE h.school_id = ${schoolId} AND h.month = ${wanted} AND h.published
    LIMIT 1
  `;
  if (rows.length === 0) return { hero: null };
  const r = rows[0];
  const named = r.may_be_named === true;
  const klass = [r.grade, r.section].map((v) => String(v || "")).filter(Boolean).join(" ");
  // First name only, and only with a yes. Never a surname, because a surname
  // plus a school is an identification rather than a celebration.
  const firstName = String(r.name || "").trim().split(/\s+/)[0] || "";
  return {
    hero: {
      month: r.month as string,
      // The child either way; the name only where it was agreed.
      displayName: named ? firstName : klass ? `A pupil in ${klass}` : "A pupil",
      named,
      grade: klass,
      achievement: (r.achievement as string) || "",
      story: (r.story as string) || "",
    },
  };
}

/** May this child be named if they are ever chosen? Asked of the guardian. */
export async function heroNameConsent(sql: Sql, profileId: string, kidId: string) {
  const owned = await sql`
    SELECT id FROM vita_hero.kids WHERE id = ${kidId} AND profile_id = ${profileId} LIMIT 1`;
  if (owned.length === 0) throw new ApiError(404, "No such child", "NOT_FOUND");
  const rows = await sql`
    SELECT granted FROM vita_hero.hero_name_consent WHERE kid_id = ${kidId} LIMIT 1`;
  return { kidId, asked: rows.length > 0, granted: rows.length > 0 && rows[0].granted === true };
}

export async function setHeroNameConsent(
  sql: Sql, profileId: string, kidId: string, granted: boolean,
) {
  const owned = await sql`
    SELECT id FROM vita_hero.kids WHERE id = ${kidId} AND profile_id = ${profileId} LIMIT 1`;
  if (owned.length === 0) throw new ApiError(404, "No such child", "NOT_FOUND");
  await sql`
    INSERT INTO vita_hero.hero_name_consent (kid_id, profile_id, granted, decided_at)
    VALUES (${kidId}, ${profileId}, ${granted}, NOW())
    ON CONFLICT (kid_id) DO UPDATE
      SET granted = EXCLUDED.granted, profile_id = EXCLUDED.profile_id, decided_at = NOW()
  `;
  return { kidId, asked: true, granted };
}
