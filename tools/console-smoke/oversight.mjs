const { chromium } = (await import((process.env.PW_DIR || "playwright") + "/index.js")).default;

// Oversight — K4 partner performance, K6 record access, J9 retention, and one
// child's whole trail.
//
// Two of these existed only as endpoints with nothing that opened them, and
// two did not exist at all. The point of the screen is that a programme being
// run badly is visible from it, so these checks are about what it refuses to
// flatter: a partner nobody has used, a referral that never reached one, a
// read of a child's record.

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
  const D = {
    "/api/admin/overview": { schools: 1, students: 40, guardians: 40, guardiansActivated: 12,
      campStatus: {}, upcoming: [] },
    "/api/admin/analytics": null,
    "/api/admin/schools": { schools: [] },
    "/api/admin/partners": {
      note: "A referral is attributed to a hospital through the appointment the family booked.",
      hospitals: [
        { id: "h1", name: "Rainbow Children's Hospital", city: "Hyderabad", district: "Gachibowli",
          isCampPartner: true, rating: 4.9, sent: 20, seen: 6, closed: 5, outstanding: 12,
          expired: 2, seenRate: 30, closureRate: 25, avgDaysToClose: 31.5 },
        { id: "h2", name: "Never Used Clinic", city: "Hyderabad", district: "Kukatpally",
          isCampPartner: false, rating: 4.4, sent: 0, seen: 0, closed: 0, outstanding: 0,
          expired: 0, seenRate: null, closureRate: null, avgDaysToClose: null },
      ],
      notBooked: { total: 14, closed: 9, outstanding: 4, declined: 1 },
    },
    "/api/admin/access-log": {
      days: 30,
      note: "Every read of a child's screening record, review or photograph.",
      entries: [
        { id: "ra1", kidId: "k_1", kidName: "Aarav Sharma", schoolName: "Silver Oaks",
          campId: "c1", actorId: "ph_9", actorName: "Nurse Latha", actorRole: "SCREENER",
          surface: "SCREENING", at: "2026-08-29T09:14:00Z" },
        { id: "ra2", kidId: "k_1", kidName: "Aarav Sharma", schoolName: "Silver Oaks",
          campId: "c1", actorId: "ph_8", actorName: "Dr Anand", actorRole: "PHYSICIAN",
          surface: "PHOTOGRAPH", at: "2026-08-29T11:02:00Z" },
      ],
      byActor: [
        { actorId: "ph_9", actorName: "Nurse Latha", actorRole: "SCREENER", reads: 41,
          children: 38, lastAt: "2026-08-29T09:14:00Z" },
      ],
    },
    "/api/admin/retention": {
      note: "Nothing is deleted automatically. This reports what a retention run would touch.",
      findingsOlderThanWindow: 0, photosOlderThanWindow: 3, windowYears: 7,
    },
    "/api/admin/child/k_1": {
      child: { kidId: "k_1", name: "Aarav Sharma" },
      events: [
        { at: "2026-08-20T04:00:00Z", action: "Consent recorded", by: "SMS", detail: "Annual Camp" },
        { at: "2026-08-28T05:30:00Z", action: "Screened", by: "Nurse Latha", detail: "Annual Camp" },
      ],
      reads: [
        { at: "2026-08-29T11:02:00Z", by: "Dr Anand", role: "PHYSICIAN", surface: "PHOTOGRAPH" },
      ],
    },
  };
  const real = window.fetch;
  window.fetch = (u, o) => {
    const path = new URL(u, location.origin).pathname;
    let body = D[path];
    if (body === undefined) body = path.startsWith("/api/") ? {} : null;
    if (body === null) return Promise.resolve(new Response(JSON.stringify({ error: "no" }),
      { status: 500, headers: { "content-type": "application/json" } }));
    return Promise.resolve(new Response(JSON.stringify(body),
      { headers: { "content-type": "application/json" } }));
  };
});

await p.goto(URL, { waitUntil: "networkidle" });
await p.waitForTimeout(600);

const nav = (label) => p.locator(".navi", { hasText: new RegExp("^" + label + "$") }).first().click();
const tab = (label) => p.locator(".tab", { hasText: new RegExp("^" + label + "$") }).first().click();
const text = () => p.$eval("#root", (n) => n.innerText);

check("Oversight is reachable from the menu",
  (await p.locator(".navi", { hasText: /^Oversight$/ }).count()) === 1);

await nav("Oversight");
await p.waitForTimeout(450);
let t = await text();

// K4.
check("partners show what was sent and what was seen", /Rainbow Children/.test(t) && /\b20\b/.test(t));
check("a poor seen rate is called out", await p.evaluate(() =>
  [...document.querySelectorAll("td.bad")].some((c) => c.textContent.includes("30%"))));
check("a partner nobody has used is kept out of the rate table", await p.evaluate(() => {
  const rows = [...document.querySelectorAll("tbody tr")];
  return !rows.some((r) => r.textContent.includes("Never Used Clinic"));
}));
check("a partner nobody has used is still listed, without a rate", /Never Used Clinic/.test(t));
// The KPI label is set uppercase by the design system, so match it that way.
check("referrals that never reached a partner are reported separately",
  /own doctor/i.test(t) && /14/.test(t));

// K6.
await tab("Record access");
await p.waitForTimeout(400);
t = await text();
check("the access log lists who opened a record", /Nurse Latha/.test(t) && /Dr Anand/.test(t));
check("the access log names what was opened",
  /Screening form/.test(t) && /Photograph/.test(t));
check("the access log summarises by person", /41/.test(t) && /38/.test(t));
check("photograph views appear in the same ledger", /Photograph/.test(t));

// J9.
await tab("Retention");
await p.waitForTimeout(400);
t = await text();
check("retention says it does not delete on a timer", /Nothing is deleted automatically/.test(t));
check("retention reports what a run would touch", /Photos Older Than Window/i.test(t));

// One child.
await tab("Look up a child");
await p.waitForTimeout(300);
await p.locator("input[placeholder*='roster id']").first().fill("k_1");
await p.getByRole("button", { name: "Open" }).first().click();
await p.waitForTimeout(500);
t = await text();
check("a child's trail shows what was done", /Consent recorded/.test(t) && /Screened/.test(t));
check("a child's trail shows who merely looked",
  /Who has opened this record/.test(t) && /Dr Anand/.test(t));

check("oversight does not scroll the page sideways", (await p.evaluate(() =>
  document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 2);
check("no page errors", errs.length === 0);
if (errs.length) console.log(errs.join("\n"));
await b.close();
process.exit(failures || errs.length ? 1 : 0);
