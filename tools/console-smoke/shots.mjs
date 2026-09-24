const { chromium } = (await import((process.env.PW_DIR || "playwright") + "/index.js")).default;
import { go } from "./nav.mjs";

// Screenshots of the console's main screens, driven the same way the smoke
// tests drive them. Run through tools/console-shots.sh, which serves the page
// and passes PORTAL_URL and OUT.

const URL = process.env.PORTAL_URL || "http://127.0.0.1:8098/admin";
const OUT = process.env.OUT || ".";

const ANALYTICS = {
  scope: "ALL",
  funnel: [
    { key: "rostered", label: "On the camp roster", stage: "B7", count: 400, pct: 100 },
    { key: "consented", label: "Consent given", stage: "B3", count: 320, pct: 80 },
    { key: "present", label: "Present on the day", stage: "C3", count: 300, pct: 75 },
    { key: "screened", label: "Screened", stage: "C8", count: 290, pct: 73 },
    { key: "reviewed", label: "Clinically reviewed", stage: "D5", count: 250, pct: 63 },
    { key: "released", label: "Released to guardians", stage: "D6", count: 240, pct: 60 },
  ],
  attendance: { absent: 20, declined: 12 },
  referrals: { total: 48, open: 9, booked: 5, attended: 4, closed: 26, declined: 4,
    expired: 0, urgentOpen: 2, overdue: 3, closureRate: 59, avgDaysToClose: 21.4 },
  prevalence: [
    { checkType: "Vision", total: 290, good: 210, watch: 44, alert: 6, notMeasured: 30 },
    { checkType: "Dental", total: 290, good: 240, watch: 30, alert: 4, notMeasured: 16 },
    { checkType: "Height & weight", total: 290, good: 250, watch: 28, alert: 2, notMeasured: 10 },
  ],
  trend: Array.from({ length: 12 }, (_, i) => ({
    month: "2026-" + String(i + 1).padStart(2, "0"),
    screened: i === 8 ? 290 : 0, referralsRaised: i === 8 ? 48 : 0, referralsClosed: i === 9 ? 26 : 0,
  })),
  bySchool: [
    { id: "sch_1", name: "Silver Oaks", city: "Hyderabad", district: "Gachibowli",
      students: 400, rostered: 400, screened: 290, released: 240, referrals: 48,
      referralsClosed: 26, closureRate: 54, coverage: 73, lastCamp: "2026-09-18" },
    { id: "sch_2", name: "Bright Beginnings", city: "Warangal", district: "Hanamkonda",
      students: 120, rostered: 0, screened: 0, released: 0, referrals: 0,
      referralsClosed: 0, closureRate: null, coverage: 0, lastCamp: "" },
  ],
  byDistrict: [
    { district: "Gachibowli", schools: 1, screened: 290, flagged: 54, flaggedPct: 19 },
    { district: "Hanamkonda", schools: 1, screened: 0, flagged: 0, flaggedPct: 0 },
  ],
};

const kid = (i) => ({
  id: "kid_" + i, name: ["Aarav Sharma", "Diya Reddy", "Vivaan Kumar", "Ananya Iyer",
    "Kabir Menon", "Ishita Rao", "Arjun Nair", "Meera Gupta"][i % 8],
  grade: String(1 + (i % 8)), section: "ABC"[i % 3],
  rollNo: String(100 + i), dob: "2016-0" + (1 + (i % 9)) + "-12", gender: i % 2 ? "F" : "M",
  guardianName: "Parent " + i, guardianPhone: "+9197000000" + String(10 + i),
  consent: i % 3 === 0 ? "GRANTED" : i % 3 === 1 ? "PENDING" : "DECLINED",
  usingApp: i % 2 === 0,
});
const roster = Array.from({ length: 12 }, (_, i) => kid(i));

await (async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2 });
  const errs = [];
  p.on("pageerror", (e) => errs.push("pageerror: " + e.message));

  await p.addInitScript(([A, R]) => {
    localStorage.setItem("vh_console", JSON.stringify({
      mode: "key", key: "k", name: "VitaHero Admin", role: "SUPERADMIN", profileId: "ph_1", schoolId: null,
    }));
    const D = {
      "/api/admin/overview": { schools: 2, students: 520, guardians: 500, guardiansActivated: 210,
        campStatus: { SCHEDULED: 1, RELEASED: 1 }, upcoming: [
          { id: "camp_1", schoolName: "Silver Oaks", startsOn: "2027-10-02", status: "SCHEDULED" }] },
      "/api/admin/analytics": A,
      "/api/admin/schools": { schools: [
        { id: "sch_1", name: "Silver Oaks", city: "Hyderabad", district: "Gachibowli",
          partnerCode: "SO-1", academicYear: "2027-28", students: 400, camps: 3,
          contactName: "Latha Rao", contactPhone: "+919700000100", contactEmail: "office@silveroaks.in" },
        { id: "sch_2", name: "Bright Beginnings", city: "Warangal", district: "Hanamkonda",
          partnerCode: "BB-2", academicYear: "2027-28", students: 120, camps: 0,
          contactName: "Suresh K", contactPhone: "+919700000200", contactEmail: "" }] },
      "/api/admin/schools/sch_1": { school: { id: "sch_1", name: "Silver Oaks", city: "Hyderabad",
        district: "Gachibowli", contactName: "Latha Rao", contactPhone: "+919700000100",
        contactEmail: "office@silveroaks.in", academicYear: "2027-28", campCadence: "ANNUAL",
        checksOffered: ["Height & weight", "Vision", "Dental", "Haemoglobin"],
        description: "K-10 day school, two sections a grade.", partnerCode: "SO-1" } },
      "/api/admin/schools/sch_1/roster": { rows: R, total: R.length, students: R, roster: R },
      "/api/admin/questions": { enabled: true, responseWindowDays: 3,
        counts: { waiting_on_us: 2, overdue: 1, closed: 4 },
        threads: [
          { id: "qt_1", guardianName: "Parent 1", guardianPhone: "+919700000001", kidName: "Aarav Sharma",
            subject: "Vision", status: "OPEN", awaiting: "SCHOOL", waitingDays: 5,
            lastMessage: "The report says WATCH for vision.", lastAt: "2027-09-12T04:00:00Z" },
          { id: "qt_2", guardianName: "Parent 2", guardianPhone: "+919700000002", kidName: "Diya Reddy",
            subject: "Dental", status: "ANSWERED", awaiting: "GUARDIAN", waitingDays: 0,
            lastMessage: "Thank you.", lastAt: "2027-09-13T04:00:00Z" }] },
      "/api/admin/billing/contract?school_id=sch_1": { contract: { id: "con_1",
        shape: "PER_STUDENT_YEAR", ratePaise: 15000, rateRupees: 150, currency: "INR",
        academicYear: "2027-28", startsOn: "2027-04-01", endsOn: "2028-03-31", notes: "" } },
      "/api/admin/billing/invoices?school_id=sch_1": { invoices: [
        { id: "inv_1", number: "VH-2027-0001", academicYear: "2027-28", status: "DRAFT",
          amountRupees: 60000, issuedAt: "", paidAt: "" },
        { id: "inv_2", number: "VH-2026-0004", academicYear: "2026-27", status: "PAID",
          amountRupees: 58000, issuedAt: "2026-05-02", paidAt: "2026-05-20" }] },
      "/api/admin/hospitals": { canEdit: true, hospitals: [
        { id: "hos_1", name: "Rainbow Children's Hospital", city: "Hyderabad", district: "Banjara Hills",
          address: "Road No 2", phone: "+914023456789", lat: 17.41, lng: 78.44, rating: 4.9,
          isCampPartner: true, active: true, doctorCount: 3 },
        { id: "hos_2", name: "LV Prasad Eye Institute", city: "Hyderabad", district: "Banjara Hills",
          address: "Road No 2", phone: "+914030612345", lat: 17.42, lng: 78.45, rating: 4.8,
          isCampPartner: false, active: true, doctorCount: 1 }] },
      "/api/admin/doctors": { canEdit: true, doctors: [
        { id: "doc_1", name: "Dr Ananya Rao", specialty: "Paediatrics", hospitalId: "hos_1",
          hospitalName: "Rainbow Children's Hospital", city: "Hyderabad", rating: 4.9, active: true,
          phone: "+919700000401", canSignIn: true, hasMobile: true, campCount: 3 },
        { id: "doc_2", name: "Dr Nandini Sharma", specialty: "Dentistry", hospitalId: "hos_1",
          hospitalName: "Rainbow Children's Hospital", city: "Hyderabad", rating: 4.7, active: true,
          phone: "+919700000402", canSignIn: true, hasMobile: true, campCount: 1 },
        { id: "doc_3", name: "Dr Ravi Teja", specialty: "Ophthalmology", hospitalId: "hos_2",
          hospitalName: "LV Prasad Eye Institute", city: "Hyderabad", rating: 4.8, active: true,
          phone: "", canSignIn: false, hasMobile: false, campCount: 0 }] },
      "/api/admin/invites": { total: 400, joined: 210, notJoined: 190, neverInvited: 40, guardians: [
        { profileId: "ph_1", name: "Parent 1", phone: "+919700000001", children: 1, usingApp: true,
          invitedAt: "2027-09-01T00:00:00Z" },
        { profileId: "ph_2", name: "Parent 2", phone: "+919700000002", children: 2, usingApp: false,
          invitedAt: "" }] },
      "/api/admin/library": { checkTypes: ["Vision", "Dental", "Skin"], locales: ["en", "hi", "te"],
        articles: [{ slug: "vision-at-school", locale: "en",
          title: "When your child squints at the board", summary: "What a vision WATCH means.",
          body: "Long body text.", checkTypes: ["Vision"], flags: ["WATCH", "ALERT"],
          minAge: 4, maxAge: 14, published: true }] },
    };
    const real = window.fetch;
    window.fetch = (u, o) => {
      const s = String(u).replace(/^https?:\/\/[^/]+/, "");
      const path = s.split("?")[0];
      if (!path.startsWith("/api/")) return real(u, o);
      const body = D[s] !== undefined ? D[s] : D[path] !== undefined ? D[path] : {};
      return Promise.resolve(new Response(JSON.stringify(body),
        { headers: { "content-type": "application/json" } }));
    };
  }, [ANALYTICS, roster]);

  await p.goto(URL, { waitUntil: "networkidle" });
  await p.waitForTimeout(800);

  const shot = async (name) => {
    await p.waitForTimeout(250);
    await p.screenshot({ path: OUT + "/" + name + ".png" });
    console.log("shot  " + name);
  };
  const tryGo = async (label, wait) => {
    try { await go(p, label, { wait: wait || 400 }); return true; }
    catch (e) { console.log("skip  " + label + " — " + e.message.slice(0, 80)); return false; }
  };

  await shot("01-dashboard");
  if (await tryGo("Schools")) await shot("02-schools");
  try {
    await p.getByText("Silver Oaks").first().click();
    await p.waitForTimeout(600);
    await shot("03-school-roster");
  } catch (e) { console.log("skip  school detail"); }
  if (await tryGo("Camps")) await shot("04-camps");
  if (await tryGo("Questions")) await shot("05-questions");
  if (await tryGo("Billing")) await shot("06-billing");
  if (await tryGo("Hospitals")) await shot("07-hospitals");
  if (await tryGo("Doctors")) await shot("08-doctors");
  if (await tryGo("Library")) await shot("09-library");

  // The signed-out screen, which needs a page with no stored session.
  const p2 = await b.newPage({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 2 });
  p2.on("pageerror", (e) => errs.push("pageerror(signin): " + e.message));
  await p2.addInitScript(() => {
    localStorage.removeItem("vh_console");
    const real = window.fetch;
    window.fetch = (u, o) => String(u).startsWith("/api/") || /\/api\//.test(String(u))
      ? Promise.resolve(new Response("{}", { headers: { "content-type": "application/json" } }))
      : real(u, o);
  });
  await p2.goto(URL, { waitUntil: "networkidle" });
  await p2.waitForTimeout(700);
  await p2.screenshot({ path: OUT + "/00-sign-in.png" });
  console.log("shot  00-sign-in");
  // And the second slide, to prove the arrows move it.
  await p2.evaluate(() => [...document.querySelectorAll(".slide .arrow")].pop().click());
  await p2.waitForTimeout(350);
  await p2.screenshot({ path: OUT + "/00-sign-in-2.png" });
  console.log("shot  00-sign-in-2");
  // And the other door.
  await p2.evaluate(() => [...document.querySelectorAll(".modes button")]
    .find((n) => n.textContent.trim() === "Admin").click());
  await p2.waitForTimeout(300);
  await p2.screenshot({ path: OUT + "/00-sign-in-admin.png" });
  console.log("shot  00-sign-in-admin");

  if (errs.length) console.log(errs.join("\n"));
  await b.close();
})();
