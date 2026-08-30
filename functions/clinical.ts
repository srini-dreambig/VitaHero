// Clinical rules for camp screening.
//
// Everything here is a pure function of what a screener measured. It proposes a
// flag; it never decides one. A supervising physician confirms or overrides
// every flag before a parent sees it (see camps.ts, reviewParticipant).
//
// The growth tables are a direct port of GrowthStandards.kt in the Android app.
// They must stay identical: if the backend and the app disagree about a child's
// percentile, the parent sees one number on the results card and a different
// position on the growth chart.

export type Flag = "GOOD" | "WATCH" | "ALERT" | "NOT_MEASURED";
export type Urgency = "NONE" | "ROUTINE" | "SOON" | "URGENT";

/**
 * Check types a camp can offer. The portal and the API agree on these strings.
 *
 * Split deliberately. A check is only offerable if somebody has designed the
 * screen a clinician records it on — otherwise the school agrees to a check,
 * the camp lists it, and the person holding the tablet is given a bare
 * Normal/Abnormal dropdown for a spine examination. That is not screening, it
 * is a checkbox with a clinical-sounding label.
 *
 * DESIGNED_CHECKS is what a school can be offered today. PLANNED_CHECKS are
 * recognised so existing camps and historical findings keep working, but are
 * not offered anywhere until their capture screen exists.
 */
export const DESIGNED_CHECKS = [
  "Height & weight",
  "Vision",
  "Dental",
  "Haemoglobin",
] as const;

export const PLANNED_CHECKS = [
  "ENT",
  "Skin",
  "Spine",
  "Immunisation review",
] as const;

export const CHECK_TYPES = [...DESIGNED_CHECKS, ...PLANNED_CHECKS] as const;
export type CheckType = (typeof CHECK_TYPES)[number];

/** Can a clinician actually record this check on a screen built for it? */
export function isDesignedCheck(v: string): boolean {
  return (DESIGNED_CHECKS as readonly string[]).includes(v);
}

export function isCheckType(v: string): v is CheckType {
  return (CHECK_TYPES as readonly string[]).includes(v);
}

// ─── WHO 2007 growth reference (as used by IAP) ─────────────

interface Ref { age: number; p50: number }

const HEIGHT_BOYS: Ref[] = [
  { age: 2, p50: 87.8 }, { age: 3, p50: 96.1 }, { age: 4, p50: 103.3 }, { age: 5, p50: 110.0 },
  { age: 6, p50: 116.1 }, { age: 7, p50: 121.7 }, { age: 8, p50: 127.1 }, { age: 9, p50: 132.2 },
  { age: 10, p50: 137.2 }, { age: 11, p50: 142.8 }, { age: 12, p50: 149.1 }, { age: 13, p50: 156.2 },
  { age: 14, p50: 163.5 }, { age: 15, p50: 168.7 }, { age: 16, p50: 171.6 }, { age: 17, p50: 172.8 },
  { age: 18, p50: 172.9 },
];
const HEIGHT_GIRLS: Ref[] = [
  { age: 2, p50: 86.4 }, { age: 3, p50: 95.1 }, { age: 4, p50: 102.7 }, { age: 5, p50: 109.4 },
  { age: 6, p50: 115.6 }, { age: 7, p50: 121.4 }, { age: 8, p50: 127.0 }, { age: 9, p50: 132.4 },
  { age: 10, p50: 137.8 }, { age: 11, p50: 143.7 }, { age: 12, p50: 150.0 }, { age: 13, p50: 155.7 },
  { age: 14, p50: 159.5 }, { age: 15, p50: 161.2 }, { age: 16, p50: 161.8 }, { age: 17, p50: 162.1 },
  { age: 18, p50: 162.2 },
];
const WEIGHT_BOYS: Ref[] = [
  { age: 2, p50: 12.2 }, { age: 3, p50: 14.3 }, { age: 4, p50: 16.3 }, { age: 5, p50: 18.3 },
  { age: 6, p50: 20.5 }, { age: 7, p50: 22.9 }, { age: 8, p50: 25.6 }, { age: 9, p50: 28.6 },
  { age: 10, p50: 32.0 }, { age: 11, p50: 36.0 }, { age: 12, p50: 40.7 }, { age: 13, p50: 45.8 },
  { age: 14, p50: 51.0 }, { age: 15, p50: 55.5 }, { age: 16, p50: 58.5 }, { age: 17, p50: 60.0 },
  { age: 18, p50: 61.0 },
];
const WEIGHT_GIRLS: Ref[] = [
  { age: 2, p50: 11.5 }, { age: 3, p50: 13.5 }, { age: 4, p50: 15.5 }, { age: 5, p50: 17.4 },
  { age: 6, p50: 19.5 }, { age: 7, p50: 21.9 }, { age: 8, p50: 24.6 }, { age: 9, p50: 27.8 },
  { age: 10, p50: 31.4 }, { age: 11, p50: 35.5 }, { age: 12, p50: 40.1 }, { age: 13, p50: 44.8 },
  { age: 14, p50: 48.5 }, { age: 15, p50: 50.8 }, { age: 16, p50: 52.0 }, { age: 17, p50: 52.5 },
  { age: 18, p50: 53.0 },
];

const HEIGHT_SPREAD = 0.045;
const WEIGHT_SPREAD = 0.14;

function isBoy(gender: string): boolean {
  const g = (gender || "").toLowerCase();
  return g.startsWith("b") || g === "male" || g === "m";
}

function medianAtAge(ageYears: number, gender: string, metric: "HEIGHT" | "WEIGHT"): number {
  const boy = isBoy(gender);
  const table =
    metric === "HEIGHT" ? (boy ? HEIGHT_BOYS : HEIGHT_GIRLS) : boy ? WEIGHT_BOYS : WEIGHT_GIRLS;
  const age = Math.min(Math.max(Math.round(ageYears), 2), 18);
  const hit = table.find((r) => r.age === age);
  return hit ? hit.p50 : table[table.length - 1].p50;
}

/** Estimate a percentile (1-99) for a measured value. Mirrors GrowthStandards.kt. */
export function estimatePercentile(
  value: number,
  ageYears: number,
  gender: string,
  metric: "HEIGHT" | "WEIGHT"
): number {
  const spread = metric === "HEIGHT" ? HEIGHT_SPREAD : WEIGHT_SPREAD;
  const p50 = medianAtAge(ageYears, gender, metric);
  if (p50 <= 0 || !Number.isFinite(value) || value <= 0) return 50;
  const zScore = (value / p50 - 1) / spread;
  let pct: number;
  if (zScore <= -1.88) pct = 3;
  else if (zScore <= -1.04) pct = 3 + Math.trunc(((zScore + 1.88) / 0.84) * 12);
  else if (zScore <= 0) pct = 15 + Math.trunc(((zScore + 1.04) / 1.04) * 35);
  else if (zScore <= 1.04) pct = 50 + Math.trunc((zScore / 1.04) * 35);
  else if (zScore <= 1.88) pct = 85 + Math.trunc(((zScore - 1.04) / 0.84) * 12);
  else pct = 97;
  return Math.min(Math.max(pct, 1), 99);
}

export function bmi(heightCm: number, weightKg: number): number {
  if (!heightCm || !weightKg || heightCm <= 0) return 0;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

// ─── Per-check flag proposals ───────────────────────────────

export interface FindingInput {
  checkType: string;
  /** Free-form measurements, shape depends on the check. */
  detail: Record<string, unknown>;
}

export interface FindingContext {
  ageYears: number;
  gender: string;
}

export interface Proposal {
  flag: Flag;
  /** One line a screener can read back to confirm the machine agrees with them. */
  rationale: string;
  /** Canonical numeric value for the check, where one exists. */
  valueNum: number | null;
  valueText: string;
  urgency: Urgency;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
};

/**
 * Snellen acuity, worse eye decides. 6/6 is normal vision.
 * Referral thresholds follow the usual school-screening convention: 6/12 or
 * worse warrants a look, 6/24 or worse warrants a referral.
 */
const ACUITY_ORDER = ["6/6", "6/9", "6/12", "6/18", "6/24", "6/36", "6/60", "<6/60"];

export function acuityRank(v: string): number {
  const i = ACUITY_ORDER.indexOf((v || "").trim());
  return i < 0 ? -1 : i;
}

export function proposeFlag(input: FindingInput, ctx: FindingContext): Proposal {
  const d = input.detail || {};

  switch (input.checkType) {
    case "Height & weight": {
      const h = num(d.heightCm);
      const w = num(d.weightKg);
      if (h === null || w === null) {
        return notMeasured("Height and weight not recorded");
      }
      const hPct = estimatePercentile(h, ctx.ageYears, ctx.gender, "HEIGHT");
      const wPct = estimatePercentile(w, ctx.ageYears, ctx.gender, "WEIGHT");
      const b = bmi(h, w);
      let flag: Flag = "GOOD";
      let why = `Height ${hPct}th percentile, weight ${wPct}th, BMI ${b}`;
      if (hPct < 3 || wPct < 3) {
        flag = "ALERT";
        why += " — below the 3rd percentile";
      } else if (wPct >= 97) {
        flag = "ALERT";
        why += " — at or above the 97th percentile for weight";
      } else if (hPct < 15 || wPct < 15 || wPct > 90) {
        flag = "WATCH";
        why += " — outside the 15th-90th band";
      } else {
        why += " — within the normal band";
      }
      return {
        flag,
        rationale: why,
        valueNum: b,
        valueText: `${h} cm, ${w} kg`,
        urgency: flag === "ALERT" ? "SOON" : flag === "WATCH" ? "ROUTINE" : "NONE",
      };
    }

    case "Vision": {
      const left = String(d.leftAcuity || "").trim();
      const right = String(d.rightAcuity || "").trim();
      if (!left && !right) return notMeasured("Vision not tested");
      const worst = Math.max(acuityRank(left), acuityRank(right));
      if (worst < 0) return notMeasured("Vision result not recognised");
      const squint = d.squint === true;
      const worstLabel = ACUITY_ORDER[worst];
      let flag: Flag = "GOOD";
      let why = `Worse eye ${worstLabel}`;
      if (worst >= acuityRank("6/24")) {
        flag = "ALERT";
        why += " — needs an eye examination";
      } else if (worst >= acuityRank("6/12")) {
        flag = "WATCH";
        why += " — below normal";
      } else {
        why += " — normal";
      }
      if (squint && flag === "GOOD") {
        flag = "WATCH";
        why += ", squint noted";
      } else if (squint) {
        why += ", squint noted";
      }
      return {
        flag,
        rationale: why,
        valueNum: worst,
        valueText: `L ${left || "—"} / R ${right || "—"}`,
        urgency: flag === "ALERT" ? "SOON" : flag === "WATCH" ? "ROUTINE" : "NONE",
      };
    }

    case "Dental": {
      const caries = num(d.cariesCount);
      const gums = String(d.gums || "").toLowerCase();
      const pain = d.pain === true;
      if (caries === null && !gums) return notMeasured("Dental check not recorded");
      let flag: Flag = "GOOD";
      const parts: string[] = [];
      if (caries !== null) {
        parts.push(`${caries} carious ${caries === 1 ? "tooth" : "teeth"}`);
        if (caries >= 3) flag = "ALERT";
        else if (caries >= 1) flag = "WATCH";
      }
      if (gums === "bleeding" || gums === "swollen") {
        parts.push(`${gums} gums`);
        if (flag === "GOOD") flag = "WATCH";
      }
      if (pain) {
        parts.push("reports pain");
        flag = "ALERT";
      }
      if (parts.length === 0) parts.push("no findings");
      return {
        flag,
        rationale: parts.join(", "),
        valueNum: caries,
        valueText: parts.join(", "),
        urgency: flag === "ALERT" ? (pain ? "URGENT" : "SOON") : flag === "WATCH" ? "ROUTINE" : "NONE",
      };
    }

    case "Haemoglobin": {
      const hb = num(d.hb);
      if (hb === null) return notMeasured("Haemoglobin not measured");
      // WHO cut-offs for children, simplified by age band.
      const age = ctx.ageYears;
      const mild = age < 5 ? 11.0 : age < 12 ? 11.5 : 12.0;
      const severe = 8.0;
      let flag: Flag = "GOOD";
      let why = `${hb} g/dL`;
      if (hb < severe) {
        flag = "ALERT";
        why += " — severe anaemia";
      } else if (hb < mild) {
        flag = "WATCH";
        why += ` — below the ${mild} g/dL cut-off for this age`;
      } else {
        why += " — normal";
      }
      return {
        flag,
        rationale: why,
        valueNum: hb,
        valueText: `${hb} g/dL`,
        urgency: flag === "ALERT" ? "URGENT" : flag === "WATCH" ? "ROUTINE" : "NONE",
      };
    }

    // Observational checks: the screener says normal or abnormal, and a note.
    case "ENT":
    case "Skin":
    case "Spine":
    case "Immunisation review": {
      const outcome = String(d.outcome || "").toLowerCase();
      if (!outcome) return notMeasured(`${input.checkType} not recorded`);
      const note = String(d.note || "").trim();
      const flag: Flag =
        outcome === "referral" ? "ALERT" : outcome === "abnormal" ? "WATCH" : "GOOD";
      return {
        flag,
        rationale: note || (flag === "GOOD" ? "No findings" : outcome),
        valueNum: null,
        valueText: note || outcome,
        urgency: flag === "ALERT" ? "SOON" : flag === "WATCH" ? "ROUTINE" : "NONE",
      };
    }

    default:
      return notMeasured("Unknown check type");
  }
}

function notMeasured(why: string): Proposal {
  return { flag: "NOT_MEASURED", rationale: why, valueNum: null, valueText: "", urgency: "NONE" };
}

// ─── Rolling findings up to the parent-facing summary ───────

const SEVERITY: Record<Flag, number> = { NOT_MEASURED: -1, GOOD: 0, WATCH: 1, ALERT: 2 };

export function worstFlag(flags: Flag[]): Flag {
  const measured = flags.filter((f) => f !== "NOT_MEASURED");
  if (measured.length === 0) return "NOT_MEASURED";
  return measured.reduce((a, b) => (SEVERITY[b] > SEVERITY[a] ? b : a), "GOOD" as Flag);
}

export function worstUrgency(list: Urgency[]): Urgency {
  const order: Urgency[] = ["NONE", "ROUTINE", "SOON", "URGENT"];
  return list.reduce((a, b) => (order.indexOf(b) > order.indexOf(a) ? b : a), "NONE" as Urgency);
}

/**
 * Project a child's findings onto the three flags the parent app displays,
 * plus the measurements it charts.
 *
 * Nutrition is the worse of growth and haemoglobin: a child can be on the
 * height curve and still anaemic, and the app has one nutrition flag to say so.
 */
export interface KidSummary {
  dental: Flag;
  eyesight: Flag;
  nutrition: Flag;
  heightCm: number | null;
  weightKg: number | null;
  overallScore: number;
  urgency: Urgency;
}

export function summariseForApp(
  findings: Array<{ checkType: string; flag: Flag; detail: Record<string, unknown>; urgency: Urgency }>
): KidSummary {
  const by = (t: string) => findings.find((f) => f.checkType === t);

  const growth = by("Height & weight");
  const hb = by("Haemoglobin");
  const dental = by("Dental");
  const vision = by("Vision");

  const nutrition = worstFlag([
    growth ? growth.flag : "NOT_MEASURED",
    hb ? hb.flag : "NOT_MEASURED",
  ]);

  const heightCm = growth ? num(growth.detail.heightCm) : null;
  const weightKg = growth ? num(growth.detail.weightKg) : null;

  const all: Flag[] = findings.map((f) => f.flag);
  const worst = worstFlag(all);
  const overallScore = worst === "ALERT" ? 58 : worst === "WATCH" ? 72 : worst === "GOOD" ? 88 : 80;

  return {
    dental: dental ? dental.flag : "NOT_MEASURED",
    eyesight: vision ? vision.flag : "NOT_MEASURED",
    nutrition,
    heightCm,
    weightKg,
    overallScore,
    urgency: worstUrgency(findings.map((f) => f.urgency)),
  };
}

/**
 * The default plain-language line a physician sees pre-filled before they edit
 * it. Deliberately cautious, and never a diagnosis.
 */
export function draftRecommendation(name: string, summary: KidSummary): string {
  const concerns: string[] = [];
  if (summary.eyesight === "ALERT" || summary.eyesight === "WATCH") concerns.push("vision");
  if (summary.dental === "ALERT" || summary.dental === "WATCH") concerns.push("dental health");
  if (summary.nutrition === "ALERT" || summary.nutrition === "WATCH") concerns.push("growth and nutrition");

  if (concerns.length === 0) {
    return `${name}'s check-up was normal. Nothing needs follow-up right now — keep up the usual routine of balanced meals, outdoor play and brushing twice a day.`;
  }
  const list =
    concerns.length === 1
      ? concerns[0]
      : concerns.slice(0, -1).join(", ") + " and " + concerns[concerns.length - 1];
  const when =
    summary.urgency === "URGENT"
      ? "Please see a doctor within the next few days."
      : summary.urgency === "SOON"
        ? "Please book an appointment in the next two weeks."
        : "Please mention this at your next routine visit.";
  return `${name}'s check-up found something worth following up on ${list}. ${when} This screening is for information only and is not a diagnosis.`;
}
