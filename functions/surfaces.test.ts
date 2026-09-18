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

  test("a doctor belongs in the console, and is told so by name", () => {
    expect(surfaceRefusal("console", "PHYSICIAN", CONSOLE)).toBeNull();
    const r = surfaceRefusal("app", "PHYSICIAN", CONSOLE)!;
    expect(r.code).toBe("WRONG_SURFACE_APP");
    // The whole point. "This number isn't registered" sent a doctor off to
    // argue with a camp organizer about a number that was registered fine.
    expect(r.error).toMatch(/registered as a doctor/i);
    expect(r.error).toContain(CONSOLE);
  });

  test("so do screeners, school administrators and operations", () => {
    for (const role of CONSOLE_ROLES) {
      expect(surfaceRefusal("console", role, CONSOLE), role).toBeNull();
      expect(surfaceRefusal("app", role, CONSOLE)!.code, role).toBe("WRONG_SURFACE_APP");
    }
  });

  test("the two sets do not overlap, which is the point", () => {
    for (const role of APP_ROLES) expect(CONSOLE_ROLES).not.toContain(role);
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
