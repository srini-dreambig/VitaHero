// Every call the console makes, against the routes the worker serves.
//
// The mirror of app-routes.test.ts. The admin console is a single HTML string
// built by portal.ts with no build step and no type checking across the
// network boundary, so a renamed route is invisible until somebody presses the
// button — and /api/admin/lookup shipped exactly that way: written, guarded
// behind the wrong condition, and answering "Not found" in production while
// every test passed.
//
// The call list is parsed out of portal.ts rather than written here, so it
// cannot fall behind the console it is meant to be testing.

import { describe, expect, test, mock } from "bun:test";
import { readFileSync } from "node:fs";

/**
 * Every path the console asks for, with the interpolated ids filled in.
 *
 * api("/api/admin/camps/" + id + "/review/" + kidId) is one call with two
 * variables in it; what matters is the shape, so each variable becomes a
 * sample id and the shape is what gets driven.
 */
function consoleCalls(): string[] {
  const src = readFileSync("./portal.ts", "utf8");
  const out = new Set<string>();
  for (const m of src.matchAll(/api\(\s*("(?:[^"\\]|\\.)*"(?:\s*\+\s*[^,)]+)*)/g)) {
    let path = "";
    for (const part of m[1].split(/\s*\+\s*/)) {
      const p = part.trim();
      path += p.startsWith('"') && p.endsWith('"') ? p.slice(1, -1) : "sample";
      }
    path = path.split("?")[0].replace(/(sample)+/g, "sample");
    // A trailing variable with no "/" before it is a query string being
    // appended — api("/api/admin/doctors" + qs) — not another path segment.
    path = path.replace(/([^/])sample$/, "$1");
    // A segment that is only a variable cannot be resolved by reading the
    // source: api("/api/admin/" + kind + "/" + id) is two or three different
    // routes depending on what `kind` holds at the time. Those shapes are
    // covered by the concrete calls elsewhere in this list, and driving
    // "/api/admin/sample" would only assert that a made-up URL 404s.
    if (!path.startsWith("/api/") || /^\/api\/admin\/sample/.test(path)) continue;
    out.add(path);
  }
  return [...out].sort();
}

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
const OPS = { "X-Admin-Key": "test-admin-key", "Content-Type": "application/json" };

/**
 * Every method the console might use on a path.
 *
 * portal.ts carries the method in an options object that is awkward to pair
 * with the path, and it does not matter: what is being asked is whether this
 * URL reaches any handler at all. If every verb answers "Not found", no button
 * on that screen works.
 */
const VERBS = ["GET", "POST", "PATCH", "PUT", "DELETE"];

async function anyVerbRoutes(path: string) {
  for (const method of VERBS) {
    const init: RequestInit = { method, headers: OPS };
    if (method !== "GET" && method !== "DELETE") init.body = "{}";
    const res = await worker.fetch(new Request("https://api.test" + path, init), ENV as never);
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    // Exactly the worker's unmatched-route answer, not any 404 containing
    // the words. "Camp not found" is a handler that ran and found nothing —
    // the route is alive, and treating it as dead reported seven working
    // screens as broken the first time this ran.
    if (!(res.status === 404 && body.error === "Not found")) return method;
  }
  return "";
}

describe("the console and the worker are the same product", () => {
  const calls = consoleCalls();

  test("portal.ts was actually parsed", () => {
    expect(calls.length).toBeGreaterThan(50);
    // The screens a camp day depends on, spot-checked.
    expect(calls).toContain("/api/admin/camps/sample/screening/sample");
    expect(calls).toContain("/api/admin/camps/sample/release");
  });

  // The two calls the parser cannot resolve, driven by hand.
  //
  // api("/api/admin/" + kind + "/" + id) is retire, and api("/api/admin/" +
  // kind) is restore; `kind` is "hospitals" or "doctors" depending on which
  // row's menu was used. Skipping them silently would leave four buttons
  // untested, so they are written out here — the only hand-written paths in
  // this file, and named as such.
  for (const kind of ["hospitals", "doctors"]) {
    test(`retiring and restoring a ${kind.slice(0, -1)} reaches a handler`, async () => {
      expect(await anyVerbRoutes(`/api/admin/${kind}/sample`), `DELETE /api/admin/${kind}/:id`)
        .not.toBe("");
      expect(await anyVerbRoutes(`/api/admin/${kind}`), `POST /api/admin/${kind}`).not.toBe("");
    });
  }

  for (const path of consoleCalls()) {
    test(`${path} reaches a handler`, async () => {
      const verb = await anyVerbRoutes(path);
      expect(verb, `${path} answers "Not found" for every method`).not.toBe("");
    });
  }
});
