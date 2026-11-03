// The twelve pre-camp diet plans.
//
// A dietician writes one plan per growth group for girls and one for boys
// before the camp. Once a child's
// results are released, the plan for the group those results put them in
// reaches the family on its own, with the dietician's number to phone about
// a milk intolerance or a food allergy.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import pg from "pg";
import type { Sql } from "./common";
import { serialQuery } from "./pgserial";
import type { Actor } from "./schools";
import { SCHEMA_STEPS } from "./index";
import { migrate } from "./migrate";
import {
  TEMPLATE_KEYS,
  adminDieticianTemplates,
  adminSaveDieticianTemplate,
  dieticianCohorts,
  dieticianTemplates,
  guardianDietPlan,
  saveDieticianTemplate,
  saveDietPlan,
  setDieticianSchool,
  templateKeyOf,
  upsertDietician,
} from "./dietician";

describe("the groups a plan is written for", () => {
  test("twelve: each growth group for girls and for boys, none for haemoglobin", () => {
    expect(TEMPLATE_KEYS.length).toBe(12);
    expect(new Set(TEMPLATE_KEYS).size).toBe(12);
    expect(TEMPLATE_KEYS.filter((k) => k.endsWith("+GIRLS")).length).toBe(6);
    expect(TEMPLATE_KEYS.some((k) => k.includes("ANAEMIA"))).toBe(false);
  });

  test("tooth decay shares the healthy-weight plan", () => {
    expect(templateKeyOf("NORMAL+GIRLS+TEETH")).toBe("NORMAL+GIRLS");
    expect(templateKeyOf("OVER+ANAEMIA+BOYS")).toBe("OVER+ANAEMIA+BOYS");
  });
});

const URL = process.env.TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;

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
const DIET: Actor = {
  profileId: "ph_9200000001", name: "Meera", role: "DIETICIAN", schoolId: null, surface: "app",
};
const OVERWEIGHT_GUIDANCE = "Fruit instead of biscuits, and an hour of active play every day.";

suite("pre-camp plans reach the family", () => {
  beforeAll(async () => {
    const admin = new pg.Client({ connectionString: URL });
    await admin.connect();
    await admin.query("DROP DATABASE IF EXISTS vh_diet_tpl");
    await admin.query("CREATE DATABASE vh_diet_tpl");
    await admin.end();
    const u = new globalThis.URL(URL!);
    u.pathname = "/vh_diet_tpl";
    client = new pg.Client({ connectionString: u.toString() });
    await client.connect();
    sql = neonShim(client);
    await migrate(sql, SCHEMA_STEPS, []);

    await sql`INSERT INTO vita_hero.schools (id, name, city, partner_code)
              VALUES ('sch_t', 'Silver Oaks', 'Hyderabad', 'SO-T')`;
    // A 10-year-old boy, 140 cm and 45 kg: BMI 23, overweight for his age.
    await sql`INSERT INTO vita_hero.kids (id, profile_id, name, school_id, grade, section, age, gender)
              VALUES ('k_t', 'ph_part', 'Kiran', 'sch_t', '5', 'A', 10, 'M'),
                     ('k_u', 'ph_part', 'Uma', 'sch_t', '5', 'A', 10, 'F')`;
    await sql`INSERT INTO vita_hero.school_camps (id, school_id, title, date, status, checks)
              VALUES ('sc_t', 'sch_t', 'Annual camp', '2027-02-01', 'IN_PROGRESS',
                      ${JSON.stringify(["Height & weight", "Haemoglobin", "Dental"])}::jsonb)`;
    await sql`INSERT INTO vita_hero.camp_participants
                (id, camp_id, school_id, kid_id, profile_id, consent_status, attendance, status)
              VALUES ('cp_t', 'sc_t', 'sch_t', 'k_t', 'ph_part', 'GRANTED', 'PRESENT', 'SCREENED'),
                     ('cp_u', 'sc_t', 'sch_t', 'k_u', 'ph_part', 'GRANTED', 'PRESENT', 'RELEASED')`;
    await sql`INSERT INTO vita_hero.camp_findings
                (id, camp_id, kid_id, check_type, flag, auto_flag, value_text, detail)
              VALUES ('f_t', 'sc_t', 'k_t', 'Height & weight', 'WATCH', 'WATCH', '140 cm, 45 kg',
                      ${JSON.stringify({ heightCm: "140", weightKg: "45" })}::jsonb),
                     ('f_u', 'sc_t', 'k_u', 'Dental', 'WATCH', 'WATCH', '2 caries',
                      ${JSON.stringify({ cariesCount: "2" })}::jsonb)`;

    const d = await upsertDietician(sql, OPS, { name: "Meera", phone: "9200000001" });
    await setDieticianSchool(sql, OPS, d.id, "sch_t", true);
  });

  afterAll(async () => { if (client) await client.end(); });

  test("a plan saved before girls and boys were split stands for both until rewritten", async () => {
    const [d] = await sql`SELECT id FROM vita_hero.dieticians WHERE name = 'Meera'`;
    await sql`INSERT INTO vita_hero.diet_plan_templates (dietician_id, cohort_key, title, guidance)
              VALUES (${d.id}, 'STUNTED', 'Old growth plan', 'Dal and an egg every day.')`;
    const r = await dieticianTemplates(sql, DIET);
    for (const key of ["STUNTED+GIRLS", "STUNTED+BOYS"]) {
      const t = r.templates.find((x) => x.key === key)!;
      expect(t.title).toBe("Old growth plan");
      expect(t.saved).toBe(false);
    }
    expect(r.ready).toBe(0);
    await sql`DELETE FROM vita_hero.diet_plan_templates WHERE cohort_key = 'STUNTED'`;
  });

  test("before anything is written, all twelve are starter drafts", async () => {
    const r = await dieticianTemplates(sql, DIET);
    expect(r.templates.map((t) => t.key)).toEqual(TEMPLATE_KEYS);
    expect(r.ready).toBe(0);
    expect(r.templates.every((t) => t.guidance.length > 10)).toBe(true);
  });

  test("a plan is saved under its group, with the group's focus", async () => {
    const r = await saveDieticianTemplate(sql, DIET, {
      key: "OVER+BOYS", title: "Healthy weight plan", focus: "WEIGHT_GAIN",
      guidance: OVERWEIGHT_GUIDANCE, targets: [{ label: "Sweet drinks", value: "None" }],
    });
    expect(r.ready).toBe(1);
    const t = r.templates.find((x) => x.key === "OVER+BOYS")!;
    expect(t.saved).toBe(true);
    expect(t.focus).toBe("WEIGHT_CONTROL");
    await expect(saveDieticianTemplate(sql, DIET, { key: "NOPE", guidance: OVERWEIGHT_GUIDANCE }))
      .rejects.toThrow(/No such group/);
  });

  test("the dietician's groups start from their own pre-camp plan", async () => {
    const r = await dieticianCohorts(sql, DIET, "sch_t");
    const over = r.cohorts.find((c) => c.key === "OVER+BOYS")!;
    expect(over.draft.source).toBe("TEMPLATE");
    expect(over.draft.guidance).toBe(OVERWEIGHT_GUIDANCE);
  });

  test("results not yet released give the family nothing", async () => {
    const r = await guardianDietPlan(sql, "ph_part", "k_t");
    expect(r.plan).toBeNull();
  });

  test("once released, the group's plan reaches the family, with the dietician's number", async () => {
    await sql`UPDATE vita_hero.camp_participants SET status = 'RELEASED' WHERE id = 'cp_t'`;
    const r = await guardianDietPlan(sql, "ph_part", "k_t");
    expect(r.plan!.title).toBe("Healthy weight plan");
    expect(r.plan!.guidance).toBe(OVERWEIGHT_GUIDANCE);
    expect(r.dietician!.name).toBe("Meera");
    expect(r.dietician!.phone).toContain("9200000001");
    expect(r.allergyNote).toMatch(/dairy/);
    // Read twice, still one plan.
    await guardianDietPlan(sql, "ph_part", "k_t");
    const rows = await sql`SELECT COUNT(*)::int AS n FROM vita_hero.diet_plans WHERE kid_id = 'k_t'`;
    expect(rows[0].n).toBe(1);
  });

  test("a rewritten pre-camp plan replaces the one given from it", async () => {
    await new Promise((r) => setTimeout(r, 20));
    await saveDieticianTemplate(sql, DIET, {
      key: "OVER+BOYS", title: "Healthy weight plan, v2", guidance: OVERWEIGHT_GUIDANCE + " No sweet drinks.",
    });
    const r = await guardianDietPlan(sql, "ph_part", "k_t");
    expect(r.plan!.title).toBe("Healthy weight plan, v2");
    const active = await sql`SELECT COUNT(*)::int AS n FROM vita_hero.diet_plans
                             WHERE kid_id = 'k_t' AND status = 'ACTIVE'`;
    expect(active[0].n).toBe(1);
  });

  test("tooth decay adds its line to the healthy-weight plan", async () => {
    // Uma has teeth released and no growth reading: no plan written for that group yet.
    expect((await guardianDietPlan(sql, "ph_part", "k_u")).plan).toBeNull();
    await saveDieticianTemplate(sql, DIET, {
      key: "UNKNOWN+GIRLS", title: "Everyday plan", guidance: "A balanced plate every meal, with a fruit a day.",
    });
    const r = await guardianDietPlan(sql, "ph_part", "k_u");
    expect(r.plan!.title).toBe("Everyday plan");
    expect(r.plan!.guidance).toMatch(/tooth decay/);
  });

  test("a plan the dietician writes for the child is never replaced by a pre-camp one", async () => {
    await saveDietPlan(sql, DIET, {
      kidId: "k_t", title: "Kiran's own plan", guidance: "No milk: curd and ragi instead, for the calcium.",
    });
    const r = await guardianDietPlan(sql, "ph_part", "k_t");
    expect(r.plan!.title).toBe("Kiran's own plan");
    expect(r.dietician!.name).toBe("Meera");
  });

  // Operations read and correct a dietician's plans from the admin console.
  test("operations see the dietician's twelve plans, written and draft", async () => {
    const [d] = await sql`SELECT id FROM vita_hero.dieticians WHERE name = 'Meera'`;
    const r = await adminDieticianTemplates(sql, OPS, d.id as string);
    expect(r.dietician.name).toBe("Meera");
    expect(r.templates.map((t) => t.key)).toEqual(TEMPLATE_KEYS);
    expect(r.templates.find((t) => t.key === "OVER+BOYS")!.saved).toBe(true);
    expect(r.ready).toBe((await dieticianTemplates(sql, DIET)).ready);
  });

  test("a plan operations save is the dietician's plan", async () => {
    const [d] = await sql`SELECT id FROM vita_hero.dieticians WHERE name = 'Meera'`;
    const r = await adminSaveDieticianTemplate(sql, OPS, d.id as string, {
      key: "UNDER+GIRLS", title: "Catch-up plan",
      guidance: "An egg or a cup of dal at every meal.",
      targets: [{ label: "Protein", value: "Every meal" }, { label: "", value: "dropped" }],
    });
    const t = r.templates.find((x) => x.key === "UNDER+GIRLS")!;
    expect(t.saved).toBe(true);
    expect(t.targets).toEqual([{ label: "Protein", value: "Every meal" }]);
    const mine = await dieticianTemplates(sql, DIET);
    expect(mine.templates.find((x) => x.key === "UNDER+GIRLS")!.title).toBe("Catch-up plan");
  });

  test("only operations reach another dietician's plans", async () => {
    const [d] = await sql`SELECT id FROM vita_hero.dieticians WHERE name = 'Meera'`;
    await expect(adminDieticianTemplates(sql, DIET, d.id as string)).rejects.toThrow(/operations/);
    await expect(adminSaveDieticianTemplate(sql, DIET, d.id as string, {
      key: "OVER+BOYS", guidance: OVERWEIGHT_GUIDANCE,
    })).rejects.toThrow(/operations/);
    await expect(adminDieticianTemplates(sql, OPS, "die_nobody")).rejects.toThrow(/No such dietician/);
    await expect(adminSaveDieticianTemplate(sql, OPS, d.id as string, { key: "OVER+BOYS", guidance: "short" }))
      .rejects.toThrow();
  });
});
