const { chromium } = (await import((process.env.PW_DIR || "playwright") + "/index.js")).default;

// The ops dashboard — K1 and the K2 rollup.
//
// The numbers on this screen are what a school and a funder are shown, so the
// things worth testing are the ones that would mislead them: a percentage
// invented from no denominator, a funnel that widens, a check nobody performed
// counted as a clean result.

const URL = process.env.PORTAL_URL || "http://127.0.0.1:8099/portal.html";
let failures = 0;
const check = (l, c) => { console.log((c ? "PASS  " : "FAIL  ") + l); if (!c) failures++; };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
p.on("pageerror", (e) => errs.push("pageerror: " + e.message));

const ANALYTICS = {
  scope: "ALL",
  funnel: [
    { key: "rostered", label: "On the camp roster", stage: "B7", count: 400, pct: 100 },
    { key: "consented", label: "Consent given", stage: "B3", count: 320, pct: 80 },
    { key: "present", label: "Present on the day", stage: "C3", count: 300, pct: 75 },
    { key: "screened", label: "Screened", stage: "C8", count: 290, pct: 73 },
    { key: "reviewed", label: "Clinically reviewed", stage: "D5", count: 250, pct: 63 },
    { key: "released", label: "Released to guardians", stage: "D6", count: 240, pct: 60 },
  ],
  attendance: { absent: 20, declined: 12 },
  referrals: { total: 48, open: 9, booked: 5, attended: 4, closed: 26, declined: 4,
    expired: 0, urgentOpen: 2, overdue: 3, closureRate: 59, avgDaysToClose: 21.4 },
  prevalence: [
    { checkType: "Vision", total: 290, good: 210, watch: 44, alert: 6, notMeasured: 30 },
    { checkType: "Dental", total: 290, good: 240, watch: 30, alert: 4, notMeasured: 16 },
  ],
  trend: Array.from({ length: 12 }, (_, i) => ({
    month: "2026-" + String(i + 1).padStart(2, "0"),
    screened: i === 8 ? 290 : 0, referralsRaised: i === 8 ? 48 : 0, referralsClosed: i === 9 ? 26 : 0,
  })),
  bySchool: [
    { id: "sch_1", name: "Silver Oaks", city: "Hyderabad", district: "Gachibowli",
      students: 400, rostered: 400, screened: 290, released: 240, referrals: 48,
      referralsClosed: 26, closureRate: 54, coverage: 73, lastCamp: "2026-09-18" },
    { id: "sch_2", name: "Bright Beginnings", city: "Warangal", district: "Hanamkonda",
      students: 120, rostered: 0, screened: 0, released: 0, referrals: 0,
      referralsClosed: 0, closureRate: null, coverage: 0, lastCamp: "" },
  ],
  byDistrict: [
    { district: "Gachibowli", schools: 1, screened: 290, flagged: 54, flaggedPct: 19 },
  ],
};

await p.addInitScript((A) => {
  localStorage.setItem("vh_console", JSON.stringify({
    mode: "key", key: "k", name: "Ops", role: "SUPERADMIN", profileId: "ph_1", schoolId: null,
  }));
  const D = {
    "/api/admin/overview": { schools: 2, students: 520, guardians: 500, guardiansActivated: 210,
      campStatus: { SCHEDULED: 1, RELEASED: 1 }, upcoming: [] },
    "/api/admin/analytics": A,
    "/api/admin/schools": { schools: [] },
  };
  const real = window.fetch;
  window.fetch = (u, o) => {
    const path = new URL(u, location.origin).pathname;
    const body = D[path] !== undefined ? D[path] : path.startsWith("/api/") ? {} : null;
    if (body === null) return real(u, o);
    return Promise.resolve(new Response(JSON.stringify(body),
      { headers: { "content-type": "application/json" } }));
  };
}, ANALYTICS);

await p.goto(URL, { waitUntil: "networkidle" });
await p.waitForTimeout(700);
const t = await p.$eval("#root", (n) => n.innerText);

// Closure is the headline. Screening that never closes a referral has not
// helped anyone, so this is the number the dashboard leads with.
check("closure rate leads the dashboard", /REFERRAL CLOSURE[\s\S]{0,40}59%/i.test(t));
check("closure is shown against its denominator", /26 of 48 referrals closed/.test(t));
check("urgent and overdue referrals are called out", /2 urgent/.test(t) && /3 overdue/.test(t));
check("average days to close is shown", /21\.4/.test(t));

// The funnel.
check("the funnel names every pathway stage",
  ["B7", "B3", "C3", "C8", "D5", "D6"].every((s) => t.includes(s)));
check("the funnel says where children were lost", /80 did not reach this step/.test(t));
check("the funnel is anchored at 100%", /100%/.test(t));

// Prevalence.
check("what screening finds is broken out per check", /Vision/.test(t) && /Dental/.test(t));
check("flagged counts are stated against the total", /50 of 290 flagged/.test(t));
// A check nobody performed must never read as a clean result.
check("not-measured is reported, not folded into normal", /30 not measured/.test(t));
check("the legend distinguishes not measured", /Not measured/.test(t));

// A percentage with no denominator.
check("a school with no camp shows a dash, not 0%", await p.evaluate(() => {
  const row = [...document.querySelectorAll("tbody tr")]
    .find((r) => r.textContent.includes("Bright Beginnings"));
  return row ? row.innerText.includes("—") : false;
}));

// K2 stays aggregate.
check("the district rollup is present", /By district/.test(t) && /Gachibowli/.test(t));
check("the district rollup says it carries no child", /no school, no child/i.test(t));

// Layout.
check("the dashboard does not scroll the page sideways", (await p.evaluate(() =>
  document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 2);
check("the trend chart drew", (await p.$$("svg.chart")).length === 1);

check("no page errors", errs.length === 0);
if (errs.length) console.log(errs.join("\n"));
await b.close();
process.exit(failures || errs.length ? 1 : 0);
