// The six routes the other audits could not reach.
//
// write-paths.test.ts covers the writes the school pathway makes, and says at
// the top which routes it leaves out: the ones that only do their work once
// something outside the worker answers. Sign-in needs an SMS provider or
// Firebase. The diet tips and the vision half of food recognition need
// TOOLKIT_URL. Chasing guardians only stamps invited_at once a text has
// actually gone out.
//
// "Needs an external service" is not the same as "cannot be tested", and
// leaving them out left the front door of the product — every way a person
// signs in — audited by nothing that runs a real query. All of it leaves
// through global fetch, so one stub reaches all of it.
//
// The stub answers as the real services do and records what it was asked, so
// these tests can assert the worker sent the right thing and not merely that
// it survived the reply. A request to a host the stub does not recognise is an
// error rather than a default success: a route quietly calling somewhere new
// should fail here, not pass.

import { afterAll, afterEach, beforeAll, describe, expect, test, mock } from "bun:test";
import pg from "pg";
import type { Sql } from "./common";
import { serialQuery } from "./pgserial";
import type { Actor } from "./schools";
import { SCHEMA_STEPS } from "./index";
import { migrate } from "./migrate";
import { addSchoolAdmin, createSchool, setClasses } from "./schools";
import { commitRoster } from "./roster";
import { DESIGNED_CHECKS } from "./clinical";

const URL = process.env.TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;
function URL2(base: string, db: string): string {
  const u = new globalThis.URL(base);
  u.pathname = "/" + db;
  return u.toString();
}

// ── the outside world, written down ──

type Call = { url: string; method: string; body: string };
let calls: Call[] = [];
/** Set to make the next Twilio send fail, the way a bad credential does. */
let smsFails = false;
/** The phone number Firebase will claim the id token belongs to. */
let firebasePhone = "+919876543210";
/** Set to make the toolkit reply with valid JSON in the wrong shape. */
let dietShapeWrong = false;

const realFetch = globalThis.fetch;

function stubFetch() {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
    const method = init?.method || "GET";
    // Twilio is sent a URLSearchParams, not a string. Reading only strings
    // recorded every SMS as an empty body, which made "the code texted is the
    // code stored" pass or fail on nothing at all.
    const raw = init?.body;
    const body = typeof raw === "string" ? raw
      : raw instanceof URLSearchParams ? raw.toString()
      : raw === undefined || raw === null ? "" : String(raw);
    calls.push({ url, method, body });

    // Twilio: the only two answers that matter are "queued" and a 4xx with a
    // message, because the message is what the console shows an operator.
    if (url.includes("api.twilio.com")) {
      if (smsFails) {
        return new Response(JSON.stringify({ message: "The 'From' number is not a valid phone number" }),
          { status: 400, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ sid: "SM_stub", status: "queued" }),
        { status: 201, headers: { "Content-Type": "application/json" } });
    }

    // Firebase identity: accounts:lookup, answering with the phone number the
    // test wants this id token to belong to.
    if (url.includes("identitytoolkit.googleapis.com")) {
      return new Response(JSON.stringify({ users: [{ phoneNumber: firebasePhone }] }),
        { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // The AI toolkit, in the OpenAI chat-completions shape the worker asks for.
    if (url.includes("/chat/completions")) {
      // Only the vision call carries an image_url part. Keying on the word
      // "food" looked reasonable and was wrong: the diet-tip prompt says
      // "iron and protein rich Indian foods", so every tip request was being
      // answered in the food-recognition shape.
      const asked = body.includes("image_url");
      const content = asked
        ? JSON.stringify({ items: [{ name: "Idli & Sambar", confidence: 0.82, kcal: 250 }] })
        // The four keys the worker actually reads. Getting these wrong is how
        // the blank-tip bug below was found: anything else parses fine and
        // leaves every field empty.
        : dietShapeWrong
          ? JSON.stringify({ tips: ["Add a green vegetable to lunch."] })
          : JSON.stringify({
            greeting: "Good morning, Aarav",
            insight: "Three weeks of logged meals is a real habit.",
            suggestion: "Add a green vegetable to lunch four days a week.",
            funFact: "Spinach has more iron per plate than most fruit.",
          });
      return new Response(JSON.stringify({ choices: [{ message: { content } }] }),
        { status: 200, headers: { "Content-Type": "application/json" } });
    }

    throw new Error(`the worker called a host this stub does not know: ${method} ${url}`);
  }) as typeof fetch;
}

let client: pg.Client;
let sql: Sql;
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

// Configured, unlike everywhere else: that is the whole point of this file.
const ENV = {
  DATABASE_URL: "postgres://live",
  ADMIN_API_KEY: "test-admin-key",
  TWILIO_ACCOUNT_SID: "AC_stub_account",
  TWILIO_AUTH_TOKEN: "stub_token",
  TWILIO_FROM: "+15550000000",
  TOOLKIT_URL: "https://toolkit.test",
  TOOLKIT_SECRET_KEY: "stub_key",
  FIREBASE_API_KEY: "stub_firebase_key",
  INVITE_SIGNING_KEY: "stub_invite_key",
};

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
const GUARDIAN_PHONE = "9876543210";
// The SMS code and the app are two different doors on purpose: a parent is
// told to use the app's Firebase code, and only console roles get an SMS OTP.
// So the OTP tests sign in as a head teacher, and the Firebase ones as a
// parent. Getting that the wrong way round is how this file started.
const HEAD_PHONE = "9123400009";
let schoolId = "", kidId = "", guardianId = "", headId = "";

async function call(method: string, path: string, body?: unknown, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token === "ops") headers["X-Admin-Key"] = "test-admin-key";
  else if (token) headers.Authorization = "Bearer " + token;
  const res = await worker.fetch(
    new Request("https://api.test" + path, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    }),
    ENV as never,
  );
  const text = await res.text();
  let parsed: any = {};
  try { parsed = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, text: text.slice(0, 300), json: parsed };
}

suite("the routes that need the outside world", () => {
  beforeAll(async () => {
    if (!URL) return;
    const admin = new pg.Client({ connectionString: URL });
    await admin.connect();
    await admin.query("DROP DATABASE IF EXISTS vh_external");
    await admin.query("CREATE DATABASE vh_external");
    await admin.end();
    client = new pg.Client({ connectionString: URL2(URL, "vh_external") });
    await client.connect();
    sql = neonShim(client);
    live = sql;
    await migrate(sql, SCHEMA_STEPS, []);
    stubFetch();

    const school = await createSchool(sql, OPS, {
      name: "Silver Oaks", city: "Hyderabad", checksOffered: [...DESIGNED_CHECKS],
    });
    schoolId = school.school.id;
    const head: Actor = {
      profileId: "ph_head", name: "Asha", role: "SCHOOL_ADMIN", schoolId,
    };
    await setClasses(sql, OPS, schoolId, { grades: ["Class 5"], sections: ["A"] });
    // A roster import is what provisions a guardian, and provisioning is what
    // the closed app checks before it will send anybody a code.
    await commitRoster(sql, head, schoolId, {
      rows: [{
        name: "Aarav Sharma", studentRef: "2026/0412", grade: "Class 5", section: "A",
        gender: "Male", dob: "2016-03-14", guardianName: "Rahul Sharma",
        guardianPhone: GUARDIAN_PHONE,
      }],
    });
    const k = await sql`SELECT id, profile_id FROM vita_hero.kids LIMIT 1`;
    kidId = k[0].id as string;
    guardianId = k[0].profile_id as string;

    const admin2 = await addSchoolAdmin(sql, OPS, schoolId, {
      name: "Asha Rao", phone: HEAD_PHONE,
    });
    headId = (admin2 as any).profileId || (admin2 as any).admin?.profileId || "";
  });
  afterAll(async () => {
    globalThis.fetch = realFetch;
    if (client) await client.end();
  });
  afterEach(() => { calls = []; smsFails = false; dietShapeWrong = false; });

  // ── sign-in: the front door, by all three of its ways in ──

  test("POST /api/auth/phone/send texts a real code to a provisioned number", async () => {
    const r = await call("POST", "/api/auth/phone/send",
      { phone: HEAD_PHONE, surface: "console" });
    expect(r.status, r.text).toBe(200);

    const sms = calls.filter((c) => c.url.includes("api.twilio.com"));
    expect(sms.length, "no text was sent").toBe(1);

    // The code in the database is the code that went out. A flow that stores
    // one and texts another locks every guardian out, and answers 200 doing it.
    const row = await sql`SELECT otp FROM vita_hero.phone_otps LIMIT 1`;
    expect(row.length, "nothing was stored to verify against").toBe(1);
    const otp = String(row[0].otp);
    expect(otp).toMatch(/^\d{4,8}$/);
    const texted = new URLSearchParams(sms[0].body).get("Body") || "";
    expect(texted, "the code texted is not the code stored").toContain(otp);
  });

  test("and the code it stored is the one that signs you in", async () => {
    await call("POST", "/api/auth/phone/send", { phone: HEAD_PHONE, surface: "console" });
    const row = await sql`SELECT otp FROM vita_hero.phone_otps LIMIT 1`;
    const r = await call("POST", "/api/auth/phone/verify",
      { phone: HEAD_PHONE, otp: String(row[0].otp), surface: "console" });
    expect(r.status, r.text).toBe(200);
    expect(typeof r.json.token, "no session token came back").toBe("string");
    expect(String(r.json.token).length).toBeGreaterThan(30);

    const session = await sql`
      SELECT profile_id, surface FROM vita_hero.sessions WHERE token = ${r.json.token}`;
    expect(session.length, "the token handed out has no session row").toBe(1);
    expect(session[0].profile_id).toBe(headId);
    expect(session[0].surface).toBe("console");
  });

  test("a wrong code is refused and the right one still works after it", async () => {
    await call("POST", "/api/auth/phone/send", { phone: HEAD_PHONE, surface: "console" });
    const row = await sql`SELECT otp FROM vita_hero.phone_otps LIMIT 1`;
    const wrong = String(Number(row[0].otp) + 1).padStart(String(row[0].otp).length, "0");
    const bad = await call("POST", "/api/auth/phone/verify",
      { phone: HEAD_PHONE, otp: wrong, surface: "console" });
    expect(bad.status).toBeGreaterThan(399);
    const good = await call("POST", "/api/auth/phone/verify",
      { phone: HEAD_PHONE, otp: String(row[0].otp), surface: "console" });
    expect(good.status, good.text).toBe(200);
  });

  test("a number nobody imported is refused before any text is sent", async () => {
    const r = await call("POST", "/api/auth/phone/send",
      { phone: "9999900000", surface: "console" });
    expect(r.status).toBe(403);
    expect(r.json.code).toBe("NOT_PROVISIONED");
    // The refusal has to come first. Texting a code to somebody who cannot
    // use it costs money and teaches them the app is broken.
    expect(calls.filter((c) => c.url.includes("twilio")).length,
      "a code was texted to an unregistered number").toBe(0);
  });

  test("POST /api/auth/phone/firebase-verify is the door the app really uses", async () => {
    const r = await call("POST", "/api/auth/phone/firebase-verify",
      { idToken: "stub-id-token", surface: "app" });
    expect(r.status, r.text).toBe(200);
    const lookup = calls.filter((c) => c.url.includes("identitytoolkit"));
    expect(lookup.length, "the id token was never checked with Google").toBe(1);
    expect(lookup[0].body).toContain("stub-id-token");

    const session = await sql`
      SELECT profile_id FROM vita_hero.sessions WHERE token = ${r.json.token}`;
    expect(session[0].profile_id).toBe(guardianId);
  });

  test("a Firebase sign-in for an unimported number is refused too", async () => {
    firebasePhone = "+919999900000";
    const r = await call("POST", "/api/auth/phone/firebase-verify",
      { idToken: "stub-id-token", surface: "app" });
    firebasePhone = "+91" + GUARDIAN_PHONE;
    expect(r.status).toBe(403);
    expect(r.json.code).toBe("NOT_PROVISIONED");
  });

  test("POST /api/auth/logout ends the session it was called with", async () => {
    const signIn = await call("POST", "/api/auth/phone/firebase-verify",
      { idToken: "stub-id-token", surface: "app" });
    const token = signIn.json.token as string;

    const out = await call("POST", "/api/auth/logout", {}, token);
    expect(out.status, out.text).toBeLessThan(300);

    // The row stays and is stamped revoked, rather than being deleted — which
    // is right, because "who was signed in when" is worth keeping. So the
    // assertion is the one that matters to a person: the token is refused.
    const after = await sql`
      SELECT revoked_at FROM vita_hero.sessions WHERE token = ${token}`;
    expect(after.length, "the session row vanished instead of being revoked").toBe(1);
    expect(after[0].revoked_at, "logout left the session usable").not.toBeNull();
    const reuse = await call("GET", "/api/kids", undefined, token);
    expect(reuse.status, "a logged-out token still works").toBe(401);
  });

// ── chasing guardians, which only writes once a text has gone out ──

describe("chasing the guardians who have not joined", () => {
  afterEach(() => { calls = []; smsFails = false; });

  test("POST /api/admin/invites/send texts them and stamps the invite", async () => {
    const before = await sql`
      SELECT invite_count FROM vita_hero.profiles WHERE id = ${guardianId}`;
    const r = await call("POST", "/api/admin/invites/send",
      { schoolId, onlyNotJoined: false }, "ops");
    expect(r.status, r.text).toBe(200);
    expect(r.json.sent, "nobody was texted").toBeGreaterThan(0);
    expect(calls.filter((c) => c.url.includes("twilio")).length).toBeGreaterThan(0);

    // The stamp is the half write-paths.test.ts could not reach, because it
    // only happens once a send has actually succeeded. Without it the console
    // cannot tell a guardian who has been chased four times from one nobody
    // has written to, which is the entire purpose of that screen.
    const after = await sql`
      SELECT invited_at, invite_count FROM vita_hero.profiles WHERE id = ${guardianId}`;
    expect(after[0].invited_at, "invited_at was never stamped").not.toBeNull();
    expect(Number(after[0].invite_count))
      .toBe(Number(before[0].invite_count || 0) + 1);
  });

  test("and when the provider refuses, it says why and stamps nobody", async () => {
    smsFails = true;
    const before = await sql`
      SELECT invite_count FROM vita_hero.profiles WHERE id = ${guardianId}`;
    const r = await call("POST", "/api/admin/invites/send",
      { schoolId, onlyNotJoined: false }, "ops");
    expect(r.status, r.text).toBe(200);
    expect(r.json.sent).toBe(0);
    // The provider's own words reach the operator. "Could not reach" on its
    // own sent somebody hunting through mobile numbers for what was a bad
    // From number.
    expect(JSON.stringify(r.json)).toContain("From");
    const after = await sql`
      SELECT invite_count FROM vita_hero.profiles WHERE id = ${guardianId}`;
    expect(Number(after[0].invite_count), "a failed send was counted as an invite")
      .toBe(Number(before[0].invite_count || 0));
  });
});

// ── the two legacy personal-tracking writes ──

describe("the older personal-tracking routes", () => {
  let token = "";
  beforeAll(async () => {
    if (!URL) return;
    const signIn = await call("POST", "/api/auth/phone/firebase-verify",
      { idToken: "stub-id-token", surface: "app" });
    token = signIn.json.token as string;
  });

  test("POST /api/leaderboard ranks within the child's own school", async () => {
    const r = await call("POST", "/api/leaderboard", { current_kid_id: kidId }, token);
    expect(r.status, r.text).toBe(200);
    expect(Array.isArray(r.json.leaderboard) || Array.isArray(r.json.entries)
      || Array.isArray(r.json), `unexpected leaderboard shape: ${r.text}`).toBe(true);
  });

  test("and refuses to rank around a child who is not yours", async () => {
    const other = await sql`
      INSERT INTO vita_hero.kids (id, profile_id, name, school_id, grade, section, age, gender)
      VALUES ('k_not_yours', 'ph_someone_else', 'Not Yours', ${schoolId}, 'Class 5', 'A', 10, 'M')
      RETURNING id`;
    const r = await call("POST", "/api/leaderboard",
      { current_kid_id: other[0].id }, token);
    expect(r.status, "is_you could be pointed at any child in the country").toBe(403);
  });

  test("DELETE /api/appointments/:id removes only the caller's own", async () => {
    await sql`
      INSERT INTO vita_hero.appointments (id, profile_id, kid_name, doctor_name, date, time)
      VALUES ('appt_mine', ${guardianId}, 'Aarav Sharma', 'Dr Rao', '2026-09-01', '10:00'),
             ('appt_theirs', 'ph_someone_else', 'Someone Else', 'Dr Rao', '2026-09-01', '11:00')`;

    const r = await call("DELETE", "/api/appointments/appt_mine", undefined, token);
    expect(r.status, r.text).toBe(200);
    const mine = await sql`SELECT id FROM vita_hero.appointments WHERE id = 'appt_mine'`;
    expect(mine.length, "the caller's own appointment was not removed").toBe(0);

    // The clause that matters is the one nobody sees: another family's row
    // must survive a delete aimed at it.
    const theirs = await call("DELETE", "/api/appointments/appt_theirs", undefined, token);
    expect(theirs.status).toBe(200);
    const left = await sql`SELECT id FROM vita_hero.appointments WHERE id = 'appt_theirs'`;
    expect(left.length, "one family deleted another family's appointment").toBe(1);
  });
});

// ── the toolkit: diet tips and the vision half of food recognition ──
//
// Both are written to degrade quietly when TOOLKIT_URL is unset, which is the
// right behaviour and the reason neither had ever been exercised: every other
// test runs with it unset, so every other test takes the path where these do
// nothing. Configured, they parse somebody else's JSON and write the result.

describe("the routes that call the AI toolkit", () => {
  let token = "";

  beforeAll(async () => {
    if (!URL) return;
    const signIn = await call("POST", "/api/auth/phone/firebase-verify",
      { idToken: "stub-id-token", surface: "app" });
    token = signIn.json.token as string;
    expect(typeof token).toBe("string");
  });
  afterEach(() => { calls = []; dietShapeWrong = false; });

  test("POST /api/ai-diet-tips/generate asks the toolkit and keeps the answer", async () => {
    const r = await call("POST", "/api/ai-diet-tips/generate", { kid_id: kidId }, token);
    expect(r.status, r.text).toBe(201);
    expect(calls.filter((c) => c.url.includes("/chat/completions")).length,
      "the toolkit was never called").toBe(1);

    // Kept, not just returned. The screen reads the stored row on its next
    // open, so a tip that is generated and not written is a tip a family sees
    // once and never again.
    const rows = await sql`
      SELECT content FROM vita_hero.ai_diet_tips WHERE kid_id = ${kidId}`;
    expect(rows.length, "the generated tip was not stored").toBeGreaterThan(0);
  });

  test("and the stored tip is what the app reads back", async () => {
    const r = await call("GET", `/api/ai-diet-tips?kid_id=${kidId}`, undefined, token);
    expect(r.status, r.text).toBe(200);
    expect(JSON.stringify(r.json)).toContain("green vegetable");
  });

  test("a reply in the wrong shape is refused, not stored over a good tip", async () => {
    dietShapeWrong = true;
    const r = await call("POST", "/api/ai-diet-tips/generate", { kid_id: kidId }, token);
    expect(r.status, r.text).toBe(502);
    expect(r.json.code).toBe("TOOLKIT_BAD_SHAPE");

    // The one that matters: the tip the family already had is still there.
    // The insert overwrites on conflict, so storing the empty parse would
    // have replaced good advice with a blank card and answered 201 doing it.
    const back = await call("GET", `/api/ai-diet-tips?kid_id=${kidId}`, undefined, token);
    expect(JSON.stringify(back.json), "a bad reply wiped the stored tip")
      .toContain("green vegetable");
  });

  test("POST /api/food-recognition refuses before the photograph leaves", async () => {
    // The consent gate is the point of this route. It has to be checked before
    // the image is sent anywhere, not after the reply comes back.
    const r = await call("POST", "/api/food-recognition",
      { kid_id: kidId, image_base64: "aGVsbG8=" }, token);
    expect(r.status).toBe(403);
    expect(calls.filter((c) => c.url.includes("/chat/completions")).length,
      "a meal photograph was sent without the guardian's consent").toBe(0);
  });

  test("and sends it once the guardian has said yes", async () => {
    const ok = await call("POST", "/api/me/meal-photo-consent",
      { kidId, granted: true }, token);
    expect(ok.status, ok.text).toBeLessThan(300);

    const r = await call("POST", "/api/food-recognition",
      { kid_id: kidId, image_base64: "aGVsbG8=", mime: "image/jpeg" }, token);
    expect(r.status, r.text).toBe(200);
    const sent = calls.filter((c) => c.url.includes("/chat/completions"));
    expect(sent.length, "the toolkit was not called").toBe(1);
    // The image really travelled, base64 and all, rather than a placeholder.
    expect(sent[0].body).toContain("aGVsbG8=");
    expect(JSON.stringify(r.json)).toContain("Idli");
  });
});
});
