/**
 * The WHO 2007 growth reference for 5-19 years: BMI-for-age, height-for-age
 * and weight-for-age, read the way the WHO's own software reads them.
 * Weight-for-age stops at 10 years: past that, the WHO says, weight alone
 * cannot tell a tall child from a heavy one, and BMI-for-age is the measure.
 *
 * What "the way the WHO reads them" means, from anthroplus/R/zscores.R:
 *  - age is in months, and L, M and S are interpolated linearly between the
 *    two whole months either side of it;
 *  - z = ((y / M)^L - 1) / (L * S);
 *  - BMI-for-age and weight-for-age beyond +/-3 SD are "restricted": the
 *    distance past the 3 SD line is measured in units of the 2-to-3 SD gap,
 *    because the LMS curve stretches too far out there. Height-for-age is not
 *    adjusted.
 *  - z-scores are reported to two decimals.
 * who2007.test.ts runs all 933 children in the WHO's own worked survey through
 * this and expects the WHO's answer to the second decimal.
 *
 * The BMI cut-offs are the camp's own (see bmiClass): normal from -2 to +2 SD,
 * above +2 overweight, above +3 obese, below -2 wasted, below -3 severely
 * wasted. Height-for-age below -2 SD is stunting.
 *
 * android/.../data/WhoBmi.kt and ios/VitaHero/Models/WhoBmi.swift are the same
 * code for the apps' calculator and chart. The tables in all three are
 * generated from one set of WHO files by tools/who2007/gen.py.
 */
import { BFA_F, BFA_M, HFA_F, HFA_M, WFA_F, WFA_M, type Lms } from "./who2007-data";

export const WHO_MIN_MONTHS = 60;
export const WHO_MAX_MONTHS = 229;
/** Weight-for-age ends at 10 years. */
export const WFA_MAX_MONTHS = 120;

export type WhoSex = "M" | "F";
export type WhoIndicator = "BFA" | "HFA" | "WFA";

function table(ind: WhoIndicator, sex: WhoSex): Lms {
  if (ind === "BFA") return sex === "M" ? BFA_M : BFA_F;
  if (ind === "WFA") return sex === "M" ? WFA_M : WFA_F;
  return sex === "M" ? HFA_M : HFA_F;
}

/** The last month an indicator has a curve for. */
export const maxMonthsOf = (ind: WhoIndicator) => (ind === "WFA" ? WFA_MAX_MONTHS : WHO_MAX_MONTHS);

/** L, M and S at an age in months, interpolated as the WHO does. Clamped to 60-229 (weight: 60-120). */
export function lmsAt(ind: WhoIndicator, sex: WhoSex, ageMonths: number) {
  const t = table(ind, sex);
  const a = Math.min(Math.max(ageMonths, WHO_MIN_MONTHS), maxMonthsOf(ind));
  const lo = Math.trunc(a) - WHO_MIN_MONTHS;
  const hi = Math.min(lo + 1, t.M.length - 1);
  const f = a - Math.trunc(a);
  const at = (xs: number[]) => xs[lo] + f * (xs[hi] - xs[lo]);
  return { L: at(t.L), M: at(t.M), S: at(t.S) };
}

/** The measurement that sits at a given z, on the LMS curve. */
export function valueAtZ(l: number, m: number, s: number, z: number): number {
  if (l === 0) return m * Math.exp(s * z);
  return m * Math.pow(1 + l * s * z, 1 / l);
}

export function rawZ(y: number, l: number, m: number, s: number): number {
  if (l === 0) return Math.log(y / m) / s;
  return (Math.pow(y / m, l) - 1) / (s * l);
}

/** z-score, unrounded. BMI and weight are restricted past +/-3 SD; height is not. */
export function whoZ(ind: WhoIndicator, sex: WhoSex, ageMonths: number, y: number): number {
  const { L, M, S } = lmsAt(ind, sex, ageMonths);
  return ind === "HFA" ? rawZ(y, L, M, S) : restrictedZ(y, L, M, S);
}

/**
 * z on an LMS curve, with the WHO's restriction past +/-3 SD: the distance
 * past the 3 SD line is measured in units of the 2-to-3 SD gap.
 */
export function restrictedZ(y: number, L: number, M: number, S: number): number {
  const z = rawZ(y, L, M, S);
  if (z > 3) {
    const sd3 = valueAtZ(L, M, S, 3);
    return 3 + (y - sd3) / (sd3 - valueAtZ(L, M, S, 2));
  }
  if (z < -3) {
    const sd3 = valueAtZ(L, M, S, -3);
    return -3 + (y - sd3) / (valueAtZ(L, M, S, -2) - sd3);
  }
  return z;
}

/** Standard normal CDF. */
export function normalCdf(z: number): number {
  return 0.5 * erfc(-z / Math.SQRT2);
}

function erfc(x: number): number {
  // Numerical Recipes erfc via Chebyshev fit; |error| < 1.2e-7, far below the
  // 0.1 percentile anyone reads.
  const zz = Math.abs(x);
  const t = 1 / (1 + 0.5 * zz);
  const r = t * Math.exp(
    -zz * zz - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 +
    t * (-0.82215223 + t * 0.17087277))))))))
  );
  return x >= 0 ? r : 2 - r;
}

/** Percentile, 0.1 to 99.9, one decimal. */
export function percentileOf(z: number): number {
  const p = normalCdf(z) * 100;
  return Math.min(Math.max(Math.round(p * 10) / 10, 0.1), 99.9);
}

/** Two decimals, as the WHO reports. `|| 0` turns -0 into 0, which would print as -0.00. */
export const round2 = (z: number) => Math.round(z * 100) / 100 || 0;

/**
 * BMI-for-age class, on the camp's own cut-offs: normal from -2 to +2 SD (the
 * 3rd to 97th centile, near enough), above +2 overweight, above +3 obese,
 * below -2 wasted, below -3 severely wasted. Boundaries are strict.
 */
export function bmiClass(z: number): "Severely wasted" | "Wasted" | "Normal" | "Overweight" | "Obese" {
  if (z < -3) return "Severely wasted";
  if (z < -2) return "Wasted";
  if (z > 3) return "Obese";
  if (z > 2) return "Overweight";
  return "Normal";
}

/**
 * Age in months on a given day, from a date of birth, or failing that from
 * whole years. WHO counts a month as 365.25 / 12 days. Whole years alone say
 * the child is somewhere in that year, so they are read as its middle — six
 * months out at worst, against twelve for reading them as the birthday.
 */
export function ageInMonths(dob: string | null | undefined, ageYears: number | null | undefined, on = new Date()): number | null {
  const born = parseDob(dob || "");
  if (born) {
    const days = (on.getTime() - born.getTime()) / 86_400_000;
    if (days > 0 && days < 30 * 365.25) return days / (365.25 / 12);
  }
  const y = Number(ageYears);
  if (Number.isFinite(y) && y > 0 && y < 30) return y * 12 + 6;
  return null;
}

/** YYYY-MM-DD (or a timestamp), DD-MM-YYYY and DD/MM/YYYY. null for anything else. */
export function parseDob(s: string): Date | null {
  const v = s.trim();
  let y: number, mo: number, d: number;
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
  else if ((m = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/))) { d = +m[1]; mo = +m[2]; y = +m[3]; }
  else return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCMonth() === mo - 1 ? dt : null;
}

export interface BmiForAge {
  bmi: number;            // one decimal, as shown
  sex: WhoSex;
  ageMonths: number;
  bmiZ: number;           // two decimals
  bmiPercentile: number;
  heightZ: number;
  heightPercentile: number;
  /** Weight-for-age, two decimals. null past 10 years, where the WHO has no curve. */
  weightZ: number | null;
  weightPercentile: number | null;
  bmiClass: ReturnType<typeof bmiClass>;
  stunted: boolean;
  /** Under 5 or over 19: read against the nearest end of the 5-19 reference. */
  outsideRange: boolean;
}

/** One child's reading. null when the measurements or the age cannot be read. */
export function bmiForAge(heightCm: number, weightKg: number, sex: WhoSex, ageMonths: number): BmiForAge | null {
  if (!(heightCm > 0) || !(weightKg > 0) || !Number.isFinite(ageMonths)) return null;
  const raw = weightKg / Math.pow(heightCm / 100, 2);
  const bmiZ = round2(whoZ("BFA", sex, ageMonths, raw));
  const heightZ = round2(whoZ("HFA", sex, ageMonths, heightCm));
  const weightZ = ageMonths < WFA_MAX_MONTHS + 1 ? round2(whoZ("WFA", sex, ageMonths, weightKg)) : null;
  return {
    bmi: Math.round(raw * 10) / 10,
    sex,
    ageMonths,
    bmiZ,
    bmiPercentile: percentileOf(bmiZ),
    heightZ,
    heightPercentile: percentileOf(heightZ),
    weightZ,
    weightPercentile: weightZ === null ? null : percentileOf(weightZ),
    bmiClass: bmiClass(bmiZ),
    stunted: heightZ < -2,
    outsideRange: ageMonths < WHO_MIN_MONTHS || ageMonths > WHO_MAX_MONTHS + 1,
  };
}

/**
 * The paper sheet's nutritional status from one reading: one label, so the
 * more serious finding wins — wasting, then obesity, then stunting, then
 * overweight. An obese child who is also short reads Obese; both z-scores are
 * still in the doctor's note.
 */
export function nutritionStatus(r: BmiForAge): string {
  if (r.bmiClass === "Severely wasted" || r.bmiClass === "Wasted" || r.bmiClass === "Obese") return r.bmiClass;
  if (r.stunted) return "Stunted";
  return r.bmiClass;
}
