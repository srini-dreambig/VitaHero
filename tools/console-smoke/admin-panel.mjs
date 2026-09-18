const { chromium } = (await import((process.env.PW_DIR || "playwright") + "/index.js")).default;
import { go } from "./nav.mjs";

// What the admin panel shows, and what it lets you look for.
//
// Four gaps, all of them the console dropping something it already had:
//
//   - The doctors endpoint has accepted a hospital_id filter since it was
//     written. Nothing ever sent it, so a directory of any size could only be
//     read end to end.
//   - mapSchool returns eighteen fields and the schools table showed six. The
//     contact who should be rung, the checks the school agreed to, how often
//     camps run — all on the wire, none on screen.
//   - A doctor with no usable number read "via hospital", which sounds like a
//     sensible fallback and actually means this doctor can never receive a
//     sign-in code and can never be put on a camp.
//   - A number could only be looked for in the one list you thought to open.

const URL = process.env.PORTAL_URL || "http://127.0.0.1:8099/admin";
let failures = 0;
const check = (l, c) => { console.log((c ? "PASS  " : "FAIL  ") + l); if (!c) failures++; };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
p.on("pageerror", (e) => errs.push("pageerror: " + e.message));

await p.addInitScript(() => {
  localStorage.setItem("vh_console", JSON.stringify({
    mode: "key", key: "k", name: "Ops", role: "SUPERADMIN", profileId: "ph_1", schoolId: null,
  }));
  const D = {
    "/api/admin/overview": { schools: 1, students: 40, guardians: 40, guardiansActivated: 10,
      campStatus: {}, upcoming: [] },
    "/api/admin/schools": { schools: [{
      id: "sch_1", name: "Silver Oaks", city: "Hyderabad", district: "Gachibowli",
      partnerCode: "SO-1", academicYear: "2026-27", contactName: "Asha Rao",
      contactPhone: "+919800000001", contactEmail: "head@silveroaks.in",
      campCadence: "BIANNUAL", checksOffered: ["Vision", "Dental", "Haemoglobin"],
      onboardedAt: "2025-06-14T00:00:00Z", studentCount: 412, adminCount: 3,
      active: true, status: "ACTIVE",
    }] },
    "/api/admin/hospitals": { canEdit: true, hospitals: [
      { id: "hos_1", name: "Rainbow Hospital", city: "Hyderabad", district: "Banjara Hills",
        address: "Road 2", phone: "+914023456789", lat: null, lng: null,
        isCampPartner: true, active: true, doctorCount: 2 },
      { id: "hos_2", name: "LV Prasad Eye Institute", city: "Hyderabad", district: "",
        address: "", phone: "", lat: null, lng: null,
        isCampPartner: false, active: true, doctorCount: 1 },
    ] },
    "/api/admin/doctors": { canEdit: true, doctors: [
      { id: "doc_1", name: "Dr Ananya Rao", specialty: "Paediatrics", hospitalId: "hos_1",
        hospitalName: "Rainbow Hospital", city: "Hyderabad", phone: "+919876543210",
        canSignIn: true, campCount: 3, rating: 4.9, active: true },
      { id: "doc_2", name: "Dr Landline", specialty: "Dental", hospitalId: "hos_1",
        hospitalName: "Rainbow Hospital", city: "Hyderabad", phone: "+914023456789",
        canSignIn: false, campCount: 0, rating: 4.5, active: true },
      { id: "doc_3", name: "Dr No Number", specialty: "ENT", hospitalId: "",
        hospitalName: "", city: "Guntur", phone: "",
        canSignIn: false, campCount: 0, rating: 0, active: true },
    ] },
    "/api/admin/lookup": {
      query: "9876543210", normalized: "+919876543210", isMobile: true,
      matches: [
        { kind: "Guardian", id: "ph_9876543210", name: "Rahul Sharma", phone: "+919876543210",
          detail: "Silver Oaks · 2 children · signed in", schoolId: "sch_1" },
        { kind: "Doctor (directory)", id: "doc_1", name: "Dr Ananya Rao", phone: "+919876543210",
          detail: "Paediatrics · Rainbow Hospital · Hyderabad", schoolId: "" },
      ],
    },
    "/api/admin/guardians": { canInvite: true,
      schools: [{ id: "sch_1", name: "Silver Oaks" }],
      guardians: [
        { profileId: "ph_1", name: "Rahul Sharma", phone: "+919876543210", email: "",
          children: 2, childNames: "Aarav Sharma, Diya Sharma", schoolNames: "Silver Oaks",
          schoolId: "sch_1", usingApp: true, invitedAt: "2026-01-04", joinedAt: "2026-01-05",
          consents: 2, asked: 2, canSignIn: true },
        { profileId: "ph_2", name: "Landline Parent", phone: "+914023456789", email: "",
          children: 1, childNames: "Ishaan Rao", schoolNames: "Silver Oaks",
          schoolId: "sch_1", usingApp: false, invitedAt: "", joinedAt: "",
          consents: 0, asked: 1, canSignIn: false },
      ] },
    "/api/admin/reset": { total: 462, phrase: "DELETE EVERYTHING",
      counts: { schools: 2, camps: 3, children: 400, guardians: 40, findings: 12,
                referrals: 4, photos: 0, staff: 1, questions: 0 },
      keeps: ["Operations sign-ins, including yours", "The reading library",
              "The hospital and doctor directory"] },
    "/api/admin/demo-data": {
      empty: false, removable: 2, blocked: 1, articles: 4,
      items: [
        { kind: "School", id: "sch_oak", name: "Oakridge International School",
          detail: "0 on roll · 2 camps", removable: true, reason: "" },
        { kind: "Doctor", id: "d1", name: "Dr Demo", detail: "Paediatrics",
          removable: true, reason: "" },
        { kind: "Hospital", id: "hosp_rainbow", name: "Rainbow Children's Hospital",
          detail: "Hyderabad", removable: false,
          reason: "In use by a camp, school or doctor you added — will be retired, not deleted" },
      ],
    },
  };
  window.__calls = [];
  window.confirm = () => true;
  const real = window.fetch;
  window.fetch = (u, o) => {
    const url = new URL(u, location.origin);
    const method = (o && o.method) || "GET";
    window.__calls.push({ path: url.pathname, search: url.search, method,
      body: o && o.body ? JSON.parse(o.body) : null });
    if (method !== "GET") {
      return Promise.resolve(new Response(JSON.stringify({ ok: true, removed: ["School: Oakridge"], kept: [] }),
        { headers: { "content-type": "application/json" } }));
    }
    let body = D[url.pathname];
    if (body === undefined) body = url.pathname.startsWith("/api/") ? {} : null;
    if (body === null) return real(u, o);
    return Promise.resolve(new Response(JSON.stringify(body),
      { headers: { "content-type": "application/json" } }));
  };
});

await p.goto(URL, { waitUntil: "networkidle" });
await p.waitForTimeout(400);
const calls = () => p.evaluate(() => window.__calls);
const text = async (sel) => (await p.locator(sel).innerText()).replace(/\n+/g, " | ");
// innerText reports text as it is *rendered*, and status pills are small caps
// in CSS, so "Kept" comes back as "KEPT". Where the assertion is about content
// rather than presentation, read the authored text instead.
const raw = async (sel) => p.locator(sel).first().evaluate((n) =>
  [...n.querySelectorAll("*")].map((x) => x.childNodes.length === 1
    && x.firstChild.nodeType === 3 ? x.textContent : "").join(" | ") + " | " + n.textContent);

// ── the schools table ─────────────────────────────────────────
await go(p, "Schools");
await p.waitForTimeout(350);
// The schools list is a record list now: the row carries what you scan for —
// consent, coverage, camps run, referrals open — and the rest of what the
// school told us at onboarding opens out underneath it. Thirteen columns was
// the alternative, and it was unreadable.
const scanned = await p.locator(".rec").first().evaluate((n) => n.textContent);
check("the row carries how the programme is going, not just what the school is called",
  /CONSENT/i.test(scanned) && /SCREENED/i.test(scanned)
  && /CAMPS RUN/i.test(scanned) && /OPEN REFERRALS/i.test(scanned));

// Open the first row out.
// The expander, not the row menu — both are icon buttons.
await p.locator(".rec .expander").first().click();
await p.waitForTimeout(300);
const schoolRow = await p.locator(".recd").first().evaluate((n) => n.textContent);

check("the school's contact person is on the row", /Asha Rao/.test(schoolRow));
check("the contact's mobile is on the row", /\+919800000001/.test(schoolRow));
check("the contact's email is on the row", /head@silveroaks\.in/.test(schoolRow));
// "BIANNUAL" is a database value; "Twice a year" is what the form said when
// somebody chose it.
check("how often camps run is shown in words, not as a constant",
  /Twice a year/.test(schoolRow) && !/BIANNUAL/.test(schoolRow));
check("the checks the school agreed to are shown in full", /Vision/.test(schoolRow)
  && /Dental/.test(schoolRow) && /Haemoglobin/.test(schoolRow));
check("when the school came on board is shown", /2025/.test(schoolRow));
// Read the panel as the label/value pairs it actually is. Matching a regex
// against textContent bit us twice: it runs every cell together, so "SO-1"
// followed by "Academic year" has no word boundary after the 1.
const detail = await p.locator(".recd .dgrid > div").evaluateAll((ns) =>
  Object.fromEntries(ns.map((n) => [
    n.querySelector(".ml").textContent.trim(),
    n.querySelector(".dv").textContent.trim(),
  ])));
check("the counts that were already there are still there",
  detail["Children on roll"] === "412" && detail["Partner code"] === "SO-1");
check("and what the figures on the row are a proportion of is spelled out",
  /\bof\b/.test(detail["Consent given"] || "")
  && /\bof\b/.test(detail["Children screened"] || ""));

// ── the doctors table ─────────────────────────────────────────
await go(p, "Hospitals");
await p.waitForTimeout(450);

const docTable = await p.evaluate(() => {
  const tables = [...document.querySelectorAll("table")];
  const t = tables.find((x) => x.textContent.includes("Dr Ananya Rao"));
  // textContent, not innerText: the warning sits in a pill that CSS renders in
  // small caps, and what is being asserted is what the cell says.
  return t ? t.textContent.replace(/\s+/g, " ") : "no doctors table";
});
check("a doctor's city is shown", /Hyderabad/.test(docTable));
// Read the cell rather than the flattened row: textContent has no separators,
// so the camp count runs straight into the last digits of the phone number.
const docCells = await p.evaluate(() => {
  const row = [...document.querySelectorAll("tbody tr")]
    .find((r) => r.textContent.includes("Dr Ananya Rao"));
  return row ? [...row.querySelectorAll("td")].map((td) => td.textContent.trim()) : [];
});
// Doctor | Specialty | Hospital | City | Mobile | Camps | Rating | Status | actions
check("how many camps a doctor is on is shown", docCells[5] === "3");
check("a doctor's rating is shown", docCells[6] === "4.9");
check("a doctor's mobile is shown", /\+919876543210/.test(docTable));
// The heart of it: two doctors who cannot sign in, said plainly.
check("a landline is called a landline, not a fallback",
  /Not a mobile/.test(docTable) && !/via hospital/.test(docTable));
check("a doctor with no number at all is flagged too", /No mobile/.test(docTable));

// ── filtering and searching ───────────────────────────────────
await p.evaluate(() => {
  const sel = [...document.querySelectorAll("select")].find((s) =>
    [...s.options].some((o) => o.textContent.includes("All hospitals")));
  sel.value = "hos_2";
  sel.dispatchEvent(new Event("change", { bubbles: true }));
});
await p.waitForTimeout(350);
let c = await calls();
let filtered = c.filter((x) => x.path === "/api/admin/doctors").pop();
check("choosing a hospital filters the doctors by it",
  !!filtered && /hospital_id=hos_2/.test(filtered.search));

await p.evaluate(() => {
  const i = document.getElementById("docq");
  i.value = "43210";
  i.dispatchEvent(new Event("input", { bubbles: true }));
});
await p.evaluate(() => {
  const btns = [...document.querySelectorAll("button")];
  btns.find((x) => x.textContent.trim() === "Search" && x.closest(".tbar").querySelector("#docq")).click();
});
await p.waitForTimeout(350);
c = await calls();
const searched = c.filter((x) => x.path === "/api/admin/doctors").pop();
check("a doctor can be searched for by the digits of their number",
  !!searched && /q=43210/.test(searched.search));
check("the hospital filter is kept while searching",
  !!searched && /hospital_id=hos_2/.test(searched.search));

// ── finding a number across the programme ─────────────────────
await go(p, "Oversight");
await p.waitForTimeout(400);
await go(p, "Find a number");
await p.waitForTimeout(300);
await p.evaluate(() => {
  const i = document.getElementById("lookupq");
  i.value = "9876543210";
  i.dispatchEvent(new Event("input", { bubbles: true }));
});
await p.evaluate(() => {
  [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Find").click();
});
await p.waitForTimeout(400);
c = await calls();
check("looking a number up asks the server once, with the number",
  c.some((x) => x.path === "/api/admin/lookup" && /phone=9876543210/.test(x.search)));

const found = await raw(".content");
check("the same number is reported as a guardian and as a doctor",
  /Guardian/.test(found) && /Doctor \(directory\)/.test(found));
check("the match says where that person sits", /Silver Oaks/.test(found));

// ── clearing the demonstration data ───────────────────────────
await go(p, "Demonstration data");
await p.waitForTimeout(400);
const demo = await raw(".content");
// Findable by the words somebody would go looking for, not behind a category
// invented to hold one screen.
const oversightTabs = await p.$$eval(".tabs .tab", (ns) =>
  ns.map((n) => n.textContent.replace(/\d+$/, "").trim()));
check("clearing the demo data is named on the tab, not hidden behind a category",
  oversightTabs.includes("Demonstration data") && !oversightTabs.includes("Maintenance"));
check("the demo panel lists what it would remove", /Oakridge International School/.test(demo));
check("it says which records it will keep, and why",
  /Kept/.test(demo) && /In use by a camp/.test(demo));
check("nothing has been removed by looking",
  !(await calls()).some((x) => x.method === "DELETE"));

await p.evaluate(() => {
  [...document.querySelectorAll("button")].find((x) => /^Remove 2$/.test(x.textContent.trim())).click();
});
await p.waitForTimeout(400);
c = await calls();
const purged = c.find((x) => x.path === "/api/admin/demo-data" && x.method === "DELETE");
check("removing sends one delete", !!purged);
// The reading library is content a guardian is shown, not fiction. It only
// goes when the other button is pressed.
check("the reading library is left alone unless asked for",
  !!purged && purged.body.articles === false);

// ── parents ───────────────────────────────────────────────────
//
// Guardians are the largest group of people the programme touches and the only
// one that had no list: they were reachable only through the roster of a school
// you already had to know the name of.
await go(p, "Parents");
const parents = await p.locator(".rec").first().evaluate((n) => n.textContent);
check("a parent's row names the children behind them", /Aarav Sharma/.test(parents));
check("and the school they belong to", /Silver Oaks/.test(parents));
check("and whether they are actually on the app", /On the app/i.test(parents));

const second = await p.locator(".rec").nth(1).evaluate((n) => n.textContent);
// The point of showing it at all: this parent can never receive an invitation,
// however many are sent, and that is a different problem from not having
// opened one yet.
check("a parent whose number cannot receive a code is called out",
  /Not a mobile/i.test(second) && !/\+914023456789/.test(second));

await p.evaluate(() => {
  const i = document.getElementById("parentq");
  i.value = "aarav";
  i.dispatchEvent(new Event("input", { bubbles: true }));
});
await p.evaluate(() => [...document.querySelectorAll("button")]
  .find((x) => x.textContent.trim() === "Search").click());
await p.waitForTimeout(400);
let pc = await calls();
const searched2 = pc.filter((x) => x.path === "/api/admin/guardians").pop();
check("a parent can be searched for by their child's name",
  !!searched2 && /q=aarav/.test(searched2.search));

// ── emptying the programme ────────────────────────────────────
await go(p, "Oversight");
await go(p, "Empty the programme");
const reset = await p.locator(".content").evaluate((n) => n.textContent);
check("the reset says exactly what would go, counted", /462/.test(reset)
  && /Children/.test(reset) && /400/.test(reset));
check("and what would stay", /Operations sign-ins/.test(reset)
  && /reading library/i.test(reset));

// By id, not by text: the tab that reaches this screen carries the same words
// and is never disabled, so matching on text finds the wrong control.
const guard = await p.evaluate(() => {
  const btn = document.getElementById("resetgo");
  return { present: !!btn, disabled: btn ? btn.disabled : null };
});
check("the button is there but refuses to be pressed until the words are typed",
  guard.present === true && guard.disabled === true);

// Something close, but not the phrase.
await p.evaluate(() => {
  const i = document.getElementById("resetconfirm");
  i.value = "delete";
  i.dispatchEvent(new Event("input", { bubbles: true }));
});
await p.waitForTimeout(250);
check("a near miss does not unlock it",
  await p.evaluate(() => document.getElementById("resetgo").disabled === true));

await p.evaluate(() => {
  const i = document.getElementById("resetconfirm");
  i.value = "delete everything";
  i.dispatchEvent(new Event("input", { bubbles: true }));
});
await p.waitForTimeout(250);
check("the exact words unlock it, whatever case they are typed in",
  await p.evaluate(() => document.getElementById("resetgo").disabled === false));

await p.evaluate(() => document.getElementById("resetgo").click());
await p.waitForTimeout(400);
pc = await calls();
const wiped = pc.find((x) => x.path === "/api/admin/reset" && x.method === "POST");
check("and it sends the words for the server to check again",
  !!wiped && /delete everything/i.test(String(wiped.body.confirm)));

// The safeguard that matters most: this is not a button on the demo screen.
await go(p, "Demonstration data");
check("emptying the programme is not reachable from the demonstration-data screen",
  await p.evaluate(() => document.getElementById("resetgo") === null));

check("admin panel: no page errors", errs.length === 0);
if (errs.length) console.log(errs.join("\n"));

await b.close();
process.exit(failures ? 1 : 0);
