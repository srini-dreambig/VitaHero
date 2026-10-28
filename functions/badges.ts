// D1 — badges, moved off the phone.
//
// They were computed in KidsViewModel.badgeProgressForKid() from whatever that
// handset happened to be holding at the time. Three things followed from that,
// none of them good:
//
//   * A badge was not durable. Reinstall the app, or open it on the other
//     parent's phone, and a week's streak had never happened.
//   * A badge was not comparable. Nothing anywhere could say whether one child
//     was doing better than another, which is the whole premise of "VitaHero
//     of the month".
//   * A badge could be earned by editing local state, which for a programme
//     that hands out recognition is the difference between a reward and a
//     sticker a child prints themselves.
//
// Everything the rule needs was already on the server — meal_items carries the
// day and whether it was eaten, streaks carries the run, kids carries the
// dental flag — so nothing new is being measured here. What is new is that the
// answer is written down: the first time a badge is earned, the date is kept,
// and a broken streak afterwards no longer takes the badge away.
//
// The words stay in the app. This file returns ids and numbers; the Android
// side owns the title, the description and the colour, in three languages. A
// server that returned "Super Eater" would be a server that only speaks
// English to a Telugu-speaking family.

import { Sql } from "./common";

/**
 * The checklist slot the app gives a dietician's targets (KidsViewModel's
 * PLAN_SLOT). Items in it are what counts on a day a plan covers; the
 * /api/meals route keeps a parent from filing their own items under it.
 */
export const PLAN_SLOT = "Plan";

/**
 * Whether a meal sent under PLAN_SLOT really is one of this child's plan
 * targets: an id of the form plan_<planId>_<index>_<YYYY-MM-DD>, naming a plan
 * written for this child, whose target at that index has this label.
 */
export function isPlanItem(
  meal: { id: string; kidId: string; name: string },
  plans: Map<string, { kidId: string; labels: string[] }>,
): boolean {
  const m = /^plan_(.+)_(\d+)_(\d{4}-\d{2}-\d{2})$/.exec(meal.id);
  if (!m) return false;
  const plan = plans.get(m[1]);
  return !!plan && plan.kidId === meal.kidId && plan.labels[Number(m[2])] === meal.name;
}

export type BadgeId ="b1" | "b2" | "b3" | "b4" | "b5" | "b6";

/** What a badge needs to know, gathered once. */
export interface BadgeFacts {
  mealsToday: number;
  eatenToday: number;
  currentStreak: number;
  bestStreak: number;
  /**
   * The flag on the most recent dental check a clinician actually recorded,
   * or "" when nobody has looked.
   *
   * Read from camp_findings rather than kids.dental, which the app used.
   * kids.dental is `TEXT DEFAULT 'GOOD'`, so every child who has never been
   * near a dentist reads as GOOD — and the app's own guard against that
   * (`dental != NOT_MEASURED`) could never fire. It was handing out a
   * clinical badge for a check nobody did, which is the exact thing the
   * badge list was cut down to avoid.
   */
  dental: string;
}

export interface BadgeState {
  id: BadgeId;
  /** True while the condition holds right now. */
  meets: boolean;
  /** True once it has ever held — this is what the app shows as earned. */
  earned: boolean;
  /** ISO date it was first earned, or "" if never. */
  earnedAt: string;
  target: number;
  current: number;
  /** 0..1, live rather than remembered: it is a progress bar, not a record. */
  progress: number;
}

/**
 * The six badges, as conditions over the facts.
 *
 * Deliberately the same six the app had, computed the same way, so this change
 * moves the rule without quietly rewriting what a child has to do to earn one.
 * app-surface.test.ts holds the ids and the app's badge list to each other.
 */
function evaluate(f: BadgeFacts): Omit<BadgeState, "earned" | "earnedAt">[] {
  // A day with no meal plan at all would divide by zero and also hand out
  // "ate every meal" to a child who was never offered one.
  const total = Math.max(f.mealsToday, 1);
  const dentalKnown = f.dental !== "" && f.dental !== "NOT_MEASURED";
  const brightSmile = dentalKnown && f.dental === "GOOD";
  const half = Math.max(Math.floor(total / 2), 1);
  const clamp = (v: number) => Math.max(0, Math.min(1, v));

  return [
    { id: "b1", meets: f.eatenToday >= total && f.currentStreak >= 7,
      target: 7, current: f.currentStreak, progress: clamp(f.currentStreak / 7) },
    { id: "b2", meets: f.eatenToday >= total,
      target: total, current: f.eatenToday, progress: clamp(f.eatenToday / total) },
    { id: "b3", meets: f.currentStreak >= 3,
      target: 3, current: f.currentStreak, progress: clamp(f.currentStreak / 3) },
    { id: "b4", meets: f.bestStreak >= 14,
      target: 14, current: f.bestStreak, progress: clamp(f.bestStreak / 14) },
    { id: "b5", meets: brightSmile,
      target: 1, current: brightSmile ? 1 : 0, progress: brightSmile ? 1 : 0 },
    { id: "b6", meets: f.eatenToday >= half,
      target: half, current: f.eatenToday, progress: clamp(f.eatenToday / half) },
  ];
}

export const BADGE_IDS: BadgeId[] = evaluate({
  mealsToday: 0, eatenToday: 0, currentStreak: 0, bestStreak: 0, dental: "",
}).map((b) => b.id);

export async function ensureBadgeSchema(sql: Sql): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.kid_badges (
      kid_id TEXT NOT NULL,
      badge_id TEXT NOT NULL,
      -- TEXT, not DATE, and deliberately. A DATE comes back as a Date object
      -- through node-postgres and as a string through the Neon HTTP driver,
      -- so the same code formats it two different ways depending on which
      -- driver is underneath. Every other date in this schema is an ISO
      -- string for the same reason.
      earned_on TEXT NOT NULL,
      PRIMARY KEY (kid_id, badge_id)
    )
  `;
}

/** Today, in the school day's terms rather than UTC's. */
function today(now: Date): string {
  // India is the whole of the pilot and the only timezone the programme runs
  // in. A child logging dinner at 9pm IST is on 30 minutes short of a day
  // ahead of UTC, and a badge awarded "yesterday" for that is confusing in a
  // way no parent should have to reason about.
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

/**
 * Gather the facts for one child.
 *
 * `meal_items` is the log — a photographed meal lands here as an eaten row —
 * and it is filtered to today, because "ate every meal" is a question about a
 * day and the table holds every day.
 *
 * On a day a dietician's plan covers, only the plan's own items count. The
 * checklist used to mix the plan with a generated menu and anything the
 * parent added, and ticking any of them earned the badge — so a child could
 * be rewarded for following a plan nobody wrote. See PLAN_SLOT.
 */
export async function badgeFacts(sql: Sql, kidId: string, now = new Date()): Promise<BadgeFacts> {
  const day = today(now);
  const meals = await sql`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE m.eaten)::int AS eaten
    FROM vita_hero.meal_items m
    WHERE m.kid_id = ${kidId} AND COALESCE(m.day, '') = ${day}
      AND (m.time_slot = ${PLAN_SLOT} OR NOT EXISTS (
        SELECT 1 FROM vita_hero.diet_plans dp
        WHERE dp.kid_id = m.kid_id
          AND jsonb_array_length(COALESCE(dp.targets, '[]'::jsonb)) > 0
          AND to_char(dp.created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') <= m.day
          AND (dp.status = 'ACTIVE'
               OR to_char(dp.updated_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') > m.day)
          AND (COALESCE(dp.starts_on, '') = '' OR dp.starts_on <= m.day)
          AND (COALESCE(dp.ends_on, '') = '' OR dp.ends_on >= m.day)))
  `;
  const streak = await sql`
    SELECT COALESCE(current_streak, 0)::int AS current_streak,
           COALESCE(best_streak, 0)::int AS best_streak
    FROM vita_hero.streaks WHERE kid_id = ${kidId} LIMIT 1
  `;
  const kid = await sql`
    SELECT flag FROM vita_hero.camp_findings
    WHERE kid_id = ${kidId} AND check_type = 'Dental' AND flag <> 'NOT_MEASURED'
    ORDER BY COALESCE(reviewed_at, recorded_at) DESC
    LIMIT 1
  `;
  return {
    mealsToday: (meals[0]?.total as number) || 0,
    eatenToday: (meals[0]?.eaten as number) || 0,
    currentStreak: (streak[0]?.current_streak as number) || 0,
    bestStreak: (streak[0]?.best_streak as number) || 0,
    dental: String(kid[0]?.flag || ""),
  };
}

/**
 * This child's badges, and the record of the ones they have earned.
 *
 * Reading has a side effect on purpose: the first time a condition is met, the
 * date goes in. There is no other moment to notice — nothing else in the
 * programme watches a streak tick over — and writing it here means a badge
 * earned on a Tuesday is still earned when the streak breaks on a Thursday.
 */
export async function kidBadges(
  sql: Sql,
  kidId: string,
  now = new Date(),
): Promise<{ badges: BadgeState[]; facts: BadgeFacts }> {
  const facts = await badgeFacts(sql, kidId, now);
  const live = evaluate(facts);

  const known = await sql`
    SELECT badge_id, earned_on FROM vita_hero.kid_badges WHERE kid_id = ${kidId}
  `;
  const earnedOn = new Map<string, string>();
  for (const r of known) {
    earnedOn.set(r.badge_id as string, String(r.earned_on || ""));
  }

  const day = today(now);
  const fresh = live.filter((b) => b.meets && !earnedOn.has(b.id));
  for (const b of fresh) {
    await sql`
      INSERT INTO vita_hero.kid_badges (kid_id, badge_id, earned_on)
      VALUES (${kidId}, ${b.id}, ${day})
      ON CONFLICT (kid_id, badge_id) DO NOTHING
    `;
    earnedOn.set(b.id, day);
  }

  return {
    facts,
    badges: live.map((b) => ({
      ...b,
      earned: earnedOn.has(b.id),
      earnedAt: earnedOn.get(b.id) || "",
    })),
  };
}

/**
 * A child's meal streak, worked out from the meals actually ticked.
 *
 * The app used to send its own numbers and the server stored them. Those
 * numbers rose on every tap, an untick included, so ticking a meal and
 * unticking it again kept a streak going on a day nothing was eaten; and they
 * feed the leaderboard and the "three days running" message, which made them
 * the only score in the programme a parent could simply type in. A day counts
 * when at least one of that day's meals is ticked eaten.
 *
 * The best streak never goes down: it is a record, and the one stored before
 * this existed is kept as it was.
 */
export async function recomputeStreak(
  sql: Sql,
  kidId: string,
  userId: string,
  now = new Date(),
): Promise<Record<string, unknown>> {
  const day = today(now);
  // The same rule as badgeFacts: on a day a plan covered, only a ticked plan
  // item keeps the streak going.
  const rows = await sql`
    SELECT DISTINCT m.day FROM vita_hero.meal_items m
    WHERE m.kid_id = ${kidId} AND m.eaten = true AND COALESCE(m.day, '') <> '' AND m.day <= ${day}
      AND (m.time_slot = ${PLAN_SLOT} OR NOT EXISTS (
        SELECT 1 FROM vita_hero.diet_plans dp
        WHERE dp.kid_id = m.kid_id
          AND jsonb_array_length(COALESCE(dp.targets, '[]'::jsonb)) > 0
          AND to_char(dp.created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') <= m.day
          AND (dp.status = 'ACTIVE'
               OR to_char(dp.updated_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') > m.day)
          AND (COALESCE(dp.starts_on, '') = '' OR dp.starts_on <= m.day)
          AND (COALESCE(dp.ends_on, '') = '' OR dp.ends_on >= m.day)))
    ORDER BY m.day DESC
    LIMIT 400
  `;
  const days = rows.map((r) => String(r.day));
  const ms = (d: string) => Date.parse(d + "T00:00:00Z");
  const ONE_DAY = 86_400_000;

  // Longest run of consecutive days, and the run ending today or yesterday.
  let best = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && ms(days[i - 1]) - ms(days[i]) === ONE_DAY ? run + 1 : 1;
    best = Math.max(best, run);
  }
  let current = 0;
  if (days.length > 0 && ms(day) - ms(days[0]) <= ONE_DAY) {
    current = 1;
    while (current < days.length && ms(days[current - 1]) - ms(days[current]) === ONE_DAY) current++;
  }

  const saved = await sql`
    INSERT INTO vita_hero.streaks (kid_id, user_id, current_streak, best_streak, last_log_date)
    VALUES (${kidId}, ${userId}, ${current}, ${best}, ${days[0] || ""})
    ON CONFLICT (kid_id) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      current_streak = EXCLUDED.current_streak,
      best_streak = GREATEST(COALESCE(vita_hero.streaks.best_streak, 0), EXCLUDED.best_streak),
      last_log_date = EXCLUDED.last_log_date
    RETURNING *
  `;
  return saved[0];
}
