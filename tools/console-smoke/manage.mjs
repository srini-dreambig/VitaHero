const { chromium } = (await import((process.env.PW_DIR || "playwright") + "/index.js")).default;

// Managing a school, a hospital and a doctor from the list they appear in.
//
// Three gaps this covers, all of them things the console showed but could not
// actually do:
//
//   - The schools list ended in a "Manage" button with no click handler. It
//     had never done anything; it just looked like it should.
//   - Retiring a hospital or a doctor was a one-way door. Nothing in the
//     console set active back to true, so a mis-click could only be undone by
//     someone with database access.
//   - The upsert treats a body with no `active` field as active, so saving an
//     edit to a retired hospital quietly brought it back to families.
//
// The fourth check here is about the menu itself rather than any action: it is
// position:fixed precisely because the table it sits in scrolls, and an
// absolutely positioned menu on the last row was clipped to nothing by that
// scroller. A menu that renders but cannot be seen is the same as no menu, and
// nothing else in this suite would notice.

const URL = process.env.PORTAL_URL || "http://127.0.0.1:8099/admin";
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
    "/api/admin/overview": { schools: 2, students: 40, guardians: 40, guardiansActivated: 10,
      campStatus: {}, upcoming: [] },
    "/api/admin/schools": { schools: [
      { id: "sch_1", name: "Silver Oaks", city: "Hyderabad", district: "", partnerCode: "SO-1",
        academicYear: "2026-27", studentCount: 40, adminCount: 2, active: true, status: "ACTIVE" },
      { id: "sch_2", name: "Closed Academy", city: "Guntur", district: "", partnerCode: "CA-1",
        academicYear: "2025-26", studentCount: 0, adminCount: 1, active: false, status: "ARCHIVED" },
    ] },
    "/api/admin/hospitals": { canEdit: true, hospitals: [
      { id: "hos_1", name: "Rainbow Hospital", city: "Hyderabad", district: "Banjara Hills",
        address: "Road 2", phone: "+914023456789", lat: 17.4, lng: 78.4,
        isCampPartner: true, active: true, doctorCount: 2 },
      { id: "hos_2", name: "Never Used Clinic", city: "Guntur", district: "", address: "",
        phone: "", lat: null, lng: null, isCampPartner: false, active: false, doctorCount: 0 },
    ] },
    "/api/admin/doctors": { canEdit: true, doctors: [
      { id: "doc_1", name: "Dr Ananya Rao", specialty: "Paediatrics", hospitalId: "hos_1",
        hospitalName: "Rainbow Hospital", city: "Hyderabad", phone: "+919876543210", active: true },
      { id: "doc_2", name: "Dr Retired", specialty: "Dental", hospitalId: "", hospitalName: "",
        city: "Guntur", phone: "", active: false },
    ] },
  };
  window.__calls = [];
  window.confirm = () => true;
  const real = window.fetch;
  window.fetch = (u, o) => {
    const path = new URL(u, location.origin).pathname;
    const method = (o && o.method) || "GET";
    if (method !== "GET") {
      window.__calls.push({ path, method, body: o && o.body ? JSON.parse(o.body) : null });
      return Promise.resolve(new Response(JSON.stringify({
        ok: true, id: "x", name: "x",
        school: { id: "sch_1", name: "Silver Oaks", active: false, status: "ARCHIVED" },
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
await p.waitForTimeout(400);

/** Open the action menu on the row naming `name`, and list what it offers. */
const openMenu = (name) => p.evaluate((n) => {
  // Schools are a record list, hospitals and doctors are still tables. A row
  // is a row either way, and the test is about what its menu offers.
  const row = [...document.querySelectorAll("tbody tr, .rec")]
    .find((r) => r.textContent.includes(n));
  if (!row) return { error: "no row for " + n };
  const btn = row.querySelector("td.act button, .menuw button");
  if (!btn) return { error: "no action button on the row for " + n };
  btn.click();
  const menu = document.querySelector(".menu");
  if (!menu) return { error: "no menu opened" };
  const r = menu.getBoundingClientRect();
  return {
    items: [...menu.querySelectorAll("button")].map((x) => x.textContent.trim()),
    // Rendered, on screen, and not collapsed by a clipping ancestor.
    visible: getComputedStyle(menu).visibility === "visible"
      && r.width > 0 && r.height > 0
      && r.top >= 0 && r.bottom <= window.innerHeight
      && r.left >= 0 && r.right <= window.innerWidth,
  };
}, name);

const clickItem = (label) => p.evaluate((l) => {
  const m = [...document.querySelectorAll(".menu button")].find((x) => x.textContent.trim() === l);
  if (!m) return false;
  m.click();
  return true;
}, label);

const calls = () => p.evaluate(() => window.__calls);

// ── schools ──────────────────────────────────────────────────
await p.locator(".navi", { hasText: /^Schools$/ }).first().click();
await p.waitForTimeout(350);

const active = await openMenu("Silver Oaks");
check("a school row offers actions rather than a button that does nothing",
  !active.error && active.items.length > 0);
check("an active school is offered archiving, not reopening",
  !!active.items && active.items.some((x) => /^Archive school/.test(x))
  && !active.items.some((x) => /Reopen/.test(x)));
check("deleting a school is offered from the row",
  !!active.items && active.items.some((x) => /^Delete school/.test(x)));

await p.keyboard.press("Escape");
await p.waitForTimeout(150);

const archived = await openMenu("Closed Academy");
check("an archived school is offered reopening instead of archiving",
  !archived.error && archived.items.some((x) => /^Reopen school$/.test(x))
  && !archived.items.some((x) => /^Archive school/.test(x)));

check("the menu on the last row is actually on screen, not clipped by its container",
  archived.visible === true);

await p.keyboard.press("Escape");
await p.waitForTimeout(150);
await openMenu("Silver Oaks");
await clickItem("Archive school…");
await p.waitForTimeout(350);
let c = await calls();
const arch = c.find((x) => /\/archive$/.test(x.path));
check("archiving from the row posts archived:true for that school",
  !!arch && arch.method === "POST" && arch.path === "/api/admin/schools/sch_1/archive"
  && arch.body.archived === true);

// ── hospitals ────────────────────────────────────────────────
await p.locator(".navi", { hasText: /^Hospitals$/ }).first().click();
await p.waitForTimeout(400);

const live = await openMenu("Rainbow Hospital");
check("a live hospital is offered retiring, not restoring",
  !live.error && live.items.some((x) => /^Retire hospital/.test(x))
  && !live.items.some((x) => /Restore/.test(x)));

await p.keyboard.press("Escape");
await p.waitForTimeout(150);

const dead = await openMenu("Never Used Clinic");
check("a retired hospital can be restored",
  !dead.error && dead.items.some((x) => /^Restore hospital$/.test(x)));

await clickItem("Restore hospital");
await p.waitForTimeout(350);
c = await calls();
const restored = c.filter((x) => x.path === "/api/admin/hospitals").pop();
check("restoring a hospital sends active:true for that hospital",
  !!restored && restored.body.id === "hos_2" && restored.body.active === true);

// The bug this guards: the server reads a missing `active` as true, so an edit
// that did not carry the field silently un-retired the hospital it was editing.
await p.keyboard.press("Escape");
await p.waitForTimeout(150);
await p.locator(".navi", { hasText: /^Hospitals$/ }).first().click();
await p.waitForTimeout(400);
await openMenu("Never Used Clinic");
await clickItem("Edit hospital");
await p.waitForTimeout(300);
const editKeepsRetired = await p.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Save hospital");
  if (!btn) return "no save button";
  btn.click();
  return true;
});
await p.waitForTimeout(350);
c = await calls();
const saved = c.filter((x) => x.path === "/api/admin/hospitals").pop();
check("editing a retired hospital does not quietly bring it back",
  editKeepsRetired === true && !!saved && saved.body.id === "hos_2" && saved.body.active === false);

// ── doctors ──────────────────────────────────────────────────
await p.locator(".navi", { hasText: /^Hospitals$/ }).first().click();
await p.waitForTimeout(400);
const deadDoc = await openMenu("Dr Retired");
check("a retired doctor can be restored", !deadDoc.error
  && deadDoc.items.some((x) => /^Restore doctor$/.test(x)));

await clickItem("Restore doctor");
await p.waitForTimeout(350);
c = await calls();
const docRestored = c.filter((x) => x.path === "/api/admin/doctors").pop();
check("restoring a doctor sends active:true for that doctor",
  !!docRestored && docRestored.body.id === "doc_2" && docRestored.body.active === true);

check("manage actions: no page errors", errs.length === 0);
if (errs.length) console.log(errs.join("\n"));

await b.close();
process.exit(failures ? 1 : 0);
