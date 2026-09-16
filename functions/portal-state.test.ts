// The console's state shape, checked statically.
//
// The console is one long-lived page behind one state object, so the only
// question that matters is what clears it. That used to be answered in three
// places that had to agree and did not — and thirteen fields were never in the
// object at all, because set() creates a key on first use and nothing can clear
// what it does not know about. These two tests keep the shape honest: a field
// used on S must be declared in freshState(), and signing out must rebuild from
// that shape rather than name fields.
//
// Checking reads is enough to catch a field set() invents: a field nothing ever
// reads back as S.<name> is dead, and one that is read is caught here.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const SRC = readFileSync(new URL("./portal.ts", import.meta.url), "utf8");

function freshStateBody(): string {
  const start = SRC.indexOf("function freshState()");
  expect(start).toBeGreaterThan(0);
  const end = SRC.indexOf("var S = freshState();", start);
  expect(end).toBeGreaterThan(start);
  return SRC.slice(start, end);
}

/** Field names read or written as `S.<name>` anywhere in the console. */
function fieldsUsed(): Set<string> {
  return new Set([...SRC.matchAll(/\bS\.([a-zA-Z][A-Za-z0-9]*)/g)].map((m) => m[1]));
}

describe("the console's state shape", () => {
  test("every field the console uses is declared in one place", () => {
    const body = freshStateBody();
    const missing = [...fieldsUsed()].filter((f) => !body.includes(f + ":")).sort();
    expect(missing).toEqual([]);
  });

  test("signing out rebuilds the state rather than naming fields", () => {
    const start = SRC.indexOf("function signOut()");
    const end = SRC.indexOf("\n  }", start);
    const body = SRC.slice(start, end);
    expect(body).toContain("S = freshState()");
    // A hand-written list here is what let forty fields survive a sign-out.
    expect(body).not.toMatch(/S\.\w+\s*=\s*(null|""|\[\])/);
  });

  test("a camp pack never outlives the session that downloaded it", () => {
    const start = SRC.indexOf("function signOut()");
    const end = SRC.indexOf("\n  }", start);
    const body = SRC.slice(start, end);
    // Packs name children, so signing out has to take them off the device.
    expect(body).toContain("PACK_KEY");
    expect(body).toContain("removeItem");
  });
});
