// Going to a screen by name, whatever kind of control happens to reach it.
//
// The console has three levels: destinations in the sidebar, groups as tabs
// inside a destination, and the screens of a group as a segmented control
// under those tabs. A test should say where it wants to be, not which of the
// three it has to click this week — every one of these files used to click
// ".navi" for everything, and all of them broke at once when a school's
// screens moved out of the sidebar and into tabs.
//
// If the screen is inside a group that is not open, the group is opened first.
// That is the one piece of structure this knows about, and it works it out by
// looking rather than by being told.

const NAME = (n) => n.textContent.replace(/\d+$/, "").trim();

/**
 * Click the control named `label`, opening its group first if it has one.
 *
 * In order, because the last step has a side effect: a navigation control on
 * screen, then any button on screen, then — only if neither exists — opening
 * each group in turn to look inside it. Sweeping the groups navigates away
 * from wherever you were, so it must not run while the thing you asked for is
 * sitting in front of you. Doing it in the other order took the billing screen
 * off screen and then went looking for its "Change contract" button.
 */
export async function go(p, label, opts = {}) {
  const wait = opts.wait || 450;

  if (await click(p, label)) { await p.waitForTimeout(wait); return; }
  if (await click(p, label, true)) { await p.waitForTimeout(wait); return; }

  const groups = await p.$$eval(".tabs .tab", (ns) =>
    ns.map((n) => n.textContent.replace(/\d+$/, "").trim()));
  for (const g of groups) {
    await click(p, g);
    await p.waitForTimeout(250);
    if (await click(p, label)) { await p.waitForTimeout(wait); return; }
  }

  throw new Error(`console-smoke: nothing named "${label}" to click`
    + (groups.length ? ` (groups on screen: ${groups.join(", ")})` : ""));
}

/**
 * Navigation controls first, so that a screen called "Staff" is reached by its
 * own control rather than by some button that happens to share the name.
 */
async function click(p, label, anyButton) {
  return p.evaluate(([l, any]) => {
    const name = (n) => n.textContent.replace(/\d+$/, "").trim();
    const sel = any ? "button" : ".navi, .tabs .tab, .seg button";
    const el = [...document.querySelectorAll(sel)].find((n) => name(n) === l);
    if (!el || el.disabled) return false;
    el.click();
    return true;
  }, [label, !!anyButton]);
}

/** The groups currently on offer, in order. */
export const groups = (p) =>
  p.$$eval(".tabs .tab", (ns) => ns.map((n) => n.textContent.replace(/\d+$/, "").trim()));

/** The screens of the group currently open, in order. */
export const screens = (p) =>
  p.$$eval(".seg button", (ns) => ns.map((n) => n.textContent.replace(/\d+$/, "").trim()));
