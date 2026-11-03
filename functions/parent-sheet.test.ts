// The parent's assessment sheets: the paper sheet's columns, in its words.

import { describe, expect, test } from "bun:test";
import { assessmentSheet } from "./parent-sheet";

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

  test("nothing measured reads not recorded, with no chart", () => {
    const sheet = assessmentSheet("Height & weight", {}, girl)!;
    expect(sheet.rows.every((x) => x.value === "Not recorded")).toBe(true);
    expect(sheet.growth).toBeUndefined();
  });
});

describe("vision sheet", () => {
  test("the seven columns, prescriptions per eye", () => {
    const r = rows("Vision", {
      rightAcuity: "6/6", leftAcuity: "6/12", testingCondition: "Unaided",
      newOdUva: "6/18", newOdSph: "-2.00", newOdCyl: "-0.75", newOdAxi: "180", newOdCva: "6/6",
      colorVision: "17/17 (Normal Pass)", otherComplaints: "Headache after reading",
    });
    expect(Object.keys(r)).toEqual([
      "Visual acuity", "Testing condition", "Present glasses prescription", "New glasses prescription",
      "Colour vision", "Other complaints", "Other abnormalities",
    ]);
    expect(r["Visual acuity"]).toBe("Right (OD) 6/6, Left (OS) 6/12");
    expect(r["Present glasses prescription"]).toBe("None");
    expect(r["New glasses prescription"]).toBe("Right (OD): UVA 6/18, Sph -2.00, Cyl -0.75, Axis 180, CVA 6/6");
    expect(r["Other complaints"]).toBe("Headache after reading");
    expect(r["Other abnormalities"]).toBe("None");
  });
});

describe("dental sheet", () => {
  test("the six columns, complaints and interventions as lists", () => {
    const r = rows("Dental", {
      hygiene: "Fair (Mild Plaque)", dentition: "Mixed", cariesCount: "3", missingCount: "0", filledCount: "1",
      fluorosis: "None", dentalSymptoms: "Reports Toothache / Pain,Hot / Cold Sensitivity",
      treatmentNeeded: "Restorative Dental Filling",
    });
    expect(Object.keys(r)).toEqual([
      "Oral hygiene", "Tooth index", "Dental fluorosis", "Complaints", "Other abnormalities",
      "Recommended dental intervention",
    ]);
    expect(r["Tooth index"]).toBe("dmft/DMFT 4 (decayed 3, missing 0, filled 1)");
    expect(r.Complaints).toBe("Reports Toothache / Pain, Hot / Cold Sensitivity");
    expect(r["Other abnormalities"]).toBe("None");
    expect(r["Recommended dental intervention"]).toBe("Restorative Dental Filling");
  });

  test("any other complaints joins the complaints row", () => {
    const r = rows("Dental", { hygiene: "Good", otherComplaints: "Bleeding gums" });
    expect(r.Complaints).toBe("Bleeding gums");
  });
});

test("the other checks have no sheet", () => {
  expect(assessmentSheet("ENT", {}, girl)).toBeNull();
});
