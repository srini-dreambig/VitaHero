// The dietician, end to end.
//
// A new role is mostly a question about what it may not see. A screening
// doctor sees their own specialty, at their own camp, for the day. The flow
// diagram asked for a dietician to see "all the information by category with
// all the information", which taken literally is every child's whole clinical
// record — a wider grant than anyone else in the product has.
//
// So most of this file is the boundary: which children, which checks, and what
// happens when somebody asks for one outside it.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import pg from "pg";
import type { Sql } from "./common";
import { serialQuery } from "./pgserial";
import type { Actor } from "./schools";
import { SCHEMA_STEPS } from "./index";
import { migrate } from "./migrate";
import {
  DIETICIAN_CHECKS,
  dieticianChild,
  dieticianChildren,
  dieticianSchools,
  guardianDietPlan,
  listDieticians,
  retireDietician,
  saveDietPlan,
  setDieticianSchool,
  upsertDietician,
} from "./dietician";
import { myArticles, upsertArticle } from "./library";
import { APP_ROLES, CONSOLE_ROLES, surfaceRefusal } from "./surfaces";
import * as surfaces from "./surfaces";
import { DESIGNED_CHECKS } from "./clinical";

describe("which door a dietician stands at", () => {
  test("the app admits them; the console does not", () => {
    expect(APP_ROLES).toContain("DIETICIAN");
    expect(CONSOLE_ROLES).not.toContain("DIETICIAN");
  });

  test("and the console says where their work actually is", () => {
    const r = surfaceRefusal("console", "DIETICIAN", "https://console.test");
    expect(r).not.toBeNull();
    expect(r!.error).toMatch(/VitaHero app/);
    expect(surfaceRefusal("app", "DIETICIAN", "https://console.test")).toBeNull();
  });

  test("and the refusal a dietician gets is about their own job", () => {
    const { dieticianSurfaceRefusal, clinicalSurfaceRefusal } = surfaces;
    expect(dieticianSurfaceRefusal("app")).toBeNull();
    const r = dieticianSurfaceRefusal("console")!;
    expect(r.code).toBe("APP_ONLY");
    // Same gate as the clinical one, different words: telling a dietician
    // that "screening, approval and release" happen in the app is telling
    // them about somebody else's work.
    expect(r.error).toMatch(/plans you write/);
    expect(r.error).not.toBe(clinicalSurfaceRefusal("console")!.error);
    // A legacy token, minted before sessions recorded a surface, is refused
    // here as it is everywhere else.
    expect(dieticianSurfaceRefusal("")).not.toBeNull();
    expect(dieticianSurfaceRefusal(undefined)).not.toBeNull();
  });

  test("a dietician is not a specialty, so no camp can hand them a form", async () => {
    // The four designed checks are the four the user asked to keep. A
    // dietician reads two of them and screens none.
    const { screeningChecksFor, SPECIALTIES } = await import("./clinical");
    expect(SPECIALTIES).not.toContain("Dietician");
    expect(screeningChecksFor("Dietician")).toEqual([]);
    for (const c of DIETICIAN_CHECKS) expect(DESIGNED_CHECKS).toContain(c as never);
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

const OPS: Actor = { profileId: "ph_ops", name: "Ops", role: "SUPERADMIN", schoolId: null };
// The dietician signs in as themselves: the profile id is derived from the
// number, which is the only link between the directory row and the session.
const DIET: Actor = {
  profileId: "ph_9100000001", name: "Meera", role: "DIETICIAN", schoolId: null, surface: "app",
};
const OTHER: Actor = {
  profileId: "ph_9100000002", name: "Asha", role: "DIETICIAN", schoolId: null, surface: "app",
};

let dieticianId = "";
let otherId = "";

suite("what a dietician can reach", () => {
  beforeAll(async () => {
    if (!URL) return;
    const admin = new pg.Client({ connectionString: URL });
    await admin.connect();
    await admin.query("DROP DATABASE IF EXISTS vh_dietician");
    await admin.query("CREATE DATABASE vh_dietician");
    await admin.end();
    client = new pg.Client({ connectionString: URL2(URL, "vh_dietician") });
    await client.connect();
    sql = neonShim(client);
    await migrate(sql, SCHEMA_STEPS, []);

    await sql`INSERT INTO vita_hero.schools (id, name, city, partner_code)
              VALUES ('sch_mine', 'Silver Oaks', 'Hyderabad', 'SO-M'),
                     ('sch_other', 'Delhi Public', 'Hyderabad', 'DP-O')`;
    await sql`INSERT INTO vita_hero.kids (id, profile_id, name, school_id, grade, section, age, gender, height_cm, weight_kg)
              VALUES ('k_mine', 'ph_par', 'Aarav Sharma', 'sch_mine', '5', 'B', 10, 'M', 128, 24),
                     ('k_mine2', 'ph_par', 'Diya Sharma', 'sch_mine', '5', 'B', 10, 'F', 130, 26),
                     ('k_far', 'ph_par2', 'Ravi Kumar', 'sch_other', '6', 'A', 11, 'M', 134, 28)`;
    // A released camp with all four checks, so the filter has something to
    // filter: two a dietician may read, two they may not.
    await sql`INSERT INTO vita_hero.school_camps (id, school_id, title, date, status, checks)
              VALUES ('sc_d', 'sch_mine', 'Annual camp', '2027-02-01', 'RELEASED',
                      ${JSON.stringify([...DESIGNED_CHECKS])}::jsonb)`;
    await sql`INSERT INTO vita_hero.camp_participants
                (id, camp_id, school_id, kid_id, profile_id, consent_status, attendance, status)
              VALUES ('cp_d', 'sc_d', 'sch_mine', 'k_mine', 'ph_par', 'GRANTED', 'PRESENT', 'RELEASED')`;
    const findings: Array<[string, string, string, string]> = [
      ["f_hw", "Height & weight", "WATCH", "128 cm, 24 kg"],
      ["f_hb", "Haemoglobin", "ALERT", "7.2 g/dL"],
      ["f_de", "Dental", "ALERT", "3 caries"],
      ["f_vi", "Vision", "WATCH", "6/18 left"],
    ];
    for (const [id, check, flag, text] of findings) {
      await sql`INSERT INTO vita_hero.camp_findings
                  (id, camp_id, kid_id, check_type, flag, auto_flag, value_text)
                VALUES (${id}, 'sc_d', 'k_mine', ${check}, ${flag}, ${flag}, ${text})`;
    }
    await sql`INSERT INTO vita_hero.meal_items (id, profile_id, kid_id, name, kcal, eaten, day)
              VALUES ('mi1', 'ph_par', 'k_mine', 'Idli', 250, true, '2027-02-10'),
                     ('mi2', 'ph_par', 'k_mine', 'Dal rice', 400, true, '2027-02-10'),
                     ('mi3', 'ph_par', 'k_mine', 'Milk', 120, false, '2027-02-10')`;

    const a = await upsertDietician(sql, OPS, { name: "Meera", phone: "9100000001" });
    dieticianId = a.id;
    const b = await upsertDietician(sql, OPS, { name: "Asha", phone: "9100000002" });
    otherId = b.id;
    await setDieticianSchool(sql, OPS, dieticianId, "sch_mine", true);
    await setDieticianSchool(sql, OPS, otherId, "sch_other", true);
  });

  afterAll(async () => { if (client) await client.end(); });

  // ── the directory ──

  test("adding one gives them a sign-in and says which number opens the door", async () => {
    const r = await upsertDietician(sql, OPS, { id: dieticianId, name: "Meera", phone: "9100000001" });
    expect(r.profileId).toBe("ph_9100000001");
    expect(r.signInHint).toMatch(/\+919100000001/);
    const p = await sql`SELECT role, provisioned FROM vita_hero.profiles WHERE id = 'ph_9100000001'`;
    expect(p[0].role).toBe("DIETICIAN");
    expect(p[0].provisioned).toBe(true);
  });

  test("a number that belongs to a parent is refused outright", async () => {
    await sql`INSERT INTO vita_hero.profiles (id, phone, name, role, provisioned)
              VALUES ('ph_9100009999', '+919100009999', 'A parent', 'PARENT', true)
              ON CONFLICT (id) DO NOTHING`;
    await expect(upsertDietician(sql, OPS, { name: "Nope", phone: "9100009999" }))
      .rejects.toThrow(/already registered as a parent/);
  });

  test("and so is a number that already signs in as a clinician", async () => {
    await sql`INSERT INTO vita_hero.profiles (id, phone, name, role, provisioned)
              VALUES ('ph_9100008888', '+919100008888', 'A doctor', 'PHYSICIAN', true)
              ON CONFLICT (id) DO NOTHING`;
    await expect(upsertDietician(sql, OPS, { name: "Nope", phone: "9100008888" }))
      .rejects.toThrow(/signs in as a physician/);
  });

  test("a landline is refused, because a code cannot reach a desk", async () => {
    await expect(upsertDietician(sql, OPS, { name: "Desk", phone: "04023456789" }))
      .rejects.toThrow(/landline/);
  });

  test("only operations manages the directory", async () => {
    const schoolAdmin: Actor = {
      profileId: "ph_sa", name: "Office", role: "SCHOOL_ADMIN", schoolId: "sch_mine",
    };
    await expect(listDieticians(sql, schoolAdmin)).rejects.toThrow(/operations/);
    await expect(upsertDietician(sql, schoolAdmin, { name: "X", phone: "9100000003" }))
      .rejects.toThrow(/operations/);
  });

  // ── the boundary ──

  test("they see the schools they were assigned and no others", async () => {
    const { schools, me } = await dieticianSchools(sql, DIET);
    expect(me.name).toBe("Meera");
    expect(schools.map((s) => s.id)).toEqual(["sch_mine"]);
    expect(schools[0].children).toBe(2);
  });

  test("the children at that school, and not the ones at the other", async () => {
    const { children } = await dieticianChildren(sql, DIET, "sch_mine");
    expect(children.map((c) => c.name).sort()).toEqual(["Aarav Sharma", "Diya Sharma"]);
    // Aarav has growth and haemoglobin flagged; the dental and vision flags
    // are not this person's business and are not counted.
    expect(children.find((c) => c.name === "Aarav Sharma")!.concerns).toBe(2);
  });

  test("asking for somebody else's school is refused", async () => {
    await expect(dieticianChildren(sql, DIET, "sch_other")).rejects.toThrow(/not assigned/);
    await expect(dieticianChildren(sql, OTHER, "sch_mine")).rejects.toThrow(/not assigned/);
  });

  test("asking for a child at somebody else's school is refused", async () => {
    await expect(dieticianChild(sql, DIET, "k_far")).rejects.toThrow(/not at one of your schools/);
  });

  test("a child that does not exist gets the same answer as one out of scope", async () => {
    // Otherwise this endpoint becomes a way of asking whether a kid id is real.
    const a = await dieticianChild(sql, DIET, "k_far").catch((e) => e.message);
    const b = await dieticianChild(sql, DIET, "k_nonsense").catch((e) => e.message);
    expect(a).toBe(b);
  });

  test("the record they get is growth and haemoglobin, and nothing else", async () => {
    const r = await dieticianChild(sql, DIET, "k_mine");
    const checks = r.findings.map((f) => f.checkType).sort();
    expect(checks).toEqual(["Haemoglobin", "Height & weight"]);
    // The refusal is the query, not the screen: the dental finding is not in
    // the response at all, so nothing can read it out of the wire.
    expect(JSON.stringify(r)).not.toContain("caries");
    expect(JSON.stringify(r)).not.toContain("6/18");
  });

  test("and the food log, by day, rather than every meal ever eaten", async () => {
    const r = await dieticianChild(sql, DIET, "k_mine");
    expect(r.foodLog).toHaveLength(1);
    expect(r.foodLog[0]).toEqual({ day: "2027-02-10", items: 3, eaten: 2, kcal: 650 });
  });

  test("looking at a child's record is written down", async () => {
    const rows = await sql`
      SELECT surface, kid_id FROM vita_hero.record_access
      WHERE actor_id = ${DIET.profileId} AND kid_id = 'k_mine'
    `;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].surface).toBe("DIETICIAN");
  });

  // ── the plan ──

  test("the form opens with a draft drawn from what was found", async () => {
    const r = await dieticianChild(sql, DIET, "k_mine");
    // Haemoglobin was the ALERT, so that is the focus it proposes.
    expect(r.draft.focus).toBe("ANAEMIA");
    expect(r.draft.guidance).toMatch(/Aarav/);
    expect(r.draft.guidance).toMatch(/haemoglobin/);
  });

  test("a plan needs something a family can act on", async () => {
    await expect(saveDietPlan(sql, DIET, { kidId: "k_mine", guidance: "eat" }))
      .rejects.toThrow(/act on/);
  });

  test("a plan can be written, and the parent can read it", async () => {
    const { plan } = await saveDietPlan(sql, DIET, {
      kidId: "k_mine",
      title: "Iron-rich plan",
      focus: "ANAEMIA",
      startsOn: "2027-02-15",
      guidance: "Add a green leafy vegetable to lunch, and lemon with it so the iron is absorbed.",
      targets: [{ label: "Iron-rich meals", value: "5 a week" }],
    });
    expect(plan.status).toBe("ACTIVE");
    expect(plan.authorName).toBe("Meera");
    expect(plan.targets).toEqual([{ label: "Iron-rich meals", value: "5 a week" }]);

    const seen = await guardianDietPlan(sql, "ph_par", "k_mine");
    expect(seen.plan!.id).toBe(plan.id);
    expect(seen.plan!.guidance).toMatch(/green leafy/);
  });

  test("only one plan runs at a time", async () => {
    // Two ACTIVE rows would leave a parent's screen choosing between them,
    // which is how a family ends up following last term's advice.
    await saveDietPlan(sql, DIET, {
      kidId: "k_mine",
      title: "Everyday plan",
      guidance: "Keep the iron going and add a fruit at breakfast.",
    });
    const rows = await sql`
      SELECT status, COUNT(*)::int AS n FROM vita_hero.diet_plans
      WHERE kid_id = 'k_mine' GROUP BY status ORDER BY status
    `;
    const active = rows.find((r) => r.status === "ACTIVE");
    expect(active!.n).toBe(1);
    const seen = await guardianDietPlan(sql, "ph_par", "k_mine");
    expect(seen.plan!.title).toBe("Everyday plan");
    // The one before it is kept, not overwritten.
    const r = await dieticianChild(sql, DIET, "k_mine");
    expect(r.plans.length).toBe(2);
  });

  test("a parent cannot read a plan for somebody else's child", async () => {
    await expect(guardianDietPlan(sql, "ph_par", "k_far")).rejects.toThrow(/No such child/);
  });

  test("a child with no plan is not an error", async () => {
    const r = await guardianDietPlan(sql, "ph_par", "k_mine2");
    expect(r.plan).toBeNull();
  });

  test("a dietician cannot write a plan for a child outside their schools", async () => {
    await expect(saveDietPlan(sql, OTHER, {
      kidId: "k_mine", guidance: "Something perfectly sensible about vegetables.",
    })).rejects.toThrow(/not at one of your schools/);
  });

  // ── the library ──

  test("they can write for the shelf", async () => {
    await upsertArticle(sql, DIET, {
      slug: "iron-at-home", locale: "en", title: "Iron at home",
      body: "Dark green leaves, dal and jaggery are the cheapest iron in an Indian kitchen, " +
        "and a squeeze of lemon helps the body take it up.",
      checkTypes: ["Haemoglobin"], flags: ["WATCH", "ALERT"],
    });
    const { articles } = await myArticles(sql, DIET);
    expect(articles.map((a) => a.slug)).toContain("iron-at-home");
  });

  test("but not over somebody else's article", async () => {
    await upsertArticle(sql, OPS, {
      slug: "about-vision", locale: "en", title: "About vision",
      body: "What a vision flag means, and what to do next, written by the programme team.",
    });
    await expect(upsertArticle(sql, DIET, {
      slug: "about-vision", locale: "en", title: "About vision",
      body: "A rewrite of somebody else's article, which should not be allowed to happen.",
    })).rejects.toThrow(/written by somebody else/);
  });

  test("and taking a page off the shelf stays with operations", async () => {
    const { deleteArticle } = await import("./library");
    await expect(deleteArticle(sql, DIET, "iron-at-home", "en")).rejects.toThrow(/operations/);
  });

  // ── the shapes the app reads ──

  test("every field the app declares is one the server actually sends", () => {
    // kotlinx fills a missing key with the declared default and says nothing,
    // so a renamed field shows a dietician a child with no readings and no
    // plan, and no error anywhere.
    const src = readFileSync(
      "../android/app/src/main/java/com/rork/vitahero/data/DieticianDtos.kt", "utf8");
    const fieldsOf = (name: string) => {
      const at = src.indexOf(`data class ${name}(`);
      if (at < 0) throw new Error(`${name} is gone from DieticianDtos.kt`);
      const body = src.slice(at, src.indexOf("\n)", at));
      return (body.match(/^\s*val\s+(\w+)\s*:/gm) || [])
        .map((x) => x.replace(/^\s*val\s+/, "").replace(/\s*:$/, ""));
    };
    const missing = (fields: string[], payload: Record<string, unknown>) =>
      fields.filter((f) => !(f in payload));

    return (async () => {
      const record = await dieticianChild(sql, DIET, "k_mine") as unknown as Record<string, unknown>;
      expect(missing(fieldsOf("DieticianChildRecordDto"), record)).toEqual([]);
      expect(missing(fieldsOf("DieticianChildProfileDto"),
        record.child as Record<string, unknown>)).toEqual([]);
      expect(missing(fieldsOf("DieticianFindingDto"),
        (record.findings as Record<string, unknown>[])[0])).toEqual([]);
      expect(missing(fieldsOf("FoodLogDayDto"),
        (record.foodLog as Record<string, unknown>[])[0])).toEqual([]);
      expect(missing(fieldsOf("DietPlanDto"),
        (record.plans as Record<string, unknown>[])[0])).toEqual([]);
      expect(missing(fieldsOf("DietDraftDto"),
        record.draft as Record<string, unknown>)).toEqual([]);

      const list = await dieticianChildren(sql, DIET, "sch_mine") as unknown as Record<string, unknown>;
      expect(missing(fieldsOf("DieticianChildrenDto"), list)).toEqual([]);
      expect(missing(fieldsOf("DieticianChildDto"),
        (list.children as Record<string, unknown>[])[0])).toEqual([]);

      const mine = await dieticianSchools(sql, DIET) as unknown as Record<string, unknown>;
      expect(missing(fieldsOf("DieticianSchoolsDto"), mine)).toEqual([]);
      expect(missing(fieldsOf("DieticianMeDto"), mine.me as Record<string, unknown>)).toEqual([]);
      expect(missing(fieldsOf("DieticianSchoolDto"),
        (mine.schools as Record<string, unknown>[])[0])).toEqual([]);
    })();
  });

  // ── retiring one ──

  test("retiring a dietician takes the schools and the sign-in with it", async () => {
    await retireDietician(sql, OPS, dieticianId);
    const p = await sql`SELECT provisioned FROM vita_hero.profiles WHERE id = 'ph_9100000001'`;
    expect(p[0].provisioned).toBe(false);
    const links = await sql`
      SELECT active FROM vita_hero.dietician_schools WHERE dietician_id = ${dieticianId}`;
    expect(links.every((l) => l.active === false)).toBe(true);
    await expect(dieticianSchools(sql, DIET)).rejects.toThrow(/not active/);
  });

  test("and a retired one cannot be handed a school until they are restored", async () => {
    await expect(setDieticianSchool(sql, OPS, dieticianId, "sch_mine", true))
      .rejects.toThrow(/retired/);
    await upsertDietician(sql, OPS, { id: dieticianId, name: "Meera", phone: "9100000001", active: true });
    await setDieticianSchool(sql, OPS, dieticianId, "sch_mine", true);
    const { schools } = await dieticianSchools(sql, DIET);
    expect(schools.map((s) => s.id)).toEqual(["sch_mine"]);
  });

  test("the plan a retired dietician wrote does not vanish from the family", async () => {
    // The advice was given. Withdrawing the person does not unsay it.
    const seen = await guardianDietPlan(sql, "ph_par", "k_mine");
    expect(seen.plan).not.toBeNull();
  });
});
