const { chromium } = (await import((process.env.PW_DIR || "playwright") + "/index.js")).default;

// The first screen a new programme ever shows.
//
// Every other test here starts from a programme with schools, rosters and
// camps in it, so the state an operator actually meets on day one was the one
// state nothing rendered. It told them to "Open a school and schedule one to
// get started" on a programme with no schools — advice for a step they cannot
// take, as the first sentence the product says to them.
//
// The analytics payload below is the real empty-programme shape, taken from
// adminAnalytics against a freshly migrated database, not a hand-written
// guess: three times while auditing this I stubbed a shape the server does not
// produce and read the console's honest complaint as a bug.

const URL = process.env.PORTAL_URL || "http://127.0.0.1:8099/admin";
let failures = 0;
const check = (l, c) => { console.log((c ? "PASS  " : "FAIL  ") + l); if (!c) failures++; };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
const errs = [];
p.on("pageerror", (e) => errs.push("pageerror: " + e.message));

const FUNNEL = [
  { key: "rostered", label: "On the camp roster", stage: "B7", count: 0, pct: null },
  { key: "consented", label: "Consent given", stage: "B3", count: 0, pct: null },
  { key: "present", label: "Present on the day", stage: "C3", count: 0, pct: null },
  { key: "screened", label: "Screened", stage: "C8", count: 0, pct: null },
  { key: "reviewed", label: "Clinically reviewed", stage: "D5", count: 0, pct: null },
  { key: "released", label: "Released to guardians", stage: "D6", count: 0, pct: null },
];
const ANALYTICS = {
  scope: "ALL", funnel: FUNNEL, attendance: { absent: 0, declined: 0 },
  referrals: { total: 0, open: 0, booked: 0, attended: 0, closed: 0, declined: 0,
    expired: 0, urgentOpen: 0, overdue: 0, closureRate: null, avgDaysToClose: null },
  prevalence: [], trend: [], bySchool: [], byDistrict: [],
};

async function openAs(role, schoolId) {
  await p.addInitScript(([role, schoolId, analytics]) => {
    localStorage.setItem("vh_console", JSON.stringify({
      mode: "key", key: "k", name: "Asha Menon", role, profileId: "ph_1", schoolId }));
    const D = {
      "/api/admin/overview": { schools: 0, students: 0, guardians: 0,
        guardiansActivated: 0, campStatus: {}, upcoming: [] },
      "/api/admin/analytics": analytics,
      "/api/admin/schools": { schools: [] },
    };
    const real = window.fetch;
    window.fetch = (u, o) => {
      const path = new URL(u, location.origin).pathname;
      if (!path.startsWith("/api/")) return real(u, o);
      return Promise.resolve(new Response(JSON.stringify(D[path] !== undefined ? D[path] : {}),
        { headers: { "content-type": "application/json" } }));
    };
  }, [role, schoolId, ANALYTICS]);
  await p.goto(URL, { waitUntil: "networkidle" });
  await p.waitForTimeout(600);
  return p.$eval("#root", (n) => n.innerText);
}

// ── operations, day one ───────────────────────────────────────
let text = await openAs("SUPERADMIN", null);
check("the dashboard renders on an empty programme rather than complaining",
  !/unexpected shape|could not be loaded/i.test(text));
check("and does not tell an operator to open a school they have not created",
  !/Open a school and schedule one/.test(text));
check("it names the actual first step instead", /A programme starts with a school/.test(text));
check("and offers the button that takes them there",
  await p.evaluate(() => [...document.querySelectorAll("button")]
    .some((b) => /Add the first school/.test(b.textContent))));

await p.evaluate(() => [...document.querySelectorAll("button")]
  .find((b) => /Add the first school/.test(b.textContent)).click());
await p.waitForTimeout(600);
check("which lands on Schools, where the add form is",
  /No schools yet/.test(await p.$eval("#root", (n) => n.innerText)));

// The pathway codes are VitaHero's own vocabulary.
check("operations sees the pathway stage codes it runs the programme against",
  /B7|C8|D6/.test(text));

// ── a school office, day one ──────────────────────────────────
await p.close();
const p2 = await b.newPage({ viewport: { width: 1280, height: 1000 } });
p2.on("pageerror", (e) => errs.push("pageerror: " + e.message));
// Re-open as a school administrator using the same helper against page 2.
await p2.addInitScript(([analytics]) => {
  localStorage.setItem("vh_console", JSON.stringify({
    mode: "session", token: "t", name: "Asha Rao", role: "SCHOOL_ADMIN",
    profileId: "ph_head", schoolId: "sch_1" }));
  const D = {
    "/api/admin/overview": { schools: 0, students: 0, guardians: 0,
      guardiansActivated: 0, campStatus: {}, upcoming: [] },
    "/api/admin/analytics": analytics,
    "/api/admin/schools/sch_1": { school: { id: "sch_1", name: "Silver Oaks", city: "Hyderabad",
      partnerCode: "SO-1", academicYear: "2026-27", checksOffered: [], status: "ACTIVE",
      active: true, studentCount: 0, adminCount: 0 } },
  };
  const real = window.fetch;
  window.fetch = (u, o) => {
    const path = new URL(u, location.origin).pathname;
    if (!path.startsWith("/api/")) return real(u, o);
    return Promise.resolve(new Response(JSON.stringify(D[path] !== undefined ? D[path] : {}),
      { headers: { "content-type": "application/json" } }));
  };
}, [ANALYTICS]);
await p2.goto(URL, { waitUntil: "networkidle" });
await p2.waitForTimeout(600);
const headText = await p2.$eval("#root", (n) => n.innerText);

check("a school office is not shown VitaHero's internal stage codes",
  !/\bB7\b|\bC8\b|\bD6\b/.test(headText));
// The rows themselves stay: the drop between two of them is the story.
check("but still sees what each step of the pathway is",
  /On the camp roster/.test(headText) && /Released to guardians/.test(headText));
check("and is not told to open a school, which is not their job",
  !/Add the first school/.test(headText));

check("first run: no page errors", errs.length === 0);
if (errs.length) errs.forEach((e) => console.log("      " + e));

await b.close();
process.exit(failures ? 1 : 0);
