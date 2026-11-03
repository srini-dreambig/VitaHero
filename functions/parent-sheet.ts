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
  /**
   * Vision only: each prescription with a value in it, as the glasses slip
   * lays it out. The app draws the table and leaves out the row of the same
   * title; older apps show that row's text instead.
   */
  rx?: RxTable[];
}

export interface RxEye { sph: string; cyl: string; axis: string; va: string }
export interface RxRow { label: "D/V" | "N/V"; right: RxEye; left: RxEye }
export interface RxTable { title: string; lensType: string; rows: RxRow[] }

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

// The slip's boxes per eye: distance keeps the keys older records use, near adds "Near".
const DISTANCE_KEYS = { sph: "Sph", cyl: "Cyl", axis: "Axi", va: "Cva" } as const;
const NEAR_KEYS = { sph: "NearSph", cyl: "NearCyl", axis: "NearAxi", va: "NearVa" } as const;

function rxEye(d: Record<string, unknown>, prefix: string, keys: Record<keyof RxEye, string>): RxEye {
  return { sph: str(d[prefix + keys.sph]), cyl: str(d[prefix + keys.cyl]), axis: str(d[prefix + keys.axis]), va: str(d[prefix + keys.va]) };
}
const blankEye = (e: RxEye) => !e.sph && !e.cyl && !e.axis && !e.va;

/** "Sph -1.50, Cyl -0.50, Axis 180, CVA 6/6" for one eye's row, "" when blank. */
function eyeText(e: RxEye, va: string): string {
  return ([["Sph", e.sph], ["Cyl", e.cyl], ["Axis", e.axis], [va, e.va]] as const)
    .filter(([, v]) => v).map(([w, v]) => `${w} ${v}`).join(", ");
}

/** One eye's prescription as text: distance, then near, "" when blank. */
function eyeRx(d: Record<string, unknown>, prefix: string, withUva: boolean): string {
  const parts: string[] = [];
  if (withUva && str(d[`${prefix}Uva`])) parts.push(`UVA ${str(d[`${prefix}Uva`])}`);
  const distance = eyeText(rxEye(d, prefix, DISTANCE_KEYS), "CVA");
  if (distance) parts.push(distance);
  const near = eyeText(rxEye(d, prefix, NEAR_KEYS), "V/A");
  if (near) parts.push(`near ${near}`);
  return parts.join(", ");
}

/** The prescription as the slip draws it, or null when nothing was written. */
function rxTable(d: Record<string, unknown>, base: "present" | "new", title: string): RxTable | null {
  const rows: RxRow[] = [];
  for (const [label, keys] of [["D/V", DISTANCE_KEYS], ["N/V", NEAR_KEYS]] as const) {
    const right = rxEye(d, `${base}Od`, keys), left = rxEye(d, `${base}Os`, keys);
    if (!blankEye(right) || !blankEye(left)) rows.push({ label, right, left });
  }
  const lensType = str(d[`${base}LensType`]);
  return rows.length ? { title, lensType, rows } : null;
}

function prescription(d: Record<string, unknown>, base: "present" | "new"): string {
  const od = eyeRx(d, `${base}Od`, base === "new");
  const os = eyeRx(d, `${base}Os`, base === "new");
  if (!od && !os) return NONE;
  const lens = str(d[`${base}LensType`]);
  return [od && `Right (OD): ${od}`, os && `Left (OS): ${os}`, lens && `Lens: ${lens}`].filter(Boolean).join("; ");
}

/** BMI and the nutritional status for a growth record, as the sheet words them. */
export function growthSummary(
  detail: unknown, child: SheetChild
): { bmi: string; nutritionalStatus: string } {
  const d = (detail && typeof detail === "object" ? detail : {}) as Record<string, unknown>;
  const h = num(d.heightCm), w = num(d.weightKg);
  if (!h || !w || h <= 0 || w <= 0) return { bmi: "", nutritionalStatus: str(d.nutritionalStatus) };
  const r = whoReading(h, w, child.ageYears, child.gender, child.dob);
  return {
    bmi: `${fix1(w / Math.pow(h / 100, 2))} kg/m²`,
    // The doctor's own status wins over the WHO reading.
    nutritionalStatus: str(d.nutritionalStatus) || (r ? nutritionStatus(r) : ""),
  };
}

function growthSheet(d: Record<string, unknown>, child: SheetChild): AssessmentSheet {
  const h = num(d.heightCm), w = num(d.weightKg), muac = num(d.muacCm);
  const rows: SheetRow[] = [
    { label: "Height", value: h !== null ? `${fix1(h)} cm` : NOT_RECORDED },
    { label: "Weight", value: w !== null ? `${fix1(w)} kg` : NOT_RECORDED },
  ];
  // No longer on the clinician's form; older records that have it keep it.
  if (muac !== null) rows.push({ label: "Mid-arm circumference", value: `${fix1(muac)} cm` });
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

/** "Right (OD) 6/6, Left (OS) 6/12", or not recorded. */
function perEye(right: unknown, left: unknown): string {
  const r = str(right), l = str(left);
  return r || l ? [`Right (OD) ${r || "—"}`, `Left (OS) ${l || "—"}`].join(", ") : NOT_RECORDED;
}

// The vision sheet's four parts, each with the values the camp tested:
// visual acuity (distance, near, how it was tested), the present and the new
// glasses prescription, and colour vision; then any other complaints.
function visionSheet(d: Record<string, unknown>): AssessmentSheet {
  const rows: SheetRow[] = [
    { label: "Visual acuity, distance", value: perEye(d.rightAcuity, d.leftAcuity) },
    { label: "Visual acuity, near", value: perEye(d.rightNearVision, d.leftNearVision) },
    { label: "Testing condition", value: str(d.testingCondition) || NOT_RECORDED },
    { label: "Present glasses prescription", value: prescription(d, "present") },
    { label: "New glasses prescription", value: prescription(d, "new") },
    { label: "Colour vision", value: str(d.colorVision) || NOT_RECORDED },
    { label: "Any other complaints", value: orNone(d.otherComplaints) },
  ];
  // No longer on the form; an older record that noted one keeps it.
  if (orNone(d.otherAbnormalities) !== NONE) {
    rows.push({ label: "Other abnormalities", value: orNone(d.otherAbnormalities) });
  }
  const rx = [
    rxTable(d, "present", "Present glasses prescription"),
    rxTable(d, "new", "New glasses prescription"),
  ].filter((x): x is RxTable => x !== null);
  return rx.length ? { title: "Vision assessment", rows, rx } : { title: "Vision assessment", rows };
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
  // The sheet's four parts in its order: tooth index, oral hygiene index,
  // enamel, alignment & occlusion, and the treatment plan.
  const rows: SheetRow[] = [
    { label: "Tooth index", value: index ? `${index} (${counts})` : NOT_RECORDED },
    { label: "Oral hygiene index", value: str(d.hygiene) || NOT_RECORDED },
    { label: "Enamel, alignment & occlusion", value: str(d.fluorosis) ? `Dental fluorosis: ${str(d.fluorosis)}` : NOT_RECORDED },
    { label: "Treatment plan", value: interventions.length ? interventions.join(", ") : NONE },
    { label: "Any other complaints", value: complaints.length ? complaints.join(", ") : NONE },
  ];
  // No longer on the form; an older record that noted one keeps it.
  if (orNone(d.abnormalFindings) !== NONE) {
    rows.push({ label: "Other abnormalities", value: orNone(d.abnormalFindings) });
  }
  return { title: "Dental assessment", rows };
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
