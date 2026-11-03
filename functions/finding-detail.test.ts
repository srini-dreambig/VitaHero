// No clinician screen shows the birth history and lab orders older records carry.

import { describe, expect, test } from "bun:test";
import { findingDetail } from "./camps";

describe("finding detail", () => {
  const stored = { rightAcuity: "6/6", history: { birth: "Term" }, investigations: { cbc: true } };

  test("vision and dental drop the history and lab orders", () => {
    expect(findingDetail("Vision", stored)).toEqual({ rightAcuity: "6/6" });
    expect(findingDetail("Dental", { hygiene: "Good", history: {} })).toEqual({ hygiene: "Good" });
  });

  test("the physician's growth record drops them too", () => {
    expect(findingDetail("Height & weight", { heightCm: "132", history: { birth: "Term" }, investigations: {} }))
      .toEqual({ heightCm: "132" });
  });

  test("no detail reads as empty", () => {
    expect(findingDetail("Vision", null)).toEqual({});
  });
});
