// Tests for the roster normalisation helpers.
//
// These are the functions that decide what a school's spreadsheet means, so a
// silent change of behaviour here shows up as wrong children in wrong classes,
// or an invite SMS sent to a number nobody owns. Run with: bun test

import { describe, expect, test } from "bun:test";
import {
  ageFromIsoDob,
  buildStudentRef,
  chunk,
  currentAcademicYear,
  generatePartnerCode,
  normalizeGender,
  normalizePhone,
  parseDob,
  rowField,
  slugify,
  tidyName,
} from "./common";

describe("normalizePhone", () => {
  test("accepts a bare 10-digit Indian mobile", () => {
    expect(normalizePhone("9876543210")).toEqual({ e164: "+919876543210", last10: "9876543210" });
  });

  test("strips the formatting a spreadsheet adds", () => {
    expect(normalizePhone(" 98765-43210 ")?.e164).toBe("+919876543210");
    expect(normalizePhone("(98765) 43210")?.e164).toBe("+919876543210");
  });

  test("keeps an explicit country code", () => {
    expect(normalizePhone("+91 98765 43210")?.e164).toBe("+919876543210");
    expect(normalizePhone("0091 9876543210")?.e164).toBe("+00919876543210");
  });

  test("rejects anything shorter than 10 digits", () => {
    expect(normalizePhone("98765")).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });

  test("last10 is the identity key, so formatting never splits a guardian in two", () => {
    const a = normalizePhone("9876543210");
    const b = normalizePhone("+91-98765-43210");
    expect(a?.last10).toBe(b?.last10 as string);
  });
});

describe("parseDob", () => {
  test("reads ISO dates", () => {
    expect(parseDob("2016-03-14")).toEqual({ iso: "2016-03-14", ambiguous: false });
  });

  test("reads DD/MM/YYYY as day-first", () => {
    expect(parseDob("14/03/2016")).toEqual({ iso: "2016-03-14", ambiguous: false });
  });

  test("flags a date where day and month are both plausible", () => {
    const r = parseDob("03/04/2016");
    expect(r?.iso).toBe("2016-04-03");
    expect(r?.ambiguous).toBe(true);
  });

  test("accepts dot and dash separators", () => {
    expect(parseDob("14.03.2016")?.iso).toBe("2016-03-14");
    expect(parseDob("14-03-2016")?.iso).toBe("2016-03-14");
  });

  test("rejects impossible calendar dates instead of rolling them forward", () => {
    expect(parseDob("31/02/2016")).toBeNull();
    expect(parseDob("32/01/2016")).toBeNull();
    expect(parseDob("14/13/2016")).toBeNull();
  });

  test("reads textual month names", () => {
    expect(parseDob("12 Mar 2016")?.iso).toBe("2016-03-12");
    expect(parseDob("12-March-2016")?.iso).toBe("2016-03-12");
    expect(parseDob("Mar 12, 2016")?.iso).toBe("2016-03-12");
    expect(parseDob("March 12 2016")?.iso).toBe("2016-03-12");
  });

  test("rejects unreadable input", () => {
    expect(parseDob("not a date")).toBeNull();
    expect(parseDob("")).toBeNull();
    expect(parseDob("Rahul")).toBeNull();
  });

  test("does not invent 1 January from a stray year", () => {
    // Date.parse accepts all of these and yields 1 Jan, which would give the
    // child a birthday nobody entered and a wrong growth percentile.
    expect(parseDob("sometime in 2016")).toBeNull();
    expect(parseDob("born 2016")).toBeNull();
    expect(parseDob("2016")).toBeNull();
    expect(parseDob("N/A")).toBeNull();
    expect(parseDob("-")).toBeNull();
  });

  test("rejects a made-up month name", () => {
    expect(parseDob("12 Smarch 2016")).toBeNull();
  });
});

describe("ageFromIsoDob", () => {
  test("counts whole years only", () => {
    const today = new Date();
    const tenYearsAgo = new Date(
      Date.UTC(today.getUTCFullYear() - 10, today.getUTCMonth(), today.getUTCDate())
    );
    expect(ageFromIsoDob(tenYearsAgo.toISOString().slice(0, 10))).toBe(10);
  });

  test("does not round up before the birthday", () => {
    const today = new Date();
    // Ten years ago, one day later in the year: the birthday has not happened.
    const notYet = new Date(
      Date.UTC(today.getUTCFullYear() - 10, today.getUTCMonth(), today.getUTCDate() + 1)
    );
    expect(ageFromIsoDob(notYet.toISOString().slice(0, 10))).toBe(9);
  });

  test("returns a negative age for a future date so the validator can reject it", () => {
    const next = new Date(Date.now() + 400 * 864e5).toISOString().slice(0, 10);
    expect(ageFromIsoDob(next)).toBeLessThan(0);
  });
});

describe("normalizeGender", () => {
  test("maps the spellings a roster actually uses", () => {
    for (const v of ["M", "m", "male", "Boy", "BOY"]) expect(normalizeGender(v)).toBe("Male");
    for (const v of ["F", "female", "Girl", "g"]) expect(normalizeGender(v)).toBe("Female");
  });

  test("blank stays blank so the validator can warn rather than guess", () => {
    expect(normalizeGender("")).toBe("");
    expect(normalizeGender("  ")).toBe("");
  });

  test("anything else becomes Other rather than being dropped", () => {
    expect(normalizeGender("transgender")).toBe("Other");
    expect(normalizeGender("x")).toBe("Other");
  });
});

describe("tidyName", () => {
  test("fixes all-caps and all-lower office exports", () => {
    expect(tidyName("RAHUL SHARMA")).toBe("Rahul Sharma");
    expect(tidyName("rahul sharma")).toBe("Rahul Sharma");
  });

  test("collapses stray whitespace", () => {
    expect(tidyName("  Rahul   Sharma ")).toBe("Rahul Sharma");
  });

  test("leaves correctly mixed-case names alone", () => {
    expect(tidyName("Rahul D'Souza")).toBe("Rahul D'Souza");
    expect(tidyName("Ananya McKenzie")).toBe("Ananya McKenzie");
  });
});

describe("buildStudentRef", () => {
  test("an explicit admission number is the identity", () => {
    expect(buildStudentRef("2026/0412", "9876543210", "Rahul", "2016-03-14")).toBe("sid_2026-0412");
  });

  test("the same admission number is stable across re-uploads that rename the child", () => {
    const a = buildStudentRef("2026/0412", "9876543210", "Rahul Sharma", "2016-03-14");
    const b = buildStudentRef("2026/0412", "9876543210", "Rahul K Sharma", "2016-03-14");
    expect(a).toBe(b);
  });

  test("without one, identity falls back to phone plus name plus dob", () => {
    const ref = buildStudentRef("", "9876543210", "Rahul Sharma", "2016-03-14");
    expect(ref).toBe("auto_9876543210_rahul-sharma_2016-03-14");
  });

  test("two children of one guardian do not collide", () => {
    const a = buildStudentRef("", "9876543210", "Rahul", "2016-03-14");
    const b = buildStudentRef("", "9876543210", "Ananya", "2015-11-02");
    expect(a).not.toBe(b);
  });
});

describe("rowField", () => {
  test("matches headers regardless of case, spaces and punctuation", () => {
    const row = { "Guardian Phone": "9876543210", "Student_Name": "Rahul" };
    expect(rowField(row, "guardianphone")).toBe("9876543210");
    expect(rowField(row, "studentname")).toBe("Rahul");
  });

  test("returns the first alias that matches", () => {
    expect(rowField({ Class: "4" }, "grade", "class", "standard")).toBe("4");
  });

  test("missing or null becomes an empty string", () => {
    expect(rowField({ a: null }, "a")).toBe("");
    expect(rowField({}, "grade")).toBe("");
  });
});

describe("slugify", () => {
  test("produces url-safe keys", () => {
    expect(slugify("Class 4-B")).toBe("class-4-b");
    expect(slugify("  Oakridge International  ")).toBe("oakridge-international");
  });

  test("caps length so generated ids stay bounded", () => {
    expect(slugify("a".repeat(80)).length).toBe(40);
  });
});

describe("generatePartnerCode", () => {
  test("keeps a recognisable prefix from the school name", () => {
    expect(generatePartnerCode("Oakridge")).toMatch(/^OAKR/);
    expect(generatePartnerCode("St Anns")).toMatch(/^STAN/);
  });

  test("the random suffix avoids characters people misread", () => {
    // The prefix comes from the school name and may contain O or I; the four
    // random characters are the part a parent is most likely to mistype.
    for (let i = 0; i < 200; i++) {
      const suffix = generatePartnerCode("Oakridge").slice(4);
      expect(suffix).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);
      expect(suffix).not.toMatch(/[OI01]/);
    }
  });

  test("falls back to a prefix when the name has no letters", () => {
    expect(generatePartnerCode("123")).toMatch(/^SCHL/);
  });
});

describe("currentAcademicYear", () => {
  test("rolls over in June, Indian convention", () => {
    expect(currentAcademicYear(new Date("2026-06-01T00:00:00Z"))).toBe("2026-27");
    expect(currentAcademicYear(new Date("2026-05-31T00:00:00Z"))).toBe("2025-26");
  });

  test("pads the second year to two digits across a century", () => {
    expect(currentAcademicYear(new Date("2099-07-01T00:00:00Z"))).toBe("2099-00");
  });
});

describe("chunk", () => {
  test("splits into fixed sizes with a short tail", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  test("an empty list produces no batches", () => {
    expect(chunk([], 100)).toEqual([]);
  });
});
