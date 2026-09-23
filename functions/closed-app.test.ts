// The doors a closed programme does not have.
//
// Reported: "This is closed app why Parent is seeing Add kid option still?"
// The add-child path was already gone — from the screen and from the server,
// which answers ROSTER_MANAGED. But it was not the only one of its kind, and
// the others were still open:
//
//   * Google sign-in and an email sign-up form on the sign-in screen, both of
//     which the server refuses, so a parent could only find out by failing.
//   * Email sign-in, which the server still accepted, minting a profile
//     through upsertProfileFromNeonAuth for an account nobody had put on a
//     roster.
//   * A partner code that enrolled a family in a school, and a button that
//     registered a child for a camp — both of them decisions the school makes.
//
// A closed programme has exactly one door for a family: the mobile number
// their school holds. Everything else about their children — which school,
// which camp, which checks — is the roster's to say.

import { describe, expect, test, mock } from "bun:test";

function makeSql(rows: Record<string, unknown>[] = []) {
  const run = () => Promise.resolve(rows);
  const sql: any = (s: TemplateStringsArray | string) => {
    if (typeof s === "string") throw new Error("sql(identifier) is not supported");
    return run();
  };
  sql.query = () => run();
  return sql;
}

let sessionRows: Record<string, unknown>[] = [];
mock.module("@neondatabase/serverless", () => ({ neon: () => makeSql(sessionRows) }));
const { default: worker } = await import("./index");

const ENV = {
  DATABASE_URL: "postgres://stub",
  ADMIN_API_KEY: "test-admin-key",
  TWILIO_ACCOUNT_SID: "",
  TWILIO_AUTH_TOKEN: "",
};

const TOKEN = "tok_parent_" + "x".repeat(32);
/** A signed-in parent, the way authenticateSession resolves one. */
function asParent() {
  sessionRows = [{ id: "ph_9876543210", user_id: "ph_9876543210", name: "Rahul Sharma",
    role: "PARENT", school_id: null }];
}

async function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  const res = await worker.fetch(new Request("https://api.test" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  }), ENV as never);
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

describe("a family has one door, and it is their phone", () => {
  test("children are the school's to add, not the app's", async () => {
    asParent();
    const r = await post("/api/kids", { name: "A child" }, { Authorization: `Bearer ${TOKEN}` });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe("ROSTER_MANAGED");
  });

  test("so is which school a family belongs to", async () => {
    asParent();
    // A partner code typed into the app used to create the enrolment outright.
    const r = await post("/api/schools/enroll", { partner_code: "SO-1" },
      { Authorization: `Bearer ${TOKEN}` });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe("ROSTER_MANAGED");
    // And says what to do instead, rather than only refusing.
    expect(String(r.body.error)).toMatch(/school office/i);
  });

  test("and which children are screened at a camp", async () => {
    asParent();
    const r = await post("/api/school-camps/register",
      { school_camp_id: "sc_1", kid_id: "k_1" }, { Authorization: `Bearer ${TOKEN}` });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe("ROSTER_MANAGED");
    // The thing a parent *is* asked to do is named, so the refusal is not a
    // dead end.
    expect(String(r.body.error)).toMatch(/permission/i);
  });

  test("there is no sign-up", async () => {
    const r = await post("/api/auth/signup",
      { name: "X", email: "x@example.com", password: "secret123" });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe("SIGNUP_DISABLED");
  });

  test("and no email sign-in, which was the second door into the same building",
    async () => {
      // This used to reach Neon Auth and, on success, create a profile for an
      // account no school had ever heard of.
      const r = await post("/api/auth/signin", { email: "x@example.com", password: "secret123" });
      expect(r.status).toBe(403);
      expect(r.body.code).toBe("EMAIL_SIGNIN_DISABLED");
      expect(String(r.body.error)).toMatch(/mobile number your school holds/i);
    });

  test("and no Google sign-in — not disabled, gone", async () => {
    // It used to answer 403 GOOGLE_DISABLED, on the reasoning that an
    // installed copy of the app might still call it. No copy ever shipped
    // with it: the app has never been uploaded to Play, and the client-side
    // chain was removed before it was. So the door is not locked, it is
    // bricked up, and the unmatched-route answer is the honest one.
    const r = await post("/api/auth/google", { idToken: "x" });
    expect(r.status).toBe(404);
    expect(r.body.error).toBe("Not found");
  });

  test("an operator can still sign in by email when the SMS provider is down", async () => {
    // Kept deliberately: the alternative is a deployment nobody can get into.
    const r = await post("/api/auth/signin", { email: "ops@example.com", password: "secret123" },
      { "X-Admin-Key": "test-admin-key" });
    expect(r.body.code).not.toBe("EMAIL_SIGNIN_DISABLED");
  });

  test("staff can still enrol a family from the console", async () => {
    sessionRows = [{ id: "ph_head", user_id: "ph_head", name: "Asha Rao",
      role: "SCHOOL_ADMIN", school_id: "sch_1" }];
    const r = await post("/api/schools/enroll", { partner_code: "SO-1" },
      { Authorization: `Bearer ${TOKEN}` });
    expect(r.body.code).not.toBe("ROSTER_MANAGED");
  });
});
