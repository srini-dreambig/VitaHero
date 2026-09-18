// Which numbers can receive a one-time code, and which only look like they can.
//
// This is the check behind every "not a valid mobile number" message in the
// console. It existed as a sentence long before it existed as code: several
// call sites printed it while calling normalizePhone(), which accepts any ten
// digits. A doctor entered with the hospital's landline got a profile, got an
// OTP, and could never sign in, because the code went to a desk phone.

import { describe, expect, test } from "bun:test";
import { isMobile, normalizeMobile, normalizePhone } from "./common";

describe("a number that can receive a code", () => {
  test("an Indian mobile is accepted in every format it gets typed in", () => {
    const want = "+919876543210";
    for (const raw of [
      "9876543210",
      "+91 98765 43210",
      "+919876543210",
      "091-9876543210",
      "98765 43210",
      " 9876543210 ",
    ]) {
      const n = normalizeMobile(raw);
      expect(n, raw).not.toBeNull();
      expect(n!.e164, raw).toBe(want);
      expect(n!.last10, raw).toBe("9876543210");
    }
  });

  test("every Indian mobile prefix is allowed, and only those", () => {
    for (const first of "6789") {
      expect(isMobile(first + "876543210"), first).toBe(true);
    }
    for (const first of "012345") {
      expect(isMobile(first + "876543210"), first).toBe(false);
    }
  });

  test("a landline is refused — this is the one that was getting through", () => {
    // Rainbow Children's Hospital's switchboard, as it appears in the seed
    // data: a perfectly good number that no OTP will ever reach.
    expect(normalizePhone("+914023456789")).not.toBeNull();
    expect(normalizeMobile("+914023456789")).toBeNull();
    expect(isMobile("04023456789")).toBe(false);
  });

  test("nothing, too few digits, and rubbish are all refused", () => {
    for (const raw of ["", "   ", "98765", "abcdefghij", "+91", null, undefined]) {
      expect(isMobile(raw as string), String(raw)).toBe(false);
    }
  });

  test("a non-Indian number is judged on its digits, not on India's rules", () => {
    // +1 415 555 0123 is a real shape of number; the 6-9 rule is about the
    // Indian numbering plan and says nothing about it. Refusing it would be
    // this function inventing a rule it has no basis for.
    const n = normalizeMobile("+14155550123");
    expect(n).not.toBeNull();
    expect(n!.e164).toBe("+14155550123");
  });

  test("a trunk prefix is not a country code", () => {
    // How people actually write their own number in India. This used to come
    // back as +09876543210 — a country code of zero. The last ten digits were
    // right, so the profile id was right and nothing looked wrong; only the
    // number every message was sent to was wrong.
    expect(normalizePhone("09876543210")!.e164).toBe("+919876543210");
    expect(normalizePhone("0919876543210")!.e164).toBe("+919876543210");
    expect(normalizeMobile("09876543210")!.e164).toBe("+919876543210");
    // And the same number reached three different ways is one number.
    const ways = ["9876543210", "09876543210", "+91 98765 43210", "0091 9876543210"];
    expect(new Set(ways.map((w) => normalizePhone(w)!.e164)).size).toBe(1);
  });

  test("it agrees with normalizePhone on everything it accepts", () => {
    for (const raw of ["9876543210", "+919000000001", "+14155550123"]) {
      expect(normalizeMobile(raw)).toEqual(normalizePhone(raw));
    }
  });
});
