const { chromium } = (await import((process.env.PW_DIR || "playwright") + "/index.js")).default;

// One rule: where the console shows a state with an obvious remedy, the
// control for that remedy is on the same screen — ideally on the same row.
//
// It kept being broken the same way. The roster reported "0 guardians using
// the app" and NO against every child, and the only way to invite anybody was
// a different screen under a different section. The consent screen listed
// guardians who had not replied and, instead of a button, carried a sentence
// telling the operator to walk to Setup. Each of those was found by the
// founder, not by a test, so the rule gets tests.

const URL = process.env.PORTAL_URL || "http://127.0.0.1:8099/portal.html";
let failures = 0;
const check = (l, c) => { console.log((c ? "PASS  " : "FAIL  ") + l); if (!c) failures++; };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
const posted = [];
p.on("pageerror", (e) => errs.push("pageerror: " + e.message));

await p.addInitScript(() => {
  window.__posted = [];
  localStorage.setItem("vh_console", JSON.stringify({
    mode: "key", key: "k", name: "Ops", role: "SUPERADMIN", profileId: "ph_1", schoolId: null,
  }));
  const school = { id: "sch_1", name: "Silver Oaks", city: "Hyderabad", district: "",
    contactName: "", contactPhone: "", contactEmail: "", academicYear: "2026-27",
    campCadence: "ANNUAL", checksOffered: ["Vision"], description: "", partnerCode: "SO-1" };
  const D = {
    "/api/admin/overview": { schools: 1, students: 3, guardians: 3, guardiansActivated: 0,
      campStatus: {}, upcoming: [] },
    "/api/admin/schools": { schools: [{ ...school, students: 3, camps: 1 }] },
    "/api/admin/schools/sch_1": { school },
    "/api/admin/schools/sch_1/roster": {
      total: 3, academicYear: "2026-27",
      students: [
        { kidId: "k1", name: "Rahul Sharma", grade: "Class 4", section: "B", dob: "2016-03-14",
          studentRef: "sid_2026-0412", guardianName: "Priya Sharma", guardianPhone: "+919876543210",
          guardianActivated: false, profileId: "ph_g1" },
        { kidId: "k2", name: "Ananya Reddy", grade: "Class 5", section: "A", dob: "2015-11-02",
          studentRef: "sid_2026-0413", guardianName: "Vikram Reddy", guardianPhone: "+919876543211",
          guardianActivated: true, profileId: "ph_g2" },
        { kidId: "k3", name: "No Number", grade: "PP2", section: "A", dob: "2021-05-25",
          studentRef: "sid_2026-0414", guardianName: "Nobody", guardianPhone: "",
          guardianActivated: false, profileId: "ph_g3" },
      ],
    },
    "/api/admin/schools/sch_1/camps": { camps: [{ id: "cmp_1", title: "Annual Camp",
      date: "2026-09-18", status: "SCHEDULED", participants: 2, consented: 0, screened: 0,
      released: 0, schoolName: "Silver Oaks" }] },
    "/api/admin/camps/cmp_1": {
      camp: { id: "cmp_1", schoolId: "sch_1", schoolName: "Silver Oaks", title: "Annual Camp",
        date: "2026-09-18", status: "SCHEDULED", checks: ["Vision"], grades: ["Class 4"],
        participants: 2, consented: 0, declined: 0, pendingConsent: 2, present: 0, absent: 0,
        screened: 0, awaitingReview: 0, approved: 0, released: 0, urgent: 0, photosEnabled: false,
        academicYear: "2026-27", sections: [], capacity: 200, consentDeadline: "", venue: "",
        time: "", description: "", releasedAt: "", resultSummary: "" },
      staff: [], can: { schedule: true, screen: true, review: true },
    },
    "/api/admin/camps/cmp_1/participants": { participants: [
      { kidId: "k1", name: "Rahul Sharma", grade: "Class 4", section: "B",
        guardianName: "Priya Sharma", guardianPhone: "+919876543210",
        guardianProfileId: "ph_g1", guardianUsingApp: false,
        consentStatus: "PENDING", consentPhotos: false, attendance: "UNKNOWN",
        status: "NOT_SCREENED", findingsCount: 0, urgency: "NONE", recommendation: "" },
      { kidId: "k2", name: "Ananya Reddy", grade: "Class 5", section: "A",
        guardianName: "Vikram Reddy", guardianPhone: "+919876543211",
        guardianProfileId: "ph_g2", guardianUsingApp: true,
        consentStatus: "PENDING", consentPhotos: false, attendance: "UNKNOWN",
        status: "NOT_SCREENED", findingsCount: 0, urgency: "NONE", recommendation: "" },
    ] },
  };
  const real = window.fetch;
  window.fetch = (u, o) => {
    const path = new URL(u, location.origin).pathname;
    if (o && o.method === "POST") {
      window.__posted.push({ path, body: JSON.parse(o.body || "{}") });
      return Promise.resolve(new Response(JSON.stringify({ sent: 1, failed: [] }),
        { headers: { "content-type": "application/json" } }));
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
await p.locator(".navi", { hasText: /^Schools$/ }).first().click();
await p.waitForTimeout(350);
await p.getByText("Silver Oaks").first().click();
await p.waitForTimeout(600);

// ── the roster ──
let t = await p.$eval("#root", (n) => n.innerText);
check("the roster offers to invite the guardians who are not on the app",
  /Send invitation to 1 guardian\b/i.test(t));

const rowButton = async (name, label) => p.evaluate(([n, l]) => {
  const row = [...document.querySelectorAll("tbody tr")].find((r) => r.textContent.includes(n));
  if (!row) return "no row";
  const btn = [...row.querySelectorAll("button")].find((b) => b.textContent.trim() === l);
  return btn ? "yes" : row.innerText;
}, [name, label]);

check("a guardian not on the app can be invited from their own row",
  (await rowButton("Rahul Sharma", "Invite")) === "yes");
check("a guardian already on the app is not offered an invitation",
  (await rowButton("Ananya Reddy", "Invite")) !== "yes");
// Nothing to send to, so offer nothing rather than a button that fails.
check("a guardian with no number is told so instead of given a dead button",
  /no number/i.test(await rowButton("No Number", "Invite")));

await p.evaluate(() => {
  const row = [...document.querySelectorAll("tbody tr")].find((r) => r.textContent.includes("Rahul"));
  [...row.querySelectorAll("button")].find((b) => b.textContent.trim() === "Invite").click();
});
await p.waitForTimeout(400);
let sent = await p.evaluate(() => window.__posted);
check("inviting one guardian targets only that guardian",
  sent.some((x) => x.path === "/api/admin/invites/send"
    && Array.isArray(x.body.profileIds) && x.body.profileIds.length === 1
    && x.body.profileIds[0] === "ph_g1"));

// ── the consent screen ──
await p.locator(".navi", { hasText: /^All camps$/ }).first().click();
await p.waitForTimeout(400);
await p.getByText("Annual Camp").first().click();
await p.waitForTimeout(600);
await p.waitForTimeout(400);
// Count re-renders of the root before clicking, so a detached-node failure
// below is reported as the render loop it would be rather than a flaky click.
const renders = await p.evaluate(() => new Promise((res) => {
  let n = 0;
  const mo = new MutationObserver(() => { n++; });
  mo.observe(document.getElementById("root"), { childList: true });
  setTimeout(() => { mo.disconnect(); res(n); }, 1500);
}));
check("the camp screen settles instead of re-rendering in a loop", renders <= 2);
await p.locator(".navi", { hasText: /^Consent/ }).first().click({ timeout: 10000 });
await p.waitForTimeout(700);
t = await p.$eval("#root", (n) => n.innerText);

// The sentence that used to send people to another screen.
check("consent no longer tells the operator to go to another screen",
  !/Use Setup/i.test(t));
check("consent can remind everyone still waiting", /Remind all 2/.test(t));
check("a guardian on the app is offered a reminder",
  (await rowButton("Ananya Reddy", "Remind")) === "yes");
// Reminding somebody who has no app is the wrong remedy; invite them instead.
check("a guardian not on the app is offered an invitation, not a reminder",
  (await rowButton("Rahul Sharma", "Invite")) === "yes"
  && (await rowButton("Rahul Sharma", "Remind")) !== "yes");

await p.evaluate(() => {
  const row = [...document.querySelectorAll("tbody tr")].find((r) => r.textContent.includes("Ananya"));
  [...row.querySelectorAll("button")].find((b) => b.textContent.trim() === "Remind").click();
});
await p.waitForTimeout(400);
sent = await p.evaluate(() => window.__posted);
check("reminding one guardian does not re-text the whole camp",
  sent.some((x) => /consent\/request$/.test(x.path)
    && Array.isArray(x.body.profileIds) && x.body.profileIds.length === 1));

check("no page errors", errs.length === 0);
if (errs.length) console.log(errs.join("\n"));
await b.close();
process.exit(failures ? 1 : 0);
