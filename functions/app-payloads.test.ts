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

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
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
} from "./camps";
import { DESIGNED_CHECKS } from "./clinical";

const URL = process.env.TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;
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
    await migrate(sql, SCHEMA_STEPS, []);

    // ── the admin panel's half, in order ──
    const school = await createSchool(sql, OPS, {
      name: "Silver Oaks", city: "Hyderabad",
      checksOffered: [...DESIGNED_CHECKS],
    });
    const schoolId = school.school.id;
    ADMIN = { profileId: "ph_head", name: "Asha Rao", role: "SCHOOL_ADMIN", schoolId };
    DOC = { profileId: "ph_doc", name: "Dr Rao", role: "SCHOOL_ADMIN", schoolId };
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
    guardianId = g[0].profile_id as string;
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
    await setAttendance(sql, ADMIN, campId, kidId, "PRESENT");
    await saveScreening(sql, ADMIN, campId, kidId, {
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
    await reviewParticipant(sql, OPS, campId, kidId, {
      approve: true,
      recommendation: "Aarav's distance vision needs an eye test within a month, "
        + "and the dental cavities need a dentist. Everything else looked fine.",
    });
    // No SMS in a test: the sender is a parameter precisely so the release
    // path can be exercised without texting anybody.
    await releaseCamp(sql, OPS, campId, async () => ({ ok: true }));

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
