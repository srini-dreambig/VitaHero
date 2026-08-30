const { chromium } = (await import((process.env.PW_DIR || "playwright") + "/index.js")).default;

// A doctor at a camp, from the console's side.
//
// The admin adds a doctor to the directory, assigns them to a camp, and that
// assignment is what lets them sign in to the Android app. When the camp is
// done the admin ends their access — and with no active camp they cannot sign
// in at all. What is checked here is that the screen makes each of those
// states visible, because "can this doctor still open my school's data" is not
// a question anyone should have to infer.

const URL = process.env.PORTAL_URL || "http://127.0.0.1:8099/portal.html";
let failures = 0;
const check = (l, c) => { console.log((c ? "PASS  " : "FAIL  ") + l); if (!c) failures++; };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
p.on("pageerror", (e) => errs.push("pageerror: " + e.message));

await p.addInitScript(() => {
  localStorage.setItem("vh_console", JSON.stringify({
    mode: "key", key: "k", name: "Ops", role: "SUPERADMIN", profileId: "ph_1", schoolId: null,
  }));
  const camp = {
    camp: {
      id: "cmp_1", schoolId: "sch_1", schoolName: "Silver Oaks", title: "Annual Camp",
      date: "2026-09-18", status: "SCHEDULED", checks: ["Vision"], grades: ["Class 4"],
      participants: 40, consented: 30, declined: 0, pendingConsent: 10, present: 0,
      absent: 0, screened: 0, awaitingReview: 0, approved: 0, released: 0, urgent: 0,
      photosEnabled: false, academicYear: "2026-27", sections: [], capacity: 200,
      consentDeadline: "", venue: "", time: "", description: "", releasedAt: "", resultSummary: "",
    },
    staff: [
      { profileId: "ph_9812345678", role: "PHYSICIAN", name: "Dr Kavita Rao",
        phone: "+919812345678", active: true, doctorId: "doc_1", revokedAt: "" },
      { profileId: "ph_9800000000", role: "SCREENER", name: "Nurse Latha",
        phone: "+919800000000", active: false, doctorId: "", revokedAt: "2026-09-19T10:00:00Z" },
    ],
    can: { schedule: true, screen: true, review: true },
  };
  const D = {
    "/api/admin/overview": { schools: 1, students: 40, guardians: 40, guardiansActivated: 10,
      campStatus: {}, upcoming: [] },
    "/api/admin/schools": { schools: [{ id: "sch_1", name: "Silver Oaks", city: "Hyderabad",
      partnerCode: "SO-1", academicYear: "2026-27", students: 40, camps: 1 }] },
    "/api/admin/schools/sch_1": { school: { id: "sch_1", name: "Silver Oaks", city: "Hyderabad",
      district: "", contactName: "", contactPhone: "", contactEmail: "", academicYear: "2026-27",
      campCadence: "ANNUAL", checksOffered: ["Vision"], description: "", partnerCode: "SO-1" } },
    "/api/admin/schools/sch_1/roster": { total: 0, academicYear: "2026-27", students: [] },
    "/api/admin/schools/sch_1/camps": { camps: [{ id: "cmp_1", title: "Annual Camp",
      date: "2026-09-18", status: "SCHEDULED", participants: 40, consented: 30, screened: 0,
      released: 0, schoolName: "Silver Oaks" }] },
    "/api/admin/camps/cmp_1": camp,
    "/api/admin/schools/sch_1/staff": { staff: [] },
    "/api/admin/doctors": { canEdit: true, doctors: [
      { id: "doc_2", name: "Dr Meera Iyer", specialty: "Ophthalmology", hospitalId: "h1",
        hospitalName: "LV Prasad", city: "Hyderabad", phone: "+919876543210", active: true },
      { id: "doc_3", name: "Dr No Number", specialty: "Dental", hospitalId: "", hospitalName: "",
        city: "Hyderabad", phone: "", active: true },
    ] },
  };
  window.__calls = [];
  const real = window.fetch;
  window.fetch = (u, o) => {
    const path = new URL(u, location.origin).pathname;
    const method = (o && o.method) || "GET";
    if (method !== "GET") {
      window.__calls.push({ path, method, body: o && o.body ? JSON.parse(o.body) : null });
      return Promise.resolve(new Response(JSON.stringify({
        ok: true, signInHint: "Dr Meera Iyer signs in to the app with +919876543210.",
      }), { headers: { "content-type": "application/json" } }));
    }
    let body = D[path];
    if (body === undefined) body = path.startsWith("/api/") ? {} : null;
    if (body === null) return real(u, o);
    return Promise.resolve(new Response(JSON.stringify(body),
      { headers: { "content-type": "application/json" } }));
  };
});

await p.goto(URL, { waitUntil: "networkidle" });
await p.waitForTimeout(500);
await p.evaluate(() => {
  // Straight to the camp: the sequence to get there is covered elsewhere.
  location.hash = "";
});
await p.locator(".navi", { hasText: /^Schools$/ }).first().click();
await p.waitForTimeout(350);
await p.getByText("Silver Oaks").first().click();
await p.waitForTimeout(700);
await p.locator(".tab", { hasText: /^Camps$/ }).first().click();
await p.waitForTimeout(450);
await p.getByText("Annual Camp").first().click();
await p.waitForTimeout(600);

const text = () => p.$eval("#root", (n) => n.innerText);
let t = await text();

// Pills are set uppercase by the design system; match them that way.
check("an assigned doctor is shown as active", /Dr Kavita Rao/.test(t) && /\bactive\b/i.test(t));
// A revoked person stays on the list — they are how the school knows who
// screened at this camp after access ended.
check("someone whose access ended stays listed, marked", /Nurse Latha/.test(t) && /Access ended/i.test(t));
check("an active assignment can be ended", (await p.getByRole("button", { name: "End access" }).count()) === 1);
check("an ended assignment can be restored", (await p.getByRole("button", { name: "Restore" }).count()) === 1);

// Assigning from the directory is the join that gives a doctor a login.
check("a directory doctor can be assigned to the camp",
  (await p.getByRole("button", { name: /Assign a doctor/ }).count()) === 1);
check("the screen says the assignment is what lets them sign in",
  /signs in to the Android app/i.test(t));
check("it says ending access stops the sign-in entirely",
  /cannot sign in at all/i.test(t));

// A doctor with no number cannot sign in, so must not be offered.
const options = await p.$$eval("select option", (os) => os.map((o) => o.textContent));
check("a doctor with no mobile number is not offered",
  options.some((o) => /Meera Iyer/.test(o)) && !options.some((o) => /No Number/.test(o)));

await p.getByRole("button", { name: /Assign a doctor/ }).first().click();
await p.waitForTimeout(400);
const calls = await p.evaluate(() => window.__calls);
const assign = calls.find((c) => /\/staff$/.test(c.path) && c.method === "POST");
check("assigning sends the doctor id, not a profile id",
  !!assign && assign.body.doctorId === "doc_2" && !assign.body.profileId);
check("the admin is told the number the doctor signs in with",
  /signs in to the app with \+919876543210/.test(await text()));

await p.getByRole("button", { name: "End access" }).first().click();
await p.waitForTimeout(400);
const patch = (await p.evaluate(() => window.__calls)).find((c) => c.method === "PATCH");
// Revoked, not deleted: the assignment is the record of who screened whom.
check("ending access revokes rather than deletes",
  !!patch && patch.body.active === false && /\/staff\/ph_9812345678$/.test(patch.path));

check("no page errors", errs.length === 0);
if (errs.length) console.log(errs.join("\n"));
await b.close();
process.exit(failures || errs.length ? 1 : 0);
