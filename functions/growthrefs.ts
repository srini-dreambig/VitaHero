/**
 * The two Indian and school-age references the camp reads beside the WHO's:
 *
 *  - IAP 2015 (Khadilkar et al., Indian Pediatr 2015;52:47-55): height,
 *    weight and BMI centiles for Indian children from 5 to 18, printed at
 *    every half year. The chart lines are the printed centiles. A child
 *    between two lines is read between them, linearly in z, so the centile
 *    always agrees with where the dot sits on the chart. Beyond the outer
 *    lines the paper prints nothing, so the distance past the line is read
 *    off an LMS curve fitted to that half year's row (tools/growthrefs/gen.py).
 *    Ages between half years are read between the two rows, as the chart's
 *    lines are drawn.
 *  - Mramba 2017 (BMJ 2017;358:j3423) MUAC-for-age, 5 to 19 years, by month:
 *    z on the authors' L, M, S, restricted past +/-3 SD the way the WHO's
 *    references are (the authors' own MUACz package does the same).
 *
 * The BMI class and the nutritional status still come from the WHO reading
 * (who2007.ts); the IAP centiles sit beside it, as the IAP charts are drawn.
 * android/.../data/GrowthRefs.kt and ios/VitaHero/Models/GrowthRefs.swift are
 * the same code for the apps' charts.
 */
import {
  IAP_BMI_F, IAP_BMI_M, IAP_HT_F, IAP_HT_M, IAP_WT_F, IAP_WT_M, MUAC_F, MUAC_M, type IapChart,
} from "./growthrefs-data";
import { normalCdf, percentileOf, rawZ, restrictedZ, round2, type WhoSex } from "./who2007";

export const IAP_MIN_MONTHS = 60;
export const IAP_MAX_MONTHS = 216;
export const MUAC_MIN_MONTHS = 60;
export const MUAC_MAX_MONTHS = 228;

export type IapMeasure = "HT" | "WT" | "BMI";

export function iapChart(m: IapMeasure, sex: WhoSex): IapChart {
  if (m === "HT") return sex === "M" ? IAP_HT_M : IAP_HT_F;
  if (m === "WT") return sex === "M" ? IAP_WT_M : IAP_WT_F;
  return sex === "M" ? IAP_BMI_M : IAP_BMI_F;
}

/** A row's position at an age in months: index and fraction between half years, clamped to 5-18. */
function rowAt(months: number) {
  const a = Math.min(Math.max(months, IAP_MIN_MONTHS), IAP_MAX_MONTHS);
  const x = (a - IAP_MIN_MONTHS) / 6;
  const lo = Math.min(Math.floor(x), 25);
  return { lo, f: x - lo };
}

const between = (xs: number[], lo: number, f: number) => xs[lo] + f * (xs[lo + 1] - xs[lo]);

/** The chart's lines (3rd to 97th, or the BMI chart's 3rd to 27 AE) at an age in months. */
export function iapLinesAt(m: IapMeasure, sex: WhoSex, months: number): number[] {
  const { lo, f } = rowAt(months);
  return iapChart(m, sex).centiles.map((c) => between(c, lo, f));
}

export function iapLmsAt(m: IapMeasure, sex: WhoSex, months: number) {
  const t = iapChart(m, sex);
  const { lo, f } = rowAt(months);
  return { L: between(t.L, lo, f), M: between(t.M, lo, f), S: between(t.S, lo, f) };
}

/** Inverse normal CDF by bisection; only ever asked for the charts' few centiles. */
const qCache = new Map<number, number>();
export function zOfPercent(p: number): number {
  const hit = qCache.get(p);
  if (hit !== undefined) return hit;
  let lo = -10, hi = 10;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (normalCdf(mid) < p / 100) lo = mid; else hi = mid;
  }
  const z = (lo + hi) / 2;
  qCache.set(p, z);
  return z;
}

/** z on the IAP chart, unrounded: between the printed lines, or past them on the fitted curve. */
export function iapZ(m: IapMeasure, sex: WhoSex, months: number, y: number): number {
  const t = iapChart(m, sex);
  const lines = iapLinesAt(m, sex, months);
  const zs = t.percents.map(zOfPercent);
  const last = lines.length - 1;
  if (y <= lines[0] || y >= lines[last]) {
    const { L, M, S } = iapLmsAt(m, sex, months);
    const k = y <= lines[0] ? 0 : last;
    return zs[k] + rawZ(y, L, M, S) - rawZ(lines[k], L, M, S);
  }
  let k = 0;
  while (y > lines[k + 1]) k++;
  return zs[k] + ((zs[k + 1] - zs[k]) * (y - lines[k])) / (lines[k + 1] - lines[k]);
}

/** "3rd", "50th", or an adult-equivalent line's own name. */
const lineName = (label: string) => (/^\d+$/.test(label) ? label + (label.endsWith("3") && label !== "13" ? "rd" : "th") : label);

/** Which two lines the reading sits between, in the chart's words. */
export function iapBand(m: IapMeasure, sex: WhoSex, months: number, y: number): string {
  const t = iapChart(m, sex);
  const lines = iapLinesAt(m, sex, months);
  const last = lines.length - 1;
  const name = (k: number) => (/^\d+$/.test(t.labels[k]) ? lineName(t.labels[k]) : `the ${t.labels[k]} line`);
  if (y < lines[0]) return `below ${name(0)}`;
  if (y > lines[last]) return `above ${name(last)}`;
  // A reading exactly on a line counts as on its way up: the 50th reads "50th–75th".
  let k = 0;
  while (k < last - 1 && y >= lines[k + 1]) k++;
  return `${lineName(t.labels[k])}–${lineName(t.labels[k + 1])}`;
}

export interface IapReading {
  z: number;          // two decimals
  percentile: number; // 0.1 to 99.9
  band: string;       // e.g. "25th–50th", "below 3rd", "above the 27 AE line"
}

/** A child's reading on one IAP chart. null under 5 or past 18, where the IAP charts have no lines. */
export function iapReading(m: IapMeasure, sex: WhoSex, months: number, y: number): IapReading | null {
  if (!(y > 0) || !Number.isFinite(months) || months < IAP_MIN_MONTHS || months >= IAP_MAX_MONTHS + 1) return null;
  const z = round2(iapZ(m, sex, months, y));
  return { z, percentile: percentileOf(z), band: iapBand(m, sex, months, y) };
}

export interface IapReadings {
  height: IapReading | null;
  weight: IapReading | null;
  bmi: IapReading | null;
}

export function iapReadings(heightCm: number, weightKg: number, sex: WhoSex, months: number): IapReadings {
  const bmi = heightCm > 0 && weightKg > 0 ? weightKg / Math.pow(heightCm / 100, 2) : 0;
  return {
    height: iapReading("HT", sex, months, heightCm),
    weight: iapReading("WT", sex, months, weightKg),
    bmi: iapReading("BMI", sex, months, bmi),
  };
}

/** Mramba L, M, S at an age in months, interpolated between whole months. Clamped to 60-228. */
export function muacLmsAt(sex: WhoSex, months: number) {
  const t = sex === "M" ? MUAC_M : MUAC_F;
  const a = Math.min(Math.max(months, MUAC_MIN_MONTHS), MUAC_MAX_MONTHS);
  const lo = Math.trunc(a) - MUAC_MIN_MONTHS;
  const hi = Math.min(lo + 1, t.M.length - 1);
  const f = a - Math.trunc(a);
  const at = (xs: number[]) => xs[lo] + f * (xs[hi] - xs[lo]);
  return { L: at(t.L), M: at(t.M), S: at(t.S) };
}

/** MUAC-for-age z, unrounded, restricted past +/-3 SD. */
export function muacZ(sex: WhoSex, months: number, cm: number): number {
  const { L, M, S } = muacLmsAt(sex, months);
  return restrictedZ(cm, L, M, S);
}

export interface MuacReading {
  z: number;          // two decimals
  percentile: number;
}

/** null under 5 or past 19, where the reference stops (under 5 the camp uses the WHO's cm cut-offs). */
export function muacReading(sex: WhoSex, months: number, cm: number): MuacReading | null {
  if (!(cm > 0) || !Number.isFinite(months) || months < MUAC_MIN_MONTHS || months >= MUAC_MAX_MONTHS + 1) return null;
  const z = round2(muacZ(sex, months, cm));
  return { z, percentile: percentileOf(z) };
}
