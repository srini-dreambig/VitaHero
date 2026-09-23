const { chromium } = (await import((process.env.PW_DIR || "playwright") + "/index.js")).default;
import { go } from "./nav.mjs";

// C — the dietician directory, from the console's side.
//
// What is under test is mostly the assignment, because that is the part that
// decides what a dietician can see. A dietician is put on a school, not on a
// camp: their work is continuous and a camp ends. So the row has to offer the
// schools they are not already on, and taking one away has to be one click on
// the school itself rather than a form.

const URL = process.env.PORTAL_URL || "http://127.0.0.1:8099/admin";
let failures = 0;
const check = (l, c) => { console.log((c ? "PASS  " : "FAIL  ") + l); if (!c) failures++; };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const errs = [];
p.on("pageerror", (e) => errs.push("pageerror: " + e.message));

await p.addInitScript(() => {
  window.__posted = [];
  localStorage.setItem("vh_console", JSON.stringify({
    mode: "key", key: "k", name: "Ops", role: "SUPERADMIN", profileId: "ph_1", schoolId: null,
  }));
  const D = {
    "/api/admin/overview": { schools: 2, students: 0, guardians: 0, guardiansActivated: 0,
      campStatus: {}, upcoming: [] },
    "/api/admin/schools": { schools: [
      { id: "sch_1", name: "Silver Oaks", city: "Hyderabad", partnerCode: "SO-1" },
      { id: "sch_2", name: "Delhi Public", city: "Hyderabad", partnerCode: "DP-2" },
    ] },
    "/api/admin/dieticians": { dieticians: [
      { id: "die_1", name: "Meera Rao", phone: "+919100000001", qualification: "MSc Nutrition",
        city: "Hyderabad", active: true, schools: [{ schoolId: "sch_1", name: "Silver Oaks" }] },
      { id: "die_2", name: "Asha Kumar", phone: "+919100000002", qualification: "",
        city: "", active: false, schools: [] },
    ] },
  };
  const real = window.fetch;
  window.fetch = (u, o) => {
    const path = new URL(u, location.origin).pathname;
    if (o && o.method && o.method !== "GET") {
      window.__posted.push({ path, method: o.method, body: JSON.parse(o.body || "{}") });
      return Promise.resolve(new Response(JSON.stringify({ signInHint: "Saved." }),
        { headers: { "content-type": "application/json" } }));
    }
    let body = D[path];
    if (body === undefined) body = path.startsWith("/api/") ? {} : null;
    if (body === null) return real(u, o);
    return Promise.resolve(new Response(JSON.stringify(body),
      { headers: { "content-type": "application/json" } }));
  };
  window.confirm = () => true;
});

await p.goto(URL, { waitUntil: "networkidle" });
await p.waitForTimeout(500);
await go(p, "Dieticians");
await p.waitForTimeout(600);

let t = await p.$eval("#root", (n) => n.innerText);
check("the directory lists dieticians", /Meera Rao/.test(t) && /Asha Kumar/.test(t));
check("a retired one is marked as retired", /RETIRED/i.test(t));
check("the screen says what a dietician may see", /growth, haemoglobin and the food log/i.test(t));
check("and says what they may not", /not the dental, eye or illness record/i.test(t));
check("the school they are on is shown", /Silver Oaks/i.test(t));

// The assignment dropdown must offer the school they are NOT on.
const options = await p.evaluate(() => {
  const row = [...document.querySelectorAll("tbody tr")].find((r) => r.textContent.includes("Meera"));
  const sel = row.querySelector("select");
  return sel ? [...sel.options].map((o) => o.textContent.trim()) : [];
});
check("the picker offers the school they are not on",
  options.some((o) => /Delhi Public/.test(o)));
check("and does not offer the one they are already on",
  !options.some((o) => /Silver Oaks/.test(o)));

await p.evaluate(() => {
  const row = [...document.querySelectorAll("tbody tr")].find((r) => r.textContent.includes("Meera"));
  const sel = row.querySelector("select");
  sel.value = "sch_2";
  sel.dispatchEvent(new Event("change", { bubbles: true }));
});
await p.waitForTimeout(400);
let last = await p.evaluate(() => window.__posted[window.__posted.length - 1]);
check("assigning posts the school against that dietician",
  last.path === "/api/admin/dieticians/die_1/schools" && last.body.schoolId === "sch_2"
  && last.body.active === true);

// Taking a school away is the × on the school itself.
await p.evaluate(() => {
  const row = [...document.querySelectorAll("tbody tr")].find((r) => r.textContent.includes("Meera"));
  const x = [...row.querySelectorAll("button")].find((b) => b.textContent.trim() === "×");
  x.click();
});
await p.waitForTimeout(400);
last = await p.evaluate(() => window.__posted[window.__posted.length - 1]);
check("removing a school sends active false",
  last.path === "/api/admin/dieticians/die_1/schools" && last.body.active === false);

// A retired dietician gets Restore, not Retire.
const buttons = await p.evaluate(() => {
  const row = [...document.querySelectorAll("tbody tr")].find((r) => r.textContent.includes("Asha"));
  return [...row.querySelectorAll("button")].map((b) => b.textContent.trim());
});
check("a retired dietician is offered a restore", buttons.includes("Restore"));
check("and is not offered a school picker", !buttons.includes("×"));

// Adding one.
await p.getByRole("button", { name: "Add a dietician", exact: false }).first().click();
await p.waitForTimeout(300);
t = await p.$eval("#root", (n) => n.innerText);
check("the form says the number is the sign-in", /how they sign in/i.test(t));
check("and warns a parent's number will be refused", /already belongs to a parent/i.test(t));

check("no page errors", errs.length === 0);
if (errs.length) console.log(errs.join("\n"));
await b.close();
process.exit(failures ? 1 : 0);
