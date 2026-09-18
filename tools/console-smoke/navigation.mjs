const { chromium } = (await import((process.env.PW_DIR || "playwright") + "/index.js")).default;
import { go } from "./nav.mjs";

// The left navigation.
//
// A school had twelve tabs across the top and a camp had five, which asked
// somebody who runs a school office to read a strip of words to find out where
// they were. The nav is contextual instead: nothing about a camp exists until
// a camp is open, and the camp's stages are listed in the order the day runs.
// What is checked here is that the context appears and disappears with it —
// a stale section is worse than a tab strip.

const URL = process.env.PORTAL_URL || "http://127.0.0.1:8099/portal.html";
let failures = 0;
const check = (l, c) => { console.log((c ? "PASS  " : "FAIL  ") + l); if (!c) failures++; };

async function run(role, expect) {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push("pageerror: " + e.message));

  await p.addInitScript((r) => {
    localStorage.setItem("vh_console", JSON.stringify({
      mode: r === "SCHOOL_ADMIN" ? "session" : "key", key: "k", token: "t",
      name: "Tester", role: r, profileId: "ph_1",
      schoolId: r === "SCHOOL_ADMIN" ? "sch_1" : null,
    }));
    const school = { id: "sch_1", name: "Silver Oaks", city: "Hyderabad", district: "",
      contactName: "", contactPhone: "", contactEmail: "", academicYear: "2026-27",
      campCadence: "ANNUAL", checksOffered: ["Vision"], description: "", partnerCode: "SO-1" };
    const D = {
      "/api/admin/overview": { schools: 1, students: 4, guardians: 4, guardiansActivated: 1,
        campStatus: {}, upcoming: [] },
      "/api/admin/schools": { schools: [{ ...school, students: 4, camps: 1 }] },
      "/api/admin/schools/sch_1": { school },
      "/api/admin/schools/sch_1/roster": { total: 0, academicYear: "2026-27", students: [] },
      "/api/admin/schools/sch_1/camps": { camps: [{ id: "cmp_1", title: "Annual Camp",
        date: "2026-09-18", status: "SCHEDULED", participants: 4, consented: 2, screened: 0,
        released: 0, schoolName: "Silver Oaks" }] },
      "/api/admin/camps/cmp_1": {
        camp: { id: "cmp_1", schoolId: "sch_1", schoolName: "Silver Oaks", title: "Annual Camp",
          date: "2026-09-18", status: "SCHEDULED", checks: ["Vision"], grades: ["Class 4"],
          participants: 4, consented: 2, declined: 0, pendingConsent: 2, present: 0, absent: 0,
          screened: 0, awaitingReview: 0, approved: 0, released: 0, urgent: 0,
          photosEnabled: false, academicYear: "2026-27", sections: [], capacity: 200,
          consentDeadline: "", venue: "", time: "", description: "", releasedAt: "",
          resultSummary: "" },
        staff: [], can: { schedule: true, screen: true, review: true },
      },
    };
    const real = window.fetch;
    window.fetch = (u, o) => {
      const path = new URL(u, location.origin).pathname;
      let body = D[path];
      if (body === undefined) body = path.startsWith("/api/") ? {} : null;
      if (body === null) return real(u, o);
      return Promise.resolve(new Response(JSON.stringify(body),
        { headers: { "content-type": "application/json" } }));
    };
  }, role);

  await p.goto(URL, { waitUntil: "networkidle" });
  await p.waitForTimeout(600);
  const nav = () => p.$$eval(".navi", (ns) => ns.map((n) => n.textContent.trim()));
  const has = async (label) => (await nav()).some((x) => x.replace(/\d+$/, "") === label);
  const tabs = () => p.$$eval(".tabs .tab", (ns) => ns.map((n) => n.textContent.replace(/\d+$/, "").trim()));
  const segs = () => p.$$eval(".seg button", (ns) => ns.map((n) => n.textContent.replace(/\d+$/, "").trim()));
  const clickTab = async (label) => p.evaluate((l) => {
    const b = [...document.querySelectorAll(".tabs .tab")]
      .find((n) => n.textContent.replace(/\d+$/, "").trim() === l);
    if (b) b.click();
    return !!b;
  }, label);

  // The left navigation lists destinations and nothing else. What lives inside
  // one of them belongs to that thing, not to the shell around it — so the
  // sidebar is the same six lines wherever you are, and does not grow to
  // twenty-eight as you open things.
  const menu = await nav();
  check(`${role}: the sidebar is destinations only`, menu.length <= 7);
  check(`${role}: and none of a school's screens are in it`,
    !(await has("Roster")) && !(await has("Camp day")) && !(await has("Billing")));

  await p.locator(".navi", { hasText: /^(Schools|My school)$/ }).first().click();
  await p.waitForTimeout(400);
  if (role !== "SCHOOL_ADMIN") {
    await p.getByText("Silver Oaks").first().click();
    await p.waitForTimeout(600);
  }

  // Five groups of at most four, rather than twelve tabs in a strip or
  // twenty-eight lines in a sidebar.
  const schoolTabs = await tabs();
  check(`${role}: a school is grouped into a handful of tabs`,
    schoolTabs.length >= 4 && schoolTabs.length <= 6);
  check(`${role}: the groups are the jobs, not the screens`,
    ["Students", "Camps", "Follow-up", "Settings"].every((t) => schoolTabs.includes(t)));

  // The screens inside the group you are in, as a second control — and only
  // when the group holds more than one.
  check(`${role}: the group you are in shows its own screens`,
    (await segs()).includes("Roster") && (await segs()).includes("Import history"));

  await clickTab("Reports");
  await p.waitForTimeout(350);
  check(`${role}: a group holding one screen shows no second row`,
    (await segs()).length === 0);

  await clickTab("Settings");
  await p.waitForTimeout(350);
  const settings = await segs();
  check(`${role}: billing is ${expect.billing ? "shown" : "hidden"}`,
    settings.includes("Billing") === expect.billing);
  check(`${role}: settings holds the school's own affairs`,
    settings.includes("Staff") && settings.includes("Programme"));

  await clickTab("Camps");
  await p.waitForTimeout(400);
  await p.getByText("Annual Camp").first().click();
  await p.waitForTimeout(700);

  // A camp is a sequence, so its stages stay one row in the order the day
  // runs. Grouping a workflow would hide the only useful thing about it.
  const stages = ["Setup", "Parents & children", "Consent", "Camp day", "Review"];
  const campTabs = await tabs();
  check(`${role}: the camp's stages are all present`,
    stages.every((s) => campTabs.includes(s)));
  const idx = stages.map((s) => campTabs.indexOf(s));
  check(`${role}: the stages are in the order the day runs`,
    idx.every((v, i) => i === 0 || v > idx[i - 1]));
  check(`${role}: a camp shows no second row either`, (await segs()).length === 0);
  check(`${role}: and the sidebar has not changed`, (await nav()).length === menu.length);

  check(`${role}: no page errors`, errs.length === 0);
  if (errs.length) console.log(errs.join("\n"));
  await b.close();
}

await run("SUPERADMIN", { billing: true });
// A school office has no business seeing what its own contract is worth.
await run("SCHOOL_ADMIN", { billing: false });

// ── a screen that cannot be drawn does not take the tabs with it ──
//
// The tabs live inside the workspace now that they are out of the sidebar, and
// render() catches a throwing screen by replacing the whole workspace. That
// left no way to reach a screen that works — you were stuck on the broken one
// until you reloaded. Only the content sits inside that catch now.
//
// Broken with data rather than by patching the page: tabRoster() filters
// r.students, so a roster that answers with a string for students is a real
// response of the wrong shape, which is the case this is actually for.
{
  const b2 = await chromium.launch();
  const p2 = await b2.newPage({ viewport: { width: 1280, height: 900 } });
  await p2.addInitScript(() => {
    localStorage.setItem("vh_console", JSON.stringify({
      mode: "key", key: "k", name: "Ops", role: "SUPERADMIN", profileId: "ph_1", schoolId: null,
    }));
    const D = {
      "/api/admin/overview": { schools: 1, students: 1, guardians: 1, guardiansActivated: 0,
        campStatus: {}, upcoming: [] },
      "/api/admin/schools": { schools: [{ id: "sch_1", name: "Silver Oaks", city: "Hyderabad",
        district: "", partnerCode: "SO-1", academicYear: "2026-27", studentCount: 1, adminCount: 1,
        active: true, status: "ACTIVE", checksOffered: [], campCadence: "ANNUAL" }] },
      "/api/admin/schools/sch_1": { school: { id: "sch_1", name: "Silver Oaks", city: "Hyderabad",
        district: "", contactName: "", contactPhone: "", contactEmail: "", academicYear: "2026-27",
        campCadence: "ANNUAL", checksOffered: [], description: "", partnerCode: "SO-1" } },
      // The wrong shape, on purpose.
      "/api/admin/schools/sch_1/roster": { total: 1, students: "not an array" },
    };
    window.fetch = async (u) => {
      const path = new URL(u, location.origin).pathname;
      const keys = Object.keys(D).sort((a, x) => x.length - a.length);
      const k = keys.find((x) => path === x) || keys.find((x) => path.startsWith(x));
      return new Response(JSON.stringify(k ? D[k] : {}),
        { headers: { "content-type": "application/json" } });
    };
  });
  await p2.goto(URL, { waitUntil: "networkidle" });
  await p2.waitForTimeout(500);
  await go(p2, "Schools");
  await p2.getByText("Silver Oaks").first().click();
  await p2.waitForTimeout(700);

  const state = await p2.evaluate(() => ({
    broke: /could not be drawn/.test(document.querySelector(".content").textContent),
    tabs: document.querySelectorAll(".tabs .tab").length,
    sidebar: document.querySelectorAll(".navi").length,
  }));
  check("a screen that cannot be drawn says so", state.broke === true);
  check("and the tabs survive it", state.tabs >= 4);
  check("and the sidebar survives it", state.sidebar > 0);

  // And you can actually leave: the whole point of keeping the tabs.
  await go(p2, "Settings");
  const left = await p2.evaluate(() =>
    !/could not be drawn/.test(document.querySelector(".content").textContent));
  check("and you can move to a screen that works", left === true);
  await b2.close();
}

// ── the address bar ──
//
// Four things that were all missing together, because which screen you were on
// lived in memory and nowhere else: you could not send anybody a link, the back
// button did nothing, a refresh dropped you at the overview, and a bookmark was
// useless.
{
  const b3 = await chromium.launch();
  const p3 = await b3.newPage({ viewport: { width: 1280, height: 900 } });
  const err3 = [];
  p3.on("pageerror", (e) => err3.push(e.message));
  await p3.addInitScript(() => {
    localStorage.setItem("vh_console", JSON.stringify({
      mode: "key", key: "k", name: "Ops", role: "SUPERADMIN", profileId: "ph_1", schoolId: null,
    }));
    const school = { id: "sch_1", name: "Silver Oaks", city: "Hyderabad", district: "",
      partnerCode: "SO-1", academicYear: "2026-27", contactName: "", contactPhone: "",
      contactEmail: "", campCadence: "ANNUAL", checksOffered: [], description: "",
      studentCount: 1, adminCount: 1, active: true, status: "ACTIVE" };
    const D = {
      "/api/admin/overview": { schools: 1, students: 1, guardians: 1, guardiansActivated: 0,
        campStatus: {}, upcoming: [] },
      "/api/admin/schools": { schools: [school] },
      "/api/admin/schools/sch_1": { school },
      "/api/admin/schools/sch_1/roster": { total: 0, academicYear: "2026-27", students: [] },
      "/api/admin/schools/sch_1/classes": { classes: [] },
      "/api/admin/hospitals": { canEdit: true, hospitals: [] },
      "/api/admin/doctors": { canEdit: true, doctors: [] },
    };
    window.fetch = async (u) => {
      const path = new URL(u, location.origin).pathname;
      const keys = Object.keys(D).sort((a, x) => x.length - a.length);
      const k = keys.find((x) => path === x) || keys.find((x) => path.startsWith(x));
      return new Response(JSON.stringify(k ? D[k] : {}),
        { headers: { "content-type": "application/json" } });
    };
  });

  await p3.goto(URL, { waitUntil: "networkidle" });
  await p3.waitForTimeout(500);
  const hash = () => p3.evaluate(() => location.hash);

  check("the address says where you are", /#\/overview$/.test(await hash()));

  await go(p3, "Hospitals");
  check("and it changes when you go somewhere else", /#\/hospitals$/.test(await hash()));

  await go(p3, "Schools");
  await p3.getByText("Silver Oaks").first().click();
  await p3.waitForTimeout(600);
  check("a school has its own address, down to the screen",
    /#\/schools\/sch_1\/roster$/.test(await hash()));

  await go(p3, "Classes");
  check("and so does each screen inside it",
    /#\/schools\/sch_1\/classes$/.test(await hash()));

  // Back through: classes -> roster -> schools -> hospitals.
  await p3.goBack(); await p3.waitForTimeout(500);
  check("the back button goes back a screen, not out of the console",
    /#\/schools\/sch_1\/roster$/.test(await hash()));
  await p3.goBack(); await p3.waitForTimeout(500);
  await p3.goBack(); await p3.waitForTimeout(500);
  check("and keeps going back", /#\/hospitals$/.test(await hash()));
  const onScreen = await p3.locator(".content").innerText();
  check("and the screen follows the address, not just the address bar",
    /hospital/i.test(onScreen));

  await p3.goForward(); await p3.waitForTimeout(500);
  check("forward works too", /#\/schools$/.test(await hash()));

  // The whole point: a link somebody sends you.
  await p3.goto(URL + "#/schools/sch_1/classes", { waitUntil: "networkidle" });
  await p3.waitForTimeout(700);
  const deep = await p3.evaluate(() => ({
    hash: location.hash,
    crumb: document.querySelector(".bar").textContent,
    seg: [...document.querySelectorAll(".seg button.on")].map((n) => n.textContent.trim()),
  }));
  check("a link opens the screen it names, not the overview",
    /#\/schools\/sch_1\/classes$/.test(deep.hash)
    && /Silver Oaks/.test(deep.crumb) && deep.seg.includes("Classes"));

  // A nonsense address should land somewhere usable rather than blank.
  await p3.goto(URL + "#/schools/sch_nope/roster", { waitUntil: "networkidle" });
  await p3.waitForTimeout(700);
  const rubbish = await p3.evaluate(() => document.querySelector(".content").textContent);
  check("an address that names nothing still lands somewhere usable",
    rubbish.trim().length > 0);

  check("address bar: no page errors", err3.length === 0);
  if (err3.length) console.log(err3.join("\n"));
  await b3.close();
}

process.exit(failures ? 1 : 0);

