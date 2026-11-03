// Vision and dental records never carry the physician's history and lab orders.

import { describe, expect, test } from "bun:test";
import { findingDetail } from "./camps";

describe("finding detail", () => {
  const stored = { rightAcuity: "6/6", history: { birth: "Term" }, investigations: { cbc: true } };

  test("vision and dental drop the history and lab orders", () => {
    expect(findingDetail("Vision", stored)).toEqual({ rightAcuity: "6/6" });
    expect(findingDetail("Dental", { hygiene: "Good", history: {} })).toEqual({ hygiene: "Good" });
  });

  test("the physician's checks keep them", () => {
    expect(findingDetail("Height & weight", stored)).toEqual(stored);
  });

  test("no detail reads as empty", () => {
    expect(findingDetail("Vision", null)).toEqual({});
  });
});
