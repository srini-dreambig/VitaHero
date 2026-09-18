const { chromium } = (await import((process.env.PW_DIR || "playwright") + "/index.js")).default;

// The console's own sign-in, and which product it says it is.
//
// The app and the console share one sign-in endpoint and are for different
// people doing different jobs: a parent reads their own child's results in the
// Android app; a doctor reviews a camp's findings here. The endpoint could not
// tell them apart, so anyone provisioned could open either — and the app has no
// notion of a role, so a doctor who signed in there was greeted as "Parent"
// with no children.
//
// The backend now asks which product is knocking, and treats a client that
// says nothing as the family app, because every installed copy of the app
// predates the field. That default is only safe if the console actually says
// so on every sign-in call. This is the test of that.

const URL = process.env.PORTAL_URL || "http://127.0.0.1:8099/admin";

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
  // No stored session: this is the signed-out screen.
  localStorage.removeItem("vh_console");
  window.__sent = [];
  const real = window.fetch;
  window.fetch = async (u, init) => {
    const path = String(u).replace(/^https?:\/\/[^/]+/, "").split("?")[0];
    if (!path.startsWith("/api/")) return real(u, init);
    const body = init && init.body ? JSON.parse(init.body) : null;
    window.__sent.push({ path, body });
    if (path === "/api/auth/phone/send") {
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (path === "/api/auth/phone/verify") {
      return new Response(JSON.stringify({
        token: "t", profile: { id: "ph_1", name: "Dr Meera Iyer", role: "PHYSICIAN" },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({}), {
      status: 200, headers: { "Content-Type": "application/json" } });
  };
});

await p.goto(URL, { waitUntil: "networkidle" });
await p.waitForTimeout(350);

check("a signed-out console shows its sign-in screen",
  /Sign in/.test(await p.evaluate(() => document.body.innerText)));

// Ask for a code as a doctor would.
await p.evaluate(() => {
  const i = [...document.querySelectorAll("input")]
    .find((x) => /mobile/i.test(x.previousElementSibling?.textContent || ""));
  i.value = "9876500011";
  i.dispatchEvent(new Event("input", { bubbles: true }));
  [...document.querySelectorAll("button")]
    .find((x) => /send|code/i.test(x.textContent)).click();
});
await p.waitForTimeout(350);

const sent = await p.evaluate(() => window.__sent);
const send = sent.find((x) => x.path === "/api/auth/phone/send");
check("asking for a code reaches the backend", !!send);
// The heart of it. Without this the worker assumes the family app, and a
// school administrator asking for a code here would be told to use the app.
check("and the console says which product is asking",
  !!send && send.body.surface === "console");
check("along with the number, unchanged",
  !!send && send.body.phone === "9876500011");

await p.evaluate(() => {
  const i = [...document.querySelectorAll("input")].find((x) => x.value === "");
  if (i) { i.value = "123456"; i.dispatchEvent(new Event("input", { bubbles: true })); }
  const btn = [...document.querySelectorAll("button")]
    .find((x) => /verify|sign in|continue/i.test(x.textContent));
  if (btn) btn.click();
});
await p.waitForTimeout(350);

const verify = (await p.evaluate(() => window.__sent))
  .find((x) => x.path === "/api/auth/phone/verify");
// Verify is what mints the session and is reachable on its own, so it carries
// the same claim rather than trusting that /send already vouched for it.
check("and says it again when the code is verified",
  !!verify && verify.body.surface === "console");

check("sign-in: no page errors", errs.length === 0);
if (errs.length) errs.forEach((e) => console.log("      " + e));

await b.close();
process.exit(failures ? 1 : 0);
