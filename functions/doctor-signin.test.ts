// A doctor added in the console, signing in with the number the console
// demanded — against a real Postgres, through the route the app actually calls.
//
// The report: "I have created a doctor record with phone number and trying to
// login with doctors number to the app, failing with error 'The number isn't
// registered. Please contact your school or camp organizer'."
//
// It was true. Adding a doctor wrote a row into `doctors` and nothing else,
// while the OTP route looks for a profile at ph_<last ten digits>. The form
// insisted on a mobile *because* "it is how they receive a code and sign in",
// and then did not make it so. Nothing here tested the join, because the
// directory tests only looked at the directory and the sign-in tests only
// looked at profiles somebody had inserted by hand.
//
// So these tests start at the console and end at the door.

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import pg from "pg";
import type { Sql } from "./common";
import { normalizeMobile, profileIdForPhone } from "./common";
import { serialQuery } from "./pgserial";
import type { Actor } from "./schools";
import { SCHEMA_STEPS } from "./index";
import { migrate } from "./migrate";
import { listDoctors, upsertDoctor } from "./directory";
import { canClinicianSignIn } from "./camps";

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

/**
 * The check the OTP route makes, in one place.
 *
 * Deliberately a copy of index.ts's condition rather than a call into it: what
 * is being tested is that adding a doctor satisfies it, and reaching through
 * the handler would need the whole Firebase and SMS surface stubbed to find
 * that out.
 */
async function doorOpensFor(phone: string) {
  const norm = normalizeMobile(phone);
  if (!norm) return { open: false, why: "not a mobile" };
  const id = profileIdForPhone(norm.last10);
  const rows = await sql`
    SELECT provisioned, role FROM vita_hero.profiles WHERE id = ${id} LIMIT 1`;
  if (rows.length === 0 || rows[0].provisioned !== true) {
    return { open: false, why: "not provisioned" };
  }
  const role = String(rows[0].role || "");
  if (!(await canClinicianSignIn(sql, id, role))) return { open: false, why: "no active camp" };
  return { open: true, why: "", role };
}

const find = async (name: string) => {
  const d = await listDoctors(sql, OPS, "", name);
  return d.doctors.find((x) => x.name === name)!;
};

suite("a doctor added in the console can sign in", () => {
  beforeAll(async () => {
    if (!URL) return;
    const admin = new pg.Client({ connectionString: URL });
    await admin.connect();
    await admin.query("DROP DATABASE IF EXISTS vh_docsignin");
    await admin.query("CREATE DATABASE vh_docsignin");
    await admin.end();
    client = new pg.Client({ connectionString: URL2(URL, "vh_docsignin") });
    await client.connect();
    sql = neonShim(client);
    await migrate(sql, SCHEMA_STEPS, []);
  });
  afterAll(async () => { if (client) await client.end(); });

  test("the reported case: add a doctor, then sign in with that number", async () => {
    const r = await upsertDoctor(sql, OPS, {
      name: "Dr Meera Iyer", specialty: "Paediatrics", phone: "9876500011",
    });
    expect(r.phone).toBe("+919876500011");

    // The whole bug in one assertion. This was { open: false, why: "not
    // provisioned" }, which the app rendered as "This number isn't registered."
    const door = await doorOpensFor("9876500011");
    expect(door.open).toBe(true);
    expect(door.role).toBe("PHYSICIAN");
  });

  test("and the console says so, rather than just showing the number", async () => {
    const d = await find("Dr Meera Iyer");
    expect(d.hasMobile).toBe(true);
    expect(d.canSignIn).toBe(true);
    // No camp yet, and that is fine — "My camps" says a school will assign one.
    expect(d.campCount).toBe(0);
    expect(d.campsEver).toBe(0);
  });

  test("a referral-only entry is added without a sign-in, and is labelled as one", async () => {
    await upsertDoctor(sql, OPS, {
      name: "Dr Referral Only", specialty: "Cardiology", phone: "9876500022",
      canSignIn: false,
    });
    const door = await doorOpensFor("9876500022");
    expect(door.open).toBe(false);

    const d = await find("Dr Referral Only");
    expect(d.hasMobile).toBe(true);
    // The two are different facts now. Before, canSignIn meant "has a mobile",
    // so this row claimed a sign-in it did not have.
    expect(d.canSignIn).toBe(false);
  });

  test("switching it on afterwards is one action, not a re-entry of the record", async () => {
    const before = await find("Dr Referral Only");
    await upsertDoctor(sql, OPS, {
      id: before.id, name: before.name, specialty: before.specialty,
      phone: before.phone, canSignIn: true,
    });
    expect((await doorOpensFor("9876500022")).open).toBe(true);
    expect((await find("Dr Referral Only")).canSignIn).toBe(true);
  });

  test("and off again", async () => {
    const d = await find("Dr Referral Only");
    await upsertDoctor(sql, OPS, {
      id: d.id, name: d.name, specialty: d.specialty, phone: d.phone, canSignIn: false,
    });
    expect((await doorOpensFor("9876500022")).open).toBe(false);
  });

  test("a number that already belongs to a parent is refused, not taken over", async () => {
    await sql`INSERT INTO vita_hero.profiles (id, phone, name, role, provisioned)
              VALUES ('ph_9876500033', '+919876500033', 'Rahul Sharma', 'PARENT', true)`;
    await expect(upsertDoctor(sql, OPS, {
      name: "Dr Clash", specialty: "ENT", phone: "9876500033",
    })).rejects.toThrow(/already registered as a parent/i);

    // The parent is untouched: still a parent, still able to sign in.
    const rows = await sql`SELECT role FROM vita_hero.profiles WHERE id = 'ph_9876500033'`;
    expect(rows[0].role).toBe("PARENT");
  });

  test("a landline is still refused, because it cannot receive the code", async () => {
    await expect(upsertDoctor(sql, OPS, {
      name: "Dr Deskphone", specialty: "ENT", phone: "04023456789",
    })).rejects.toThrow(/landline/i);
  });

  test("a doctor whose camps were all revoked is turned away; one never assigned is not", async () => {
    // Never assigned — the case that used to be treated as "access ended".
    const fresh = await find("Dr Meera Iyer");
    expect(await canClinicianSignIn(sql, profileIdForPhone("9876500011"), "PHYSICIAN")).toBe(true);
    expect(fresh.campsEver).toBe(0);

    // Now give them a camp and revoke it. That is a closed door, and stays one.
    await sql`INSERT INTO vita_hero.schools (id, name, city, partner_code)
              VALUES ('sch_1', 'Silver Oaks', 'Hyderabad', 'SO-1') ON CONFLICT DO NOTHING`;
    await sql`INSERT INTO vita_hero.school_camps (id, school_id, title, date, status)
              VALUES ('sc_1', 'sch_1', 'Annual camp', '2026-08-01', 'PLANNED') ON CONFLICT DO NOTHING`;
    await sql`INSERT INTO vita_hero.camp_staff (id, camp_id, profile_id, staff_role, doctor_id, active)
              VALUES ('cst_1', 'sc_1', ${profileIdForPhone("9876500011")}, 'PHYSICIAN', ${fresh.id}, false)`;

    expect(await canClinicianSignIn(sql, profileIdForPhone("9876500011"), "PHYSICIAN")).toBe(false);
    expect((await doorOpensFor("9876500011")).why).toBe("no active camp");

    const after = await find("Dr Meera Iyer");
    expect(after.campsEver).toBe(1);
    expect(after.campCount).toBe(0);
  });

  test("their sign-in cannot be removed while they are on a live camp", async () => {
    const d = await find("Dr Meera Iyer");
    await sql`UPDATE vita_hero.camp_staff SET active = true WHERE id = 'cst_1'`;
    await expect(upsertDoctor(sql, OPS, {
      id: d.id, name: d.name, specialty: d.specialty, phone: d.phone, canSignIn: false,
    })).rejects.toThrow(/active camp/i);
    // Still able to sign in, because nothing was taken away.
    expect((await doorOpensFor("9876500011")).open).toBe(true);
  });
});
