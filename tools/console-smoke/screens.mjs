const { chromium } = (await import((process.env.PW_DIR || "playwright") + "/index.js")).default;

// Every console screen added late — the question queue, a question thread,
// contracts and invoices, the reading library — rendered in a real browser
// against a stubbed API. A screen that throws on render fails here.

const URL = process.env.PORTAL_URL || "http://127.0.0.1:8099/portal.html";

let failures = 0;
function check(label, cond) {
  console.log((cond ? "PASS  " : "FAIL  ") + label);
  if (!cond) failures++;
}

const b = await chromium.launch();
const p = await b.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("pageerror: " + e.message));

await p.addInitScript(() => {
  localStorage.setItem("vh_console", JSON.stringify({
    mode: "key", key: "k", name: "Ops", role: "SUPERADMIN", profileId: "ph_1", schoolId: null,
  }));
  const D = {
    "/api/admin/overview": { schools: 1, students: 6, guardians: 6, guardiansActivated: 3,
      campStatus: { SCHEDULED: 1 }, upcoming: [] },
    "/api/admin/schools": { schools: [{ id: "sch_1", name: "Silver Oaks", city: "Hyderabad",
      partnerCode: "SO-1", academicYear: "2027-28", students: 6, camps: 1 }] },
    "/api/admin/schools/sch_1": { school: { id: "sch_1", name: "Silver Oaks", city: "Hyderabad",
      district: "", contactName: "", contactPhone: "", contactEmail: "", academicYear: "2027-28",
      campCadence: "ANNUAL", checksOffered: ["Vision", "Skin"], description: "", partnerCode: "SO-1" } },
    "/api/admin/schools/sch_1/roster": { rows: [], total: 0, students: [], roster: [] },
    "/api/admin/questions": { enabled: true, responseWindowDays: 3,
      counts: { waiting_on_us: 2, overdue: 1, closed: 0 },
      threads: [
        { id: "qt_1", guardianName: "Parent 1", guardianPhone: "+919700000001", kidName: "Pupil 1",
          subject: "Vision", status: "OPEN", awaiting: "SCHOOL", waitingDays: 5,
          lastMessage: "The report says WATCH for vision.", lastAt: "2027-09-12T04:00:00Z" },
        { id: "qt_2", guardianName: "Parent 2", guardianPhone: "+919700000002", kidName: "",
          subject: "Dental", status: "ANSWERED", awaiting: "GUARDIAN", waitingDays: 0,
          lastMessage: "Thank you.", lastAt: "2027-09-13T04:00:00Z" }] },
    "/api/admin/questions/qt_1": {
      thread: { id: "qt_1", schoolName: "Silver Oaks", kidName: "Pupil 1", subject: "Vision",
        status: "OPEN", awaiting: "SCHOOL", openedAt: "2027-09-10T04:00:00Z" },
      messages: [{ id: "m1", side: "GUARDIAN", name: "Parent 1",
        body: "Should I take her to an eye doctor?", at: "2027-09-10T04:00:00Z" }] },
    "/api/admin/billing/contract?school_id=sch_1": { contract: { id: "con_1",
      shape: "PER_STUDENT_YEAR", ratePaise: 15000, rateRupees: 150, currency: "INR",
      academicYear: "2027-28", startsOn: "2027-04-01", endsOn: "2028-03-31", notes: "" } },
    "/api/admin/billing/invoices?school_id=sch_1": { invoices: [{ id: "inv_1",
      number: "VH-2027-0001", academicYear: "2027-28", status: "DRAFT", amountRupees: 150,
      issuedAt: "", paidAt: "" }] },
    "/api/admin/hospitals": { canEdit: true, hospitals: [
      { id: "hos_1", name: "Rainbow Children's Hospital", city: "Hyderabad", district: "Banjara Hills",
        address: "Road No 2", phone: "+914023456789", lat: 17.41, lng: 78.44, rating: 4.9,
        isCampPartner: true, active: true, doctorCount: 3 },
      { id: "hos_2", name: "LV Prasad Eye Institute", city: "Hyderabad", district: "",
        address: "", phone: "", lat: null, lng: null, rating: 4.8,
        isCampPartner: false, active: true, doctorCount: 1 }] },
    "/api/admin/doctors": { canEdit: true, doctors: [
      { id: "doc_1", name: "Dr Ananya Rao", specialty: "Paediatrics", hospitalId: "hos_1",
        hospitalName: "Rainbow Children's Hospital", city: "Hyderabad", rating: 4.9, active: true }] },
    "/api/admin/invites": { total: 6, joined: 2, notJoined: 4, neverInvited: 3, guardians: [
      { profileId: "ph_1", name: "Parent 1", phone: "+919700000001", children: 1, usingApp: true, invitedAt: "2027-09-01T00:00:00Z" },
      { profileId: "ph_2", name: "Parent 2", phone: "+919700000002", children: 2, usingApp: false, invitedAt: "" }] },
    "/api/admin/library": { checkTypes: ["Vision", "Dental", "Skin"], locales: ["en", "hi", "te"],
      articles: [{ slug: "vision-at-school", locale: "en",
        title: "When your child squints at the board", summary: "What a vision WATCH means.",
        body: "Long body text.", checkTypes: ["Vision"], flags: ["WATCH", "ALERT"],
        minAge: 4, maxAge: 14, published: true }] },
  };
  window.fetch = async (url) => {
    const u = String(url).replace(/^https?:\/\/[^/]+/, "");
    const keys = Object.keys(D).sort((a, b) => b.length - a.length);
    const k = keys.find((x) => u === x) || keys.find((x) => u.startsWith(x));
    return new Response(JSON.stringify(k ? D[k] : {}), { status: 200,
      headers: { "Content-Type": "application/json" } });
  };
});

await p.goto(URL);
await p.waitForTimeout(600);

const text = async () => (await p.locator(".content").innerText()).replace(/\n+/g, " | ");
const click = async (name) => {
  await p.getByRole("button", { name, exact: false }).first().click();
  await p.waitForTimeout(280);
};

check("the console boots signed in", /schools/.test(await text()));
check("operations sees the library in the menu",
  (await p.locator("nav").innerText()).includes("Library"));

await click("Schools");
await p.getByText("Silver Oaks").first().click();
await p.waitForTimeout(400);

// ── questions ──
await click("Questions");
const q = await text();
check("the queue says what this channel is not", /not urgent care/i.test(q));
check("the queue names the promised reply window", /within 3 days|3 days/.test(q));
check("an overdue question is called out", /waiting longer than/i.test(q));
check("days waited is shown per thread", /\b5d\b/i.test(q));
check("the channel can be closed from here", /Stop taking questions/.test(q));

await p.getByText("Parent 1").first().click();
await p.waitForTimeout(300);
const thread = await text();
check("a thread shows the family's own words", /eye doctor/.test(thread));
check("a reply can be sent and the thread closed", /Reply and close/.test(thread));
check("the reply box warns against clinical detail", /referral letter/.test(thread));

// ── billing ──
await click("Questions");
await click("Billing");
const bill = await text();
check("billing says invoices come from delivered work", /actually released/.test(bill));
check("billing says there is no payment gateway", /no payment gateway/.test(bill));
check("the contract is shown", /per student year/i.test(bill));
check("the rate is shown in rupees", /150/.test(bill));
check("the invoice is listed", /VH-2027-0001/.test(bill));
check("a draft invoice can be marked sent", /Mark sent/.test(bill));

await click("Change contract");
const form = await text();
check("the contract form offers a free shape", /Free/i.test(form));
check("the contract form explains paise", /paise/.test(form));

// ── library ──
await click("Cancel");
await click("Library");
const lib = await text();
check("the library warns against writing a diagnosis", /diagnosis/.test(lib));
check("an article shows what triggers it", /Vision/.test(lib));
check("an article shows its age band", /4.{0,3}14/.test(lib));

await click("New article");
const art = await text();
check("a new article can be tagged by check", /Shown to families whose child/.test(art));
check("a new article can be tagged by flag", /WATCH/.test(art));
check("untagged articles are explained as general", /general shelf/.test(art));

// ── hospitals and doctors ──
await click("Hospitals");
const hos = await text();
check("the hospital directory lists hospitals", /Rainbow Children/.test(hos));
check("a camp partner is marked as one", /Camp partner/i.test(hos));
check("a second hospital is listed", /LV Prasad/.test(hos));
check("the directory says what it is for", /refers their child onward/i.test(hos));
await click("Add hospital");
const hosForm = await text();
check("a hospital can be added", /Add a hospital/.test(hosForm));
check("coordinates are optional and explained", /sort hospitals by how far/i.test(hosForm));
await click("Cancel");

// ── invites ──
await click("Schools");
await p.getByText("Silver Oaks").first().click();
await p.waitForTimeout(400);
await click("App invites");
const inv = await text();
check("invites explain why they matter", /reaches a family only if they have the app/i.test(inv));
check("only families not on the app are targeted by default", /Invite the 4 not on the app/.test(inv));
check("the guardian list can be exported", /Export CSV/.test(inv));
check("a guardian already on the app is marked", /Installed/i.test(inv));

check("no page errors anywhere", errs.length === 0);
if (errs.length) console.log(errs.join("\n"));

await b.close();
process.exit(failures || errs.length ? 1 : 0);
