// The parent's assessment sheets: physical growth, vision and dental, one row
// per column of the paper sheet, built from what the doctor recorded.
//
// Built here, once, so the Android and iOS results screens show the same
// columns in the same words; each app only lays the rows out. A column the
// doctor left empty reads "Not recorded"; one the sheet says is "if present"
// reads "None".

import { muacBand, ord, toothIndex, whoReading } from "./clinical";
import { iapReadings, type IapReading } from "./growthrefs";
import { nutritionStatus } from "./who2007";

export interface SheetRow { label: string; value: string }
export interface AssessmentSheet {
  title: string;
  rows: SheetRow[];
  /** Physical growth only: the numbers the app draws the IAP, WHO and MUAC charts from. */
  growth?: { heightCm: number; weightKg: number; muacCm?: number };
}

export interface SheetChild { ageYears: number | null; gender: string; dob: string }

/** A date of birth as YYYY-MM-DD, whether the driver gave a string or a Date. */
export function dobText(v: unknown): string {
  if (v instanceof Date) return isNaN(v.getTime()) ? "" : v.toISOString().slice(0, 10);
  return v === null || v === undefined ? "" : String(v);
}

const NOT_RECORDED = "Not recorded";
const NONE = "None";

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
const num = (v: unknown) => {
  const s = str(v);
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
/** A many-choice field, sent as a comma list by the apps and the console. */
const list = (v: unknown): string[] =>
  (Array.isArray(v) ? v.map(str) : str(v).split(",").map((x) => x.trim()))
    .filter((x) => x && x.toLowerCase() !== "none");
const orNone = (v: unknown) => {
  const s = str(v);
  return s && s.toLowerCase() !== "none" ? s : NONE;
};
const signed = (z: number) => (z > 0 ? `+${z.toFixed(2)}` : z.toFixed(2));
const fix1 = (n: number) => (Math.round(n * 10) / 10).toString();

/** "Sph -1.50, Cyl -0.50, Axis 180, CVA 6/6" for one eye, "" when blank. */
function eyeRx(d: Record<string, unknown>, prefix: string, withUva: boolean): string {
  const parts: string[] = [];
  if (withUva && str(d[`${prefix}Uva`])) parts.push(`UVA ${str(d[`${prefix}Uva`])}`);
  for (const [k, word] of [["Sph", "Sph"], ["Cyl", "Cyl"], ["Axi", "Axis"], ["Cva", "CVA"]]) {
    const v = str(d[`${prefix}${k}`]);
    if (v) parts.push(`${word} ${v}`);
  }
  return parts.join(", ");
}

function prescription(d: Record<string, unknown>, base: "present" | "new"): string {
  const od = eyeRx(d, `${base}Od`, base === "new");
  const os = eyeRx(d, `${base}Os`, base === "new");
  if (!od && !os) return NONE;
  return [od && `Right (OD): ${od}`, os && `Left (OS): ${os}`].filter(Boolean).join("; ");
}

function growthSheet(d: Record<string, unknown>, child: SheetChild): AssessmentSheet {
  const h = num(d.heightCm), w = num(d.weightKg), muac = num(d.muacCm);
  const rows: SheetRow[] = [
    { label: "Height", value: h !== null ? `${fix1(h)} cm` : NOT_RECORDED },
    { label: "Weight", value: w !== null ? `${fix1(w)} kg` : NOT_RECORDED },
    { label: "Mid-arm circumference", value: muac !== null ? `${fix1(muac)} cm` : NOT_RECORDED },
  ];
  if (h && w && h > 0 && w > 0) {
    rows.push({ label: "BMI", value: `${fix1(w / Math.pow(h / 100, 2))} kg/m²` });
    const r = whoReading(h, w, child.ageYears, child.gender, child.dob);
    if (r) {
      // The IAP 2015 Indian chart first, as the camp reads it, then the WHO z-score.
      const iap = iapReadings(h, w, r.sex, r.ageMonths);
      const read = (i: IapReading | null, z: number | null, p: number | null) =>
        [i && `IAP ${i.band} centile`, z !== null && p !== null && `WHO z ${signed(z)} (${ord(p)} percentile)`]
          .filter(Boolean).join("; ");
      const add = (label: string, value: string) => value && rows.push({ label, value });
      add("Height-for-age", read(iap.height, r.heightZ, r.heightPercentile));
      add("Weight-for-age", read(iap.weight, r.weightZ, r.weightPercentile));
      add("BMI-for-age", read(iap.bmi, r.bmiZ, r.bmiPercentile));
    }
    if (muac !== null) {
      const m = muacBand(muac, child.ageYears, child.gender, child.dob);
      if (m.z !== null && m.percentile !== null) {
        rows.push({ label: "MUAC-for-age", value: `z ${signed(m.z)} (${ord(m.percentile)} percentile)${m.note ? `, ${m.note}` : ""}` });
      }
    }
    // The doctor's own status, where an older record has one, wins over the WHO reading.
    const status = str(d.nutritionalStatus) || (r ? nutritionStatus(r) : "");
    if (status) rows.push({ label: "Nutritional status", value: status });
    const growth = muac !== null && muac > 0 ? { heightCm: h, weightKg: w, muacCm: muac } : { heightCm: h, weightKg: w };
    return { title: "Physical growth assessment", rows, growth };
  }
  rows.push({ label: "BMI", value: NOT_RECORDED });
  return { title: "Physical growth assessment", rows };
}

function visionSheet(d: Record<string, unknown>): AssessmentSheet {
  const r = str(d.rightAcuity), l = str(d.leftAcuity);
  const acuity = r || l
    ? [`Right (OD) ${r || "—"}`, `Left (OS) ${l || "—"}`].join(", ")
    : NOT_RECORDED;
  return {
    title: "Vision assessment",
    rows: [
      { label: "Visual acuity", value: acuity },
      { label: "Testing condition", value: str(d.testingCondition) || NOT_RECORDED },
      { label: "Present glasses prescription", value: prescription(d, "present") },
      { label: "New glasses prescription", value: prescription(d, "new") },
      { label: "Colour vision", value: str(d.colorVision) || NOT_RECORDED },
      { label: "Other complaints", value: orNone(d.otherComplaints) },
      { label: "Other abnormalities", value: orNone(d.otherAbnormalities) },
    ],
  };
}

function dentalSheet(d: Record<string, unknown>): AssessmentSheet {
  const decayed = num(d.cariesCount), missing = num(d.missingCount), filled = num(d.filledCount);
  const index = toothIndex(str(d.dentition), decayed, missing, filled);
  const counts = [
    decayed !== null && `decayed ${decayed}`,
    missing !== null && `missing ${missing}`,
    filled !== null && `filled ${filled}`,
  ].filter(Boolean).join(", ");
  const complaints = list(d.dentalSymptoms);
  const other = str(d.otherComplaints);
  if (other && other.toLowerCase() !== "none") complaints.push(other);
  const interventions = list(d.treatmentNeeded);
  return {
    title: "Dental assessment",
    rows: [
      { label: "Oral hygiene", value: str(d.hygiene) || NOT_RECORDED },
      { label: "Tooth index", value: index ? `${index} (${counts})` : NOT_RECORDED },
      { label: "Dental fluorosis", value: str(d.fluorosis) || NOT_RECORDED },
      { label: "Complaints", value: complaints.length ? complaints.join(", ") : NONE },
      { label: "Other abnormalities", value: orNone(d.abnormalFindings) },
      { label: "Recommended dental intervention", value: interventions.length ? interventions.join(", ") : NONE },
    ],
  };
}

/** The sheet for one check, or null for a check that has none. */
export function assessmentSheet(
  checkType: string, detail: unknown, child: SheetChild
): AssessmentSheet | null {
  const d = (detail && typeof detail === "object" ? detail : {}) as Record<string, unknown>;
  switch (checkType) {
    case "Height & weight": return growthSheet(d, child);
    case "Vision": return visionSheet(d);
    case "Dental": return dentalSheet(d);
    default: return null;
  }
}
