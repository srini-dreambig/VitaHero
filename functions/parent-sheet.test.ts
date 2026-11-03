// The parent's assessment sheets: the paper sheet's columns, in its words.

import { describe, expect, test } from "bun:test";
import { assessmentSheet, growthSummary } from "./parent-sheet";

const girl = { ageYears: 9, gender: "Female", dob: "" };
const rows = (checkType: string, detail: Record<string, unknown>) =>
  Object.fromEntries((assessmentSheet(checkType, detail, girl)?.rows || []).map((r) => [r.label, r.value]));

describe("physical growth sheet", () => {
  test("height, weight, mid-arm, BMI and the IAP, WHO and MUAC readings", () => {
    const sheet = assessmentSheet("Height & weight", { heightCm: "132", weightKg: "28", muacCm: "18.5" }, girl)!;
    const r = Object.fromEntries(sheet.rows.map((x) => [x.label, x.value]));
    expect(sheet.rows.map((x) => x.label)).toEqual([
      "Height", "Weight", "Mid-arm circumference", "BMI",
      "Height-for-age", "Weight-for-age", "BMI-for-age", "MUAC-for-age", "Nutritional status",
    ]);
    expect(r.Height).toBe("132 cm");
    expect(r.BMI).toBe("16.1 kg/m²");
    // IAP first, then the WHO z-score.
    expect(r["Height-for-age"]).toMatch(/^IAP \S+ centile; WHO z [+-]\d\.\d\d \(\d+\w\w percentile\)$/);
    expect(r["BMI-for-age"]).toContain("IAP ");
    expect(r["MUAC-for-age"]).toMatch(/^z [+-]\d\.\d\d/);
    expect(r["Nutritional status"]).toBe("Normal");
    expect(sheet.growth).toEqual({ heightCm: 132, weightKg: 28, muacCm: 18.5 });
  });

  test("no mid-arm measured, no mid-arm row", () => {
    const labels = assessmentSheet("Height & weight", { heightCm: "132", weightKg: "28" }, girl)!.rows.map((x) => x.label);
    expect(labels).not.toContain("Mid-arm circumference");
    expect(labels).not.toContain("MUAC-for-age");
    expect(labels).toContain("BMI");
    expect(labels).toContain("Nutritional status");
  });

  test("the physician's BMI and nutritional status", () => {
    expect(growthSummary({ heightCm: "132", weightKg: "28" }, girl)).toEqual({ bmi: "16.1 kg/m²", nutritionalStatus: "Normal" });
    expect(growthSummary({ heightCm: "132", weightKg: "28", nutritionalStatus: "Stunted" }, girl).nutritionalStatus).toBe("Stunted");
    expect(growthSummary({}, girl)).toEqual({ bmi: "", nutritionalStatus: "" });
  });

  test("nothing measured reads not recorded, with no chart", () => {
    const sheet = assessmentSheet("Height & weight", {}, girl)!;
    expect(sheet.rows.every((x) => x.value === "Not recorded")).toBe(true);
    expect(sheet.growth).toBeUndefined();
  });
});

describe("vision sheet", () => {
  test("every tested value, prescriptions per eye", () => {
    const r = rows("Vision", {
      rightAcuity: "6/6", leftAcuity: "6/12", rightNearVision: "N6 (Normal)", leftNearVision: "N8",
      testingCondition: "Unaided",
      newOdUva: "6/18", newOdSph: "-2.00", newOdCyl: "-0.75", newOdAxi: "180", newOdCva: "6/6",
      colorVision: "17/17 (Normal Pass)", otherComplaints: "Headache after reading",
    });
    expect(Object.keys(r)).toEqual([
      "Visual acuity, distance", "Visual acuity, near", "Testing condition",
      "Present glasses prescription", "New glasses prescription", "Colour vision", "Any other complaints",
    ]);
    expect(r["Visual acuity, distance"]).toBe("Right (OD) 6/6, Left (OS) 6/12");
    expect(r["Visual acuity, near"]).toBe("Right (OD) N6 (Normal), Left (OS) N8");
    expect(r["Present glasses prescription"]).toBe("None");
    expect(r["New glasses prescription"]).toBe("Right (OD): UVA 6/18, Sph -2.00, Cyl -0.75, Axis 180, CVA 6/6");
    expect(r["Any other complaints"]).toBe("Headache after reading");
  });

  test("the prescription as the glasses slip lays it out", () => {
    const sheet = assessmentSheet("Vision", {
      newOdSph: "-2.00", newOdCyl: "-0.75", newOdAxi: "180", newOdCva: "6/6",
      newOsSph: "-2.25", newOsCva: "6/9",
      newOdNearSph: "+1.00", newOdNearVa: "N6",
      newLensType: "Bifocals",
    }, girl)!;
    expect(sheet.rx).toEqual([{
      title: "New glasses prescription",
      lensType: "Bifocals",
      rows: [
        { label: "D/V", right: { sph: "-2.00", cyl: "-0.75", axis: "180", va: "6/6" }, left: { sph: "-2.25", cyl: "", axis: "", va: "6/9" } },
        { label: "N/V", right: { sph: "+1.00", cyl: "", axis: "", va: "N6" }, left: { sph: "", cyl: "", axis: "", va: "" } },
      ],
    }]);
    // Older apps read the row's text.
    const r = Object.fromEntries(sheet.rows.map((x) => [x.label, x.value]));
    expect(r["New glasses prescription"]).toBe(
      "Right (OD): Sph -2.00, Cyl -0.75, Axis 180, CVA 6/6, near Sph +1.00, V/A N6; Left (OS): Sph -2.25, CVA 6/9; Lens: Bifocals");
  });

  test("no prescription written, no table", () => {
    expect(assessmentSheet("Vision", { rightAcuity: "6/6" }, girl)!.rx).toBeUndefined();
  });

  test("an older record's abnormality is kept", () => {
    expect(rows("Vision", { otherAbnormalities: "Squint" })["Other abnormalities"]).toBe("Squint");
    expect(rows("Vision", {})["Visual acuity, near"]).toBe("Not recorded");
  });
});

describe("dental sheet", () => {
  test("the four parts in the sheet's order, then complaints", () => {
    const r = rows("Dental", {
      hygiene: "Fair (Mild Plaque)", dentition: "Mixed", cariesCount: "3", missingCount: "0", filledCount: "1",
      fluorosis: "None", dentalSymptoms: "Reports Toothache / Pain,Hot / Cold Sensitivity",
      treatmentNeeded: "Restorative Dental Filling",
    });
    expect(Object.keys(r)).toEqual([
      "Tooth index", "Oral hygiene index", "Enamel, alignment & occlusion", "Treatment plan",
      "Any other complaints",
    ]);
    expect(r["Tooth index"]).toBe("dmft/DMFT 4 (decayed 3, missing 0, filled 1)");
    expect(r["Oral hygiene index"]).toBe("Fair (Mild Plaque)");
    expect(r["Enamel, alignment & occlusion"]).toBe("Dental fluorosis: None");
    expect(r["Any other complaints"]).toBe("Reports Toothache / Pain, Hot / Cold Sensitivity");
    expect(r["Treatment plan"]).toBe("Restorative Dental Filling");
  });

  test("any other complaints joins the complaints row", () => {
    const r = rows("Dental", { hygiene: "Good", otherComplaints: "Bleeding gums" });
    expect(r["Any other complaints"]).toBe("Bleeding gums");
  });
});

test("the other checks have no sheet", () => {
  expect(assessmentSheet("ENT", {}, girl)).toBeNull();
});
