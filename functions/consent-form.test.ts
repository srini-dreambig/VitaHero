// The paper slip asks exactly what the app asks.
//
// Two ways to take consent, one question. If the printed form and the app's
// consent screen ever say different things, a school ends up holding a
// signature for something the child was never asked about — and nothing in a
// server test would notice, because the app's wording lives in Kotlin.
//
// So this test reads LocaleStrings.kt. Change the question in the app, in any
// of the three languages, and the build stops here until the form follows.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import pg from "pg";
import type { Sql } from "./common";
import { serialQuery } from "./pgserial";
import type { Actor } from "./schools";
import { SCHEMA_STEPS } from "./index";
import { migrate } from "./migrate";
import { campConsentForm, CONSENT_COPY, CONSENT_FORM_LANGS } from "./consent-form";
import { DESIGNED_CHECKS } from "./clinical";

const LOCALES = "../android/app/src/main/java/com/rork/vitahero/data/LocaleStrings.kt";

/**
 * The app's string table for one locale, for the keys the form reuses.
 *
 * Read by slicing between the map declarations rather than parsing Kotlin: the
 * maps are `S.key to "value"` pairs and nothing else, and a structural change
 * big enough to break this slice is a change this test should fail on anyway.
 */
function appStrings(locale: string, keys: string[]): Record<string, string> {
  const src = readFileSync(LOCALES, "utf8");
  const order = ["en", "hi", "te", "allTranslations"];
  const at = (name: string) => {
    const m = new RegExp(`val ${name}\\b[^=]*=\\s*mapOf\\(`).exec(src);
    if (!m) throw new Error(`LocaleStrings has no '${name}' map any more`);
    return m.index;
  };
  const i = order.indexOf(locale);
  if (i < 0) throw new Error(`no such locale: ${locale}`);
  const seg = src.slice(at(locale), at(order[i + 1]));
  const out: Record<string, string> = {};
  for (const k of keys) {
    const m = new RegExp(`S\\.${k} to "((?:[^"\\\\]|\\\\.)*)"`).exec(seg);
    // Unicode escapes are how the file stores Devanagari and Telugu.
    if (m) out[k] = m[1].replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  }
  return out;
}

describe("the form's wording is the app's wording", () => {
  const keys = Object.keys(CONSENT_COPY.en);

  test("there is something to compare", () => {
    expect(keys.length).toBeGreaterThan(5);
    expect(CONSENT_FORM_LANGS).toEqual(["en", "hi", "te"]);
  });

  for (const lang of ["en", "hi", "te"]) {
    test(`${lang}: every question on the slip is the app's question, word for word`, () => {
      const app = appStrings(lang, keys);
      for (const k of keys) {
        // A key the app has not translated falls back to English in the app,
        // and this table carries English for it too — so there is nothing to
        // compare, not a mismatch.
        if (!(k in app)) continue;
        expect(CONSENT_COPY[lang][k], `${lang}.${k}`).toBe(app[k]);
      }
    });
  }

  test("the app has not grown a consent question the slip does not ask", () => {
    const src = readFileSync(LOCALES, "utf8");
    // Every key the consent screen renders, read off the screen itself.
    const screen = readFileSync(
      "../android/app/src/main/java/com/rork/vitahero/ui/screens/CampConsentScreen.kt", "utf8");
    const used = new Set((screen.match(/S\.(\w+)/g) || []).map((s) => s.slice(2)));
    // Headings and empty states are the app's own furniture; what has to match
    // is the wording of the questions and the answers.
    const asked = [...used].filter((k) =>
      /^(consent|photoConsent|campConsentDecline)/.test(k) && !/^consentGiven/.test(k));
    for (const k of asked) {
      expect(src).toContain(`S.${k} to `);
      expect(Object.keys(CONSENT_COPY.en), `app asks ${k}; the printed slip does not`)
        .toContain(k);
    }
  });
});

// ── the form itself, against a real camp ──

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
const NURSE: Actor = { profileId: "ph_scr", name: "Screener", role: "SCREENER", schoolId: "sch_f" };

const CAMP = "sc_form";
const PHOTOLESS = "sc_noph";

suite("the printed slip", () => {
  beforeAll(async () => {
    if (!URL) return;
    const admin = new pg.Client({ connectionString: URL });
    await admin.connect();
    await admin.query("DROP DATABASE IF EXISTS vh_consentform");
    await admin.query("CREATE DATABASE vh_consentform");
    await admin.end();
    client = new pg.Client({ connectionString: URL2(URL, "vh_consentform") });
    await client.connect();
    sql = neonShim(client);
    await migrate(sql, SCHEMA_STEPS, []);

    await sql`INSERT INTO vita_hero.schools (id, name, city, partner_code)
              VALUES ('sch_f', 'Silver Oaks', 'Hyderabad', 'SO-F')`;
    await sql`INSERT INTO vita_hero.school_camps
                (id, school_id, title, date, time, venue, status, checks,
                 consent_deadline, photos_enabled)
              VALUES (${CAMP}, 'sch_f', 'Annual camp', '2026-08-01', '9:00 am', 'School hall',
                      'SCHEDULED', ${JSON.stringify(["Vision", "Dental"])}::jsonb,
                      '2026-07-25', true)`;
    await sql`INSERT INTO vita_hero.school_camps
                (id, school_id, title, date, status, checks, photos_enabled)
              VALUES (${PHOTOLESS}, 'sch_f', 'Quiet camp', '2026-09-01', 'SCHEDULED',
                      ${JSON.stringify([...DESIGNED_CHECKS])}::jsonb, false)`;

    // Three children: one still to answer, one already answered in the app,
    // and one whose name would break the page if it were not escaped.
    await sql`INSERT INTO vita_hero.kids (id, profile_id, name, school_id, grade, section, student_ref, age, gender)
              VALUES ('k_a', 'ph_p1', 'Aarav Sharma', 'sch_f', '5', 'B', 'S-101', 10, 'M'),
                     ('k_b', 'ph_p2', 'Diya Rao', 'sch_f', '5', 'B', 'S-102', 10, 'F'),
                     ('k_c', 'ph_p3', 'Ravi <script>Kumar</script> & Sons', 'sch_f', '6', 'A', 'S-103', 11, 'M')`;
    for (const [id, kid, status] of [
      ["cp_a", "k_a", "PENDING"], ["cp_b", "k_b", "GRANTED"], ["cp_c", "k_c", "PENDING"],
    ]) {
      await sql`INSERT INTO vita_hero.camp_participants
                  (id, camp_id, school_id, kid_id, profile_id, consent_status)
                VALUES (${id}, ${CAMP}, 'sch_f', ${kid}, ${"ph_" + kid}, ${status})`;
    }
    await sql`INSERT INTO vita_hero.camp_participants
                (id, camp_id, school_id, kid_id, profile_id, consent_status)
              VALUES ('cp_d', ${PHOTOLESS}, 'sch_f', 'k_a', 'ph_p1', 'PENDING')`;
    await sql`INSERT INTO vita_hero.profiles (id, phone, name, role, provisioned, school_id)
              VALUES ('ph_scr', '+919000000009', 'Screener', 'SCREENER', true, 'sch_f')`;
    await sql`INSERT INTO vita_hero.camp_staff (id, camp_id, profile_id, staff_role, active)
              VALUES ('cst_f', ${CAMP}, 'ph_scr', 'SCREENER', true)`;
  });

  afterAll(async () => { if (client) await client.end(); });

  test("it prints only the children still waiting to answer", async () => {
    const html = await campConsentForm(sql, OPS, CAMP);
    expect(html).toContain("Aarav Sharma");
    // Diya answered in the app. Re-printing her slip invites a second, paper
    // answer that contradicts the first.
    expect(html).not.toContain("Diya Rao");
    expect((html.match(/class="slip"/g) || []).length).toBe(2);
  });

  test("asking for all of them prints all of them", async () => {
    const html = await campConsentForm(sql, OPS, CAMP, { only: "all" });
    expect(html).toContain("Diya Rao");
    expect((html.match(/class="slip"/g) || []).length).toBe(3);
  });

  test("it asks yes or no against each check the camp offers, and no others", async () => {
    const html = await campConsentForm(sql, OPS, CAMP);
    expect(html).toContain("Vision");
    expect(html).toContain("Dental");
    expect(html).not.toContain("Haemoglobin");
    // Two boxes per check per child: yes and no.
    const boxes = (html.match(/class="box"/g) || []).length;
    expect(boxes).toBeGreaterThanOrEqual(2 * 2 * 2);
  });

  test("the camp's own facts are on it", async () => {
    const html = await campConsentForm(sql, OPS, CAMP);
    expect(html).toContain("Silver Oaks");
    expect(html).toContain("School hall");
    expect(html).toContain("9:00 am");
    expect(html).toContain("S-101");
    // The deadline is the app's sentence with the date filled in, not a
    // second phrasing of it.
    expect(html).toContain("Please answer by 2026-07-25.");
    expect(html).not.toContain("%s");
  });

  test("the photograph question is asked only where the camp asked it", async () => {
    const asked = await campConsentForm(sql, OPS, CAMP);
    expect(asked).toContain(CONSENT_COPY.en.photoConsentAgree);
    const quiet = await campConsentForm(sql, OPS, PHOTOLESS);
    expect(quiet).not.toContain(CONSENT_COPY.en.photoConsentAgree);
    expect(quiet).not.toContain(CONSENT_COPY.en.photoConsentTitle);
  });

  test("it prints in the family's language, not only in English", async () => {
    const hi = await campConsentForm(sql, OPS, CAMP, { lang: "hi" });
    expect(hi).toContain(CONSENT_COPY.hi.consentChecksTitle);
    expect(hi).toContain('<html lang="hi">');
    const te = await campConsentForm(sql, OPS, CAMP, { lang: "te" });
    expect(te).toContain(CONSENT_COPY.te.consentGrant);
    // An unknown language is English, not a blank page.
    const nonsense = await campConsentForm(sql, OPS, CAMP, { lang: "xx" });
    expect(nonsense).toContain(CONSENT_COPY.en.consentChecksTitle);
  });

  test("a child's name cannot close the tag it sits in", async () => {
    const html = await campConsentForm(sql, OPS, CAMP, { only: "all" });
    expect(html).not.toContain("<script>Kumar</script>");
    expect(html).toContain("&lt;script&gt;Kumar&lt;/script&gt; &amp; Sons");
  });

  test("a screener on the camp cannot print the roster", async () => {
    // They are on the staff and may screen. Running the camp — the roster,
    // the guardians' numbers, the paperwork — is the school office's job.
    await expect(campConsentForm(sql, NURSE, CAMP)).rejects.toThrow(/permission/i);
  });

  test("nobody is handed a form for a camp they are not on", async () => {
    const stranger: Actor = { profileId: "ph_nope", name: "Nope", role: "PHYSICIAN", schoolId: "sch_f" };
    await expect(campConsentForm(sql, stranger, CAMP)).rejects.toThrow();
  });
});
