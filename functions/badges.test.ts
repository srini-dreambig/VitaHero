// Badges, now that the server decides them.
//
// Two things are under test. The rule itself — the same six the app had, the
// same conditions — and the thing that is new: a badge, once earned, stays
// earned. That is the whole reason for moving it off the phone. A streak that
// breaks on Thursday should not take back what was earned on Tuesday, and a
// reinstall should not take back anything at all.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import pg from "pg";
import type { Sql } from "./common";
import { serialQuery } from "./pgserial";
import { SCHEMA_STEPS } from "./index";
import { migrate } from "./migrate";
import { BADGE_IDS, kidBadges } from "./badges";

const APP = "../android/app/src/main/java/com/rork/vitahero";

describe("the app and the server agree on what a badge is", () => {
  test("every id the server sends, the app has words for", () => {
    const vm = readFileSync(`${APP}/data/KidsViewModel.kt`, "utf8");
    // The `dress()` table: one branch per id, each naming its locale keys.
    const dressed = [...vm.matchAll(/"(b\d+)" -> Badge\(/g)].map((m) => m[1]);
    expect(dressed.sort()).toEqual([...BADGE_IDS].sort());
  });

  test("and the app no longer works any of them out for itself", () => {
    const vm = readFileSync(`${APP}/data/KidsViewModel.kt`, "utf8");
    // The old rule read meals and streaks and decided. If any of those
    // comparisons come back, two places decide and they will disagree.
    expect(vm).not.toMatch(/currentStreak >= \d/);
    expect(vm).not.toMatch(/bestStreak >= \d/);
    expect(vm).not.toMatch(/eatenCount >= totalMeals/);
  });
});

const URL = process.env.TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;
function URL2(base: string, db: string): string {
  const u = new globalThis.URL(base);
  u.pathname = "/" + db;
  return u.toString();
}

let client: pg.Client;
let sql: Sql;

function neonShim(c: pg.Client): Sql {
  const send = serialQuery(c);
  const fn: any = (strings: TemplateStringsArray | string, ...values: unknown[]) => {
    if (typeof strings === "string") throw new Error("sql(identifier) is not supported");
    let text = "";
    const params: unknown[] = [];
    for (let i = 0; i < strings.length; i++) {
      text += strings[i];
      if (i < values.length) { params.push(values[i]); text += "$" + params.length; }
    }
    return send(text, params);
  };
  fn.query = (t: string, p: unknown[]) => send(t, p);
  return fn as Sql;
}

// Half past noon in India, so "today" is unambiguous either side of UTC.
const NOON = new Date("2027-03-10T07:00:00Z");
const DAY = "2027-03-10";
const KID = "k_badge";

const byId = (badges: { id: string }[], id: string) => badges.find((b) => b.id === id)!;

suite("a child's badges", () => {
  beforeAll(async () => {
    if (!URL) return;
    const admin = new pg.Client({ connectionString: URL });
    await admin.connect();
    await admin.query("DROP DATABASE IF EXISTS vh_badges");
    await admin.query("CREATE DATABASE vh_badges");
    await admin.end();
    client = new pg.Client({ connectionString: URL2(URL, "vh_badges") });
    await client.connect();
    sql = neonShim(client);
    await migrate(sql, SCHEMA_STEPS, []);

    await sql`INSERT INTO vita_hero.schools (id, name, city, partner_code)
              VALUES ('sch_b', 'Silver Oaks', 'Hyderabad', 'SO-B')`;
    await sql`INSERT INTO vita_hero.kids (id, profile_id, name, school_id, grade, age, gender)
              VALUES (${KID}, 'ph_par', 'Aarav Sharma', 'sch_b', '5', 10, 'M')`;
  });

  afterAll(async () => { if (client) await client.end(); });

  const setMeals = async (total: number, eaten: number) => {
    await sql`DELETE FROM vita_hero.meal_items WHERE kid_id = ${KID}`;
    for (let i = 0; i < total; i++) {
      await sql`INSERT INTO vita_hero.meal_items (id, profile_id, kid_id, name, kcal, eaten, day)
                VALUES (${"m" + i}, 'ph_par', ${KID}, ${"Meal " + i}, 300, ${i < eaten}, ${DAY})`;
    }
  };
  const setStreak = async (current: number, best: number) => {
    await sql`INSERT INTO vita_hero.streaks (kid_id, current_streak, best_streak, last_log_date)
              VALUES (${KID}, ${current}, ${best}, ${DAY})
              ON CONFLICT (kid_id) DO UPDATE
                SET current_streak = EXCLUDED.current_streak, best_streak = EXCLUDED.best_streak`;
  };

  test("a child who has logged nothing has earned nothing", async () => {
    await setMeals(0, 0);
    await setStreak(0, 0);
    const { badges } = await kidBadges(sql, KID, NOON);
    expect(badges).toHaveLength(BADGE_IDS.length);
    expect(badges.filter((b) => b.earned)).toHaveLength(0);
    // Not "0 of 0 meals eaten, so you ate them all".
    expect(byId(badges, "b2").earned).toBe(false);
    expect(byId(badges, "b6").earned).toBe(false);
  });

  test("eating half the day's meals earns the half-way badge and not the rest", async () => {
    await setMeals(4, 2);
    const { badges } = await kidBadges(sql, KID, NOON);
    expect(byId(badges, "b6").earned).toBe(true);
    expect(byId(badges, "b2").earned).toBe(false);
    expect(byId(badges, "b2").current).toBe(2);
    expect(byId(badges, "b2").target).toBe(4);
    expect(byId(badges, "b2").progress).toBeCloseTo(0.5, 5);
  });

  test("a full day and a week's streak earns the top one", async () => {
    await setMeals(4, 4);
    await setStreak(7, 7);
    const { badges } = await kidBadges(sql, KID, NOON);
    expect(byId(badges, "b1").earned).toBe(true);
    expect(byId(badges, "b2").earned).toBe(true);
    expect(byId(badges, "b3").earned).toBe(true);
    // Fourteen days is the best streak, and seven is not fourteen.
    expect(byId(badges, "b4").earned).toBe(false);
  });

  test("a badge earned once is not taken back when the streak breaks", async () => {
    // The whole point of moving this off the phone.
    const before = await kidBadges(sql, KID, NOON);
    expect(byId(before.badges, "b1").earned).toBe(true);
    expect(byId(before.badges, "b1").earnedAt).toBe(DAY);

    await setMeals(4, 0);
    await setStreak(0, 7);
    const after = await kidBadges(sql, KID, NOON);
    expect(byId(after.badges, "b1").earned, "earned survives").toBe(true);
    expect(byId(after.badges, "b1").earnedAt).toBe(DAY);
    // But the progress bar tells the truth about today.
    expect(byId(after.badges, "b1").meets).toBe(false);
    expect(byId(after.badges, "b1").progress).toBe(0);
  });

  test("and it survives the phone being wiped, because it is not on the phone", async () => {
    // Nothing local is involved; asking again from a different device is the
    // same query. What would have lost the badge before is losing local state.
    const { badges } = await kidBadges(sql, KID, NOON);
    expect(byId(badges, "b1").earned).toBe(true);
  });

  test("yesterday's meals are not today's", async () => {
    await sql`DELETE FROM vita_hero.meal_items WHERE kid_id = ${KID}`;
    await sql`INSERT INTO vita_hero.meal_items (id, profile_id, kid_id, name, kcal, eaten, day)
              VALUES ('m_old', 'ph_par', ${KID}, 'Yesterday', 300, true, '2027-03-09')`;
    const { facts } = await kidBadges(sql, KID, NOON);
    expect(facts.mealsToday).toBe(0);
    expect(facts.eatenToday).toBe(0);
  });

  test("the dental badge waits for a dentist", async () => {
    // kids.dental is `TEXT DEFAULT 'GOOD'`, so every child who has never been
    // near a dentist reads as GOOD there. Reading the finding instead is what
    // stops a clinical badge being handed out for a check nobody did.
    const kid = await sql`SELECT dental FROM vita_hero.kids WHERE id = ${KID}`;
    expect(kid[0].dental, "the column really does default to GOOD").toBe("GOOD");

    const { badges, facts } = await kidBadges(sql, KID, NOON);
    expect(facts.dental).toBe("");
    expect(byId(badges, "b5").earned).toBe(false);

    await sql`INSERT INTO vita_hero.school_camps (id, school_id, title, date, status, checks)
              VALUES ('sc_b', 'sch_b', 'Camp', '2027-03-01', 'RELEASED', '["Dental"]'::jsonb)
              ON CONFLICT (id) DO NOTHING`;
    await sql`INSERT INTO vita_hero.camp_findings (id, camp_id, kid_id, check_type, flag)
              VALUES ('f_b', 'sc_b', ${KID}, 'Dental', 'GOOD')
              ON CONFLICT (camp_id, kid_id, check_type) DO UPDATE SET flag = EXCLUDED.flag`;
    const after = await kidBadges(sql, KID, NOON);
    expect(after.facts.dental).toBe("GOOD");
    expect(byId(after.badges, "b5").earned).toBe(true);
  });

  test("a child with cavities is not told their smile is bright", async () => {
    await sql`DELETE FROM vita_hero.kid_badges WHERE kid_id = ${KID} AND badge_id = 'b5'`;
    await sql`UPDATE vita_hero.camp_findings SET flag = 'ALERT'
              WHERE kid_id = ${KID} AND check_type = 'Dental'`;
    const { badges } = await kidBadges(sql, KID, NOON);
    expect(byId(badges, "b5").earned).toBe(false);
  });

  test("every field the app declares is one the server actually sends", async () => {
    // kotlinx fills a missing key with the declared default and says nothing,
    // so a renamed field shows a child "0 / 0" on a badge they have earned.
    const src = readFileSync(`${APP}/data/GuardianDtos.kt`, "utf8");
    const at = src.indexOf("data class BadgeDto(");
    expect(at, "BadgeDto not found — the app has renamed it").toBeGreaterThan(0);
    const body = src.slice(at, src.indexOf("\n)", at));
    const fields = (body.match(/^\s*val\s+(\w+)\s*:/gm) || [])
      .map((x) => x.replace(/^\s*val\s+/, "").replace(/\s*:$/, ""));
    expect(fields.length).toBeGreaterThan(4);

    const { badges } = await kidBadges(sql, KID, NOON);
    const sent = badges[0] as unknown as Record<string, unknown>;
    expect(fields.filter((f) => !(f in sent))).toEqual([]);
  });

  test("two children can be compared, which they could not be before", async () => {
    await sql`INSERT INTO vita_hero.kids (id, profile_id, name, school_id, grade, age, gender)
              VALUES ('k_other', 'ph_par2', 'Diya Rao', 'sch_b', '5', 10, 'F')
              ON CONFLICT (id) DO NOTHING`;
    await sql`INSERT INTO vita_hero.streaks (kid_id, current_streak, best_streak, last_log_date)
              VALUES ('k_other', 3, 3, ${DAY}) ON CONFLICT (kid_id) DO NOTHING`;
    const mine = await kidBadges(sql, KID, NOON);
    const theirs = await kidBadges(sql, "k_other", NOON);
    const count = (r: { badges: { earned: boolean }[] }) => r.badges.filter((b) => b.earned).length;
    // The comparison is the point; the exact numbers are the tests above.
    expect(typeof count(mine)).toBe("number");
    expect(count(theirs)).toBeGreaterThan(0);
    const rows = await sql`
      SELECT kid_id, COUNT(*)::int AS n FROM vita_hero.kid_badges
      GROUP BY kid_id ORDER BY kid_id
    `;
    expect(rows.length).toBe(2);
  });
});
