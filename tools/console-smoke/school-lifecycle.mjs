const { chromium } = (await import((process.env.PW_DIR || "playwright") + "/index.js")).default;

// Getting rid of a school, and getting rid of a doctor.
//
// The console could create a school and never remove one, and could add a
// screener or physician and never take them away. Both gaps left the same kind
// of residue: a list of duplicate and demo schools nobody could clear, and
// clinical staff who had left still holding a working sign-in.
//
// What is checked here is that the two acts stay distinct. Archiving is always
// offered and keeps every record. Deleting is offered only for a school where
// no child has been screened, and is refused in words rather than by a button
// that fails when pressed.

const URL = process.env.PORTAL_URL || "http://127.0.0.1:8099/portal.html";
let failures = 0;
const check = (l, c) => { console.log((c ? "PASS  " : "FAIL  ") + l); if (!c) failures++; };

const b = await chromium.launch();

/**
 * Open a school's Programme tab with a given footprint.
 * `screened` decides whether this is a school with clinical records or an
 * empty one, which is the only thing that changes what the panel offers.
 */
async function open(screened) {
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push("pageerror: " + e.message));

  await p.addInitScript((hasRecords) => {
    localStorage.setItem("vh_console", JSON.stringify({
      mode: "key", key: "k", name: "Ops", role: "SUPERADMIN", profileId: "ph_1", schoolId: null,
    }));
    const school = {
      id: "sch_1", name: "Silver Oaks", city: "Hyderabad", district: "", partnerCode: "SO-1",
      contactName: "", contactPhone: "", contactEmail: "", academicYear: "2026-27",
      campCadence: "ANNUAL", checksOffered: ["Vision"], description: "",
      status: "ACTIVE", active: true, studentCount: hasRecords ? 40 : 0, adminCount: 1,
    };
    const footprint = hasRecords
      ? { students: 40, camps: 2, campsRun: 1, findings: 120, referrals: 8, photos: 3, staff: 3, clinical: true }
      : { students: 0, camps: 0, campsRun: 0, findings: 0, referrals: 0, photos: 0, staff: 1, clinical: false };
    const D = {
      "/api/admin/overview": { schools: 1, students: 40, guardians: 40, guardiansActivated: 10,
        campStatus: {}, upcoming: [] },
      "/api/admin/schools": { schools: [school] },
      "/api/admin/schools/sch_1": { school: school },
      "/api/admin/schools/sch_1/roster": { total: 0, academicYear: "2026-27", students: [] },
      "/api/admin/schools/sch_1/archive": {
        school: { id: "sch_1", name: "Silver Oaks", active: true, status: "ACTIVE" },
        footprint: footprint,
        canDelete: !footprint.clinical,
        reason: footprint.clinical
          ? "This school has screening records. Archive it instead — the records stay, and nobody can sign in or schedule a camp."
          : "",
      },
      "/api/admin/schools/sch_1/admins": { admins: [
        { profileId: "ph_a", name: "Asha Rao", phone: "+919800000001", email: "", hasSignedIn: true, addedBy: "" },
      ] },
      "/api/admin/schools/sch_1/staff": { staff: [
        { profileId: "ph_d", name: "Dr Kavita Rao", phone: "+919812345678", role: "PHYSICIAN", hasSignedIn: true },
        { profileId: "ph_s", name: "Nurse Latha", phone: "+919800000000", role: "SCREENER", hasSignedIn: false },
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
          ok: true, removed: "ph_d", name: "Silver Oaks", deleted: "sch_1",
          school: { id: "sch_1", name: "Silver Oaks", active: false, status: "ARCHIVED",
            city: "Hyderabad", district: "", partnerCode: "SO-1", contactName: "", contactPhone: "",
            contactEmail: "", academicYear: "2026-27", campCadence: "ANNUAL",
            checksOffered: ["Vision"], description: "", studentCount: 0, adminCount: 1 },
        }), { headers: { "content-type": "application/json" } }));
      }
      let body = D[path];
      if (body === undefined) body = path.startsWith("/api/") ? {} : null;
      if (body === null) return real(u, o);
      return Promise.resolve(new Response(JSON.stringify(body),
        { headers: { "content-type": "application/json" } }));
    };
  }, screened);

  await p.goto(URL, { waitUntil: "networkidle" });
  await p.waitForTimeout(500);
  await p.locator(".navi", { hasText: /^Schools$/ }).first().click();
  await p.waitForTimeout(350);
  await p.getByText("Silver Oaks").first().click();
  await p.waitForTimeout(700);
  return { p, errs };
}

// ── a school that has screened children ──────────────────────
{
  const { p, errs } = await open(true);
  await p.locator(".navi", { hasText: /^Programme$/ }).first().click();
  await p.waitForTimeout(600);
  const t = await p.$eval("#root", (n) => n.innerText);

  check("the panel appears on the programme tab", /Closing this school down/i.test(t));
  check("it counts what is attached before offering anything",
    /120/.test(t) && /findings recorded/i.test(t));
  check("archiving is offered", (await p.getByRole("button", { name: "Archive school" }).count()) === 1);
  check("deleting a school with records is refused in words",
    /has screening records/i.test(t)
      && (await p.getByRole("button", { name: /Delete this school/ }).count()) === 0);

  await p.getByRole("button", { name: "Archive school" }).first().click();
  await p.waitForTimeout(500);
  const calls = await p.evaluate(() => window.__calls);
  const arch = calls.find((c) => /\/archive$/.test(c.path));
  check("archiving posts to the school, not a delete",
    !!arch && arch.method === "POST" && arch.body.archived === true
      && !calls.some((c) => c.method === "DELETE"));
  check("records school: no page errors", errs.length === 0);
  if (errs.length) console.log(errs.join("\n"));
  await p.close();
}

// ── an empty school, the duplicate row somebody wants gone ───
{
  const { p, errs } = await open(false);
  await p.locator(".navi", { hasText: /^Programme$/ }).first().click();
  await p.waitForTimeout(600);

  check("deleting an empty school is offered",
    (await p.getByRole("button", { name: /Delete this school/ }).count()) === 1);
  // The ids are opaque and the list is by name, so typing the name is the only
  // check that the row about to go is the row that was read.
  check("the delete button is inert until the name is typed",
    await p.getByRole("button", { name: /Delete this school/ }).first().isDisabled());

  await p.locator('input[placeholder^="Type Silver Oaks"]').first().fill("Silver Oakes");
  await p.waitForTimeout(250);
  check("a near miss does not arm it",
    await p.getByRole("button", { name: /Delete this school/ }).first().isDisabled());

  // Typed one key at a time, the way an operator types it. The field used to
  // re-render the whole console on every keystroke, which threw away the
  // element being typed into: the first character landed and the rest went
  // nowhere. fill() sets the value in one shot and never saw it.
  const confirm = p.locator('input[placeholder^="Type Silver Oaks"]').first();
  await confirm.fill("");
  await confirm.click();
  await confirm.pressSequentially("Silver Oaks", { delay: 15 });
  await p.waitForTimeout(250);
  check("the name can be typed a character at a time",
    (await confirm.inputValue()) === "Silver Oaks");
  check("the field still has the caret after typing",
    await confirm.evaluate((n) => n === document.activeElement));

  await p.locator('input[placeholder^="Type Silver Oaks"]').first().fill("Silver Oaks");
  await p.waitForTimeout(250);
  check("the exact name arms it",
    !(await p.getByRole("button", { name: /Delete this school/ }).first().isDisabled()));

  await p.getByRole("button", { name: /Delete this school/ }).first().click();
  await p.waitForTimeout(500);
  const del = (await p.evaluate(() => window.__calls)).find((c) => c.method === "DELETE");
  check("deleting sends the typed name for the server to check too",
    !!del && del.path === "/api/admin/schools/sch_1" && del.body.confirmName === "Silver Oaks");
  check("empty school: no page errors", errs.length === 0);
  if (errs.length) console.log(errs.join("\n"));
  await p.close();
}

// ── clinical staff can be taken off a school ─────────────────
{
  const { p, errs } = await open(true);
  await p.locator(".navi", { hasText: /^Staff$/ }).first().click();
  await p.waitForTimeout(700);
  const t = await p.$eval("#root", (n) => n.innerText);

  check("the physician and screener are listed",
    /Dr Kavita Rao/.test(t) && /Nurse Latha/.test(t));
  // Three people, three Remove buttons: the administrator had one already, the
  // other two are what was missing.
  check("every person can be removed, not only the administrator",
    (await p.getByRole("button", { name: /^Remove$/ }).count()) === 3);

  const rows = p.locator("tbody tr");
  const doctorRow = rows.filter({ hasText: "Dr Kavita Rao" }).first();
  await doctorRow.getByRole("button", { name: /^Remove$/ }).click();
  await p.waitForTimeout(500);
  const call = (await p.evaluate(() => window.__calls)).find((c) => c.method === "DELETE");
  check("removing a physician goes to the staff endpoint, by their profile id",
    !!call && call.path === "/api/admin/schools/sch_1/staff/ph_d");
  // The confirmation banner names them, so check the table, not the page.
  check("they leave the list once removed",
    (await rows.filter({ hasText: "Dr Kavita Rao" }).count()) === 0
      && (await rows.filter({ hasText: "Nurse Latha" }).count()) === 1);
  check("people: no page errors", errs.length === 0);
  if (errs.length) console.log(errs.join("\n"));
  await p.close();
}

await b.close();
process.exit(failures ? 1 : 0);
