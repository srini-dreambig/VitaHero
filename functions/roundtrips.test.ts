// Round trips per console operation, against a real database with real rows.
//
// On Cloudflare each query is an outbound subrequest to Neon, so what a console
// page costs the user is not how many queries it runs but how many times it
// waits: reads issued together cost one network latency, reads issued one after
// another cost one each. This measures the waits, against a school with a real
// roster on it, and holds each page to a ceiling — so putting a plain `await`
// back in front of an independent read fails here rather than in production.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import pg from "pg";
import type { Sql } from "./common";
import { serialQuery } from "./pgserial";
import { ensureStageASchema, createSchool, setClasses, type Actor } from "./schools";
import { commitRoster } from "./roster";
import { ensureCampSchema, createCamp, buildCampRoster, adminOverview, campPack, reviewQueue, listParticipants } from "./camps";
import { ensureReferralSchema, referralDashboard } from "./referrals";
import { ensureLifecycleSchema } from "./lifecycle";
import { ensureMediaSchema } from "./media";
import { ensureMessageSchema } from "./messages";
import { ensureOversightSchema } from "./oversight";
import { adminAnalytics } from "./analytics";
import { schoolReport, programmeReport } from "./reports";
import { listRoster } from "./roster";

const URL = process.env.TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;
function URL2(b: string, d: string) { const u = new globalThis.URL(b); u.pathname = "/" + d; return u.toString(); }

let client: pg.Client;
let sql: Sql;
let count = 0;
// A wave is a set of queries in flight at the same time: one network latency.
// Counted at call time, so Promise.all([a, b, c]) is one wave and three
// sequential awaits are three.
let waves = 0;
let inFlight = 0;
// The local driver is a single pg client, which cannot really run two queries
// at once; serialQuery queues them. That does not distort the measurement,
// which counts when a query was *issued*, not when it ran.
let send: (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]>;
const OPS: Actor = { profileId: "ph_ops", name: "Ops", role: "SUPERADMIN", schoolId: null };

function run(text: string, params: unknown[]): Promise<Record<string, unknown>[]> {
  count++;
  if (inFlight === 0) waves++;
  inFlight++;
  return send(text, params).finally(() => { inFlight--; });
}

function shim(c: pg.Client): Sql {
  send = serialQuery(c);
  const fn: any = (strings: TemplateStringsArray | string, ...values: unknown[]) => {
    if (typeof strings === "string") throw new Error("no");
    let text = ""; const params: unknown[] = [];
    for (let i = 0; i < strings.length; i++) {
      text += strings[i];
      if (i < values.length) { params.push(values[i]); text += "$" + params.length; }
    }
    return run(text, params);
  };
  fn.query = (t: string, p: unknown[] = []) => run(t, p);
  return fn as Sql;
}

const STUDENTS = (n: number) => Array.from({ length: n }, (_, i) => ({
  "Admission No": "2026/" + (1000 + i),
  "Student Name": "Child " + i,
  "Date of Birth": "14/03/2016",
  Gender: i % 2 ? "F" : "M",
  Class: "Class " + ((i % 5) + 1),
  Section: "A",
  "Guardian Name": "Guardian " + i,
  "Guardian Phone": String(9811100000 + i),
}));

let schoolId = "";
let campId = "";

suite("round trips per console operation", () => {
  beforeAll(async () => {
    if (!URL) return;
    const admin = new pg.Client({ connectionString: URL });
    await admin.connect();
    await admin.query("DROP DATABASE IF EXISTS vh_cost");
    await admin.query("CREATE DATABASE vh_cost");
    await admin.end();
    client = new pg.Client({ connectionString: URL2(URL, "vh_cost") });
    await client.connect();
    sql = shim(client);
    await client.query("CREATE SCHEMA vita_hero");
    await client.query(`CREATE TABLE vita_hero.profiles (
      id TEXT PRIMARY KEY, user_id TEXT, phone TEXT, name TEXT DEFAULT '', email TEXT,
      session_token TEXT, auth_provider TEXT, role TEXT DEFAULT 'PARENT',
      provisioned BOOLEAN DEFAULT false, school_id TEXT, is_logged_in BOOLEAN DEFAULT false,
      onboarding_complete BOOLEAN DEFAULT false, created_by TEXT DEFAULT '',
      invited_at TIMESTAMPTZ, invite_count INT DEFAULT 0, locale_code TEXT DEFAULT 'en')`);
    await client.query(`CREATE TABLE vita_hero.kids (
      id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, user_id TEXT, name TEXT NOT NULL,
      age INT DEFAULT 0, gender TEXT DEFAULT '', school TEXT DEFAULT '', grade TEXT DEFAULT '',
      height_cm DOUBLE PRECISION DEFAULT 0, weight_kg DOUBLE PRECISION DEFAULT 0,
      overall_score INT DEFAULT 80, dental TEXT DEFAULT 'GOOD', eyesight TEXT DEFAULT 'GOOD',
      nutrition TEXT DEFAULT 'GOOD', last_checkup TEXT DEFAULT '', student_ref TEXT,
      source TEXT DEFAULT 'PARENT')`);
    await client.query(`CREATE UNIQUE INDEX kids_profile_studentref ON vita_hero.kids(profile_id, student_ref) WHERE student_ref IS NOT NULL`);
    await client.query(`CREATE TABLE vita_hero.schools (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, city TEXT DEFAULT '', district TEXT DEFAULT '',
      partner_code TEXT NOT NULL UNIQUE, contact_email TEXT DEFAULT '', description TEXT DEFAULT '',
      active BOOLEAN DEFAULT true)`);
    await client.query(`CREATE TABLE vita_hero.school_camps (
      id TEXT PRIMARY KEY, school_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT DEFAULT '',
      date TEXT NOT NULL, time TEXT DEFAULT '', status TEXT DEFAULT 'DRAFT',
      checks JSONB DEFAULT '[]'::jsonb, grades JSONB DEFAULT '[]'::jsonb, capacity INT DEFAULT 200,
      registered_count INT DEFAULT 0, result_summary TEXT, active BOOLEAN DEFAULT true)`);
    await client.query(`CREATE TABLE vita_hero.school_enrollments (
      id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, school_id TEXT NOT NULL, kid_id TEXT,
      status TEXT DEFAULT 'ACTIVE', enrolled_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE (profile_id, school_id))`);
    await client.query(`CREATE TABLE vita_hero.camp_registrations (
      id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, school_camp_id TEXT NOT NULL, kid_id TEXT,
      UNIQUE (profile_id, school_camp_id, kid_id))`);
    await client.query(`CREATE TABLE vita_hero.camp_kid_results (
      id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, school_camp_id TEXT NOT NULL, kid_id TEXT NOT NULL,
      dental TEXT, eyesight TEXT, nutrition TEXT, height_cm NUMERIC, weight_kg NUMERIC,
      recorded_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE (school_camp_id, kid_id))`);
    await client.query(`CREATE TABLE vita_hero.hospitals (
      id TEXT PRIMARY KEY, name TEXT, city TEXT, district TEXT, address TEXT, lat DOUBLE PRECISION,
      lng DOUBLE PRECISION, phone TEXT, rating DOUBLE PRECISION, is_camp_partner BOOLEAN DEFAULT false,
      active BOOLEAN DEFAULT true)`);
    await client.query(`CREATE TABLE vita_hero.doctors (
      id TEXT PRIMARY KEY, name TEXT, specialty TEXT, hospital TEXT, hospital_id TEXT,
      city TEXT, phone TEXT DEFAULT '', rating DOUBLE PRECISION, active BOOLEAN DEFAULT true)`);
    await ensureStageASchema(sql);
    await ensureCampSchema(sql);
    await ensureReferralSchema(sql);
    await ensureLifecycleSchema(sql);
    await ensureMediaSchema(sql);
    await ensureMessageSchema(sql);
    await ensureOversightSchema(sql);

    const s = await createSchool(sql, OPS, { name: "Measured School", city: "Hyderabad",
      checksOffered: ["Height & weight", "Dental", "Vision"] });
    schoolId = s.school.id;
    await setClasses(sql, OPS, schoolId, { classes: [{ grade: "Class 1", sections: ["A"] },
      { grade: "Class 2", sections: ["A"] }, { grade: "Class 3", sections: ["A"] },
      { grade: "Class 4", sections: ["A"] }, { grade: "Class 5", sections: ["A"] }] });
    await commitRoster(sql, OPS, schoolId, { rows: STUDENTS(400), filename: "r.csv" });
    const camp = await createCamp(sql, OPS, schoolId, { title: "Annual", date: "2026-11-01",
      checks: ["Height & weight", "Dental", "Vision"], grades: ["Class 1","Class 2","Class 3","Class 4","Class 5"] });
    campId = camp.camp.id;
    await buildCampRoster(sql, OPS, campId);
  }, 180_000);
  afterAll(async () => { if (client) await client.end(); });

  test("a 400-child school, measured", async () => {
    // The ceiling is what the page costs today. It is not a target: it is a
    // tripwire. Raising one means a page got slower for every user of it, so
    // it belongs in the same commit as the reason.
    //
    // Where a ceiling is 2 rather than 1, the first wait is the access check.
    // That one stays sequential on purpose: a caller who is not allowed near a
    // camp should not cause the camp's rows to be read at all, and saving a
    // network hop is not worth reading a child's record first and deciding
    // afterwards. The school report's 3 is a real chain — the school row names
    // the academic year, the year selects the camps, the camps drive the rest.
    const ops: Array<[string, number, () => Promise<unknown>]> = [
      ["ops overview",        1, () => adminOverview(sql, OPS)],
      ["ops analytics",       1, () => adminAnalytics(sql, OPS)],
      ["school roster (500)", 1, () => listRoster(sql, OPS, schoolId, "", "", 500, 0)],
      ["camp participants",   2, () => listParticipants(sql, OPS, campId, {})],
      ["camp pack (offline)", 2, () => campPack(sql, OPS, campId)],
      ["review queue",        2, () => reviewQueue(sql, OPS, campId)],
      ["school report",       3, () => schoolReport(sql, OPS, schoolId, "")],
      ["programme report",    2, () => programmeReport(sql, OPS, "")],
      ["referral dashboard",  1, () => referralDashboard(sql, OPS, schoolId, {})],
    ];
    console.log("\n  400 children on the roll, all on one camp\n");
    console.log("  operation              queries   waits      ms");
    console.log("  " + "-".repeat(50));
    const over: string[] = [];
    for (const [label, ceiling, op] of ops) {
      count = 0; waves = 0;
      const t0 = performance.now();
      await op();
      const ms = performance.now() - t0;
      console.log(
        `  ${label.padEnd(22)} ${String(count).padStart(6)}  ${String(waves).padStart(6)}  ${ms.toFixed(0).padStart(6)}`
      );
      if (waves > ceiling) over.push(`${label}: ${waves} waits, ceiling ${ceiling}`);
    }
    console.log("");

    // What actually goes down the wire. The offline pack is the one a screener
    // downloads on a school's wifi before going into a hall with no signal, so
    // its size is a field problem, not a cosmetic one.
    const pack = JSON.stringify(await campPack(sql, OPS, campId));
    const roster = JSON.stringify(await listRoster(sql, OPS, schoolId, "", "", 500, 0));
    const kb = (x: string) => (new TextEncoder().encode(x).length / 1024).toFixed(1);
    console.log(`  camp pack for 400 children:   ${kb(pack)} KiB`);
    console.log(`  roster page of 400:           ${kb(roster)} KiB`);
    console.log("");
    // A pack that grows past this is no longer something to hand a phone on a
    // school's wifi, and the reason belongs in the same commit as the change.
    expect(new TextEncoder().encode(pack).length).toBeLessThan(600 * 1024);

    expect(over).toEqual([]);
  }, 120_000);
});
