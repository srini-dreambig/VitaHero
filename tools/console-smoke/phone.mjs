const { chromium } = (await import((process.env.PW_DIR || "playwright") + "/index.js")).default;

// The console on a phone.
//
// A school admin opens this standing in a hall, not at a desk, and for a while
// it was unusable there: at 390px the document laid out 639px wide, so every
// screen scrolled sideways and the sticky header slid off with it. Two causes,
// both invisible at desktop width — a flex child with the default
// min-width:auto holding the nav strip open, and roster tables placed straight
// into a card with no scroller of their own. This measures the symptom rather
// than either cause, so a third way of reintroducing it fails here too.

const URL = process.env.PORTAL_URL || "http://127.0.0.1:8099/portal.html";
const PHONE = { width: 390, height: 844 };

let failures = 0;
function check(label, cond) {
  console.log((cond ? "PASS  " : "FAIL  ") + label);
  if (!cond) failures++;
}

const b = await chromium.launch();
const p = await b.newPage({ viewport: PHONE });
const errs = [];
p.on("pageerror", (e) => errs.push("pageerror: " + e.message));

await p.addInitScript(() => {
  localStorage.setItem("vh_console", JSON.stringify({
    mode: "key", key: "k", name: "Ops", role: "SUPERADMIN", profileId: "ph_1", schoolId: null,
  }));
  const wide = (n) => Array.from({ length: n }, (_, i) => ({
    id: "cmp_" + i, title: "Annual Health Camp " + i, schoolName: "Silver Oaks International",
    date: "2027-09-1" + (i % 9), participants: 240, consented: 180, status: "SCHEDULED",
  }));
  const D = {
    "/api/admin/overview": {
      schools: 3, students: 640, guardians: 610, guardiansActivated: 300,
      campStatus: { SCHEDULED: 2, RELEASED: 1 }, upcoming: wide(4),
    },
    "/api/admin/schools": { schools: [{ id: "sch_1", name: "Silver Oaks International",
      city: "Hyderabad", partnerCode: "SO-1", academicYear: "2027-28", students: 640, camps: 2 }] },
    "/api/admin/hospitals": { hospitals: [] },
    "/api/admin/library": { articles: [] },
  };
  const real = window.fetch;
  window.fetch = (u, o) => {
    const path = new URL(u, location.origin).pathname;
    if (D[path]) return Promise.resolve(new Response(JSON.stringify(D[path]),
      { headers: { "content-type": "application/json" } }));
    if (path.startsWith("/api/")) return Promise.resolve(new Response("{}",
      { headers: { "content-type": "application/json" } }));
    return real(u, o);
  };
});

await p.goto(URL, { waitUntil: "networkidle" });
await p.waitForTimeout(500);

const overflow = () => p.evaluate(() =>
  document.documentElement.scrollWidth - document.documentElement.clientWidth);

// The nav collapses into a strip; it must fit, not stretch the shell.
const navFits = await p.evaluate(() =>
  document.querySelector(".nav").getBoundingClientRect().width <= window.innerWidth + 1);
check("the collapsed nav fits the screen", navFits);

check("the overview does not scroll sideways", (await overflow()) <= 2);

// The table is the thing that overflows, and it has to scroll inside itself.
const tableScrolls = await p.evaluate(() => {
  const t = document.querySelector("table");
  if (!t) return false;
  const box = t.parentNode;
  return box.scrollWidth > box.clientWidth &&
    getComputedStyle(box).overflowX === "auto";
});
check("a wide table scrolls inside its own box", tableScrolls);

for (const label of ["Schools", "Hospitals", "Library"]) {
  await p.locator(".navi", { hasText: new RegExp("^" + label + "$") }).first().click();
  await p.waitForTimeout(350);
  check(label + " does not scroll sideways", (await overflow()) <= 2);
  // An empty page has no overflow either. Insist the screen actually drew,
  // because a blank console once passed every layout check there was.
  const drew = await p.$eval("#root", (n) => n.innerText.trim().length);
  check(label + " actually rendered", drew > 40);
}

check("no page errors", errs.length === 0);
if (errs.length) console.log(errs.join("\n"));

await b.close();
process.exit(failures || errs.length ? 1 : 0);
