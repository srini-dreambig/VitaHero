const { chromium } = (await import((process.env.PW_DIR || "playwright") + "/index.js")).default;

// A notice says something happened and then gets out of the way.
//
// "Saved." and "Deleted Silver Oaks." used to sit on the screen until the next
// action — which, on a screen you then stayed on, meant minutes later they were
// still describing something long since finished. Two promises are made now and
// both are tested here: you can put a notice away, and if you do not, it puts
// itself away.
//
// Driven from the sign-in screen because asking for a code is the shortest path
// to a notice that needs no session and no fixture.

const URL = process.env.PORTAL_URL || "http://127.0.0.1:8099/admin";

let failures = 0;
const check = (l, c) => { console.log((c ? "PASS  " : "FAIL  ") + l); if (!c) failures++; };

const b = await chromium.launch();
const p = await b.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push("pageerror: " + e.message));

await p.addInitScript(() => {
  localStorage.removeItem("vh_console");
  const real = window.fetch;
  window.fetch = async (u, init) => {
    const path = String(u).replace(/^https?:\/\/[^/]+/, "").split("?")[0];
    if (!path.startsWith("/api/")) return real(u, init);
    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { "Content-Type": "application/json" } });
  };
});

await p.goto(URL, { waitUntil: "networkidle" });
await p.waitForTimeout(350);

const askForCode = async () => p.evaluate(() => {
  const i = [...document.querySelectorAll("input")]
    .find((x) => /mobile/i.test(x.previousElementSibling?.textContent || ""));
  i.value = "9876500011";
  i.dispatchEvent(new Event("input", { bubbles: true }));
  [...document.querySelectorAll("button")]
    .find((x) => /send/i.test(x.textContent)).click();
});
const noticeText = () => p.$eval(".msg.ok", (n) => n.innerText).catch(() => "");

await askForCode();
await p.waitForTimeout(300);
check("an action says what it did", /code sent/i.test(await noticeText()));

// Dismissing it. Without this the only way to clear a notice was to do
// something else, which is not a thing anyone should have to do to stop
// reading a sentence.
check("the notice carries a way to put it away",
  (await p.$(".msg.ok.dis button")) !== null);
await p.click(".msg.ok.dis button");
await p.waitForTimeout(200);
check("and clicking it clears the notice", (await noticeText()) === "");

// Leaving it alone. The timer is four seconds plus a beat a word, so a short
// notice is gone inside six.
await p.evaluate(() => {
  const back = [...document.querySelectorAll("button")]
    .find((x) => /different number/i.test(x.textContent));
  if (back) back.click();
});
await p.waitForTimeout(250);
await askForCode();
await p.waitForTimeout(300);
check("a second notice appears", /code sent/i.test(await noticeText()));
await p.waitForTimeout(6500);
check("and clears itself without being asked", (await noticeText()) === "");

check("notice: no page errors", errs.length === 0);
if (errs.length) errs.forEach((e) => console.log("      " + e));

await b.close();
process.exit(failures ? 1 : 0);
