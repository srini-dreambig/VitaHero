// The admin side's output, read the way the app reads it.
//
// Asked: "If app is not talking to admin panel data, what's the meaning
// there?" A route existing is not the same as the app being able to read what
// comes back. A payload that answers 200 with the wrong field names parses
// into a Kotlin data class full of defaults, and the family sees an empty
// screen with no error anywhere — the app cannot tell "nothing to report" from
// "I could not understand you".
//
// So this runs the whole admin side against a real Postgres — school, roster,
// camp, consent request, screening, physician review, release — and then reads
// the result through the field names the app's @Serializable classes declare,
// parsed out of the Kotlin at test time so they cannot drift.

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
import {
  createCamp, buildCampRoster, listParticipants, recordConsent, pendingConsents,
  setAttendance, saveScreening, reviewParticipant, releaseCamp, guardianCampResult,
  addStaffMember, assignCampStaff,
} from "./camps";
import { DESIGNED_CHECKS } from "./clinical";

const URL = process.env.TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;

/**
 * The worker, wired to the same Postgres this test builds.
 *
 * Everything else here calls the functions directly, which is how a route can
 * be right in isolation and unreachable in production. The notification feed
 * is checked through worker.fetch instead — a real HTTP request, the real
 * router, the real session lookup, the real database — because "does the app
 * get the data" is a question about the whole path, not about one function.
 */
let live: Sql | null = null;
mock.module("@neondatabase/serverless", () => ({
  neon: () => {
    const proxy: any = (strings: TemplateStringsArray | string, ...v: unknown[]) => {
      if (!live) throw new Error("database not ready");
      return (live as any)(strings, ...v);
    };
    proxy.query = (t: string, pr: unknown[]) => {
      if (!live) throw new Error("database not ready");
      return live.query(t, pr);
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
function URL2(base: string, db: string): string {
  const u = new globalThis.URL(base);
  u.pathname = "/" + db;
  return u.toString();
}

const DTOS = "../android/app/src/main/java/com/rork/vitahero/data/GuardianDtos.kt";

/**
 * The fields a Kotlin data class declares, in order.
 *
 * Read rather than copied: a DTO renamed in the app must fail here, which is
 * the entire point of the exercise.
 */
function dtoFields(name: string): string[] {
  const src = readFileSync(DTOS, "utf8");
  const at = src.indexOf(`data class ${name}(`);
  if (at < 0) throw new Error(`${name} not found in GuardianDtos.kt — the app has renamed it`);
  const body = src.slice(at + `data class ${name}(`.length, src.indexOf("\n)", at));
  return (body.match(/^\s*val\s+(\w+)\s*:/gm) || [])
    .map((x) => x.replace(/^\s*val\s+/, "").replace(/\s*:$/, ""));
}

/** Which of the app's fields this payload actually fills in. */
function readable(payload: Record<string, unknown>, fields: string[]) {
  const missing = fields.filter((f) => !(f in payload));
  const empty = fields.filter(
    (f) => f in payload && (payload[f] === "" || payload[f] === null ||
      (Array.isArray(payload[f]) && (payload[f] as unknown[]).length === 0)));
  return { missing, empty };
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
let ADMIN: Actor;
let DOC: Actor;
let campId = "";
let kidId = "";
let guardianId = "";
let token = "";

suite("what the admin side releases is what the app can read", () => {
  beforeAll(async () => {
    if (!URL) return;
    const admin = new pg.Client({ connectionString: URL });
    await admin.connect();
    await admin.query("DROP DATABASE IF EXISTS vh_payloads");
    await admin.query("CREATE DATABASE vh_payloads");
    await admin.end();
    client = new pg.Client({ connectionString: URL2(URL, "vh_payloads") });
    await client.connect();
    sql = neonShim(client);
    live = sql;
    await migrate(sql, SCHEMA_STEPS, []);

    // ── the admin panel's half, in order ──
    const school = await createSchool(sql, OPS, {
      name: "Silver Oaks", city: "Hyderabad",
      checksOffered: [...DESIGNED_CHECKS],
    });
    const schoolId = school.school.id;
    ADMIN = { profileId: "ph_head", name: "Asha Rao", role: "SCHOOL_ADMIN", schoolId };
    // A real physician on the school's staff, not a school administrator
    // wearing the name. Clinical work belongs to the clinicians now, so a
    // test that screens as an administrator is testing a path the programme
    // no longer has.
    const doc = await addStaffMember(sql, OPS, schoolId, {
      name: "Dr Rao", phone: "9123455001", role: "PHYSICIAN",
    });
    DOC = { profileId: doc.staff.profileId, name: "Dr Rao", role: "PHYSICIAN", schoolId };
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
    await assignCampStaff(sql, ADMIN, campId, { profileId: DOC.profileId, role: "PHYSICIAN" });

    const parts = await listParticipants(sql, ADMIN, campId, {});
    kidId = parts.participants[0].kidId;
    const g = await sql`SELECT profile_id FROM vita_hero.kids WHERE id = ${kidId}`;
    guardianId = g[0].profile_id as string;

    // A real session row in the real table, so the notification request
    // authenticates the way the app's does rather than through a back door.
    // The worker refuses a token shorter than 30 characters before it even
    // looks, which is worth knowing about when a test says 401.
    token = "tok_payloads_test_" + "x".repeat(32);
    await sql`
      INSERT INTO vita_hero.sessions (token, profile_id, expires_at, device)
      VALUES (${token}, ${guardianId}, ${new Date(Date.now() + 86_400_000).toISOString()}, 'test')`;
    await sql`UPDATE vita_hero.profiles SET session_token = ${token}, is_logged_in = true
              WHERE id = ${guardianId}`;
  });
  afterAll(async () => { if (client) await client.end(); });

  test("the consent request the console raised is readable by the app", async () => {
    const pending = (await pendingConsents(sql, guardianId)).consents;
    expect(pending.length).toBe(1);

    const fields = dtoFields("PendingConsentDto");
    const { missing } = readable(pending[0] as never, fields);
    // A field the app declares and the server never sends parses as a default,
    // and a parent is shown a consent request with no school on it and no way
    // to tell that something went wrong.
    expect(missing, `PendingConsentDto fields the server never sends: ${missing.join(", ")}`)
      .toEqual([]);

    // And the ones a parent actually needs in order to decide.
    const p = pending[0] as Record<string, unknown>;
    expect(p.kidName).toBe("Aarav Sharma");
    expect(p.schoolName).toBe("Silver Oaks");
    expect(p.title).toBe("Annual Health Camp");
    expect(p.checks).toEqual([...DESIGNED_CHECKS]);
  });

  test("the result the physician released is readable by the app", async () => {
    await recordConsent(sql, campId, kidId, "GRANTED", {
      actorId: guardianId, source: "APP", checks: [...DESIGNED_CHECKS],
    });
    await setAttendance(sql, DOC, campId, kidId, "PRESENT");
    await saveScreening(sql, DOC, campId, kidId, {
      findings: [
        { checkType: "Height & weight", detail: { heightCm: 132, weightKg: 28 } },
        { checkType: "Vision", detail: { leftAcuity: "6/18", rightAcuity: "6/6" } },
        { checkType: "Dental", detail: { cariesCount: 2 } },
        { checkType: "Haemoglobin", detail: { hb: 10.2 } },
      ],
    });
    // A physician's approval carries the words a parent actually reads. The
    // server refuses to release without them, which is the right rule and the
    // reason this is spelled out rather than passed as an empty object.
    await reviewParticipant(sql, DOC, campId, kidId, {
      approve: true,
      recommendation: "Aarav's distance vision needs an eye test within a month, "
        + "and the dental cavities need a dentist. Everything else looked fine.",
    });
    // No SMS in a test: the sender is a parameter precisely so the release
    // path can be exercised without texting anybody.
    await releaseCamp(sql, DOC, campId, async () => ({ ok: true }));

    const res = await guardianCampResult(sql, guardianId, campId, kidId);
    const fields = dtoFields("CampResultDto");
    const { missing } = readable(res as never, fields.filter((f) => f !== "message"));
    expect(missing, `CampResultDto fields the server never sends: ${missing.join(", ")}`)
      .toEqual([]);

    expect(res.status).toBe("RELEASED");
    expect(res.kidName).toBe("Aarav Sharma");
    expect(res.schoolName).toBe("Silver Oaks");
    // The recommendation is the physician's words. An empty one is a released
    // result that says nothing, which is what a parent opens the app for.
    expect(String(res.recommendation).length).toBeGreaterThan(10);
  });

  test("every finding the camp recorded arrives in a shape the app renders", async () => {
    const res = await guardianCampResult(sql, guardianId, campId, kidId);
    const fields = dtoFields("ReleasedFindingDto");
    expect(res.findings.length).toBe(DESIGNED_CHECKS.length);

    for (const f of res.findings) {
      const { missing } = readable(f as never, fields);
      expect(missing, `ReleasedFindingDto missing: ${missing.join(", ")}`).toEqual([]);
      // checkType is the key the app lists findings by, so a blank one
      // collapses the whole list onto itself.
      expect(String(f.checkType).length).toBeGreaterThan(0);
      expect(f.flag).not.toBe("NOT_MEASURED");
    }

    // And the four the camp screened are the four that arrived, by name. The
    // app lists them with `key = { it.checkType }`.
    expect(res.findings.map((f) => f.checkType).sort())
      .toEqual([...DESIGNED_CHECKS].sort());
  });

  test("the notification feed carries what the programme did to this family", async () => {
    // It used to read vita_hero.camps — the family's own saved camps — and
    // nothing else, so a consent request, a released result and an open
    // referral all happened in silence. Only an URGENT release sends an SMS, so
    // a parent with a routine finding had a notifications screen that stayed
    // empty while their child's results sat waiting.
    const res = await worker.fetch(
      new Request("https://api.test/api/notifications", {
        headers: { Authorization: `Bearer ${token}` },
      }), ENV as never);
    expect(res.status).toBe(200);
    // A bare array, which is what the app's List<NotificationDto> expects.
    const items = (await res.json()) as Array<{ type: string; body: string }>;
    expect(Array.isArray(items), "the feed is no longer a plain array").toBe(true);
    const types = items.map((n) => n.type);

    // Consent was granted in the test above, so it is no longer pending; the
    // result and the referral are what this family has now.
    expect(types, "a released result is never mentioned").toContain("RESULT");
    const result = items.find((n) => n.type === "RESULT")!;
    expect(result.body).toContain("Aarav Sharma");

    // The physician's vision finding opens a referral, which is the one thing
    // a parent is actually asked to act on.
    expect(types, "an open referral is never mentioned").toContain("REFERRAL");
  });

  test("a parent can actually download everything held about their family", async () => {
    // /api/me/export has been served since data rights were built and the app
    // never called it: the Privacy screen showed the history of rights actions
    // while offering no way to exercise the main one. Driven through the real
    // route, because that is what the screen now does.
    const res = await worker.fetch(
      new Request("https://api.test/api/me/export", {
        headers: { Authorization: `Bearer ${token}` },
      }), ENV as never);
    expect(res.status).toBe(200);
    const dump = (await res.json()) as Record<string, unknown>;

    // The things a family would notice were missing.
    expect(dump.profile).toBeTruthy();
    expect((dump.children as unknown[]).length).toBe(1);
    expect((dump.campFindings as unknown[]).length).toBe(DESIGNED_CHECKS.length);
    expect((dump.consentHistory as unknown[]).length).toBeGreaterThan(0);
    expect(String(dump.notice)).toMatch(/everything VitaHero holds/i);

    // And the export is itself a data-rights action, logged as one.
    const logged = await sql`
      SELECT action FROM vita_hero.data_rights_log WHERE profile_id = ${guardianId}`;
    expect(logged.map((r) => r.action)).toContain("EXPORT");
  });

  test("and it reaches the app's own health tabs, not just the result list", async () => {
    // The camp result screen lists findings generically. The health tabs —
    // Growth, Dental, Eye, Nutrition — are fed from the kid summary instead,
    // and a release that fills one and not the other is a result a parent can
    // read once and never find again.
    const k = await sql`
      SELECT dental, eyesight, nutrition, height_cm, weight_kg
      FROM vita_hero.kids WHERE id = ${kidId}`;
    expect(k[0].eyesight).toBe("WATCH");
    expect(k[0].dental).not.toBe("NOT_MEASURED");
    expect(k[0].nutrition).not.toBe("NOT_MEASURED");
    expect(Number(k[0].height_cm)).toBe(132);
    expect(Number(k[0].weight_kg)).toBe(28);
  });
});
