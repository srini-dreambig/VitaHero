// Finding a number and filtering a directory.
//
// Against a real Postgres, because all three are queries: a LIKE over digits
// stripped out of a stored number, a filter the console never passed, and a
// delete that has to refuse anything carrying clinical records.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import pg from "pg";
import type { Sql } from "./common";
import { serialQuery } from "./pgserial";
import { deleteSchool, schoolFootprint, type Actor } from "./schools";
import { SCHEMA_STEPS } from "./index";
import { migrate, SCHEMA_VERSION } from "./migrate";
import { listDoctors, lookupPhone, upsertDoctor, upsertHospital } from "./directory";

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
const HEAD: Actor = { profileId: "ph_head", name: "Head", role: "SCHOOL_ADMIN", schoolId: "sch_real" };

suite("a brand-new deployment can build its own schema", () => {
  // The gap that hid this: every other database test starts from a legacy
  // schema — chain.test.ts builds one by hand, and the upgrade probes build
  // version 5 with the old code before migrating. On all of those the columns
  // already exist, so an index created one step before the ALTER that adds its
  // column never failed. On a genuinely empty database it did, and the whole
  // migration rolled back: a new deployment could not start.
  test("the whole migration applies to an empty database", async () => {
    if (!URL) return;
    const admin = new pg.Client({ connectionString: URL });
    await admin.connect();
    await admin.query("DROP DATABASE IF EXISTS vh_fresh_build");
    await admin.query("CREATE DATABASE vh_fresh_build");
    await admin.end();

    const c = new pg.Client({ connectionString: URL2(URL, "vh_fresh_build") });
    await c.connect();
    try {
      const fresh = neonShim(c);
      const r = await migrate(fresh, SCHEMA_STEPS, []);
      expect(r.migrated).toBe(true);
      expect(r.version).toBe(SCHEMA_VERSION);
      // And it is genuinely there, not just reported.
      const t = await fresh`
        SELECT COUNT(*)::int AS c FROM information_schema.tables WHERE table_schema = 'vita_hero'`;
      expect(t[0].c as number).toBeGreaterThan(20);
      // Running it again on the same database is a no-op, not a second attempt.
      const again = await migrate(fresh, SCHEMA_STEPS, []);
      expect(again.migrated).toBe(false);
    } finally {
      await c.end();
    }
  });
});

suite("a school that has screened children cannot be deleted", () => {
  // The guard that decides this read the wrong table. vita_hero.camps is the
  // parent app's own list; the programme's camps are in school_camps. The
  // footprint helper swallows a failed count as zero, so every school reported
  // no camps and no findings, and whether it counted as clinical rested on
  // referrals and photographs alone.
  //
  // Run against a database built by the real migration, because the whole bug
  // is about which columns actually exist.
  let c: pg.Client;
  let s2: Sql;

  beforeAll(async () => {
    if (!URL) return;
    const admin = new pg.Client({ connectionString: URL });
    await admin.connect();
    await admin.query("DROP DATABASE IF EXISTS vh_footprint");
    await admin.query("CREATE DATABASE vh_footprint");
    await admin.end();
    c = new pg.Client({ connectionString: URL2(URL, "vh_footprint") });
    await c.connect();
    s2 = neonShim(c);
    await migrate(s2, SCHEMA_STEPS, []);
  });
  afterAll(async () => { if (c) await c.end(); });

  test("a camp that has run is seen, and blocks the delete", async () => {
    await s2`INSERT INTO vita_hero.schools (id, name, city, partner_code)
             VALUES ('sch_busy', 'Busy School', 'Guntur', 'BUSY1')`;
    await s2`INSERT INTO vita_hero.school_camps (id, school_id, title, date, status)
             VALUES ('sc_busy_1', 'sch_busy', 'Annual camp', '2026-08-01', 'RELEASED')`;

    const fp = await schoolFootprint(s2, "sch_busy");
    expect(fp.camps).toBe(1);
    expect(fp.campsRun).toBe(1);
    // No referral was raised and no photograph was taken. Before the fix this
    // school read as having no clinical record whatsoever.
    expect(fp.referrals).toBe(0);
    expect(fp.photos).toBe(0);
    expect(fp.clinical).toBe(true);

    await expect(deleteSchool(s2, OPS, "sch_busy", "Busy School"))
      .rejects.toThrow(/screening records/);
  });

  test("findings are counted through the right camp table", async () => {
    await s2`INSERT INTO vita_hero.camp_findings (id, camp_id, kid_id, check_type, flag)
             VALUES ('cf_1', 'sc_busy_1', 'k_1', 'Vision', 'WATCH')
             ON CONFLICT (id) DO NOTHING`;
    const fp = await schoolFootprint(s2, "sch_busy");
    expect(fp.findings).toBe(1);
  });

  test("a school with nothing on it still deletes, and takes its draft camps", async () => {
    await s2`INSERT INTO vita_hero.schools (id, name, city, partner_code)
             VALUES ('sch_quiet', 'Quiet School', 'Guntur', 'QUIET1')`;
    await s2`INSERT INTO vita_hero.school_camps (id, school_id, title, date, status)
             VALUES ('sc_quiet_1', 'sch_quiet', 'Planned camp', '2027-01-01', 'DRAFT')`;

    const fp = await schoolFootprint(s2, "sch_quiet");
    expect(fp.camps).toBe(1);
    expect(fp.campsRun).toBe(0);
    expect(fp.clinical).toBe(false);

    await deleteSchool(s2, OPS, "sch_quiet", "Quiet School");
    const left = await s2`SELECT COUNT(*)::int AS c FROM vita_hero.schools WHERE id = 'sch_quiet'`;
    expect(left[0].c).toBe(0);
    // And the draft camp went with it rather than being left pointing at a
    // school that no longer exists.
    const camps = await s2`SELECT COUNT(*)::int AS c FROM vita_hero.school_camps WHERE school_id = 'sch_quiet'`;
    expect(camps[0].c).toBe(0);
  });
});

suite("looking a number up and filtering the directory", () => {
  beforeAll(async () => {
    const admin = new pg.Client({ connectionString: URL });
    await admin.connect();
    await admin.query("DROP DATABASE IF EXISTS vh_admin_data");
    await admin.query("CREATE DATABASE vh_admin_data");
    await admin.end();

    client = new pg.Client({ connectionString: URL2(URL!, "vh_admin_data") });
    await client.connect();
    sql = neonShim(client);
    // The worker's own migration, not a hand-written subset of the schema. A
    // test that builds its own tables is testing the tables it built; this one
    // runs the same path a deployment runs, with no demo data seeded.
    await migrate(sql, SCHEMA_STEPS, []);

    await upsertHospital(sql, OPS, {
      id: "h_rainbow", name: "Rainbow Children's Hospital", city: "Hyderabad",
      district: "Banjara Hills", phone: "040 2345 6789",
    });
    await upsertHospital(sql, OPS, {
      id: "h_lvp", name: "LV Prasad Eye Institute", city: "Hyderabad", phone: "040 3061 2345",
    });
    await upsertDoctor(sql, OPS, {
      id: "doc_a", name: "Dr Ananya Rao", specialty: "Paediatrics",
      hospitalId: "h_rainbow", city: "Hyderabad", phone: "98765 43210",
      // Referral-only, because the lookup test below gives this same number to
      // a guardian. A number can only open the door for one person, so a
      // doctor with a sign-in could not share it — which is the rule, not a
      // workaround for it.
      canSignIn: false,
    });
    await upsertDoctor(sql, OPS, {
      id: "doc_m", name: "Dr Meera Iyer", specialty: "Ophthalmology",
      hospitalId: "h_lvp", city: "Hyderabad", phone: "+91 90000 11111",
    });
  });

  afterAll(async () => { if (client) await client.end(); });

  // ── filtering ──────────────────────────────────────────────
  test("doctors can be filtered to one hospital", async () => {
    const all = await listDoctors(sql, OPS, "");
    expect(all.doctors.length).toBe(2);
    const eye = await listDoctors(sql, OPS, "h_lvp");
    expect(eye.doctors.map((d) => d.name)).toEqual(["Dr Meera Iyer"]);
  });

  test("doctors can be searched by name, specialty, city and hospital", async () => {
    const byName = await listDoctors(sql, OPS, "", "ananya");
    expect(byName.doctors.map((d) => d.id)).toEqual(["doc_a"]);
    const bySpecialty = await listDoctors(sql, OPS, "", "ophthalm");
    expect(bySpecialty.doctors.map((d) => d.id)).toEqual(["doc_m"]);
    const byHospital = await listDoctors(sql, OPS, "", "prasad");
    expect(byHospital.doctors.map((d) => d.id)).toEqual(["doc_m"]);
  });

  test("a doctor is found by the last digits of their number, typed any way", async () => {
    // How someone reads a number off a screen, and how they paste one.
    for (const q of ["43210", "98765 43210", "+919876543210", "09876543210"]) {
      const r = await listDoctors(sql, OPS, "", q);
      expect(r.doctors.map((d) => d.id), q).toEqual(["doc_a"]);
    }
  });

  test("the filter and the search narrow together, not separately", async () => {
    // Searching for a Hyderabad doctor inside the eye hospital must not return
    // the paediatrician who is also in Hyderabad.
    const r = await listDoctors(sql, OPS, "h_lvp", "hyderabad");
    expect(r.doctors.map((d) => d.id)).toEqual(["doc_m"]);
  });

  test("every doctor says whether their number can receive a code", async () => {
    await sql`UPDATE vita_hero.doctors SET phone = '04023456789' WHERE id = 'doc_m'`;
    const r = await listDoctors(sql, OPS, "");
    const byId = Object.fromEntries(r.doctors.map((d) => [d.id, d]));
    expect(byId.doc_a.hasMobile).toBe(true);
    // A landline left over from before the rule: still in the directory, and
    // now visibly unable to receive a code rather than looking fine.
    expect(byId.doc_m.hasMobile).toBe(false);
    await sql`UPDATE vita_hero.doctors SET phone = '+919000011111' WHERE id = 'doc_m'`;
  });

  test("and whether they actually have a sign-in, which is a different fact", async () => {
    const byId = Object.fromEntries(
      (await listDoctors(sql, OPS, "")).doctors.map((d) => [d.id, d]));
    // Both have perfectly good mobiles. Only one of them can get in, and the
    // column that used to be here reported the first and implied the second.
    expect(byId.doc_a.hasMobile).toBe(true);
    expect(byId.doc_a.canSignIn).toBe(false);
    expect(byId.doc_m.canSignIn).toBe(true);
  });

  // ── the cross-entity lookup ────────────────────────────────
  test("a number is found wherever it sits, not only where you thought to look", async () => {
    await sql`
      INSERT INTO vita_hero.profiles (id, phone, name, role, is_logged_in)
      VALUES ('ph_9876543210', '+919876543210', 'Rahul Sharma', 'PARENT', true)
      ON CONFLICT (id) DO NOTHING`;

    const r = await lookupPhone(sql, OPS, "9876543210");
    const kinds = r.matches.map((m) => m.kind).sort();
    // The same ten digits are a guardian and a doctor. Finding one and
    // stopping is how the office rings the wrong person back.
    expect(kinds).toEqual(["Doctor (directory)", "Guardian"]);
    expect(r.normalized).toBe("+919876543210");
    expect(r.isMobile).toBe(true);
  });

  test("a hospital switchboard is found, and reported as unable to receive a code", async () => {
    const r = await lookupPhone(sql, OPS, "040 2345 6789");
    expect(r.matches.some((m) => m.kind === "Hospital" && m.name.startsWith("Rainbow"))).toBe(true);
    expect(r.isMobile).toBe(false);
  });

  test("a partial number matches, but not a meaninglessly short one", async () => {
    const r = await lookupPhone(sql, OPS, "43210");
    expect(r.matches.length).toBeGreaterThan(0);
    await expect(lookupPhone(sql, OPS, "43")).rejects.toThrow(/last four digits/);
  });

  test("a school administrator cannot look across every school", async () => {
    await expect(lookupPhone(sql, HEAD, "9876543210")).rejects.toThrow(/operations/i);
  });

});
