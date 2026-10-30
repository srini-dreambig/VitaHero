// A referral is only useful if the family can find a doctor for it. The app
// matches the referral's specialty to the directory's by exact string, so
// every specialty a camp can raise must be one the directory actually has.

import { expect, test } from "bun:test";
import { SPECIALTIES } from "./clinical";
import { REFERRAL_SPECIALTY, referralSpecialty } from "./referrals";

test("every check refers to a specialty the directory lists", () => {
  for (const [check, specialty] of Object.entries(REFERRAL_SPECIALTY)) {
    expect({ check, ok: (SPECIALTIES as readonly string[]).includes(specialty) }).toEqual({ check, ok: true });
  }
});

test("old referrals read back under the directory's own names", () => {
  expect(referralSpecialty("Dental")).toBe("Dentistry");
  expect(referralSpecialty("Nutrition")).toBe("Paediatrics");
  expect(referralSpecialty("Ophthalmology")).toBe("Ophthalmology");
  expect(referralSpecialty("")).toBe("");
  expect(referralSpecialty(null)).toBe("");
});
