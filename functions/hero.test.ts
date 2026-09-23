// VitaHero of the month, and the one rule that makes it publishable.
//
// A school programme naming a child to other families is a consent question,
// not a feature question. So most of this file is about the name rather than
// the winning: a child can be the hero and still appear as "a pupil in Class
// 5", the guardian decides which, and revoking takes the name back off a month
// that has already been published.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import pg from "pg";
import type { Sql } from "./common";
import { serialQuery } from "./pgserial";
import type { Actor } from "./schools";
import { SCHEMA_STEPS } from "./index";
import { migrate } from "./migrate";
import {
  heroForSchool, heroNameConsent, heroShortlist, monthOf,
  setHeroNameConsent, setHeroOfMonth,
} from "./hero";

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

const OPS: Actor = { profileId: "ph_ops", name: "Ops", role: "SUPERADMIN", schoolId: null };
const HEAD: Actor = { profileId: "ph_head", name: "Head", role: "SCHOOL_ADMIN", schoolId: "sch_h" };
const OTHER_HEAD: Actor = {
  profileId: "ph_head2", name: "Other head", role: "SCHOOL_ADMIN", schoolId: "sch_other",
};
const STORY = "Aarav logged every meal for three weeks straight and got his whole class doing it.";

suite("VitaHero of the month", () => {
  beforeAll(async () => {
    if (!URL) return;
    const admin = new pg.Client({ connectionString: URL });
    await admin.connect();
    await admin.query("DROP DATABASE IF EXISTS vh_hero");
    await admin.query("CREATE DATABASE vh_hero");
    await admin.end();
    client = new pg.Client({ connectionString: URL2(URL, "vh_hero") });
    await client.connect();
    sql = neonShim(client);
    await migrate(sql, SCHEMA_STEPS, []);

    await sql`INSERT INTO vita_hero.schools (id, name, city, partner_code)
              VALUES ('sch_h', 'Silver Oaks', 'Hyderabad', 'SO-H'),
                     ('sch_other', 'Delhi Public', 'Hyderabad', 'DP-H')`;
    await sql`INSERT INTO vita_hero.kids (id, profile_id, name, school_id, grade, section, age, gender)
              VALUES ('k_win', 'ph_par', 'Aarav Sharma', 'sch_h', '5', 'B', 10, 'M'),
                     ('k_two', 'ph_par', 'Diya Sharma', 'sch_h', '5', 'B', 10, 'F'),
                     ('k_far', 'ph_p2', 'Ravi Kumar', 'sch_other', '6', 'A', 11, 'M')`;
    // The winner has the badges and the streak; the other child has neither.
    await sql`INSERT INTO vita_hero.kid_badges (kid_id, badge_id, earned_on)
              VALUES ('k_win', 'b1', '2027-03-01'), ('k_win', 'b2', '2027-03-02'),
                     ('k_win', 'b3', '2027-03-03')`;
    await sql`INSERT INTO vita_hero.streaks (kid_id, current_streak, best_streak, last_log_date)
              VALUES ('k_win', 21, 21, '2027-03-20'), ('k_two', 1, 2, '2027-03-20')`;
  });

  afterAll(async () => { if (client) await client.end(); });

  test("the shortlist ranks on what the server actually knows", async () => {
    const { candidates } = await heroShortlist(sql, OPS, "sch_h");
    expect(candidates[0].kidId).toBe("k_win");
    expect(candidates[0].badges).toBe(3);
    expect(candidates[0].streak).toBe(21);
    // Only this school's children.
    expect(candidates.map((c) => c.kidId)).not.toContain("k_far");
  });

  test("and says up front whether each child's story could carry their name", async () => {
    const { candidates } = await heroShortlist(sql, OPS, "sch_h");
    // Nobody has been asked yet, so nobody may be named.
    expect(candidates.every((c) => c.mayBeNamed === false)).toBe(true);
  });

  test("a head teacher sees their own school and not another's", async () => {
    const mine = await heroShortlist(sql, HEAD, "sch_h");
    expect(mine.candidates.length).toBeGreaterThan(0);
    await expect(heroShortlist(sql, OTHER_HEAD, "sch_h")).rejects.toThrow(/not your school/);
  });

  test("a hero needs a story, not just a winner", async () => {
    await expect(setHeroOfMonth(sql, OPS, {
      schoolId: "sch_h", kidId: "k_win", story: "Well done",
    })).rejects.toThrow(/few sentences/);
  });

  test("a child from another school cannot be this school's hero", async () => {
    await expect(setHeroOfMonth(sql, OPS, {
      schoolId: "sch_h", kidId: "k_far", story: STORY,
    })).rejects.toThrow(/not at that school/);
  });

  // ── the naming rule ──

  test("without consent the hero is real but not named", async () => {
    await setHeroOfMonth(sql, OPS, { schoolId: "sch_h", kidId: "k_win", story: STORY });
    const { hero } = await heroForSchool(sql, "sch_h");
    expect(hero).not.toBeNull();
    expect(hero!.named).toBe(false);
    expect(hero!.displayName).toBe("A pupil in 5 B");
    expect(hero!.story).toBe(STORY);
    // The achievement is published; the identity is not.
    expect(hero!.displayName).not.toContain("Aarav");
  });

  test("with consent they are named — first name only, never the surname", async () => {
    await setHeroNameConsent(sql, "ph_par", "k_win", true);
    const { hero } = await heroForSchool(sql, "sch_h");
    expect(hero!.named).toBe(true);
    expect(hero!.displayName).toBe("Aarav");
    // A surname plus a school is an identification rather than a celebration.
    expect(hero!.displayName).not.toContain("Sharma");
  });

  test("revoking takes the name off a month already published", async () => {
    // The point of reading consent at display time rather than baking it in
    // when the month was chosen. A consent you cannot withdraw is not consent.
    await setHeroNameConsent(sql, "ph_par", "k_win", false);
    const { hero } = await heroForSchool(sql, "sch_h");
    expect(hero!.named).toBe(false);
    expect(hero!.displayName).toBe("A pupil in 5 B");
    // And the story survives — the achievement was never the private part.
    expect(hero!.story).toBe(STORY);
  });

  test("the story never carries a clinical finding for the programme to leak", async () => {
    // Nothing enforces this in code, and it should not: the story is prose a
    // person writes. What the shape guarantees is that the server never puts a
    // finding there itself — the hero payload has no flags, no measurements
    // and no health fields at all.
    const { hero } = await heroForSchool(sql, "sch_h");
    const keys = Object.keys(hero as Record<string, unknown>).sort();
    expect(keys).toEqual(
      ["achievement", "displayName", "grade", "month", "named", "story"]
    );
  });

  test("an unpublished month shows nothing", async () => {
    await setHeroOfMonth(sql, OPS, {
      schoolId: "sch_h", kidId: "k_two", story: STORY, published: false,
    });
    expect((await heroForSchool(sql, "sch_h")).hero).toBeNull();
  });

  test("one hero per school per month, and choosing again replaces it", async () => {
    await setHeroOfMonth(sql, OPS, { schoolId: "sch_h", kidId: "k_win", story: STORY });
    await setHeroOfMonth(sql, OPS, { schoolId: "sch_h", kidId: "k_two", story: STORY });
    const rows = await sql`
      SELECT COUNT(*)::int AS n FROM vita_hero.hero_of_month
      WHERE school_id = 'sch_h' AND month = ${monthOf()}`;
    expect(rows[0].n).toBe(1);
  });

  // Whoever opens the panel next has to be able to see that the month is
  // taken. Without this the shortlist looks identical before and after a
  // choice, and the second person to look overwrites the first without
  // knowing there was anything there.
  test("the shortlist says who is already up this month", async () => {
    await setHeroOfMonth(sql, OPS, {
      schoolId: "sch_h", kidId: "k_win", story: STORY, achievement: "Logged every meal",
    });
    const { current } = await heroShortlist(sql, OPS, "sch_h");
    expect(current?.kidId).toBe("k_win");
    expect(current?.published).toBe(true);
    expect(current?.story).toBe(STORY);
    expect(current?.achievement).toBe("Logged every meal");
  });

  test("and reports the naming as it stands now, not as it stood then", async () => {
    await setHeroNameConsent(sql, "ph_par", "k_win", true);
    expect((await heroShortlist(sql, OPS, "sch_h")).current?.mayBeNamed).toBe(true);
    // The same revocation that unnames the published month unnames it here.
    await setHeroNameConsent(sql, "ph_par", "k_win", false);
    expect((await heroShortlist(sql, OPS, "sch_h")).current?.mayBeNamed).toBe(false);
  });

  test("a school with nobody chosen yet has no current hero", async () => {
    expect((await heroShortlist(sql, OTHER_HEAD, "sch_other")).current).toBeNull();
  });

  test("a guardian cannot answer the naming question for another family's child", async () => {
    await expect(heroNameConsent(sql, "ph_par", "k_far")).rejects.toThrow(/No such child/);
    await expect(setHeroNameConsent(sql, "ph_par", "k_far", true)).rejects.toThrow(/No such child/);
  });
});
