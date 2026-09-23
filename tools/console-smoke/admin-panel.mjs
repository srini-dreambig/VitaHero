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
    "/api/admin/doctors": { canEdit: true,
      // Served by the server so the dropdown, the validator and the screening
      // forms cannot be three lists that drift apart within a release.
      specialties: [
        { name: "Paediatrics", checks: ["Height & weight", "Haemoglobin"], canScreen: true, planned: ["Immunisation review"] },
        { name: "Ophthalmology", checks: ["Vision"], canScreen: true, planned: [] },
        { name: "Dentistry", checks: ["Dental"], canScreen: true, planned: [] },
        { name: "Dermatology", checks: [], canScreen: false, planned: ["Skin"] },
      ],
      doctors: [
      // hasMobile and canSignIn are two different facts: the first is whether
      // the number can receive a code, the second whether they have a sign-in
      // at all. Conflating them is what let a doctor be added, shown with their
      // number, and then turned away at the door as unregistered.
      { id: "doc_1", name: "Dr Ananya Rao", specialty: "Paediatrics", hospitalId: "hos_1",
        hospitalName: "Rainbow Hospital", city: "Hyderabad", phone: "+919876543210",
        hasMobile: true, canSignIn: true, campCount: 3, campsEver: 3, rating: 4.9, active: true },
      { id: "doc_2", name: "Dr Landline", specialty: "Dental", hospitalId: "hos_1",
        hospitalName: "Rainbow Hospital", city: "Hyderabad", phone: "+914023456789",
        hasMobile: false, canSignIn: false, campCount: 0, campsEver: 0, rating: 4.5, active: true },
      { id: "doc_3", name: "Dr No Number", specialty: "ENT", hospitalId: "",
        hospitalName: "", city: "Guntur", phone: "",
        hasMobile: false, canSignIn: false, campCount: 0, campsEver: 0, rating: 0, active: true },
      // A good mobile and no sign-in: the reported case. Added in the console,
      // shown with their number, and unable to get in.
      { id: "doc_4", name: "Dr Meera Iyer", specialty: "Ophthalmology", hospitalId: "hos_2",
        hospitalName: "Sunrise Eye", city: "Hyderabad", phone: "+919876500011",
        hasMobile: true, canSignIn: false, campCount: 0, campsEver: 0, rating: 4.2, active: true },
      // Was on camps, all revoked: a closed door rather than one never opened.
      { id: "doc_5", name: "Dr Past Tense", specialty: "ENT", hospitalId: "hos_2",
        hospitalName: "Sunrise Eye", city: "Guntur", phone: "+919876500022",
        hasMobile: true, canSignIn: false, campCount: 0, campsEver: 2, rating: 4.0, active: true },
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
      // The directory and the library are a choice, counted apart from the
      // total: that is what goes no matter what is ticked.
      optional: { directory: { hospitals: 2, doctors: 6, dieticians: 1, total: 9 },
                  library: { articles: 4, total: 4 } },
      keeps: ["Operations sign-ins, including yours — otherwise you would be locked out mid-reset"] },
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
// Doctor | Specialty | Hospital | City | Mobile | Sign-in | Camps | Rating | Status | actions
check("how many camps a doctor is on is shown", docCells[6] === "3");
check("a doctor's rating is shown", docCells[7] === "4.9");
check("a doctor's mobile is shown", /\+919876543210/.test(docTable));
// The heart of it: two doctors who cannot sign in, said plainly.
check("a landline is called a landline, not a fallback",
  /Not a mobile/.test(docTable) && !/via hospital/.test(docTable));
check("a doctor with no number at all is flagged too", /No mobile/.test(docTable));

// ── the sign-in column ────────────────────────────────────────
// The reported bug, as a column. A doctor was added with the mobile the form
// demanded, the table showed that mobile, and the app then said the number was
// not registered. The number and the sign-in were never the same fact.
const signInCell = async (name) => (await p.evaluate((n) => {
  const row = [...document.querySelectorAll("tbody tr")]
    .find((r) => r.textContent.includes(n));
  return row ? [...row.querySelectorAll("td")].map((td) => td.textContent.trim()) : [];
}, name))[5];
check("a doctor who can get in says so", /Can sign in/.test(await signInCell("Dr Ananya Rao")));
check("a doctor with a good mobile and no sign-in is not left looking fine",
  /Referral only/.test(await signInCell("Dr Meera Iyer")));
check("and a doctor whose camps were all revoked reads differently again",
  /Access ended/.test(await signInCell("Dr Past Tense")));
// Opening the menu re-renders the table, so the click and the read have to be
// two steps: in one evaluate the row object is the one that was just replaced.
await p.evaluate(() => {
  [...document.querySelectorAll("tbody tr")]
    .find((r) => r.textContent.includes("Dr Meera Iyer"))
    .querySelector(".menuw button").click();
});
await p.waitForTimeout(200);
check("giving a doctor sign-in access is one action on their row",
  await p.evaluate(() => [...document.querySelectorAll(".menu button")]
    .some((b) => /Give sign-in access/.test(b.textContent))));
await p.evaluate(() => document.body.click());
await p.waitForTimeout(150);

// ── the specialty is chosen, not typed ────────────────────────
//
// It used to be free text that nothing read, so "Ophthalmology", "ophthalmology"
// and "Eye specialist" were three specialties to a computer and one to
// everybody else. It decides which screening form a doctor is handed at a camp
// now, so it has to be a choice from the list the server accepts.
await p.evaluate(() => {
  [...document.querySelectorAll("button")]
    .find((b) => /Add doctor/i.test(b.textContent)).click();
});
await p.waitForTimeout(300);

const specialtyField = await p.evaluate(() => {
  const fld = [...document.querySelectorAll(".fld")]
    .find((f) => /Specialty/i.test(f.querySelector("label")?.textContent || ""));
  if (!fld) return { found: false };
  const sel = fld.querySelector("select");
  return {
    found: true,
    isSelect: !!sel,
    hasTextBox: !!fld.querySelector("input[type=text], input:not([type])"),
    options: sel ? [...sel.options].map((o) => o.textContent) : [],
  };
});
check("the doctor form has a specialty field", specialtyField.found);
check("and it is a dropdown rather than a text box",
  specialtyField.isSelect && !specialtyField.hasTextBox);
check("whose options come from the server's list",
  specialtyField.options.some((o) => /Ophthalmology/.test(o)));
// The dropdown says what choosing it means, so nobody has to find out at the camp.
check("each option names the checks that specialty screens",
  specialtyField.options.some((o) => /Ophthalmology.*Vision/.test(o)));
check("and a specialty with no screening form says so",
  specialtyField.options.some((o) => /Dermatology.*referral only/i.test(o)));

await p.evaluate(() => {
  const sel = [...document.querySelectorAll(".fld")]
    .find((f) => /Specialty/i.test(f.querySelector("label")?.textContent || ""))
    .querySelector("select");
  sel.value = "Dermatology";
  sel.dispatchEvent(new Event("change", { bubbles: true }));
});
await p.waitForTimeout(250);
check("choosing one explains what it means before the doctor is saved",
  /no screening form for this specialty yet/i.test(
    await p.evaluate(() => document.body.innerText)));

await p.evaluate(() => {
  [...document.querySelectorAll("button")]
    .find((b) => /^Cancel$/.test(b.textContent.trim())).click();
});
await p.waitForTimeout(300);

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
check("and the operations sign-in is the one thing that always stays",
  /Operations sign-ins/.test(reset) && /locked out/.test(reset));
// The point of this change: the directory used to be excluded silently, so
// somebody emptied the programme and then found the doctors still listed with
// no way to tell whether that was a decision or a fault.
check("the directory and the library are offered as choices, with their counts",
  /Hospitals, doctors & dieticians/.test(reset) && /Reading library/.test(reset)
  // Every count, not a prefix of the line: a key the server stopped sending
  // renders as the word "undefined", and a prefix match would let that ship.
  // (textContent runs the nodes together, so no trailing boundary to anchor
  // on — the absence of "undefined" is the check that matters.)
  && /2 hospitals, 6 doctors, 1 dietician/.test(reset)
  && !/undefined/.test(reset));
const ticked = await p.evaluate(() =>
  [...document.querySelectorAll(".card input[type=checkbox]")].map((c) => c.checked));
check("and both are ticked to begin with, so the button means what it says",
  ticked.length === 2 && ticked.every(Boolean));

// Untick the directory and it must travel as a decision, not be assumed.
await p.evaluate(() => {
  const c = [...document.querySelectorAll(".card input[type=checkbox]")][0];
  c.checked = false;
  c.dispatchEvent(new Event("change", { bubbles: true }));
});
await p.waitForTimeout(250);

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
check("and it sends the choice about the directory rather than assuming it",
  !!wiped && wiped.body.directory === false && wiped.body.library === true);

// The safeguard that matters most: emptying the programme lives on its own
// screen and nowhere else. This used to be checked against the
// demonstration-data screen, which no longer exists; Retention is the nearest
// neighbour and makes the same point.
await go(p, "Retention");
check("emptying the programme is not reachable from another oversight screen",
  await p.evaluate(() => document.getElementById("resetgo") === null));

check("admin panel: no page errors", errs.length === 0);
if (errs.length) console.log(errs.join("\n"));

await b.close();
process.exit(failures ? 1 : 0);
