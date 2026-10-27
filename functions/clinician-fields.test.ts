// The fields a doctor fills on the app's clinician form, as the rules read them.
//
// app-surface.test.ts checks that every field the app sends is one a rule
// reads. These check what the rule then does with it: a finding the doctor
// recorded reaches the flag and the line the parent reads.

import { describe, expect, test } from "bun:test";
import { proposeFlag } from "./clinical";

const ctx = { ageYears: 9, gender: "Female" };
const flag = (checkType: string, detail: Record<string, unknown>) =>
  proposeFlag({ checkType, detail }, ctx);

describe("Vision: the doctor's full eye examination", () => {
  const clear = { leftAcuity: "6/6", rightAcuity: "6/6" };

  test("normal findings leave a normal chart normal", () => {
    const r = flag("Vision", {
      ...clear, rightLashes: "Normal", rightCornea: "Normal / Clear", rightAc: "Normal / Quiet",
      pupilSize: "Normal (3-5mm)", ocularMotility: "Full in all 9 Gazes", gonioscopy: "Grade 4 (Open Angle)",
      rightNearVision: "N6 (Normal)", leftNearVision: "N6 (Normal)",
    });
    expect(r.flag).toBe("GOOD");
  });

  test("a sight-threatening finding alerts even with 6/6 vision", () => {
    const r = flag("Vision", { ...clear, rightOpticDisc: "Papilledema / Swollen" });
    expect(r.flag).toBe("ALERT");
    expect(r.rationale).toContain("optic disc OD: Papilledema / Swollen");
  });

  test("a minor finding, poor near vision or a new prescription asks for a watch", () => {
    expect(flag("Vision", { ...clear, leftLid: "Chalazion" }).flag).toBe("WATCH");
    expect(flag("Vision", { ...clear, leftNearVision: "N12" }).flag).toBe("WATCH");
    const rx = flag("Vision", { ...clear, newOdSph: "-2.00", newOdCyl: "-0.75", newOdAxi: "180", newOdUva: "6/18" });
    expect(rx.flag).toBe("WATCH");
    expect(rx.rationale).toContain("new glasses OD -2.00 -0.75 × 180");
    expect(rx.rationale).toContain("unaided OD 6/18");
  });

  test("the diagnosis and plan reach the parent's line; the final diagnosis wins", () => {
    const r = flag("Vision", {
      ...clear, provisionalDiagnosis: "Suspect myopia", finalDiagnosis: "Simple myopia", planOfCare: "Glasses, review in 6 months",
      testingCondition: "Aided (With Present Glasses)",
    });
    expect(r.rationale).toContain("diagnosis: Simple myopia");
    expect(r.rationale).not.toContain("Suspect myopia");
    expect(r.rationale).toContain("plan: Glasses, review in 6 months");
    expect(r.valueText).toContain("(aided (with present glasses))");
  });

  test("the app's capitalised external exam reads the same as the console's", () => {
    expect(flag("Vision", { ...clear, externalExam: "Normal" }).flag).toBe("GOOD");
    expect(flag("Vision", { ...clear, externalExam: "Conjunctivitis" }).flag).toBe("WATCH");
  });
});

describe("the other checks' app-only fields", () => {
  test("Dental: an oral habit is noted and watched", () => {
    expect(flag("Dental", { cariesCount: "0", dentalHabits: "None" }).flag).toBe("GOOD");
    const r = flag("Dental", { cariesCount: "0", dentalHabits: "Thumb Sucking,Mouth Breathing" });
    expect(r.flag).toBe("WATCH");
    expect(r.rationale).toContain("habits: thumb sucking, mouth breathing");
  });

  test("ENT: a speech finding is noted and watched", () => {
    expect(flag("ENT", { leftHearing: "normal", speechVoice: "Normal Speech" }).flag).toBe("GOOD");
    expect(flag("ENT", { speechVoice: "Stuttering / Stammering" }).flag).toBe("WATCH");
  });

  test("Skin: night-time itching is treated as possible scabies", () => {
    const r = flag("Skin", { pruritus: "Nocturnal Itching (Scabies)", itching: "true", lice: "false" });
    expect(r.flag).toBe("ALERT");
    expect(r.rationale).toContain("possible scabies");
  });

  test("Spine: swelling and laxity are no longer lost behind the pain flag", () => {
    const r = flag("Spine", { jointSymptoms: "Joint Swelling / Effusion", jointPain: "false", restrictedMotion: "false" });
    expect(r.flag).toBe("WATCH");
    expect(r.rationale).toContain("joint swelling");
  });
});
