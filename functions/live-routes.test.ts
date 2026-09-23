// Every GET the console and the app make, against a real Postgres.
//
// app-routes.test.ts and console-routes.test.ts already drive these URLs, but
// against a stub whose sql`` returns [] without ever looking at the query. That
// proves a route is wired. It cannot prove the SQL behind it is a statement
// Postgres will accept, because nothing ever parses it — and a query that the
// planner rejects is a 500 on every call, for every user, forever.
//
// /api/referral-specialties was exactly that. Its SELECT DISTINCT ordered by a
// CASE expression that was not in the select list, which Postgres refuses
// outright. Every route test passed. The app's getOr swallowed the 500 and
// returned an empty ReferralSpecialtiesDto, so the booking screen simply
// offered no specialties and said nothing was wrong.
//
// So this runs the same URLs with a real database behind them and asserts only
// one thing: nothing answers 500. A 400, 403 or 404 from a sample id is a
// handler that ran and disagreed, which is fine. A 500 is the server failing to
// do its own job.
//
// GET only, deliberately. A sweep that fired every verb at every path with an
// empty body would be writing to the database it is auditing, and the read
// paths are where the long SELECTs — the joins, the aggregates, the window
// functions — actually live.

import { afterAll, beforeAll, describe, expect, test, mock } from "bun:test";
import { readFileSync } from "node:fs";
import pg from "pg";
import type { Sql } from "./common";
import { serialQuery } from "./pgserial";
import type { Actor } from "./schools";
import { SCHEMA_STEPS } from "./index";
import { migrate } from "./migrate";
import { createSchool, setClasses } from "./schools";
import { commitRoster } from "./roster";
import { createCamp, buildCampRoster, listParticipants, addStaffMember } from "./camps";
import { DESIGNED_CHECKS } from "./clinical";

const URL = process.env.TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;
function URL2(base: string, db: string): string {
  const u = new globalThis.URL(base);
  u.pathname = "/" + db;
  return u.toString();
}

const DATA = "../android/app/src/main/java/kallam/healthcare/data";

/** Every GET the app's network layer makes, read off the Kotlin. */
function appGets(): string[] {
  const files = [
    "ApiRepository.kt", "GuardianRepository.kt", "LeaderboardService.kt",
    "FamilySharingService.kt", "ClinicianRepository.kt", "DieticianRepository.kt",
  ];
  const out = new Set<string>();
  for (const f of files) {
    const src = readFileSync(`${DATA}/${f}`, "utf8");
    for (const m of src.matchAll(/http\.get\(\s*"\$base(\/api\/[^"]*)"/g)) out.add(clean(m[1]));
    for (const m of src.matchAll(/\b(?:getOr|getList)\w*\(\s*"(\/api\/[^"]*)"/g)) out.add(clean(m[1]));
  }
  return [...out].sort();
}
function clean(p: string): string {
  return p.replace(/\$\{[^}]*\}/g, "sample").replace(/\$\w+/g, "sample").split("?")[0];
}

/** Every path the console asks for, the same parse console-routes.test.ts uses. */
function consoleGets(): string[] {
  const src = readFileSync("./portal.ts", "utf8");
  const out = new Set<string>();
  for (const m of src.matchAll(/\b(?:api|printPage)\(\s*("(?:[^"\\]|\\.)*"(?:\s*\+\s*[^,)]+)*)/g)) {
    let path = "";
    for (const part of m[1].split(/\s*\+\s*/)) {
      const p = part.trim();
      path += p.startsWith('"') && p.endsWith('"') ? p.slice(1, -1) : "sample";
    }
    path = path.split("?")[0].replace(/(sample)+/g, "sample").replace(/([^/])sample$/, "$1");
    if (!path.startsWith("/api/") || /^\/api\/admin\/sample/.test(path)) continue;
    out.add(path);
  }
  return [...out].sort();
}

let live: Sql | null = null;
mock.module("@neondatabase/serverless", () => ({
  neon: () => {
    const proxy: any = (s: TemplateStringsArray | string, ...v: unknown[]) => {
      if (!live) throw new Error("database not ready");
      return (live as any)(s, ...v);
    };
    proxy.query = (t: string, p: unknown[]) => {
      if (!live) throw new Error("database not ready");
      return live.query(t, p);
    };
    return proxy;
  },
}));
const { default: worker } = await import("./index");
const ENV = {
  DATABASE_URL: "postgres://live",
  ADMIN_API_KEY: "test-admin-key",
  TWILIO_ACCOUNT_SID: "",
  TWILIO_AUTH_TOKEN: "",
};

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
let campId = "", kidId = "", schoolId = "", token = "";

/**
 * Real ids in place of the parser's "sample".
 *
 * A handler that stops at "no such camp" never reaches its own SQL, so a sweep
 * of made-up ids would report a clean bill of health for queries it never ran.
 */
function withRealIds(path: string): string {
  let p = path;
  if (p.includes("/camps/")) p = p.replace(/\bsample\b/, campId);
  p = p.replace(/\bsample\b/, kidId);
  return p;
}

async function statusOf(path: string, headers: Record<string, string>): Promise<number> {
  const res = await worker.fetch(
    new Request("https://api.test" + path, { headers }), ENV as never,
  );
  return res.status;
}

suite("no route answers 500 against a real database", () => {
  beforeAll(async () => {
    if (!URL) return;
    const admin = new pg.Client({ connectionString: URL });
    await admin.connect();
    await admin.query("DROP DATABASE IF EXISTS vh_live");
    await admin.query("CREATE DATABASE vh_live");
    await admin.end();
    client = new pg.Client({ connectionString: URL2(URL, "vh_live") });
    await client.connect();
    sql = neonShim(client);
    live = sql;
    await migrate(sql, SCHEMA_STEPS, []);

    const school = await createSchool(sql, OPS, {
      name: "Silver Oaks", city: "Hyderabad", checksOffered: [...DESIGNED_CHECKS],
    });
    schoolId = school.school.id;
    const ADMIN: Actor = { profileId: "ph_head", name: "Asha", role: "SCHOOL_ADMIN", schoolId };
    await addStaffMember(sql, OPS, schoolId, {
      name: "Dr Rao", phone: "9123455001", role: "PHYSICIAN",
    });
    await setClasses(sql, OPS, schoolId, { grades: ["Class 5"], sections: ["A"] });
    await commitRoster(sql, ADMIN, schoolId, {
      rows: [{
        name: "Aarav Sharma", studentRef: "2026/0412", grade: "Class 5", section: "A",
        gender: "Male", dob: "2016-03-14", guardianName: "Rahul Sharma",
        guardianPhone: "9876543210",
      }],
    });
    const camp = await createCamp(sql, ADMIN, schoolId, {
      title: "Annual Health Camp", date: "2026-08-01", time: "09:00",
      venue: "School hall", checks: [...DESIGNED_CHECKS], grades: ["Class 5"],
    });
    campId = camp.camp.id;
    await buildCampRoster(sql, ADMIN, campId);
    const parts = await listParticipants(sql, ADMIN, campId, {});
    kidId = parts.participants[0].kidId;
    const g = await sql`SELECT profile_id FROM vita_hero.kids WHERE id = ${kidId}`;

    token = "tok_live_routes_test_" + "x".repeat(32);
    await sql`
      INSERT INTO vita_hero.sessions (token, profile_id, expires_at, device)
      VALUES (${token}, ${g[0].profile_id}, ${new Date(Date.now() + 86_400_000).toISOString()}, 'test')`;
    await sql`UPDATE vita_hero.profiles SET session_token = ${token}, is_logged_in = true
              WHERE id = ${g[0].profile_id}`;
  });
  afterAll(async () => { if (client) await client.end(); });

  test("both parsers actually found the calls they are reading", () => {
    expect(appGets().length).toBeGreaterThan(15);
    expect(consoleGets().length).toBeGreaterThan(50);
  });

  for (const path of appGets()) {
    test(`app GET ${path}`, async () => {
      const p = withRealIds(path);
      const status = await statusOf(p, { Authorization: "Bearer " + token });
      expect(status, `GET ${p} answered ${status} — the query behind it does not run`)
        .not.toBe(500);
    });
  }

  /**
   * The filtered shapes of the list screens.
   *
   * The sweep above asks for each path bare, and a search box that builds its
   * WHERE clause differently once something is typed is a different statement
   * for Postgres to reject. listGuardians is the reason this exists: it is the
   * most heavily filtered query in the console, and the one that was broken.
   */
  const FILTERED = [
    "/api/admin/guardians?q=aarav",
    "/api/admin/guardians?q=98765",
    "/api/admin/guardians?on_app=yes",
    "/api/admin/guardians?on_app=no",
    "/api/admin/guardians?school_id=SCHOOL",
    "/api/admin/doctors?q=rao",
    "/api/admin/hospitals?q=apollo",
    "/api/admin/schools?q=silver",
    "/api/admin/dieticians?q=rao",
    "/api/admin/lookup?phone=9876543210",
    "/api/admin/invites?school_id=SCHOOL",
    "/api/admin/questions?school_id=SCHOOL",
    "/api/admin/camps/CAMP/participants?q=aarav",
    "/api/admin/access-log?days=30",
  ];
  for (const raw of FILTERED) {
    test(`console GET ${raw}`, async () => {
      const p = raw.replace("SCHOOL", schoolId).replace("CAMP", campId);
      const status = await statusOf(p, { "X-Admin-Key": "test-admin-key" });
      expect(status, `GET ${p} answered ${status} — the filtered query does not run`)
        .not.toBe(500);
    });
  }

  for (const path of consoleGets()) {
    test(`console GET ${path}`, async () => {
      const p = withRealIds(path);
      const status = await statusOf(p, { "X-Admin-Key": "test-admin-key" });
      expect(status, `GET ${p} answered ${status} — the query behind it does not run`)
        .not.toBe(500);
    });
  }
});
