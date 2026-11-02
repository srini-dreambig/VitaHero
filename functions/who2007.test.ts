// The WHO 2007 reference has to give the WHO's answer, not one close to it.
//
// who2007-oracle.json is the WHO's own worked survey from anthroplus
// (data-raw/survey_who2007_z.csv): 933 children aged 5-19 with the z-scores
// the WHO's software computed for them. Every one must come out the same to
// the second decimal. The apps carry their own copy of the tables for the
// calculator and chart; those must be the same numbers as here.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  ageInMonths, bmiClass, bmiForAge, lmsAt, nutritionStatus, parseDob, percentileOf, round2, valueAtZ, whoZ,
} from "./who2007";
import { BFA_F, BFA_M, HFA_F, HFA_M, WFA_F, WFA_M } from "./who2007-data";

const read = (rel: string) => readFileSync(new globalThis.URL(rel, import.meta.url), "utf8");
const ORACLE = JSON.parse(read("./who2007-oracle.json")) as Array<
  [number, number | null, number | null, number | null, number | null, number | null]
>;

describe("against the WHO's own survey", () => {
  test("BMI-for-age matches every child exactly, to two decimals", () => {
    let n = 0;
    for (const [sex, age, w, h, , zbfa] of ORACLE) {
      if (zbfa === null || age === null || w === null || h === null) continue;
      const z = round2(whoZ("BFA", sex === 1 ? "M" : "F", age, w / (h / 100) ** 2));
      expect(z).toBe(zbfa);
      n++;
    }
    expect(n).toBeGreaterThan(900);
  });

  test("height-for-age matches every child exactly, to two decimals", () => {
    let n = 0;
    for (const [sex, age, , h, zhfa] of ORACLE) {
      if (zhfa === null || age === null || h === null) continue;
      const z = round2(whoZ("HFA", sex === 1 ? "M" : "F", age, h));
      expect(z).toBe(zhfa);
      n++;
    }
    expect(n).toBeGreaterThan(900);
  });
});

describe("the reference itself", () => {
  test("the median is the WHO's M, so it reads z 0 and the 50th percentile", () => {
    // Boys at 10 years (120 months): M = 16.4433.
    expect(lmsAt("BFA", "M", 120).M).toBeCloseTo(16.4433, 4);
    expect(whoZ("BFA", "M", 120, 16.4433)).toBeCloseTo(0, 6);
    expect(percentileOf(0)).toBe(50);
  });

  test("boys and girls are read against their own curves", () => {
    // The same 14-year-old's BMI is further from the median for a boy.
    const boy = bmiForAge(160, 60, "M", 168)!;
    const girl = bmiForAge(160, 60, "F", 168)!;
    expect(boy.bmi).toBe(girl.bmi);
    expect(boy.bmiZ).not.toBe(girl.bmiZ);
  });

  test("months between rows are interpolated", () => {
    const a = lmsAt("BFA", "F", 100).M, b = lmsAt("BFA", "F", 101).M;
    expect(lmsAt("BFA", "F", 100.5).M).toBeCloseTo((a + b) / 2, 10);
  });

  test("WHO cut-offs, strict at the line", () => {
    expect(bmiClass(-3.01)).toBe("Severely wasted");
    expect(bmiClass(-3)).toBe("Wasted");
    expect(bmiClass(-2.01)).toBe("Wasted");
    expect(bmiClass(-2)).toBe("Normal");
    expect(bmiClass(2)).toBe("Normal");
    expect(bmiClass(2.01)).toBe("Overweight");
    expect(bmiClass(3)).toBe("Overweight");
    expect(bmiClass(3.01)).toBe("Obese");
  });

  test("a thin child is thin before stunted; a short normal-weight child is stunted", () => {
    const short = bmiForAge(118, 21, "M", 120)!; // well under -2 SD for height at 10
    expect(short.stunted).toBe(true);
    expect(nutritionStatus(short)).toBe(short.bmiClass === "Normal" ? "Stunted" : short.bmiClass);
  });
});

describe("weight-for-age", () => {
  test("runs 5 to 10 years, month by month", () => {
    for (const t of [WFA_M, WFA_F]) {
      expect(t.L.length).toBe(61);
      expect(t.M.length).toBe(61);
      expect(t.S.length).toBe(61);
    }
  });

  test("the median reads z 0, for boys and girls", () => {
    expect(whoZ("WFA", "M", 96, WFA_M.M[36])).toBeCloseTo(0, 6);
    expect(whoZ("WFA", "F", 120, WFA_F.M[60])).toBeCloseTo(0, 6);
  });

  test("restricted past +/-3 SD, like BMI-for-age", () => {
    const { L, M, S } = lmsAt("WFA", "M", 96);
    const sd3 = valueAtZ(L, M, S, 3), sd2 = valueAtZ(L, M, S, 2);
    // One 2-to-3 SD gap past the +3 line reads exactly +4.
    expect(whoZ("WFA", "M", 96, sd3 + (sd3 - sd2))).toBeCloseTo(4, 6);
    const sdm3 = valueAtZ(L, M, S, -3), sdm2 = valueAtZ(L, M, S, -2);
    expect(whoZ("WFA", "M", 96, sdm3 - (sdm2 - sdm3))).toBeCloseTo(-4, 6);
  });

  test("on the reading to 10 years, null after", () => {
    const at10 = bmiForAge(138, 32, "F", 120)!;
    expect(at10.weightZ).not.toBeNull();
    expect(at10.weightPercentile).toBe(percentileOf(at10.weightZ!));
    const past = bmiForAge(140, 33, "F", 121.5)!;
    expect(past.weightZ).toBeNull();
    expect(past.weightPercentile).toBeNull();
  });
});

describe("age", () => {
  const on = new Date(Date.UTC(2026, 10, 2));
  test("from a date of birth, in WHO months", () => {
    expect(ageInMonths("2016-11-02", null, on)!).toBeCloseTo(120, 1);
    expect(ageInMonths("02-11-2016", null, on)!).toBeCloseTo(120, 1);
    expect(ageInMonths("02/11/2016", null, on)!).toBeCloseTo(120, 1);
  });
  test("whole years read as the middle of that year", () => {
    expect(ageInMonths("", 10, on)).toBe(126);
  });
  test("nothing usable is null, not a guess", () => {
    expect(ageInMonths("", 0, on)).toBeNull();
    expect(ageInMonths("2016-13-40", null, on)).toBeNull();
    expect(parseDob("31-02-2016")).toBeNull();
  });
});

describe("the apps carry the same tables", () => {
  const nums = (s: string) => (s.match(/-?\d+\.\d+|-?\d+(?=\s*,)/g) || []).map(Number);
  const tsAll = [BFA_M, BFA_F, HFA_M, HFA_F, WFA_M, WFA_F].flatMap((t) => [...t.L, ...t.M, ...t.S]);
  test("Android WhoTables.kt", () => {
    const kt = read("../android/app/src/main/java/kallam/healthcare/data/WhoTables.kt");
    expect(nums(kt.slice(kt.indexOf("val BFA_M")))).toEqual(tsAll);
  });
  test("iOS WhoTables.swift", () => {
    const sw = read("../ios/VitaHero/Models/WhoTables.swift");
    expect(nums(sw.slice(sw.indexOf("static let BFA_M")))).toEqual(tsAll);
  });
});

describe("the Height & weight flag reads the WHO reference", () => {
  test("an obese ten-year-old boy (above +3 SD) is an alert, with the z-score and percentile shown", async () => {
    const { proposeFlag } = await import("./clinical");
    // BMI 29.2 at 120 months: above +3 SD for boys.
    const p = proposeFlag(
      { checkType: "Height & weight", detail: { heightCm: 120, weightKg: 42 } },
      { ageYears: 10, gender: "Male", dob: "2016-11-02" },
    );
    expect(p.flag).toBe("ALERT");
    expect(p.rationale).toContain("BMI-for-age z +");
    expect(p.rationale).toContain("WHO 2007 boys");
    expect(p.valueText).toContain("Obese");
  });
  test("an overweight boy (+2 to +3 SD) is a watch, with the IAP centiles beside", async () => {
    const { proposeFlag } = await import("./clinical");
    // BMI 23.0 at 120 months: z +2.40, height on the 64th percentile.
    const p = proposeFlag(
      { checkType: "Height & weight", detail: { heightCm: 140, weightKg: 45 } },
      { ageYears: 10, gender: "Male", dob: "2016-11-02" },
    );
    expect(p.flag).toBe("WATCH");
    expect(p.rationale).toContain("overweight (above +2 SD)");
    expect(p.rationale).toContain("IAP 2015 centiles: height 50th–75th, weight 90th–97th, BMI above the 27 AE line");
    expect(p.valueText).toContain("Overweight");
  });
  test("a typical child is good and reads Normal", async () => {
    const { proposeFlag } = await import("./clinical");
    const p = proposeFlag(
      { checkType: "Height & weight", detail: { heightCm: 138, weightKg: 31 } },
      { ageYears: 10, gender: "Female" },
    );
    expect(p.flag).toBe("GOOD");
    expect(p.valueText).toContain("Normal");
  });
  test("no age, no curve: a watch that says why", async () => {
    const { proposeFlag } = await import("./clinical");
    const p = proposeFlag(
      { checkType: "Height & weight", detail: { heightCm: 138, weightKg: 31 } },
      { ageYears: 0, gender: "Female" },
    );
    expect(p.flag).toBe("WATCH");
    expect(p.rationale).toContain("age not recorded");
  });
});
