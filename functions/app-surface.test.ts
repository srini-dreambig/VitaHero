// What the backend screens for, against what the app can actually show.
//
// Asked: "Did you check the screens in the app? not in admin panel." I had
// not. The specialty list was derived from DESIGNED_CHECKS in clinical.ts and
// from the console's capture forms — both of them this repository's server and
// admin side. Whether a parent has anywhere to *see* the result never entered
// into it.
//
// It happens to line up: the app's four health tabs are Growth, Dental, Eye
// and Nutrition, and the four designed checks land in them. But that is
// inheritance, not a guarantee. A fifth designed check would be captured at a
// camp, stored, released, and then reach a parent as a line of text in the
// camp result with no health tab, no flag and no trend — and every test here
// would still pass.
//
// So this is the gate. It reads the Android source, because the Android source
// is the thing that decides what a family sees.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  DESIGNED_CHECKS, PLANNED_CHECKS, summariseForApp, specialtyOptions, screeningChecksFor,
} from "./clinical";

const APP = "../android/app/src/main/java/com/rork/vitahero";
const read = (f: string) => readFileSync(`${APP}/${f}`, "utf8");

/** The tabs KidDetailScreen offers, read off the enum rather than assumed. */
function appHealthTabs(): string[] {
  const src = read("ui/screens/KidDetailScreen.kt");
  const m = src.match(/private enum class DetailTab\([^)]*\)\s*\{([\s\S]*?)\}/);
  if (!m) throw new Error("DetailTab enum not found — KidDetailScreen has been restructured");
  return (m[1].match(/\b([A-Z][A-Z_]*)\s*\(/g) || []).map((x) => x.replace(/\s*\($/, ""));
}

/** The health fields on the app's Kid model. */
function appKidFields(): string[] {
  const src = read("data/Models.kt");
  const m = src.match(/data class Kid\(([\s\S]*?)\n\)/);
  if (!m) throw new Error("Kid data class not found");
  return (m[1].match(/val\s+(\w+)\s*:/g) || []).map((x) => x.replace(/val\s+/, "").replace(/\s*:$/, ""));
}

const flag = (checkType: string, detail: Record<string, unknown>) =>
  summariseForApp([{ checkType, flag: "WATCH" as const, detail, urgency: "ROUTINE" as const }]);

/** The measurement each designed check actually produces. */
const SAMPLE: Record<string, Record<string, unknown>> = {
  "Height & weight": { heightCm: 120, weightKg: 22 },
  Vision: { leftAcuity: "6/18", rightAcuity: "6/6" },
  Dental: { cariesCount: 2 },
  Haemoglobin: { hb: 9.5 },
};

describe("the app can show what a camp screens for", () => {
  test("the app's health tabs are the ones this file reasons about", () => {
    // If a tab is added or renamed, everything below is reasoning about a
    // screen that no longer exists, so fail here and say so rather than
    // quietly passing.
    expect(appHealthTabs().sort()).toEqual(["DENTAL", "EYE", "GROWTH", "NUTRITION"]);
  });

  test("and the Kid model carries a field behind each of them", () => {
    const fields = appKidFields();
    for (const f of ["growth", "dental", "eyesight", "nutrition"]) {
      expect(fields, f).toContain(f);
    }
  });

  test("every designed check reaches a parent as something, not just text", () => {
    // The real assertion. A check a camp can capture must move a value the app
    // renders as a health area — otherwise it is recorded, released, and shown
    // to the family as a bare line in the camp result with no flag and no
    // trend, which is not a result, it is a receipt.
    for (const check of DESIGNED_CHECKS) {
      const s = flag(check, SAMPLE[check] || {});
      const surfaced =
        s.dental !== "NOT_MEASURED" ||
        s.eyesight !== "NOT_MEASURED" ||
        s.nutrition !== "NOT_MEASURED" ||
        s.heightCm !== null ||
        s.weightKg !== null;
      expect(surfaced, `${check} reaches no health tab in the app`).toBe(true);
    }
  });

  test("and lands where a parent would look for it", () => {
    expect(flag("Vision", SAMPLE.Vision).eyesight).toBe("WATCH");
    expect(flag("Dental", SAMPLE.Dental).dental).toBe("WATCH");
    // Haemoglobin has no tab of its own: it is anaemia, and the app says that
    // under Nutrition. Worth asserting rather than assuming, because the name
    // on the capture form and the name on the app's tab are different words
    // for the same finding.
    expect(flag("Haemoglobin", SAMPLE.Haemoglobin).nutrition).toBe("WATCH");
    const growth = flag("Height & weight", SAMPLE["Height & weight"]);
    expect(growth.heightCm).toBe(120);
    expect(growth.nutrition).toBe("WATCH");
  });

  test("a planned check has no app surface either, which is why it is planned", () => {
    // Stated so the split does not get read as "the capture screen is the only
    // thing missing". Building one is two pieces of work: somewhere for a
    // clinician to record it, and somewhere for a family to see it.
    for (const check of PLANNED_CHECKS) {
      const s = flag(check, {});
      expect(s.dental, check).toBe("NOT_MEASURED");
      expect(s.eyesight, check).toBe("NOT_MEASURED");
      expect(s.nutrition, check).toBe("NOT_MEASURED");
      expect(s.heightCm, check).toBeNull();
    }
  });

  test("no specialty is offered as screening one that the app cannot show", () => {
    // The list the doctor dropdown is built from, checked against the app
    // rather than against the server that produced it.
    for (const sp of specialtyOptions().filter((x) => x.canScreen)) {
      for (const check of sp.checks) {
        const s = flag(check, SAMPLE[check] || {});
        const surfaced =
          s.dental !== "NOT_MEASURED" || s.eyesight !== "NOT_MEASURED" ||
          s.nutrition !== "NOT_MEASURED" || s.heightCm !== null;
        expect(surfaced, `${sp.name} screens ${check}, which the app cannot display`).toBe(true);
      }
    }
  });

  test("a specialty with no app surface screens nothing, whatever the console can capture", () => {
    for (const name of ["Dermatology", "Orthopaedics", "ENT"]) {
      expect(screeningChecksFor(name), name).toEqual([]);
    }
  });
});

// ── the capture form and the rules that read it ─────────────
//
// The other half of the same question. The console's screening form writes
// keys into a finding's `detail`, and clinical.ts reads keys out of it. Nothing
// checked they were the same keys.
//
// They are, today. But the failure is silent and total: rename `cariesCount`
// in the form and every dental check becomes "Dental check not recorded" —
// captured at the camp, stored, released, and shown to the parent as NOT
// MEASURED. No error anywhere, on either side. This is how I found it: my own
// tests used `cavities` and `leftEye`, the findings all came back
// NOT_MEASURED, and the assertions passed anyway because they only counted
// rows.
describe("the console's form writes what the clinical rules read", () => {
  const portal = readFileSync("./portal.ts", "utf8");
  const clinical = readFileSync("./clinical.ts", "utf8");

  /** The detail keys the form binds for one check, read off the form itself. */
  function formKeys(checkType: string): string[] {
    const start = portal.indexOf(`if (ct === "${checkType}")`);
    expect(start, `no capture form for ${checkType}`).toBeGreaterThan(0);
    // Bounded by the next check, or by the generic fallback the form falls
    // through to for a check with no designed screen — reading past it picks
    // up that fallback's "outcome" and reports it against the last check.
    const rest = portal.slice(start + 10);
    const ends = [rest.indexOf("if (ct ==="), rest.indexOf('el("label", null, "Result")')]
      .filter((i) => i >= 0);
    const block = rest.slice(0, ends.length ? Math.min(...ends) : rest.length);
    const keys = new Set<string>();
    for (const m of block.matchAll(/bind\("(\w+)"/g)) keys.add(m[1]);
    // Checkboxes assign directly rather than through bind().
    for (const m of block.matchAll(/\bd\.(\w+) = e\.target\.checked/g)) keys.add(m[1]);
    // The clinician's free-text note, which is stored as screener_note and is
    // deliberately not an input to any rule.
    keys.delete("__note");
    return [...keys];
  }

  /** The detail keys the rule for one check actually reads. */
  function ruleKeys(checkType: string): string[] {
    const start = clinical.indexOf(`case "${checkType}":`);
    expect(start, `no clinical rule for ${checkType}`).toBeGreaterThan(0);
    const block = clinical.slice(start, clinical.indexOf("\n    case ", start + 10));
    const keys = new Set<string>();
    for (const m of block.matchAll(/\bd\.(\w+)/g)) keys.add(m[1]);
    return [...keys];
  }

  for (const check of DESIGNED_CHECKS) {
    test(`${check}: every field the form offers is one the rules read`, () => {
      const form = formKeys(check);
      const rule = ruleKeys(check);
      expect(form.length, `${check} form binds nothing`).toBeGreaterThan(0);
      expect(rule.length, `${check} rule reads nothing`).toBeGreaterThan(0);

      // Per field, not per check. A form with four fields where three still
      // match would otherwise hide the fourth: the finding is not
      // NOT_MEASURED, so nothing looks wrong, and the clinician's fourth
      // measurement is silently dropped on the way to the parent.
      const orphaned = form.filter((k) => !rule.includes(k));
      expect(
        orphaned,
        `${check}: the form writes ${orphaned.join(", ")}, which no clinical rule reads — ` +
          `a clinician fills it in and it is thrown away. The rule reads: ${rule.join(", ")}`
      ).toEqual([]);
    });
  }
});
