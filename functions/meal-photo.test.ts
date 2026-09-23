// A photograph of a child's dinner does not leave the phone unasked.
//
// Camp photographs have had a consent gate from the start: agreeing to have
// your child measured is not agreeing to have them photographed, and the
// server refuses the upload rather than trusting the screen. Meal photographs
// went through none of that. The app sent every one of them to a third-party
// vision endpoint *before* it tried the on-device labeller, so the default for
// a picture taken in a family's kitchen was that it left the handset and
// nobody was ever asked.
//
// The gate does not switch the feature off, which is what makes it a fair
// question: refusing means ML Kit labels the photo on the device and the meal
// is still logged, just less precisely.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import pg from "pg";
import type { Sql } from "./common";
import { serialQuery } from "./pgserial";
import { SCHEMA_STEPS } from "./index";
import { migrate } from "./migrate";
import { mealPhotoConsent, setMealPhotoConsent } from "./media";

const APP = "../android/app/src/main/java/kallam/healthcare";

describe("the app cannot send a meal photo it has no answer for", () => {
  test("remote recognition is opt-in, and off by default", () => {
    const svc = readFileSync(`${APP}/data/FoodRecognitionService.kt`, "utf8");
    // The default matters more than the parameter. A caller that forgets this
    // should get the private version, not the other way round.
    expect(svc).toMatch(/allowRemote:\s*Boolean\s*=\s*false/);
    // And the remote call is inside the guard rather than before it.
    const body = svc.slice(svc.indexOf("suspend fun analyseBitmap"));
    const guard = body.indexOf("if (allowRemote");
    const remote = body.indexOf("analyseRemote(");
    expect(guard).toBeGreaterThan(-1);
    expect(remote).toBeGreaterThan(guard);
  });

  test("and it names the child, because the consent is per child", () => {
    const repo = readFileSync(`${APP}/data/ApiRepository.kt`, "utf8");
    const at = repo.indexOf("suspend fun recognizeFood");
    expect(at).toBeGreaterThan(-1);
    const fn = repo.slice(at, at + 900);
    expect(fn).toContain("kidId");
    expect(fn).toContain('"kid_id" to kidId');
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

suite("the consent itself", () => {
  beforeAll(async () => {
    if (!URL) return;
    const admin = new pg.Client({ connectionString: URL });
    await admin.connect();
    await admin.query("DROP DATABASE IF EXISTS vh_mealphoto");
    await admin.query("CREATE DATABASE vh_mealphoto");
    await admin.end();
    client = new pg.Client({ connectionString: URL2(URL, "vh_mealphoto") });
    await client.connect();
    sql = neonShim(client);
    await migrate(sql, SCHEMA_STEPS, []);

    await sql`INSERT INTO vita_hero.schools (id, name, city, partner_code)
              VALUES ('sch_m', 'Silver Oaks', 'Hyderabad', 'SO-M')`;
    await sql`INSERT INTO vita_hero.kids (id, profile_id, name, school_id, grade, age, gender)
              VALUES ('k_mine', 'ph_par', 'Aarav', 'sch_m', '5', 10, 'M'),
                     ('k_theirs', 'ph_other', 'Someone else', 'sch_m', '5', 10, 'F')`;
  });

  afterAll(async () => { if (client) await client.end(); });

  test("not asked is not the same as yes", async () => {
    const c = await mealPhotoConsent(sql, "ph_par", "k_mine");
    expect(c.asked).toBe(false);
    expect(c.granted).toBe(false);
  });

  test("a no is recorded as a no, and is not confused with never asked", async () => {
    const c = await setMealPhotoConsent(sql, "ph_par", "k_mine", false);
    expect(c.asked).toBe(true);
    expect(c.granted).toBe(false);
    const again = await mealPhotoConsent(sql, "ph_par", "k_mine");
    expect(again.asked).toBe(true);
    expect(again.granted).toBe(false);
  });

  test("a guardian can change their mind, both ways", async () => {
    await setMealPhotoConsent(sql, "ph_par", "k_mine", true);
    expect((await mealPhotoConsent(sql, "ph_par", "k_mine")).granted).toBe(true);
    await setMealPhotoConsent(sql, "ph_par", "k_mine", false);
    expect((await mealPhotoConsent(sql, "ph_par", "k_mine")).granted).toBe(false);
  });

  test("it is per child, not per family", async () => {
    await sql`INSERT INTO vita_hero.kids (id, profile_id, name, school_id, grade, age, gender)
              VALUES ('k_sib', 'ph_par', 'Diya', 'sch_m', '3', 8, 'F')
              ON CONFLICT (id) DO NOTHING`;
    await setMealPhotoConsent(sql, "ph_par", "k_mine", true);
    // The sibling was never asked. Saying yes for one child says nothing
    // about the other.
    expect((await mealPhotoConsent(sql, "ph_par", "k_sib")).asked).toBe(false);
  });

  test("a guardian cannot answer for somebody else's child", async () => {
    await expect(mealPhotoConsent(sql, "ph_par", "k_theirs")).rejects.toThrow(/No such child/);
    await expect(setMealPhotoConsent(sql, "ph_par", "k_theirs", true))
      .rejects.toThrow(/No such child/);
  });
});
