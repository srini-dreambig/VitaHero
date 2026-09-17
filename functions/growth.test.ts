// The growth reference exists twice, in two languages.
//
// clinical.ts decides what a screener is told and what the physician reviews.
// GrowthStandards.kt draws the chart a parent sees and labels their child on
// it. They carry the same WHO medians, the same spreads and the same band
// edges, kept in step by hand — and nothing made them agree. A number typed
// into one and not the other means the app tells a family their child is fine
// on a chart while the record says otherwise, which is worse than either
// answer alone.
//
// So this reads both and compares them. It is a text comparison rather than a
// shared module because the two ends cannot import from each other; what it
// buys is that a change to one without the other fails here.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { estimatePercentile, referenceSex } from "./clinical";

const TS = readFileSync(new globalThis.URL("./clinical.ts", import.meta.url), "utf8");
const KT = readFileSync(
  new globalThis.URL(
    "../android/app/src/main/java/com/rork/vitahero/data/GrowthStandards.kt",
    import.meta.url,
  ),
  "utf8",
);

function tsTable(name: string): Array<[number, number]> {
  const body = TS.split(`const ${name}: Ref[] = [`)[1].split("];")[0];
  return [...body.matchAll(/age: (\d+), p50: ([\d.]+)/g)]
    .map((m) => [Number(m[1]), Number(m[2])] as [number, number]);
}
function ktTable(name: string): Array<[number, number]> {
  // The entries are Ref(2, 87.8f) — full of brackets — so the close is the
  // one on its own line, not the first one encountered.
  const body = KT.split(`private val ${name} = listOf(`)[1].split("\n    )")[0];
  return [...body.matchAll(/Ref\((\d+), ([\d.]+)f\)/g)]
    .map((m) => [Number(m[1]), Number(m[2])] as [number, number]);
}

describe("the growth reference, on both sides", () => {
  for (const [ts, kt] of [
    ["HEIGHT_BOYS", "heightBoys"], ["HEIGHT_GIRLS", "heightGirls"],
    ["WEIGHT_BOYS", "weightBoys"], ["WEIGHT_GIRLS", "weightGirls"],
  ] as const) {
    test(`${ts} is the same table as ${kt}`, () => {
      const a = tsTable(ts);
      const b = ktTable(kt);
      expect(a.length).toBe(17);
      expect(b).toEqual(a);
    });
  }

  test("the spreads match", () => {
    expect(TS).toContain("const HEIGHT_SPREAD = 0.045");
    expect(TS).toContain("const WEIGHT_SPREAD = 0.14");
    expect(KT.includes("Metric.HEIGHT -> 0.045f")).toBe(true);
    expect(KT.includes("Metric.WEIGHT -> 0.14f")).toBe(true);
  });

  test("the percentile bands match", () => {
    for (const z of ["-1.88", "-1.04", "1.04", "1.88"]) {
      expect(TS.includes(z)).toBe(true);
      expect(KT.includes(z + "f")).toBe(true);
    }
  });

  test("both sides read a child's sex the same way", () => {
    // The app's copy used to accept "male" but not "m", which is the kind of
    // difference that charts every boy against the girls' reference.
    for (const g of ["Male", "male", "M", "m", "boy", "B"]) {
      expect(referenceSex(g)).toBe("M");
    }
    for (const g of ["Female", "female", "F", "f", "girl", "G"]) {
      expect(referenceSex(g)).toBe("F");
    }
    for (const g of ["", "Other", "prefer not to say", "x"]) {
      expect(referenceSex(g)).toBeNull();
    }
    expect(KT).toContain('if (g.startsWith("b") || g == "male" || g == "m") return "M"');
    expect(KT).toContain('if (g.startsWith("g") || g == "female" || g == "f") return "F"');
  });
});

describe("a child whose sex was not recorded", () => {
  test("is measured against the reference that reads lower, not the girls' one", () => {
    // A fourteen-year-old at 160cm: above the girls' median, below the boys'.
    const asBoy = estimatePercentile(160, 14, "Male", "HEIGHT");
    const asGirl = estimatePercentile(160, 14, "Female", "HEIGHT");
    const unknown = estimatePercentile(160, 14, "", "HEIGHT");
    expect(asGirl).toBeGreaterThan(asBoy);
    // Silently picking the girls' table said "above average" about a child who
    // may be below it. The cautious number is the one a physician should see.
    expect(unknown).toBe(Math.min(asBoy, asGirl));
    expect(unknown).not.toBe(asGirl);
  });

  test("and the rationale says so, so nobody reads it as their own chart", async () => {
    const { proposeFlag } = await import("./clinical");
    const known = proposeFlag(
      { checkType: "Height & weight", detail: { heightCm: 160, weightKg: 45 } },
      { ageYears: 14, gender: "Male" });
    const unknown = proposeFlag(
      { checkType: "Height & weight", detail: { heightCm: 160, weightKg: 45 } },
      { ageYears: 14, gender: "" });
    expect(known.rationale).not.toContain("sex not recorded");
    expect(unknown.rationale).toContain("sex not recorded");
  });
});
