// Every call the app makes, against the routes the worker serves.
//
// Asked: "You must look at admin panel and app to have the communication
// between. If app is not taking to admin panel data, what's the meaning
// there?" — which is the right question, and one nothing here was asking.
//
// The console and the app are two halves of one product: a camp is built,
// consent requested, children screened and results released on the admin side,
// and every one of those is worthless unless the family's app can read it. The
// tests either side were written to their own half — chain.test.ts calls the
// guardian functions directly, worker.test.ts stubs the database — so a route
// could be renamed, moved inside the wrong guard, or never written, and both
// halves would stay green while the app got "Not found". That has already
// happened once in this repository, to /api/admin/lookup.
//
// So the list of endpoints is not written here. It is read out of the Kotlin
// the app actually ships, at test time, so it cannot drift from what the app
// really calls.

import { describe, expect, test, mock } from "bun:test";
import { readFileSync } from "node:fs";

const DATA = "../android/app/src/main/java/com/rork/vitahero/data";

/** Every HTTP call in the app's network layer, read off the source. */
function appCalls(): Array<{ method: string; path: string; where: string }> {
  const files = [
    "ApiRepository.kt", "GuardianRepository.kt",
    "LeaderboardService.kt", "FamilySharingService.kt",
    // The clinician's half of the app. It calls /api/admin routes, which is
    // exactly why it belongs in this list: those routes were written for a
    // browser, and nothing else would notice if one moved.
    "ClinicianRepository.kt",
    // The dietician's half. Its own routes rather than the admin ones,
    // because a dietician is not an administrator and the admin router turns
    // away any role outside its staff list.
    "DieticianRepository.kt",
  ];
  const out = new Map<string, { method: string; path: string; where: string }>();

  for (const f of files) {
    const src = readFileSync(`${DATA}/${f}`, "utf8");

    // Direct calls: http.get("$base/api/...")
    for (const m of src.matchAll(/http\.(get|post|put|delete|patch)\(\s*"\$base(\/api\/[^"]*)"/g)) {
      const path = clean(m[2]);
      out.set(m[1].toUpperCase() + " " + path, { method: m[1].toUpperCase(), path, where: f });
    }
    // Guardian helpers: getOr("/api/...", …), postFor("/api/...", …)
    for (const m of src.matchAll(/\b(getOr|getList|postFor|postOr|deleteFor)\w*\(\s*"(\/api\/[^"]*)"/g)) {
      const method = /^(post|delete)/i.test(m[1])
        ? m[1].toLowerCase().startsWith("delete") ? "DELETE" : "POST"
        : "GET";
      const path = clean(m[2]);
      out.set(method + " " + path, { method, path, where: f });
    }
  }
  return [...out.values()].sort((a, b) => (a.path + a.method).localeCompare(b.path + b.method));
}

/**
 * A Kotlin interpolation stands in for an id the app fills at runtime.
 *
 * The id itself does not matter — what is being asked is whether the shape of
 * the URL reaches a handler at all, and a handler that answers 404 because the
 * row is missing has still been reached.
 */
function clean(p: string): string {
  return p.replace(/\$\{[^}]*\}/g, "sample").replace(/\$\w+/g, "sample");
}

// ── the worker, with a database that answers nothing ──
let handlers: unknown[] = [];
function makeSql() {
  const run = () => Promise.resolve([] as Record<string, unknown>[]);
  const sql: any = (strings: TemplateStringsArray | string) => {
    if (typeof strings === "string") throw new Error("sql(identifier) is not supported");
    return run();
  };
  sql.query = () => run();
  return sql;
}
mock.module("@neondatabase/serverless", () => ({ neon: () => makeSql() }));
const { default: worker } = await import("./index");

const ENV = {
  DATABASE_URL: "postgres://stub",
  TWILIO_ACCOUNT_SID: "",
  TWILIO_AUTH_TOKEN: "",
  ADMIN_API_KEY: "test-admin-key",
};

async function reach(method: string, path: string) {
  const init: RequestInit = { method, headers: { "Content-Type": "application/json" } };
  if (method !== "GET" && method !== "DELETE") init.body = "{}";
  const res = await worker.fetch(new Request("https://api.test" + path, init), ENV as never);
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return { status: res.status, error: body.error || "" };
}

describe("the app and the worker are the same product", () => {
  const calls = appCalls();

  test("the app's network layer was actually read", () => {
    // If this drops to nothing the parser has stopped matching and every
    // assertion below would pass by finding no work to do.
    expect(calls.length).toBeGreaterThan(30);
    // A spot check that the guardian half — consent, results, referrals, the
    // reading library — is in the list. Those are the admin side's output.
    const paths = calls.map((c) => c.path);
    for (const p of ["/api/camps/consent", "/api/camps/result", "/api/referrals", "/api/library"]) {
      expect(paths, p).toContain(p);
    }
  });

  for (const c of appCalls()) {
    test(`${c.method} ${c.path} reaches a handler`, async () => {
      const r = await reach(c.method, c.path);
      // 404 with "Not found" is the worker's answer for a URL that matches no
      // route at all. Anything else — 401, 403, 400, a 500 from a stub that
      // returns no rows — means the route exists and the app is talking to it.
      // Exactly the worker's unmatched-route answer. A handler that ran and
      // replied "Camp not found" or "That child is not on this camp's list"
      // is a route that exists, which is what is being asked here.
      const dead = r.status === 404 && r.error === "Not found";
      expect(dead, `${c.method} ${c.path} (called from ${c.where}) hits no route`).toBe(false);
    });
  }
});

// ── one door per person ─────────────────────────────────────
//
// Asked for plainly: authentication for doctors and parents is Firebase OTP,
// and there is no confusion about it. This is that rule, read off the app's
// own network layer so it cannot drift from what ships.
//
// The app used to carry five sign-in calls: Google, email sign-up, email
// sign-in, an SMS OTP send and its verify. None were reachable — the screens
// that called them were never rendered — but the methods were there, the
// buttons existed in unrendered composables, and the server answered three of
// them. Dead plumbing behind a live door is the kind of thing that gets
// reconnected by accident.
describe("the app signs in one way and one way only", () => {
  const auth = appCalls().filter((c) => c.path.startsWith("/api/auth"));

  test("exactly one of them mints a session, and it is the Firebase one", () => {
    const minting = auth
      .filter((c) => c.path !== "/api/auth/me" && c.path !== "/api/auth/logout")
      .map((c) => `${c.method} ${c.path}`);
    expect(minting).toEqual(["POST /api/auth/phone/firebase-verify"]);
  });

  test("and nothing else in the app talks to an auth route", () => {
    // me and logout are session housekeeping, not a way in.
    expect(auth.map((c) => c.path).sort()).toEqual([
      "/api/auth/logout",
      "/api/auth/me",
      "/api/auth/phone/firebase-verify",
    ]);
  });
});
