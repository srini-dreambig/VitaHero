const { chromium } = (await import((process.env.PW_DIR || "playwright") + "/index.js")).default;

// What the console keeps, and for how long.
//
// The console is one long-lived page with one state object behind it. Three
// questions follow from that, and none of them were being answered:
//   * does a form know which form it is, or does it wear whatever the last one
//     left behind?
//   * does signing out take the data off the screen with it, on a machine in a
//     school office that four people share?
//   * does a camp pack downloaded for a hall with no signal ever leave the
//     device again?

const URL = process.env.PORTAL_URL || "http://127.0.0.1:8099/portal.html";
let failures = 0;
const check = (l, c) => { console.log((c ? "PASS  " : "FAIL  ") + l); if (!c) failures++; };

const b = await chromium.launch();

const SCHOOL = {
  id: "sch_1", name: "Silver Oaks", city: "Hyderabad", district: "", partnerCode: "SO-1",
  contactName: "", contactPhone: "", contactEmail: "", academicYear: "2026-27",
  campCadence: "ANNUAL", checksOffered: ["Vision"], description: "",
  status: "ACTIVE", active: true, studentCount: 2, adminCount: 1,
};

async function open() {
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push("pageerror: " + e.message));

  await p.addInitScript((school) => {
    localStorage.setItem("vh_console", JSON.stringify({
      mode: "key", key: "k", name: "Ops", role: "SUPERADMIN", profileId: "ph_1", schoolId: null,
    }));
    // A camp pack from a previous day, exactly as the console stores one.
    localStorage.setItem("vh_pack_camp_9", JSON.stringify({
      camp: { id: "camp_9", title: "Annual" },
      participants: [{ kidId: "k1", name: "Meera Reddy", guardianName: "Sunita Reddy" }],
    }));
    const D = {
      "/api/admin/overview": { schools: 1, students: 2, guardians: 2, guardiansActivated: 1,
        campStatus: {}, upcoming: [] },
      "/api/admin/analytics": { funnel: {}, prevalence: [], months: [], bySchool: [] },
      "/api/admin/schools": { schools: [school] },
      "/api/admin/schools/sch_1": { school: school },
      "/api/admin/schools/sch_1/roster": { total: 2, academicYear: "2026-27", students: [
        { id: "k1", name: "Meera Reddy", grade: "Class 3", section: "A", gender: "F", age: 9,
          dob: "", studentRef: "2026/1001", guardianName: "Sunita Reddy",
          guardianPhone: "+919800000001", guardianActivated: false, profileId: "ph_g1",
          academicYear: "2026-27" },
      ] },
      "/api/admin/schools/sch_1/classes": {
        academicYear: "2026-27",
        classes: [{ grade: "Class 3", section: "A" }, { grade: "Class 4", section: "B" }],
      },
      "/api/admin/schools/sch_1/admins": { admins: [
        { profileId: "ph_a", name: "Asha Rao", phone: "+919800000001", email: "", hasSignedIn: true, addedBy: "" },
      ] },
      "/api/admin/schools/sch_1/staff": { staff: [] },
    };
    window.__calls = [];
    window.confirm = () => true;
    const real = window.fetch;
    window.fetch = (u, o) => {
      const path = new URL(u, location.origin).pathname;
      const method = (o && o.method) || "GET";
      if (method !== "GET") {
        window.__calls.push({ path, method, body: o && o.body ? JSON.parse(o.body) : null });
        return Promise.resolve(new Response(JSON.stringify({ ok: true, staff: { name: "X", phone: "Y" } }),
          { headers: { "content-type": "application/json" } }));
      }
      let body = D[path];
      if (body === undefined) body = path.startsWith("/api/") ? {} : null;
      if (body === null) return real(u, o);
      return Promise.resolve(new Response(JSON.stringify(body),
        { headers: { "content-type": "application/json" } }));
    };
  }, SCHOOL);

  await p.goto(URL, { waitUntil: "networkidle" });
  await p.waitForTimeout(500);
  await p.locator(".navi", { hasText: /^Schools$/ }).first().click();
  await p.waitForTimeout(350);
  await p.getByText("Silver Oaks").first().click();
  await p.waitForTimeout(700);
  return { p, errs };
}

// ── one form slot, seven forms ───────────────────────────────
{
  const { p, errs } = await open();

  // Classes fills the shared form slot with { year, grades, sections }.
  await p.locator(".navi", { hasText: /^Classes$/ }).first().click();
  await p.waitForTimeout(500);
  const year = await p.locator("#root input[type=text]").first().inputValue();
  check("the classes form is filled in from the school", year === "2026-27");

  // Leave without saving, and open a form of an entirely different shape.
  await p.locator(".navi", { hasText: /^Staff$/ }).first().click();
  await p.waitForTimeout(600);

  const role = await p.locator("#staff-kind").first().inputValue().catch(() => "");
  check("the add-person form knows which role it is adding", role !== "");

  const values = await p.$$eval("#root input", (ns) => ns.map((n) => n.value));
  check("the add-person form is not wearing the classes form's values",
    !values.includes("2026-27"));

  // The sharp end. The dropdown reads "School administrator" because a select
  // with nothing selected shows its first option — but the form object behind
  // it came from the classes tab and has no `kind` at all, so the branch that
  // decides where to post takes the other road. The console then creates a
  // clinician with no role while showing the operator the word administrator.
  await p.locator("#root input").first().fill("Priya Nair");
  await p.locator("#root input").nth(1).fill("+919800000009");
  const shown = await p.locator("#staff-kind").first().inputValue();
  await p.getByRole("button", { name: /Add person/ }).first().click();
  await p.waitForTimeout(400);
  const posted = (await p.evaluate(() => window.__calls)).filter((c) => c.method === "POST");
  const wantsAdmin = shown === "SCHOOL_ADMIN";
  check("the role the form shows is the role the console sends",
    posted.length === 1 && (wantsAdmin
      ? /\/admins$/.test(posted[0].path)
      : /\/staff$/.test(posted[0].path)));

  check("forms: no page errors", errs.length === 0);
  if (errs.length) console.log(errs.join("\n"));
  await p.close();
}

// ── signing out takes the data with it ───────────────────────
{
  const { p, errs } = await open();

  // Put a roster on screen: real children, real guardian phone numbers.
  await p.locator(".navi", { hasText: /^Roster$/ }).first().click();
  await p.waitForTimeout(600);
  const before = await p.$eval("#root", (n) => n.innerText);
  check("the roster is on screen to begin with", /Meera Reddy/.test(before));

  await p.getByRole("button", { name: /Sign out/ }).first().click();
  await p.waitForTimeout(400);
  const signedOut = await p.$eval("#root", (n) => n.innerText);
  check("signing out reaches the sign-in screen", !/Meera Reddy/.test(signedOut));

  const packs = await p.evaluate(() =>
    Object.keys(localStorage).filter((k) => k.indexOf("vh_pack_") === 0));
  check("signing out clears the camp packs off the device", packs.length === 0);

  const namesChild = await p.evaluate(() =>
    Object.keys(localStorage).filter((k) =>
      (localStorage.getItem(k) || "").indexOf("Meera Reddy") >= 0));
  check("nothing left on the device names a child", namesChild.length === 0);

  check("sign-out: no page errors", errs.length === 0);
  if (errs.length) console.log(errs.join("\n"));
  await p.close();
}

// ── the answer to a question nobody is asking any more ──────
{
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push("pageerror: " + e.message));

  await p.addInitScript(() => {
    localStorage.setItem("vh_console", JSON.stringify({
      mode: "key", key: "k", name: "Ops", role: "SUPERADMIN", profileId: "ph_1", schoolId: null,
    }));
    const mk = (id, name) => ({
      id, name, city: "Hyderabad", district: "", partnerCode: id.toUpperCase(),
      contactName: "", contactPhone: "", contactEmail: "", academicYear: "2026-27",
      campCadence: "ANNUAL", checksOffered: ["Vision"], description: "",
      status: "ACTIVE", active: true, studentCount: 1, adminCount: 1,
    });
    const A = mk("sch_a", "Aster High"), B = mk("sch_b", "Bluebell School");
    const D = {
      "/api/admin/overview": { schools: 2, students: 2, guardians: 2, guardiansActivated: 1,
        campStatus: {}, upcoming: [] },
      "/api/admin/analytics": { funnel: {}, prevalence: [], months: [], bySchool: [] },
      "/api/admin/schools": { schools: [A, B] },
      "/api/admin/schools/sch_a": { school: A },
      "/api/admin/schools/sch_b": { school: B },
      "/api/admin/schools/sch_a/roster": { total: 1, academicYear: "2026-27", students: [
        { id: "ka", name: "Aster Child", grade: "Class 3", section: "A", gender: "F", age: 9,
          dob: "", studentRef: "A/1", guardianName: "G A", guardianPhone: "+919800000001",
          guardianActivated: false, profileId: "ph_a", academicYear: "2026-27" }] },
      "/api/admin/schools/sch_b/roster": { total: 1, academicYear: "2026-27", students: [
        { id: "kb", name: "Bluebell Child", grade: "Class 4", section: "B", gender: "M", age: 10,
          dob: "", studentRef: "B/1", guardianName: "G B", guardianPhone: "+919800000002",
          guardianActivated: false, profileId: "ph_b", academicYear: "2026-27" }] },
    };
    const real = window.fetch;
    // Everything about Aster High answers slowly, the way a school on a bad
    // line does. Bluebell answers at once.
    window.fetch = (u, o) => {
      const path = new URL(u, location.origin).pathname;
      let body = D[path];
      if (body === undefined) body = path.startsWith("/api/") ? {} : null;
      if (body === null) return real(u, o);
      const res = () => new Response(JSON.stringify(body),
        { headers: { "content-type": "application/json" } });
      if (path.indexOf("sch_a") >= 0) {
        return new Promise((r) => setTimeout(() => r(res()), 1200));
      }
      return Promise.resolve(res());
    };
  });

  await p.goto(URL, { waitUntil: "networkidle" });
  await p.waitForTimeout(500);
  await p.locator(".navi", { hasText: /^Schools$/ }).first().click();
  await p.waitForTimeout(350);

  // Ask for the slow one, change your mind, ask for the fast one.
  await p.getByText("Aster High").first().click();
  await p.waitForTimeout(150);
  await p.locator(".navi", { hasText: /^Schools$/ }).first().click();
  await p.waitForTimeout(200);
  await p.getByText("Bluebell School").first().click();

  // Long enough for Aster's answers to arrive second.
  await p.waitForTimeout(2600);
  // The page heading, not the whole document: the sidebar lists every school by
  // name, so searching the body for "Aster High" finds the menu entry too.
  const heading = await p.$eval("#root h1", (n) => n.innerText.trim());
  const table = await p.$eval("#root", (n) => {
    const t = n.querySelector("table");
    return t ? t.innerText : "";
  });

  check("the school on screen is the one that was asked for last",
    heading === "Bluebell School");
  check("the roster on screen belongs to that school",
    /Bluebell Child/.test(table) && !/Aster Child/.test(table));

  check("stale navigation: no page errors", errs.length === 0);
  if (errs.length) console.log(errs.join("\n"));
  await p.close();
}

await b.close();
process.exit(failures ? 1 : 0);
