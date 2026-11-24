// The dietician's menus.
//
// A plan used to be a paragraph of advice and a few target lines. The
// dietician writes menus: meal slots (breakfast, lunch, ...), the foods in
// each, how much of each, and how often. The menu is the same for every age;
// only the quantities change, so each item carries one quantity per age group
// and a family sees the quantity for their own child.
//
// The menu is stored as JSON next to the old fields, which stay as they are:
// an older app reads `guidance` and `targets` and never sees `meals`.

import { ApiError } from "./schools";
import { ageInMonths } from "./who2007";

export const AGE_GROUPS = ["UNDER_5", "AGE_6_10", "AGE_11_16"] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

export const AGE_GROUP_INFO: Record<AgeGroup, { label: string; kcal: string }> = {
  UNDER_5: { label: "Up to 5 years", kcal: "1000–1200 kcal" },
  AGE_6_10: { label: "6 to 10 years", kcal: "1200–1400 kcal" },
  AGE_11_16: { label: "11 to 16 years", kcal: "1400–1700 kcal" },
};

/** "W/1" and "W/2" in the dietician's notes: once and twice a week. */
export const FREQUENCIES = ["DAILY", "WEEKLY_ONCE", "WEEKLY_TWICE"] as const;
export type Frequency = (typeof FREQUENCIES)[number];
export const FREQUENCY_LABEL: Record<Frequency, string> = {
  DAILY: "",
  WEEKLY_ONCE: "Once a week",
  WEEKLY_TWICE: "Twice a week",
};

export const MEAL_SLOTS = [
  "EARLY_MORNING", "BREAKFAST", "MID_MORNING", "LUNCH", "EVENING", "DINNER", "BEDTIME",
] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];
export const SLOT_LABEL: Record<MealSlot, string> = {
  EARLY_MORNING: "Early morning",
  BREAKFAST: "Breakfast",
  MID_MORNING: "Mid-morning snack",
  LUNCH: "Lunch",
  EVENING: "Evening snack",
  DINNER: "Dinner",
  BEDTIME: "Bedtime",
};

export type MenuItem = {
  name: string;
  qty: Record<AgeGroup, string>;
  frequency: Frequency;
};
export type MenuMeal = {
  slot: MealSlot;
  label: string;
  time: string;
  chooseAny: boolean;
  items: MenuItem[];
};

/**
 * A child's age group: from the date of birth when there is one, else the age
 * in years. Five-year-olds are in the youngest group, the dietician's
 * "under 5 / 6–10 / 11–16"; anyone older than 16 eats the 11–16 quantities.
 */
export function ageGroupOf(dob: string, age: number | null): AgeGroup {
  const months = ageInMonths(dob || "", age);
  const years = months === null ? (age ?? null) : Math.floor(months / 12);
  if (years === null || !Number.isFinite(years)) return "AGE_6_10";
  if (years <= 5) return "UNDER_5";
  if (years <= 10) return "AGE_6_10";
  return "AGE_11_16";
}

const MAX_MEALS = 10, MAX_ITEMS = 15;
const text = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

/**
 * A menu as sent by a screen, cleaned: unknown slots and empty items dropped,
 * text trimmed, counts capped. A missing or malformed menu is an empty one.
 */
export function cleanMeals(raw: unknown): MenuMeal[] {
  let list = raw;
  if (typeof list === "string") {
    try { list = JSON.parse(list); } catch { list = []; }
  }
  if (!Array.isArray(list)) return [];
  if (list.length > MAX_MEALS) throw new ApiError(400, `At most ${MAX_MEALS} meals in a plan`, "TOO_MANY_MEALS");
  const meals: MenuMeal[] = [];
  for (const m of list) {
    const o = (m || {}) as Record<string, unknown>;
    const slot = String(o.slot || "").toUpperCase() as MealSlot;
    if (!(MEAL_SLOTS as readonly string[]).includes(slot)) continue;
    const rawItems = Array.isArray(o.items) ? o.items : [];
    if (rawItems.length > MAX_ITEMS) {
      throw new ApiError(400, `At most ${MAX_ITEMS} foods in one meal`, "TOO_MANY_ITEMS");
    }
    const items: MenuItem[] = [];
    for (const it of rawItems) {
      const i = (it || {}) as Record<string, unknown>;
      const name = text(i.name, 120);
      if (!name) continue;
      const q = (i.qty || {}) as Record<string, unknown>;
      const f = String(i.frequency || "DAILY").toUpperCase() as Frequency;
      items.push({
        name,
        qty: { UNDER_5: text(q.UNDER_5, 60), AGE_6_10: text(q.AGE_6_10, 60), AGE_11_16: text(q.AGE_11_16, 60) },
        frequency: (FREQUENCIES as readonly string[]).includes(f) ? f : "DAILY",
      });
    }
    if (items.length === 0) continue;
    meals.push({
      slot,
      label: text(o.label, 40) || SLOT_LABEL[slot],
      time: text(o.time, 20),
      chooseAny: o.chooseAny === true,
      items,
    });
  }
  return meals;
}

/** What a family reads: each food with the quantity for their child's age. */
export function menuFor(meals: MenuMeal[], group: AgeGroup) {
  return meals.map((m) => ({
    slot: m.slot,
    label: m.label,
    time: m.time,
    chooseAny: m.chooseAny,
    items: m.items.map((i) => ({
      name: i.name,
      quantity: i.qty[group] || "",
      frequency: i.frequency,
      frequencyLabel: FREQUENCY_LABEL[i.frequency],
    })),
  }));
}

/** The menu as plain lines, for a screen that only knows `guidance`. */
export function menuLines(meals: MenuMeal[]): string {
  return meals.map((m) => {
    const foods = m.items.map((i) => i.name + (i.frequency === "DAILY" ? "" : ` (${FREQUENCY_LABEL[i.frequency].toLowerCase()})`));
    return `${m.label}${m.time ? ` (${m.time})` : ""}: ${foods.join(m.chooseAny ? " or " : ", ")}`;
  }).join("\n");
}

// ─── The starter menus ──────────────────────────────────────
//
// Copied from the dietician's own notes, with their food names kept as they
// wrote them. Quantities are the ones the notes give; where the notes give
// none, the box is left empty for the dietician to fill in rather than
// guessed.

type Seed = [name: string, under5?: string, f?: Frequency];
const meal = (slot: MealSlot, items: Seed[], chooseAny = false, time = ""): MenuMeal => ({
  slot, label: SLOT_LABEL[slot], time, chooseAny,
  items: items.map(([name, u5 = "", f = "DAILY"]) => ({
    name, qty: { UNDER_5: u5, AGE_6_10: "", AGE_11_16: "" }, frequency: f,
  })),
});

const HEALTHY: MenuMeal[] = [
  meal("BREAKFAST", [
    ["Idly", "3 small"], ["Dosa", "2 small"], ["Upma", "1 cup"], ["Pongal", "1 cup"],
  ], true),
  { ...meal("BREAKFAST", [["Sambar", "1 cup"], ["Chutney", "2–3 tsp"], ["Milk", "150 ml"]]), label: "With breakfast" },
  meal("MID_MORNING", [
    ["Fruit: apple, banana, orange, guava or papaya", "1"],
    ["Soaked badam, pumpkin seeds and 2 dates", "1 handful"],
  ], true),
  meal("LUNCH", [["Rice"], ["Boiled egg", "1"], ["Curry"], ["Dal"], ["Curd"],
    ["Fish or chicken", "", "WEEKLY_TWICE"]]),
  meal("EVENING", [["Boiled channa"], ["Sweet corn"], ["Sweet potato"], ["Fruit juice"]], true),
  meal("DINNER", [["Rice or multigrain roti"], ["Curry"], ["Rasam"], ["Curd"]]),
];

const UNDERWEIGHT: MenuMeal[] = [
  meal("BREAKFAST", [["Idly"], ["Millet dosa"], ["Vegetable upma"], ["Pongal"]], true),
  { ...meal("BREAKFAST", [["Egg white"], ["Sambar"], ["Chutney"]]), label: "With breakfast" },
  meal("MID_MORNING", [["Ragi java"], ["Protein shake"], ["Any fruit"]], true),
  meal("LUNCH", [["Rice"], ["Boiled egg"], ["Curry"], ["Dal"], ["Curd"],
    ["Chicken, mutton or fish", "", "WEEKLY_TWICE"]]),
  meal("EVENING", [["Sunnunda"], ["Dry-fruit laddoo"], ["Sweet potato"], ["Vegetable salad"], ["Atukula poha"]], true),
  meal("DINNER", [["Vegetable khichdi"], ["Roti"], ["Curry"], ["Curd"]], false, "7:00 pm"),
  meal("BEDTIME", [["Milk", "1 glass"]], false, "9:00 pm"),
];

const OVERWEIGHT: MenuMeal[] = [
  meal("EARLY_MORNING", [["Lukewarm water with lemon", "1 glass"]]),
  meal("BREAKFAST", [
    ["Ragi malt with boiled egg whites", "", "WEEKLY_TWICE"],
    ["Bread toast and vegetable salad", "", "WEEKLY_ONCE"],
    ["Idly"], ["Dosa"], ["Upma"], ["Pongal"],
  ], true),
  meal("MID_MORNING", [["Soaked badam, pumpkin seeds, pista and 2 dates"], ["Papaya, guava or melon"]]),
  meal("LUNCH", [["Millet khichdi or single-polished rice"], ["Dal"], ["Sambar"], ["Curry"], ["Buttermilk with lemon"]]),
  meal("DINNER", [["Single-polished rice, roti or multigrain chapati"], ["Rasam"], ["Curry"]]),
  meal("BEDTIME", [["Buttermilk with lemon", "1 glass"]]),
];

/** The dietician's starter menu for a growth group. */
export function starterMeals(growth: string): MenuMeal[] {
  const pick = growth === "SEVERE" || growth === "UNDER" || growth === "STUNTED" ? UNDERWEIGHT
    : growth === "OVER" ? OVERWEIGHT : HEALTHY;
  return JSON.parse(JSON.stringify(pick));
}

/** A stored menu column, read back. */
export function readMeals(v: unknown): MenuMeal[] {
  try { return cleanMeals(v); } catch { return []; }
}
