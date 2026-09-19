// Who is allowed through which door.
//
// There are two products behind one sign-in endpoint and they are for
// different people doing different jobs. A parent opens the Android app to
// read their own child's results. A doctor opens the console to review the
// findings of a camp they were assigned to. Neither screen is any use to the
// other, and the app does not even model a role — everyone who gets in is
// `_parentName`, defaulted to the word "Parent".
//
// The endpoint asked one question, "is this number provisioned?", which was
// survivable only while the answer was "parents only". The moment a doctor
// could be provisioned, a doctor could sign in to the family app and be
// greeted as a parent with no children.

import { describe, expect, test } from "bun:test";
import { surfaceOf, surfaceRefusal, APP_ROLES, CONSOLE_ROLES } from "./surfaces";

const CONSOLE = "https://vitahero.example/admin";

describe("which door is whose", () => {
  test("a parent belongs in the app and nowhere else", () => {
    expect(surfaceRefusal("app", "PARENT", CONSOLE)).toBeNull();
    const r = surfaceRefusal("console", "PARENT", CONSOLE)!;
    expect(r.code).toBe("WRONG_SURFACE_CONSOLE");
    // Told where to go, not just turned away.
    expect(r.error).toMatch(/app on your phone/i);
  });

  test("a doctor is admitted to both, because they work in both", () => {
    // The app is where a camp day actually happens: a dentist in a school hall
    // has a phone, not a laptop. The console is where the same person reviews
    // and releases afterwards.
    expect(surfaceRefusal("app", "PHYSICIAN", CONSOLE)).toBeNull();
    expect(surfaceRefusal("console", "PHYSICIAN", CONSOLE)).toBeNull();
  });

  test("and so is a screener, who only ever works a camp day", () => {
    expect(surfaceRefusal("app", "SCREENER", CONSOLE)).toBeNull();
    expect(surfaceRefusal("console", "SCREENER", CONSOLE)).toBeNull();
  });

  test("an administrator is console-only: there is no app screen for that job", () => {
    for (const role of ["SCHOOL_ADMIN", "ADMIN", "SUPERADMIN"]) {
      expect(surfaceRefusal("console", role, CONSOLE), role).toBeNull();
      const r = surfaceRefusal("app", role, CONSOLE)!;
      expect(r.code, role).toBe("WRONG_SURFACE_APP");
      expect(r.error, role).toContain(CONSOLE);
    }
  });

  test("a parent is admitted to the app alone, whoever else is", () => {
    // Widening the app to clinicians must not widen the console to families.
    expect(APP_ROLES).toContain("PARENT");
    expect(CONSOLE_ROLES).not.toContain("PARENT");
  });

  test("a revoked sign-in is nobody's, on either surface", () => {
    expect(surfaceRefusal("app", "REVOKED", CONSOLE)).not.toBeNull();
    expect(surfaceRefusal("console", "REVOKED", CONSOLE)).not.toBeNull();
  });

  test("a client that says nothing is the family app", () => {
    // Every installed copy of the app predates this field. Defaulting the
    // other way would have locked every parent out on the day it shipped;
    // the console is served by the same worker on every load and always
    // says which it is.
    expect(surfaceOf(undefined)).toBe("app");
    expect(surfaceOf("")).toBe("app");
    expect(surfaceOf("nonsense")).toBe("app");
    expect(surfaceOf("console")).toBe("console");
    expect(surfaceOf("CONSOLE")).toBe("console");
  });

  test("a client cannot let itself in by claiming to be the console", () => {
    // Claiming "console" only ever narrows who is admitted. A parent who sent
    // it would be refused, not promoted.
    expect(surfaceRefusal(surfaceOf("console"), "PARENT", CONSOLE)).not.toBeNull();
  });
});
