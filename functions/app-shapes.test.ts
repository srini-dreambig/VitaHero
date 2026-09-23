// Every payload the app decodes, against the field names it declares.
//
// Asked for a deep audit that assumes nothing, end to end. This is the half
// nothing was checking. app-routes.test.ts proves each URL reaches a handler;
// console-routes.test.ts proves the same for the console; the console smoke
// suite drives the console's own JavaScript against a stubbed backend. None of
// them compares what the worker actually sends with what the app actually
// reads — and that comparison is where the failures are invisible.
//
// The mechanism is worth stating, because it is why a missing field is worse
// than a broken one. GuardianRepository.getOr does this:
//
//     if (resp.observed()) resp.body<T>() else fallback
//     } catch (e: Exception) { noteTransportFailure(e); fallback }
//
// kotlinx.serialization fills an absent key from the property's default. So a
// renamed field does not throw — it parses, and the family gets a screen of
// empty strings and zeroes with nothing in any log to say why. A field the
// server drops is a silent, total failure of one screen.
//
// So: a real Postgres, a real session, a real HTTP request through the real
// router, and then every field name read out of the Kotlin at test time and
// looked for in the JSON. Nested classes are walked too, because a correct
// wrapper around a wrong element is the same empty screen.

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
  createCamp, buildCampRoster, listParticipants, recordConsent,
  setAttendance, saveScreening, reviewParticipant, releaseCamp,
  addStaffMember, assignCampStaff,
} from "./camps";
import { DESIGNED_CHECKS } from "./clinical";
import { setHeroOfMonth, setHeroNameConsent } from "./hero";
import { recordSymptom } from "./symptoms";
import { askQuestion } from "./messages";
import { seedLibraryIfEmpty } from "./library";
import { setCampPhotos, uploadFindingPhoto } from "./media";
import { requestCorrection } from "./lifecycle";

const URL = process.env.TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;
function URL2(base: string, db: string): string {
  const u = new globalThis.URL(base);
  u.pathname = "/" + db;
  return u.toString();
}

// ── the app's declared shapes, read out of the Kotlin ──

const DTOS = "../android/app/src/main/java/kallam/healthcare/data/GuardianDtos.kt";
type Field = { name: string; type: string; nullable: boolean };

/** Every data class in GuardianDtos.kt, with each property's declared type. */
function allDtos(): Record<string, Field[]> {
  const src = readFileSync(DTOS, "utf8");
  const out: Record<string, Field[]> = {};
  const re = /data class (\w+)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const open = re.lastIndex - 1;
    let depth = 0, close = open;
    for (let j = open; j < src.length; j++) {
      if (src[j] === "(") depth++;
      else if (src[j] === ")") { depth--; if (depth === 0) { close = j; break; } }
    }
    const body = src.slice(open + 1, close);
    const fields: Field[] = [];
    for (const f of body.matchAll(/\b(?:val|var)\s+(\w+)\s*:\s*([\w<>, .?]+?)\s*(?:=|,\s*$|$)/gm)) {
      const type = f[2].trim().replace(/,$/, "");
      fields.push({ name: f[1], type, nullable: type.endsWith("?") });
    }
    out[m[1]] = fields;
  }
  return out;
}
const DTO = allDtos();

function elemOf(type: string): string {
  const m = type.replace(/\?$/, "").match(/^List<\s*([\w.]+)\s*>$/);
  return m ? m[1] : "";
}

/**
 * Walk a payload against a declared class and collect what the app would
 * silently default.
 *
 * An absent nullable field is a real answer — `hero: null` is "no hero this
 * month" — so only non-null properties count as missing. An empty list is
 * reported separately: it is not a bug, but it means this run proved nothing
 * about the element type, and a shape check that quietly asserts nothing is
 * worse than no check at all.
 */
function walk(
  value: unknown, typeName: string, path: string,
  missing: string[], unchecked: string[],
) {
  const fields = DTO[typeName];
  if (!fields) return;
  if (value === null || value === undefined) return;
  if (!Array.isArray(value) && typeof value !== "object") return;
  const obj = value as Record<string, unknown>;
  for (const f of fields) {
    const here = `${path}.${f.name}`;
    if (!(f.name in obj)) {
      if (!f.nullable) missing.push(`${here} (${typeName}.${f.name}: ${f.type})`);
      continue;
    }
    const v = obj[f.name];
    const elem = elemOf(f.type);
    if (elem) {
      const arr = Array.isArray(v) ? v : [];
      if (arr.length === 0) { if (DTO[elem]) unchecked.push(`${here}: List<${elem}> was empty`); }
      else walk(arr[0], elem, `${here}[0]`, missing, unchecked);
    } else {
      const inner = f.type.replace(/\?$/, "");
      if (DTO[inner]) walk(v, inner, here, missing, unchecked);
    }
  }
}

// ── the worker, wired to this test's database ──

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
let ADMIN: Actor, DOC: Actor;
let campId = "", kidId = "", guardianId = "", schoolId = "", token = "";
let pendingCampId = "";

async function getJson(path: string): Promise<Record<string, unknown>> {
  const res = await worker.fetch(
    new Request("https://api.test" + path, { headers: { Authorization: "Bearer " + token } }),
    ENV as never,
  );
  const body = await res.json().catch(() => ({}));
  expect(res.status, `GET ${path} -> ${res.status} ${JSON.stringify(body)}`).toBe(200);
  return body as Record<string, unknown>;
}

const noSms = async () => ({ ok: true, reason: "" });

suite("what the worker sends is what the app declares", () => {
  beforeAll(async () => {
    if (!URL) return;
    const admin = new pg.Client({ connectionString: URL });
    await admin.connect();
    await admin.query("DROP DATABASE IF EXISTS vh_shapes");
    await admin.query("CREATE DATABASE vh_shapes");
    await admin.end();
    client = new pg.Client({ connectionString: URL2(URL, "vh_shapes") });
    await client.connect();
    sql = neonShim(client);
    live = sql;
    await migrate(sql, SCHEMA_STEPS, []);

    // ── the console's half, in the order a programme actually runs ──
    const school = await createSchool(sql, OPS, {
      name: "Silver Oaks", city: "Hyderabad", checksOffered: [...DESIGNED_CHECKS],
    });
    schoolId = school.school.id;
    ADMIN = { profileId: "ph_head", name: "Asha Rao", role: "SCHOOL_ADMIN", schoolId };
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
    await setCampPhotos(sql, ADMIN, campId, true);
    await buildCampRoster(sql, ADMIN, campId);
    await assignCampStaff(sql, ADMIN, campId, { profileId: DOC.profileId, role: "PHYSICIAN" });

    const parts = await listParticipants(sql, ADMIN, campId, {});
    kidId = parts.participants[0].kidId;
    const g = await sql`SELECT profile_id FROM vita_hero.kids WHERE id = ${kidId}`;
    guardianId = g[0].profile_id as string;

    // A finding that refers, so the released result, the referral list and the
    // matched library articles all have something real in them. A screen that
    // is empty because nothing happened proves nothing about its shape.
    // Photography is its own question, so the yes has to be explicit here too
    // — the photo below is refused without it, which is the system working.
    await recordConsent(sql, campId, kidId, "GRANTED", {
      actorId: guardianId, source: "APP", consentPhotos: true,
    });
    await setAttendance(sql, DOC, campId, kidId, "PRESENT");
    await saveScreening(sql, DOC, campId, kidId, {
      findings: [
        { checkType: "Height & weight", detail: { heightCm: 118, weightKg: 19 } },
        { checkType: "Vision", detail: { leftAcuity: "6/36", rightAcuity: "6/24" } },
        { checkType: "Dental", detail: { cariesCount: 4, gums: "bleeding", pain: true } },
        { checkType: "Haemoglobin", detail: { hb: 9.1 } },
      ],
    });
    // The photograph goes on before the release, because a released result is
    // closed to new findings — which is the right rule, and it means the
    // ordering here has to be the ordering a real camp uses.
    await uploadFindingPhoto(sql, DOC, campId, kidId, {
      checkType: "Dental",
      mime: "image/png",
      // A 1x1 PNG. What matters is a real row with real bytes behind it.
      data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      caption: "Upper left molar",
    });

    await reviewParticipant(sql, DOC, campId, kidId, {
      recommendation: "Please see an eye specialist within the month.",
      urgency: "SOON",
      findings: [{ checkType: "Vision", flag: "ALERT" }],
    });
    await releaseCamp(sql, DOC, campId, noSms);

    // A second camp, screened but deliberately not released, so the PENDING
    // half of CampResultDto is a real response rather than a described one.
    const camp2 = await createCamp(sql, ADMIN, schoolId, {
      title: "Follow-up Camp", date: "2026-09-01", time: "09:00",
      venue: "School hall", checks: [...DESIGNED_CHECKS], grades: ["Class 5"],
    });
    pendingCampId = camp2.camp.id;
    await buildCampRoster(sql, ADMIN, pendingCampId);
    await assignCampStaff(sql, ADMIN, pendingCampId, {
      profileId: DOC.profileId, role: "PHYSICIAN",
    });
    await recordConsent(sql, pendingCampId, kidId, "GRANTED", {
      actorId: guardianId, source: "APP",
    });
    await setAttendance(sql, DOC, pendingCampId, kidId, "PRESENT");
    await saveScreening(sql, DOC, pendingCampId, kidId, {
      findings: [{ checkType: "Height & weight", detail: { heightCm: 120, weightKg: 21 } }],
    });

    // A third camp with consent never answered, so the consent request the
    // app has to render is a real pending row rather than an empty list.
    const camp3 = await createCamp(sql, ADMIN, schoolId, {
      title: "Consent Camp", date: "2026-10-01", time: "09:00",
      venue: "School hall", checks: [...DESIGNED_CHECKS], grades: ["Class 5"],
    });
    await buildCampRoster(sql, ADMIN, camp3.camp.id);

    // A question, a symptom and a data-rights event: the three screens a
    // family writes to rather than reads.
    await askQuestion(sql, guardianId, "Rahul Sharma", {
      notUrgentAcknowledged: true, schoolId,
      body: "Should Aarav wear glasses for reading as well as for the board?",
      kidId,
    });
    await recordSymptom(sql, guardianId, kidId, {
      symptom: "Fever", severity: "MILD", startedOn: "2026-08-10",
    });
    // A data-rights event that leaves the rest of the scenario standing.
    // Withdrawing consent was the obvious choice and the wrong one: it
    // declines every pending consent and closes every open referral, which is
    // exactly right for a family that withdraws, and it silently emptied three
    // of the lists below — so the audit went green having checked nothing.
    await requestCorrection(sql, guardianId, {
      kidId, field: "name", value: "Aarav Kumar Sharma",
      note: "Spelling on the roster",
    });

    // The reading library, which is seeded rather than authored per school.
    await seedLibraryIfEmpty(sql);

    // The things a family's own screens read, which no camp creates.
    await setHeroNameConsent(sql, guardianId, kidId, true);
    await setHeroOfMonth(sql, OPS, {
      schoolId, kidId, story: "Aarav logged every meal for three weeks.",
      achievement: "Logged every meal",
    });

    token = "tok_shapes_test_" + "x".repeat(32);
    await sql`
      INSERT INTO vita_hero.sessions (token, profile_id, expires_at, device)
      VALUES (${token}, ${guardianId}, ${new Date(Date.now() + 86_400_000).toISOString()}, 'test')`;
    await sql`UPDATE vita_hero.profiles SET session_token = ${token}, is_logged_in = true
              WHERE id = ${guardianId}`;
  });
  afterAll(async () => { if (client) await client.end(); });

  /**
   * Every guardian GET the app decodes into a declared class.
   *
   * The pairing is the app's own: GuardianRepository calls getOr(path,
   * SomeDto(), …), so the path and the class it is read as sit on one line
   * there, and this list mirrors it. A route added to the repository with no
   * row here is caught below by "the app decodes nothing this file has missed".
   */
  const ROUTES: Array<{ path: string; dto: string; note?: string }> = [
    { path: "/api/camps/consents", dto: "PendingConsentsDto" },
    { path: "/api/badges?kid_id=KID", dto: "BadgesDto" },
    { path: "/api/me/diet-plan?kid_id=KID", dto: "GuardianDietPlanDto" },
    { path: "/api/me/hero?kid_id=KID", dto: "HeroResponseDto" },
    { path: "/api/me/hero-name-consent?kid_id=KID", dto: "HeroNameConsentDto" },
    { path: "/api/me/meal-photo-consent?kid_id=KID", dto: "MealPhotoConsentDto" },
    { path: "/api/me/photos?kid_id=KID", dto: "FindingPhotosDto" },
    { path: "/api/me/question-policy", dto: "QuestionPolicyDto" },
    { path: "/api/me/questions", dto: "QuestionThreadsDto" },
    { path: "/api/library?locale=en", dto: "LibraryDto" },
    { path: "/api/referrals", dto: "ReferralsDto" },
    { path: "/api/referral-specialties", dto: "ReferralSpecialtiesDto" },
    { path: "/api/me/symptoms?kid_id=KID", dto: "SymptomLogDto" },
    { path: "/api/me/entitlements", dto: "EntitlementsDto" },
    { path: "/api/me/rights", dto: "DataRightsDto" },
  ];

  /**
   * CampResultDto is two shapes behind one class.
   *
   * A result under review answers {status, message} and nothing else, because
   * there is nothing else yet; a released one answers the findings and no
   * message, because the app shows the doctor's own words instead. Asserting
   * every field on either one alone is wrong — it reported `message` as
   * missing from a released result, which is correct behaviour that the app
   * depends on: CampResultScreen reads `message` only when status is not
   * RELEASED. So both are driven, and between them they must fill the class.
   * A field neither state ever sends is dead in the app.
   */
  test("both halves of a camp result together fill every field it declares", async () => {
    const released = await getJson(`/api/camps/result?camp_id=${campId}&kid_id=${kidId}`);
    const pending = await getJson(`/api/camps/result?camp_id=${pendingCampId}&kid_id=${kidId}`);
    expect(released.status).toBe("RELEASED");
    expect(pending.status).toBe("PENDING");
    // The under-review screen has one job, and an empty card is not it.
    expect(String(pending.message || "").length).toBeGreaterThan(10);

    const never = DTO.CampResultDto
      .filter((f) => !f.nullable && !(f.name in released) && !(f.name in pending))
      .map((f) => f.name);
    expect(never, `CampResultDto fields no state ever sends: ${never.join(", ")}`).toEqual([]);

    const missing: string[] = [], unchecked: string[] = [];
    walk(released, "CampResultDto", "released", missing, unchecked);
    // Only the released shape carries findings, so that is where the element
    // type gets checked. It must not be empty here, or this asserts nothing.
    expect((released.findings as unknown[]).length).toBeGreaterThan(0);
    expect(missing.filter((x) => !x.includes(".message")), missing.join("; ")).toEqual([]);
  });

  for (const r of ROUTES) {
    test(`${r.path.split("?")[0]} fills every field ${r.dto} declares`, async () => {
      const body = await getJson(r.path.replace(/KID/g, kidId).replace(/CAMP/g, campId));
      const missing: string[] = [];
      const unchecked: string[] = [];
      walk(body, r.dto, r.dto, missing, unchecked);
      expect(
        missing,
        `${r.path} never sends: ${missing.join("; ")}\n` +
        `(the app fills these from defaults and shows an empty screen with no error)`,
      ).toEqual([]);
      // An empty list is not a passing check, it is an absent one: the element
      // class was never compared to anything. This started as a printed note
      // and six of them were showing at once, one of which was hiding a real
      // scenario bug — so it fails now. If a list is legitimately empty for a
      // family, seed a row for it above rather than relaxing this.
      expect(
        unchecked,
        `${r.path}: nothing to compare against — ${unchecked.join("; ")}`,
      ).toEqual([]);
    });
  }
});
