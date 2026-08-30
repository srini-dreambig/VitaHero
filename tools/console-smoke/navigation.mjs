const { chromium } = (await import((process.env.PW_DIR || "playwright") + "/index.js")).default;

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

  // Nothing about a school before one is open.
  check(`${role}: no school section before a school is open`, !(await has("Roster")));

  await p.locator(".navi", { hasText: /^(Schools|My school)$/ }).first().click();
  await p.waitForTimeout(400);
  if (role !== "SCHOOL_ADMIN") {
    await p.getByText("Silver Oaks").first().click();
    await p.waitForTimeout(600);
  }

  check(`${role}: the open school's sections appear`,
    (await has("Roster")) && (await has("Classes")) && (await has("All camps")));
  check(`${role}: the nav is grouped, not one flat list`,
    (await p.$$eval(".navsec h4", (ns) => ns.map((n) => n.textContent))).length >= 4);
  check(`${role}: billing is ${expect.billing ? "shown" : "hidden"}`,
    (await has("Billing")) === expect.billing);
  // Still nothing about a camp.
  check(`${role}: no camp stages before a camp is open`, !(await has("Camp day")));

  await p.locator(".navi", { hasText: /^All camps$/ }).first().click();
  await p.waitForTimeout(450);
  await p.getByText("Annual Camp").first().click();
  await p.waitForTimeout(700);

  const camp = await nav();
  const stages = ["Setup", "Parents & children", "Consent", "Camp day", "Review"];
  check(`${role}: the camp's stages are all present`,
    stages.every((s) => camp.some((x) => x.replace(/\d+$/, "") === s)));
  // In the order the day actually runs, which is the point of listing them.
  const idx = stages.map((s) => camp.findIndex((x) => x.replace(/\d+$/, "") === s));
  check(`${role}: the stages are in the order the day runs`,
    idx.every((v, i) => i === 0 || v > idx[i - 1]));
  check(`${role}: there is a way back out of the camp`,
    camp.some((x) => /^Back to /.test(x)));
  check(`${role}: the school's own sections give way to the camp's`, !(await has("Roster")));
  check(`${role}: no page errors`, errs.length === 0);
  if (errs.length) console.log(errs.join("\n"));
  await b.close();
}

await run("SUPERADMIN", { billing: true });
// A school office has no business seeing what its own contract is worth.
await run("SCHOOL_ADMIN", { billing: false });

process.exit(failures ? 1 : 0);
