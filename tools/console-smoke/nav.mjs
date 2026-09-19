// Going to a screen by name, whatever kind of control happens to reach it.
//
// The console has two levels: destinations in the sidebar, and the screens of
// a destination as one row of tabs. It had three — the tabs were groups, with
// the screens of the open group on a second row — and this file opened a group
// before looking inside it. That step is gone with the groups, but the shape
// of the helper is not: a test should say where it wants to be, not which
// control reaches it this week. Every one of these files used to click ".navi"
// for everything, and all of them broke at once when a school's screens moved
// out of the sidebar.

const NAME = (n) => n.textContent.replace(/\d+$/, "").trim();

/**
 * Click the control named `label`.
 *
 * In order, and the order matters: a navigation control on screen, then any
 * button on screen, then — only if neither exists — a sweep of the tabs,
 * which navigates away from wherever you were and so must not run while the
 * thing you asked for is sitting in front of you. Doing it the other way round
 * took the billing screen off screen and then went looking for its "Change
 * contract" button.
 *
 * The sweep survives the flattening because a tab can still reveal a button:
 * asking for "Change contract" finds it by opening Billing.
 */
export async function go(p, label, opts = {}) {
  const wait = opts.wait || 450;

  if (await click(p, label)) { await p.waitForTimeout(wait); return; }
  if (await click(p, label, true)) { await p.waitForTimeout(wait); return; }

  const tabs = await p.$$eval(".tabs .tab", (ns) =>
    ns.map((n) => n.textContent.replace(/\d+$/, "").trim()));
  for (const t of tabs) {
    await click(p, t);
    await p.waitForTimeout(250);
    if (await click(p, label)) { await p.waitForTimeout(wait); return; }
  }

  throw new Error(`console-smoke: nothing named "${label}" to click`
    + (tabs.length ? ` (tabs on screen: ${tabs.join(", ")})` : ""));
}

/**
 * Navigation controls first, so that a screen called "Staff" is reached by its
 * own control rather than by some button that happens to share the name.
 */
async function click(p, label, anyButton) {
  return p.evaluate(([l, any]) => {
    const name = (n) => n.textContent.replace(/\d+$/, "").trim();
    const sel = any ? "button" : ".navi, .tabs .tab";
    const el = [...document.querySelectorAll(sel)].find((n) => name(n) === l);
    if (!el || el.disabled) return false;
    el.click();
    return true;
  }, [label, !!anyButton]);
}

/** The screens of this destination, in order. */
export const screens = (p) =>
  p.$$eval(".tabs .tab", (ns) => ns.map((n) => n.textContent.replace(/\d+$/, "").trim()));
