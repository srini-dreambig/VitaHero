const { chromium } = (await import((process.env.PW_DIR || "playwright") + "/index.js")).default;

// E1/E3 — the consent tab as a loop rather than a table.
//
// Three states a family can be in, in the order the work happens: no app, app
// but no answer, answered. Each one has exactly one button, and the two are
// not the same button — texting a reminder about a request to somebody who
// never installed the app is a wasted text, and that was the only bulk action
// the screen had.
//
// Plus the paper round: a printable slip per child, fetched with the console's
// own token rather than opened as a link, because it is a roster of children
// and their guardians' numbers.

async function session() {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  await p.addInitScript(() => {
    localStorage.setItem("vh_console", JSON.stringify({
      mode: "key", key: "k", name: "VitaHero Admin", role: "SUPERADMIN", schoolId: null }));
    const CAMP = {
      id: "cmp_1", schoolId: "sch_1", schoolName: "Silver Oaks", title: "Annual check-up",
      date: "2027-09-10", time: "09:00", venue: "Hall", status: "SCHEDULED",
      checks: ["Vision", "Dental"], grades: ["Class 5"], sections: ["A"], academicYear: "2027-28",
      capacity: 200, consentDeadline: "2027-09-01", photosEnabled: false, releasedAt: "",
      resultSummary: "", participants: 4, consented: 1, declined: 0, pendingConsent: 3,
      present: 0, absent: 0, screened: 0, awaitingReview: 0, approved: 0, released: 0, urgent: 0,
    };
    // Two without the app, one with it and no answer, one already answered.
    const kid = (n, app, consent) => ({
      kidId: "k" + n, name: "Pupil " + n, grade: "Class 5", section: "A", gender: "F", age: 10,
      studentRef: "sid_" + n, guardianName: "Parent " + n, guardianPhone: "+91970000000" + n,
      guardianProfileId: "ph_" + n, guardianUsingApp: app, consentStatus: consent,
      consentPhotos: false, attendance: "UNKNOWN", status: "NOT_SCREENED", urgency: "NONE",
      recommendation: "", findingsCount: 0 });
    const PARTS = [kid(1, false, "PENDING"), kid(2, false, "PENDING"),
                   kid(3, true, "PENDING"), kid(4, true, "GRANTED")];
    const D = {
      "/api/admin/overview": { schools: 1, students: 4, guardians: 4, guardiansActivated: 2,
        campStatus: { SCHEDULED: 1 },
        upcoming: [{ id: "cmp_1", title: "Annual check-up", schoolName: "Silver Oaks",
          date: "2027-09-10", participants: 4, consented: 1, status: "SCHEDULED" }] },
      "/api/admin/schools": { schools: [] },
      "/api/admin/camps/cmp_1/participants": {
        can: { schedule: true, screen: false, review: false, viewClinical: true },
        photosEnabled: false, participants: PARTS },
      "/api/admin/camps/cmp_1": { camp: CAMP, staff: [],
        can: { schedule: true, screen: false, review: false, viewClinical: true } },
      "/api/admin/schools/sch_1/staff": { staff: [] },
    };
    // What the page asked for, so the test can assert who was texted.
    window.__posts = [];
    window.__opened = [];
    const realFetch = window.fetch;
    window.fetch = async (url, opts) => {
      const u = String(url).replace(/^https?:\/\/[^/]+/, "");
      if (opts && opts.method === "POST") {
        window.__posts.push({ path: u, body: JSON.parse(opts.body || "{}") });
        return new Response(JSON.stringify({ sent: 2 }), { status: 200,
          headers: { "Content-Type": "application/json" } });
      }
      if (u.indexOf("/consent/form") >= 0) {
        window.__opened.push(u);
        return new Response("<html><body>slip</body></html>", { status: 200,
          headers: { "Content-Type": "text/html" } });
      }
      const keys = Object.keys(D).sort((a, b) => b.length - a.length);
      const k = keys.find((x) => u === x) || keys.find((x) => u.startsWith(x));
      if (k) {
        return new Response(JSON.stringify(D[k]), { status: 200,
          headers: { "Content-Type": "application/json" } });
      }
      return realFetch(url, opts);
    };
    window.confirm = () => true;
    // A print window would block the run. Swallow it, keep the document.
    window.open = () => ({
      document: { write() {}, open() {}, close() {} },
      focus() {}, print() {}, close() {}, setTimeout() {},
    });
  });
  await p.goto(process.env.PORTAL_URL || "http://127.0.0.1:8099/admin");
  await p.waitForTimeout(500);
  await p.getByText("Annual check-up").first().click();
  await p.waitForTimeout(400);
  await p.getByRole("button", { name: "Consent", exact: false }).first().click();
  await p.waitForTimeout(400);
  return { b, p, errs };
}

const text = async (p) => (await p.locator(".content").innerText()).replace(/\n+/g, " | ");

function check(label, cond) {
  console.log((cond ? "PASS  " : "FAIL  ") + label);
  if (!cond) process.exitCode = 1;
}

{
  const { b, p, errs } = await session();
  const t = await text(p);

  check("the loop counts the families without the app", /2[\s|]+without the app/i.test(t));
  check("the loop counts the ones asked but not answered", /1[\s|]+asked, not answered/i.test(t));
  check("the loop counts the ones who answered", /1[\s|]+answered/i.test(t));
  check("inviting and reminding are two different buttons",
    /Invite all 2/.test(t) && /Remind all 1/.test(t));

  // Invite exactly the two with no app — not everyone still pending.
  await p.getByRole("button", { name: "Invite all 2", exact: false }).first().click();
  await p.waitForTimeout(300);
  const invite = await p.evaluate(() => window.__posts[window.__posts.length - 1]);
  check("invite goes to the invitation route", /\/api\/admin\/invites\/send$/.test(invite.path));
  check("invite names only the guardians without the app",
    JSON.stringify(invite.body.profileIds) === JSON.stringify(["ph_1", "ph_2"]));

  await p.getByRole("button", { name: "Remind all 1", exact: false }).first().click();
  await p.waitForTimeout(300);
  const remind = await p.evaluate(() => window.__posts[window.__posts.length - 1]);
  check("remind goes to the consent request route", /\/consent\/request$/.test(remind.path));
  check("remind names only the guardian who has the app",
    JSON.stringify(remind.body.profileIds) === JSON.stringify(["ph_3"]));

  // The paper round.
  check("the slips are offered for the three still waiting", /Print the 3 still waiting/.test(t));
  await p.getByRole("button", { name: "Print the 3 still waiting", exact: false }).first().click();
  await p.waitForTimeout(400);
  let opened = await p.evaluate(() => window.__opened);
  check("printing asks the server for the pending slips",
    opened.length === 1 && /\/consent\/form\?only=pending&lang=en$/.test(opened[0]));

  await p.selectOption("select", "hi");
  await p.waitForTimeout(150);
  await p.getByRole("button", { name: "Print the whole roster", exact: false }).first().click();
  await p.waitForTimeout(400);
  opened = await p.evaluate(() => window.__opened);
  check("the language and the scope both reach the server",
    opened.length === 2 && /\/consent\/form\?only=all&lang=hi$/.test(opened[1]));

  check("no page errors", errs.length === 0);
  if (errs.length) console.log(errs.join("\n"));
  await b.close();
}
