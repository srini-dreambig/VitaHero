const { chromium } = (await import((process.env.PW_DIR || "playwright") + "/index.js")).default;

// The photo surfaces in the console, against canned data. What is under test is
// the gating: no camera unless the camp has photographs on AND that child's
// guardian said yes to photographs specifically.
async function session(photosEnabled) {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  await p.addInitScript((photos) => {
    localStorage.setItem("vh_console", JSON.stringify({
      mode: "key", key: "k", name: "Ops", role: "SUPERADMIN", schoolId: null }));
    const CAMP = {
      id: "cmp_1", schoolId: "sch_1", schoolName: "Silver Oaks", title: "Annual check-up",
      date: "2027-09-10", time: "09:00", venue: "Hall", status: "IN_PROGRESS",
      checks: ["Vision", "Skin"], grades: ["Class 5"], sections: ["A"], academicYear: "2027-28",
      capacity: 200, consentDeadline: "", photosEnabled: photos, releasedAt: "", resultSummary: "",
      participants: 2, consented: 2, declined: 0, pendingConsent: 0, present: 2, absent: 0,
      screened: 0, awaitingReview: 0, approved: 0, released: 0, urgent: 0,
    };
    const kid = (n, ok) => ({ kidId: "k" + n, name: "Pupil " + n, grade: "Class 5", section: "A",
      gender: "F", age: 10, studentRef: "sid_" + n, guardianName: "Parent " + n,
      guardianPhone: "+91970000000" + n, consentStatus: "GRANTED", consentPhotos: ok,
      attendance: "PRESENT", status: "NOT_SCREENED", urgency: "NONE", recommendation: "", findingsCount: 0 });
    const PARTS = [kid(1, true), kid(2, false), Object.assign(kid(3, false), { consentStatus: "PENDING" })];
    const form = (k, ok) => ({ child: k, consentStatus: "GRANTED", photosEnabled: photos,
      consentPhotos: ok, attendance: "PRESENT", status: "NOT_SCREENED",
      checks: ["Vision", "Skin"], excludedByConsent: [], findings: [] });
    const D = {
      "/api/admin/overview": { schools: 1, students: 2, guardians: 2, guardiansActivated: 1,
        campStatus: { IN_PROGRESS: 1 },
        upcoming: [{ id: "cmp_1", title: "Annual check-up", schoolName: "Silver Oaks",
          date: "2027-09-10", participants: 2, consented: 2, status: "IN_PROGRESS" }] },
      "/api/admin/schools": { schools: [] },
      "/api/admin/camps/cmp_1/participants": { can: { schedule: true, screen: true, review: true },
        photosEnabled: photos, participants: PARTS },
      "/api/admin/camps/cmp_1/photos/k1": { photos: [{ id: "ph_1", checkType: "Skin",
        mime: "image/png", bytes: 4096, caption: "Patch on left forearm",
        uploadedAt: "2027-09-10T05:00:00Z", uploadedBy: "Nurse Devi" }] },
      "/api/admin/camps/cmp_1/screening/k1": form(PARTS[0], true),
      "/api/admin/camps/cmp_1/screening/k2": form(PARTS[1], false),
      "/api/admin/camps/cmp_1": { camp: CAMP, staff: [],
        can: { schedule: true, screen: true, review: true } },
      "/api/admin/schools/sch_1/staff": { staff: [] },
    };
    window.fetch = async (url) => {
      const u = String(url).replace(/^https?:\/\/[^/]+/, "");
      const keys = Object.keys(D).sort((a, b) => b.length - a.length);
      const k = keys.find((x) => u === x) || keys.find((x) => u.startsWith(x));
      return new Response(JSON.stringify(k ? D[k] : {}), { status: 200,
        headers: { "Content-Type": "application/json" } });
    };
  }, photosEnabled);
  await p.goto(process.env.PORTAL_URL || "http://127.0.0.1:8099/portal.html");
  await p.waitForTimeout(500);
  await p.getByText("Annual check-up").first().click();
  await p.waitForTimeout(400);
  return { b, p, errs };
}

const tab = async (p, name) => {
  await p.getByRole("button", { name, exact: false }).first().click();
  await p.waitForTimeout(300);
};
const text = async (p) => (await p.locator(".content").innerText()).replace(/\n+/g, " | ");

function check(label, cond) {
  console.log((cond ? "PASS  " : "FAIL  ") + label);
  if (!cond) process.exitCode = 1;
}

// ── photographs off ──
{
  const { b, p, errs } = await session(false);
  const setup = await text(p);

  check("off: setup says photographs are off", /Photographs/.test(setup) && /\boff\b/i.test(setup));
  check("off: setup explains why off is normal", /almost every camp/.test(setup));
  await tab(p, "Consent");
  const consent = await text(p);
  check("off: consent tab has no photographs column", !/Photographs/.test(consent));
  check("off: consent buttons are the plain pair", /Granted on paper/.test(consent));
  await tab(p, "Camp day");
  await p.getByText("Pupil 1").first().click();
  await p.waitForTimeout(300);
  const screen = await text(p);
  check("off: screening offers no camera", !/Attach/.test(screen));
  check("off: no page errors", errs.length === 0);
  await b.close();
}

// ── photographs on ──
{
  const { b, p, errs } = await session(true);
  const setup = await text(p);
  check("on: setup says photographs are on", /Photographs/.test(setup) && /photographs[\s|]+on\b/i.test(setup));
  check("on: setup warns it cannot be undone once used", /delete them first/.test(setup));
  await tab(p, "Consent");
  const consent = await text(p);
  check("on: consent tab shows a photographs column", /Photographs/.test(consent));
  check("on: consent splits the two questions", /Check-up \+ photographs/.test(consent));
  check("on: a consented child reads Allowed", /\bALLOWED\b/i.test(consent));
  check("on: a non-consented child reads Not allowed", /NOT ALLOWED/i.test(consent));

  await tab(p, "Camp day");
  await p.getByText("Pupil 1").first().click();
  await p.waitForTimeout(400);
  const consented = await text(p);
  check("on: consented child gets the camera", /Attach/.test(consented));
  check("on: existing photo is listed", /Patch on left forearm/.test(consented));
  check("on: the limits are stated", /Four per child/.test(consented));
  check("on: viewing is said to be recorded", /it is recorded/.test(consented));

  await p.getByRole("button", { name: "Done", exact: false }).first().click();
  await p.waitForTimeout(300);
  await p.getByText("Pupil 2").first().click();
  await p.waitForTimeout(400);
  const refused = await text(p);
  check("on: non-consented child gets no camera", !/Attach/.test(refused));
  check("on: and is told why", /not to photographs/.test(refused));
  check("on: no page errors", errs.length === 0);
  if (errs.length) console.log(errs.join("\n"));
  await b.close();
}
