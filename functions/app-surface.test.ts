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
const PORTAL_SRC = readFileSync("./portal.ts", "utf8");
const CLINICAL_SRC = readFileSync("./clinical.ts", "utf8");

/**
 * The detail keys the console's capture form binds for one check.
 *
 * Module scope, because two gates read it: the console's own fields against
 * the clinical rules, and the app's fields against the console's. Two copies
 * of this would be two things to keep in step.
 */
function consoleFormKeys(checkType: string): string[] {
  const start = PORTAL_SRC.indexOf(`if (ct === "${checkType}")`);
  expect(start, `no capture form for ${checkType}`).toBeGreaterThan(0);
  // Bounded by the next check, or by the generic fallback the form falls
  // through to for a check with no designed screen — reading past it picks
  // up that fallback's "outcome" and reports it against the last check.
  const rest = PORTAL_SRC.slice(start + 10);
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
function clinicalRuleKeys(checkType: string): string[] {
  const start = CLINICAL_SRC.indexOf(`case "${checkType}":`);
  expect(start, `no clinical rule for ${checkType}`).toBeGreaterThan(0);
  const end = CLINICAL_SRC.indexOf("\n    case ", start + 10);
  const block = CLINICAL_SRC.slice(start, end >= 0 ? end : undefined);
  const keys = new Set<string>();
  for (const m of block.matchAll(/\bd\.(\w+)/g)) keys.add(m[1]);
  return [...keys];
}

describe("the console's form writes what the clinical rules read", () => {
  for (const check of DESIGNED_CHECKS) {
    test(`${check}: every field the form offers is one the rules read`, () => {
      const form = consoleFormKeys(check);
      const rule = clinicalRuleKeys(check);
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

// ── and the clinician's form in the app writes them too ─────
//
// The same silent failure, now on a second surface. A dentist at a camp fills
// the form on their phone; the keys travel up as a finding's `detail`; the
// rules read them by name. Get one name wrong and the child's dental check is
// stored, released and shown to their parent as NOT MEASURED, with nothing
// failing anywhere on the way.
//
// The console's form has had this gate since the day the bug was found in it.
// The app's form is newer, has never been compiled, and is the one a doctor
// will actually be holding.
describe("the app's clinician form writes what the clinical rules read", () => {
  const screen = readFileSync(
    `${APP}/ui/screens/ClinicianScreeningScreen.kt`, "utf8"
  );

  /** The `when (check)` arm for one check, as the composable writes it. */
  function armOf(checkType: string): string {
    const start = screen.indexOf(`"${checkType}" ->`);
    expect(start, `the app's form has no arm for ${checkType}`).toBeGreaterThan(0);
    // Bounded by the next arm, or by the else branch that tells a clinician a
    // check has no form yet. Without the bound the last arm swallows it.
    const rest = screen.slice(start + checkType.length + 5);
    const ends = [rest.search(/\n\s{8}"[^"]+" ->/), rest.search(/\n\s{8}else ->/)]
      .filter((i) => i >= 0);
    return rest.slice(0, ends.length ? Math.min(...ends) : rest.length);
  }

  /**
   * The detail keys one arm binds.
   *
   * Every field helper takes the key as its argument after `fields`, so the
   * key is read off the call rather than from a list kept alongside it — a
   * list is a second place to forget.
   */
  function appKeys(checkType: string): string[] {
    const keys = new Set<string>();
    for (const m of armOf(checkType).matchAll(/\bfields,\s*"(\w+)"/g)) keys.add(m[1]);
    return [...keys];
  }

  for (const check of DESIGNED_CHECKS) {
    test(`${check}: the app's fields are the ones the rules read`, () => {
      const app = appKeys(check);
      const rule = clinicalRuleKeys(check);
      expect(app.length, `${check} has no fields in the app's form`).toBeGreaterThan(0);

      const orphaned = app.filter((k) => !rule.includes(k));
      expect(
        orphaned,
        `${check}: the app writes ${orphaned.join(", ")}, which no clinical rule reads — ` +
          `a doctor fills it in at the camp and it is thrown away. The rule reads: ${rule.join(", ")}`
      ).toEqual([]);
    });

    test(`${check}: the app offers every field the console does`, () => {
      // Not a style point. A doctor screening on their phone and a screener
      // typing into the console are recording the same child's check, and the
      // rules do not know which one it came from: a missing field on the
      // phone is a measurement that is simply never taken at a camp the
      // doctor worked, and the flag comes out of the rule regardless.
      const app = appKeys(check);
      const missing = consoleFormKeys(check).filter((k) => !app.includes(k));
      expect(
        missing,
        `${check}: the console captures ${missing.join(", ")} and the app does not`
      ).toEqual([]);
    });
  }
});

// ── the worker and the app agree on what the app is called ──
//
// Android verifies an App Link by fetching /.well-known/assetlinks.json from
// the link's host and checking that it names the package of the app claiming
// it. The worker serves that file with ANDROID_PACKAGE in it.
//
// That constant said com.rork.vitahero — the package the Kotlin lives in —
// while the app installs as kallam.healthcare. Two plausible-looking names
// for the same app, and nothing compared them. So verification failed for
// every install, silently, and every invite link opened a browser instead of
// the app. The Play listing URL the worker falls back to was wrong the same
// way, pointing at a listing that does not exist.
describe("the worker names the app the way Android does", () => {
  const gradle = readFileSync("../android/app/build.gradle.kts", "utf8");
  const worker = readFileSync("./index.ts", "utf8");

  /** The id the app actually installs under — not `namespace`, which is the Kotlin package. */
  const applicationId = gradle.match(/applicationId\s*=\s*"([^"]+)"/)?.[1];
  const androidPackage = worker.match(/const ANDROID_PACKAGE\s*=\s*"([^"]+)"/)?.[1];

  test("assetlinks names the applicationId, not the source package", () => {
    expect(applicationId, "applicationId not found in build.gradle.kts").toBeTruthy();
    expect(androidPackage, "ANDROID_PACKAGE not found in index.ts").toBeTruthy();
    expect(
      androidPackage,
      `the worker serves assetlinks.json for "${androidPackage}" but the app installs as ` +
        `"${applicationId}" — App Link verification fails on a mismatch, and it fails quietly: ` +
        `invite links open a browser and nobody is told why`
    ).toBe(applicationId);
  });

  test("and the namespace is deliberately not the applicationId", () => {
    // Guards the fix as much as the bug. If these two ever become the same
    // string, the test above stops proving anything, because picking either
    // one would pass.
    const namespace = gradle.match(/namespace\s*=\s*"([^"]+)"/)?.[1];
    expect(namespace).toBeTruthy();
    expect(
      namespace,
      "namespace and applicationId are now equal, so the check above no longer distinguishes them"
    ).not.toBe(applicationId);
  });
});

// ── the review contract, name by name ───────────────────────
//
// Approving a child is the step that lets findings out to a family, and the
// app now does it. Every field the physician reads on that screen — the flag
// the rules gave, what was measured, whether the same check was flagged at an
// earlier camp — arrives by name from reviewQueue and reviewDetail.
//
// kotlinx.serialization fills a missing key with the declared default and says
// nothing. So a renamed field does not fail: it shows a physician an empty
// measurement, or a flag of NOT_MEASURED, or "0 alerts" on a child with three,
// and asks them to sign it off. Nothing on either side errors.
describe("the review screens read fields the worker sends", () => {
  const dtos = read("data/ClinicianDtos.kt");
  const camps = readFileSync("./camps.ts", "utf8");

  /** The wire names of one @Serializable class, honouring @SerialName. */
  function dtoFields(name: string): string[] {
    const start = dtos.indexOf(`data class ${name}(`);
    expect(start, `${name} not found in ClinicianDtos.kt`).toBeGreaterThan(0);
    const body = dtos.slice(start, dtos.indexOf("\n)", start));
    const fields: string[] = [];
    for (const m of body.matchAll(/(?:@\w+\.\w+\.\w+\.SerialName\("(\w+)"\)\s*)?\bval\s+(\w+)\s*:/g)) {
      fields.push(m[1] || m[2]);
    }
    return fields;
  }

  /** The body of one exported function in camps.ts. */
  function fn(name: string): string {
    const start = camps.indexOf(`export async function ${name}(`);
    expect(start, `${name} not found in camps.ts`).toBeGreaterThan(0);
    const next = camps.indexOf("\nexport ", start + 10);
    return camps.slice(start, next >= 0 ? next : undefined);
  }

  const cases: Array<[string, string]> = [
    ["ReviewQueueItemDto", "reviewQueue"],
    ["ReviewChildDto", "reviewDetail"],
    ["ReviewDetailDto", "reviewDetail"],
    ["ReviewFindingDto", "reviewDetail"],
    ["RecurringDto", "reviewDetail"],
    ["ReleaseResultDto", "releaseCamp"],
  ];

  for (const [dto, source] of cases) {
    test(`${dto} names only keys ${source} sends`, () => {
      const fields = dtoFields(dto);
      expect(fields.length, `${dto} declares nothing`).toBeGreaterThan(0);
      const body = fn(source);
      const missing = fields.filter((f) => !new RegExp(`\\b${f}\\b`).test(body));
      expect(
        missing,
        `${dto} declares ${missing.join(", ")}, which ${source} never sends — ` +
          `the app will show the Kotlin default and report nothing`
      ).toEqual([]);
    });
  }

  test("a physician cannot approve without telling the guardian something", () => {
    // The server refuses it, and the app's button is disabled until the box
    // has text. Both, because either alone is a way to approve in silence.
    expect(fn("reviewParticipant")).toContain("recommendation");
    const screen = read("ui/screens/ClinicianReviewChildScreen.kt");
    expect(screen).toContain("recommendation.isNotBlank()");
  });
});

// ── nobody is assigned to a dead end ────────────────────────
//
// Four checks exist: height and weight, vision, dental, haemoglobin. ENT,
// Skin, Spine and the immunisation review are named in PLANNED_CHECKS and
// deliberately not built yet.
//
// That is a fine state to be in and a dangerous one to leave unguarded,
// because a specialty is a dropdown an administrator picks from. An ENT
// doctor assigned to a camp signs in, finds the child, opens the form and
// there is nothing in it — discovered in a school hall, by the one person who
// cannot do anything about it.
//
// So the rule is the pairing, not the list: every specialty offered as
// screenable must yield a form, and both assignment paths must refuse one
// that does not. Build ENT tomorrow and these pass the moment its rule lands;
// add ENT to the dropdown without its rule and they fail here.
describe("a specialty is offered only when there is something to record", () => {
  test("every screenable specialty yields at least one check", () => {
    const orphans = specialtyOptions()
      .filter((s) => s.canScreen)
      .filter((s) => screeningChecksFor(s.name).length === 0);
    expect(
      orphans.map((s) => s.name),
      "these specialties are offered as screenable and produce an empty form"
    ).toEqual([]);
  });

  test("and the ones with no screen say so rather than being hidden", () => {
    // Not filtered out of the directory: a dermatologist is a perfectly good
    // referral target, and a school should be able to record that they exist.
    // What they cannot be is a camp clinician.
    const unbuilt = specialtyOptions().filter((s) => !s.canScreen).map((s) => s.name);
    expect(unbuilt.length, "every specialty screens, so this check proves nothing")
      .toBeGreaterThan(0);
    for (const name of unbuilt) {
      expect(screeningChecksFor(name), `${name} claims no screen but returns checks`).toEqual([]);
    }
  });

  test("both assignment paths refuse a specialty with no form", () => {
    // assignDoctorToCamp has always refused. assignCampStaff took a profile id
    // and asked only about the role, so the identical assignment succeeded by
    // coming in the side entrance.
    const camps = readFileSync("./camps.ts", "utf8");
    for (const fn of ["assignDoctorToCamp", "assignCampStaff"]) {
      const start = camps.indexOf(`export async function ${fn}(`);
      expect(start, `${fn} not found`).toBeGreaterThan(0);
      const next = camps.indexOf("\nexport ", start + 10);
      const body = camps.slice(start, next >= 0 ? next : undefined);
      expect(
        body,
        `${fn} does not check the specialty has a screening form`
      ).toContain("SPECIALTY_NOT_SCREENED");
    }
  });

  test("no clinician is ever handed a planned check to record", () => {
    // The invariant that matters, and not the one I first wrote. The four
    // planned checks do have a rule in clinical.ts — a shared placeholder that
    // takes a free-text outcome of normal, abnormal or referral and nothing
    // measured. So "has no rule" was never the thing separating them; having
    // no fields, no form and no health area in the family's app is.
    //
    // What must hold is that none of them reaches a clinician: not through a
    // specialty, not through any camp. Whoever builds ENT flips one list and
    // this starts requiring the rest.
    for (const s of specialtyOptions()) {
      for (const check of screeningChecksFor(s.name)) {
        expect(
          (PLANNED_CHECKS as readonly string[]).includes(check),
          `${s.name} would be asked to record ${check}, which has no form`
        ).toBe(false);
        expect(
          (DESIGNED_CHECKS as readonly string[]).includes(check),
          `${s.name} yields ${check}, which is in neither list`
        ).toBe(true);
      }
    }
  });

  test("a designed check has a rule of its own, not the shared placeholder", () => {
    const clinical = readFileSync("./clinical.ts", "utf8");
    for (const check of DESIGNED_CHECKS) {
      expect(
        clinical,
        `${check} is offered to schools but no rule names it`
      ).toContain(`case "${check}":`);
    }
  });
});
