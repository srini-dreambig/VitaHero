import { describe, expect, test } from "bun:test";
import { ageGroupOf, cleanMeals, menuFor, menuLines, readMeals, starterMeals } from "./diet-menus";

describe("age groups", () => {
  test("from whole years", () => {
    expect(ageGroupOf("", 3)).toBe("UNDER_5");
    expect(ageGroupOf("", 5)).toBe("UNDER_5");
    expect(ageGroupOf("", 6)).toBe("AGE_6_10");
    expect(ageGroupOf("", 10)).toBe("AGE_6_10");
    expect(ageGroupOf("", 11)).toBe("AGE_11_16");
    expect(ageGroupOf("", 16)).toBe("AGE_11_16");
    expect(ageGroupOf("", 17)).toBe("AGE_11_16");
  });
  test("the date of birth wins over the age on file", () => {
    const y = new Date().getUTCFullYear();
    expect(ageGroupOf(`${y - 12}-01-01`, 4)).toBe("AGE_11_16");
  });
  test("nothing on file reads as the middle group", () => {
    expect(ageGroupOf("", null)).toBe("AGE_6_10");
  });
});

describe("menus", () => {
  test("every starter menu survives its own cleaning", () => {
    for (const g of ["SEVERE", "UNDER", "STUNTED", "OVER", "NORMAL", "UNKNOWN"]) {
      const m = starterMeals(g);
      expect(m.length).toBeGreaterThan(0);
      expect(cleanMeals(m)).toEqual(m);
    }
  });
  test("weekly once and twice are kept", () => {
    const over = starterMeals("OVER");
    const freqs = over.flatMap((m) => m.items.map((i) => i.frequency));
    expect(freqs).toContain("WEEKLY_ONCE");
    expect(freqs).toContain("WEEKLY_TWICE");
  });
  test("unknown slots, empty foods and bad frequencies are cleaned", () => {
    const m = cleanMeals([
      { slot: "brunch", items: [{ name: "Toast" }] },
      { slot: "lunch", time: " 1 pm ", items: [{ name: "  " }, { name: "Rice", frequency: "HOURLY", qty: { UNDER_5: "1 cup" } }] },
      { slot: "DINNER", items: [] },
    ]);
    expect(m).toEqual([{
      slot: "LUNCH", label: "Lunch", time: "1 pm", chooseAny: false,
      items: [{ name: "Rice", frequency: "DAILY", qty: { UNDER_5: "1 cup", AGE_6_10: "", AGE_11_16: "" } }],
    }]);
  });
  test("too many meals is refused, not truncated", () => {
    expect(() => cleanMeals(Array.from({ length: 11 }, () => ({ slot: "LUNCH", items: [{ name: "x" }] })))).toThrow();
  });
  test("a stored column that is not a menu reads as no menu", () => {
    expect(readMeals(null)).toEqual([]);
    expect(readMeals("not json")).toEqual([]);
    expect(readMeals("[]")).toEqual([]);
  });
  test("a family sees the quantity for their child's age", () => {
    const meals = cleanMeals([{ slot: "BEDTIME", items: [
      { name: "Milk", qty: { UNDER_5: "150 ml", AGE_6_10: "200 ml", AGE_11_16: "250 ml" }, frequency: "WEEKLY_TWICE" },
    ] }]);
    expect(menuFor(meals, "AGE_6_10")[0].items[0]).toEqual({
      name: "Milk", quantity: "200 ml", frequency: "WEEKLY_TWICE", frequencyLabel: "Twice a week",
    });
  });
  test("the menu as plain lines, for screens that read only guidance", () => {
    const text = menuLines(starterMeals("NORMAL"));
    expect(text).toContain("Breakfast: Idly or Dosa or Upma or Pongal");
    expect(text).toContain("Fish or chicken (twice a week)");
  });
});
