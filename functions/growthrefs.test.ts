// The IAP 2015 charts and the Mramba 2017 MUAC-for-age reference, checked
// against the papers' own printed tables and against the apps' copies.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  iapBand, iapChart, iapLinesAt, iapReading, iapReadings, iapZ, muacLmsAt, muacReading, muacZ, zOfPercent,
  type IapMeasure,
} from "./growthrefs";
import {
  IAP_BMI_F, IAP_BMI_M, IAP_HT_F, IAP_HT_M, IAP_WT_F, IAP_WT_M, MUAC_F, MUAC_M,
} from "./growthrefs-data";
import { muacBand } from "./clinical";

const read = (rel: string) => readFileSync(new globalThis.URL(rel, import.meta.url), "utf8");
const months = (years: number) => Math.round(years * 12);

describe("the IAP 2015 tables, as printed", () => {
  // Rows typed from Tables II-VII of Khadilkar et al., Indian Pediatr 2015,
  // not from the generated file, so a slip in either shows here.
  const printed: Array<[IapMeasure, "M" | "F", number, number[]]> = [
    ["HT", "M", 10, [123.6, 128.1, 132.6, 137.2, 141.9, 146.6, 151.4]],
    ["HT", "F", 18, [146.6, 150.2, 153.9, 157.8, 161.9, 166.1, 170.6]],
    ["WT", "F", 12.5, [27.6, 31.6, 36.3, 41.8, 48.2, 55.8, 64.8]],
    ["BMI", "M", 8, [12.5, 12.8, 13.3, 14.2, 15.5, 16.7, 18.8]],
    ["BMI", "F", 15, [14.7, 15.2, 16.1, 17.8, 19.9, 22.3, 26.3]],
  ];
  test.each(printed)("%s %s at %d years: the chart's lines are the printed centiles", (m, sex, age, row) => {
    expect(iapLinesAt(m, sex, months(age))).toEqual(row);
  });

  test("a child on a printed line reads that line's centile", () => {
    for (const t of [IAP_HT_M, IAP_HT_F, IAP_WT_M, IAP_WT_F, IAP_BMI_M, IAP_BMI_F]) {
      const m: IapMeasure = t === IAP_HT_M || t === IAP_HT_F ? "HT" : t === IAP_WT_M || t === IAP_WT_F ? "WT" : "BMI";
      const sex = t === IAP_HT_M || t === IAP_WT_M || t === IAP_BMI_M ? "M" : "F";
      for (let row = 0; row < 27; row++) {
        t.centiles.forEach((c, k) => {
          expect(iapZ(m, sex, 60 + row * 6, c[row])).toBeCloseTo(zOfPercent(t.percents[k]), 6);
        });
      }
    }
  });

  test("the BMI chart's adult-equivalent lines are the paper's centiles", () => {
    expect(iapChart("BMI", "M").labels).toEqual(["3", "5", "10", "25", "50", "23 AE", "27 AE"]);
    expect(iapChart("BMI", "M").percents.slice(5)).toEqual([71, 90]);
    expect(iapChart("BMI", "F").percents.slice(5)).toEqual([75, 95]);
  });

  test("between half years the lines are read between the two rows", () => {
    // 10 years 3 months: halfway between the 10.0 and 10.5 rows.
    const a = iapLinesAt("HT", "M", 120), b = iapLinesAt("HT", "M", 126);
    iapLinesAt("HT", "M", 123).forEach((v, k) => expect(v).toBeCloseTo((a[k] + b[k]) / 2, 9));
  });

  test("reading rises with the measurement, through the lines and past them", () => {
    for (const m of ["HT", "WT", "BMI"] as IapMeasure[]) {
      const lines = iapLinesAt(m, "F", 150);
      let prev = -Infinity;
      for (let y = lines[0] * 0.7; y <= lines[6] * 1.3; y += lines[3] / 200) {
        const z = iapZ(m, "F", 150, y);
        expect(z).toBeGreaterThan(prev);
        prev = z;
      }
    }
  });

  test("the band names the two lines", () => {
    expect(iapBand("HT", "M", 120, 135)).toBe("25th–50th");
    expect(iapBand("HT", "M", 120, 120)).toBe("below 3rd");
    expect(iapBand("HT", "M", 120, 160)).toBe("above 97th");
    expect(iapBand("BMI", "M", 96, 16)).toBe("50th–23 AE");
    expect(iapBand("BMI", "M", 96, 19)).toBe("above the 27 AE line");
    expect(iapBand("BMI", "F", 180, 23)).toBe("23 AE–27 AE");
  });

  test("a reading on the 50th is the 50th percentile, z 0", () => {
    expect(iapReading("HT", "M", 120, 137.2)).toEqual({ z: 0, percentile: 50, band: "50th–75th" });
  });

  test("no IAP reading under 5 or past 18", () => {
    expect(iapReading("HT", "M", 59, 110)).toBeNull();
    expect(iapReading("HT", "M", 217, 170)).toBeNull();
    expect(iapReadings(170, 60, "M", 216).bmi).not.toBeNull();
  });
});

describe("the Mramba 2017 MUAC-for-age reference", () => {
  test("the authors' L, M, S, by month", () => {
    // datalms5_19 in the authors' MUACz package.
    expect(muacLmsAt("M", 120)).toEqual({ L: -1.978628869, M: 19.90962018, S: 0.112768591 });
    expect(muacLmsAt("F", 180)).toEqual({ L: -1.47071671, M: 24.94701812, S: 0.123780596 });
    expect(MUAC_M.M).toHaveLength(169);
    expect(MUAC_F.M).toHaveLength(169);
  });

  test("a child on the median is z 0; the restriction holds past -3 SD", () => {
    expect(muacReading("M", 120, 19.90962018)).toEqual({ z: 0, percentile: 50 });
    // Each step of the 2-to-3 SD gap below -3 is one more SD.
    const z = muacZ("F", 120, 10);
    expect(z).toBeLessThan(-3);
    expect(muacZ("F", 120, 9)).toBeLessThan(z);
  });

  test("the flag follows the z cut-offs from five, and the WHO cm cut-offs under five", () => {
    // 10-year-old boy: median 19.9 cm.
    expect(muacBand(19.9, 10, "Male").flag).toBe("GOOD");
    const low = muacBand(15.8, 10, "Male");
    expect(low.z!).toBeLessThan(-2);
    expect(low.z!).toBeGreaterThanOrEqual(-3);
    expect(low.flag).toBe("WATCH");
    expect(muacBand(13, 10, "Male").flag).toBe("ALERT");
    // Under five: 11.5 and 12.5 cm.
    expect(muacBand(11.4, 4, "Female").flag).toBe("ALERT");
    expect(muacBand(12.0, 4, "Female").flag).toBe("WATCH");
    expect(muacBand(13.0, 4, "Female").flag).toBe("GOOD");
  });

  test("with no sex recorded, the lower of the two readings is kept", () => {
    // Twelve whole years are read as 12.5, 150 months.
    const m = muacReading("M", 150, 18)!, f = muacReading("F", 150, 18)!;
    expect(muacBand(18, 12, "").z).toBe(Math.min(m.z, f.z));
  });
});

describe("the apps carry the same tables", () => {
  // Numbers only: quoted labels dropped, so "23 AE" is not read as 23.
  const nums = (s: string) =>
    (s.replace(/"[^"]*"/g, "").match(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g) || []).map(Number);
  const tsAll = [
    ...[IAP_HT_M, IAP_HT_F, IAP_WT_M, IAP_WT_F, IAP_BMI_M, IAP_BMI_F]
      .flatMap((t) => [...t.percents, ...t.centiles.flat(), ...t.L, ...t.M, ...t.S]),
    ...[MUAC_M, MUAC_F].flatMap((t) => [...t.L, ...t.M, ...t.S]),
  ];
  test("Android GrowthRefTables.kt", () => {
    const kt = read("../android/app/src/main/java/kallam/healthcare/data/GrowthRefTables.kt");
    expect(nums(kt.slice(kt.indexOf("val IAP_HT_M")))).toEqual(tsAll);
  });
  test("iOS GrowthRefTables.swift", () => {
    const sw = read("../ios/VitaHero/Models/GrowthRefTables.swift");
    expect(nums(sw.slice(sw.indexOf("static let IAP_HT_M")))).toEqual(tsAll);
  });
});
