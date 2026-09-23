// The date formats the app's reminders are parsed with.
//
// A reminder is set on the phone from a date the server sent. The app parses it
// with java.time and swallows a parse failure as "no reminder" — so a format
// the two ends disagree about is not an error anywhere. It is a feature that
// simply never happens, with its toggle still in the settings screen.
//
// That is what had happened: camp dates are YYYY-MM-DD, the parser only
// accepted "01 Nov 2026", and camp reminders had never fired on any device.
// These tests pin both formats from this side, because this side is the one
// that can be run.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const SLOT_DATE = /^\d{2} [A-Z][a-z]{2} \d{4}$/;
const SLOT_TIME = /^\d{2}:\d{2} (AM|PM)$/;

const SCHEDULER = readFileSync(
  new URL("../android/app/src/main/java/kallam/healthcare/data/NotificationScheduler.kt", import.meta.url),
  "utf8",
);

describe("what the app is asked to parse", () => {
  test("a camp's date is the ISO one the server enforces", () => {
    const camps = readFileSync(new URL("./camps.ts", import.meta.url), "utf8");
    // createCamp refuses anything else, so this is the only shape a camp date
    // can reach the app in.
    expect(camps.includes('"Camp date must be YYYY-MM-DD", "BAD_DATE"')).toBe(true);
    expect(ISO.test("2026-09-18")).toBe(true);
  });

  test("a booking slot's date and time are the ones the directory generates", () => {
    const index = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    const times = index.match(/const times = \[([^\]]*)\]/);
    expect(times).not.toBeNull();
    for (const t of (times as RegExpMatchArray)[1].split(",")) {
      const value = t.trim().replace(/^"|"$/g, "");
      if (value) expect(SLOT_TIME.test(value)).toBe(true);
    }
    // `${dd} ${Mon} ${yyyy}` — the shape generateDoctorSlots builds by hand.
    expect(index.includes(
      "const dateStr = `${String(day.getDate()).padStart(2, \"0\")} ${monthNames[day.getMonth()]} ${day.getFullYear()}`"
    )).toBe(true);
    expect(SLOT_DATE.test("01 Nov 2026")).toBe(true);
  });

  test("the app accepts both, and says so in one place", () => {
    // parseReminderDate is the only date parser the reminders use. If a third
    // format ever appears on the wire, this is where it has to be taught.
    expect(SCHEDULER.includes("fun parseReminderDate(date: String): LocalDate?")).toBe(true);
    expect(SCHEDULER.includes("runCatching { LocalDate.parse(clean) }.getOrNull()")).toBe(true);
    expect(SCHEDULER.includes("runCatching { LocalDate.parse(clean, dateFormatter) }.getOrNull()")).toBe(true);
  });

  test("a camp reminder does not need a time the school never set", () => {
    const index = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
    // The column is optional and usually blank; requiring it to parse is what
    // silently dropped the reminder for most camps.
    expect(index.includes("time TEXT DEFAULT \'\'")).toBe(true);
    expect(SCHEDULER.includes("fun scheduleCampReminder(")).toBe(true);
    const fn = SCHEDULER.slice(
      SCHEDULER.indexOf("fun scheduleCampReminder("),
      SCHEDULER.indexOf("fun campReminderId("),
    );
    expect(fn).not.toContain("campTime");
    expect(fn).toContain("parseReminderDate(campDate)");
  });
});

describe("the programme's calendar", () => {
  test("a day turns over where the schools are, not in UTC", async () => {
    const { programmeToday, currentAcademicYear } = await import("./common");
    // 31 May, 19:00 UTC is 1 June, 00:30 in Hyderabad. UTC says May.
    const lateMay = new Date("2026-05-31T19:00:00Z");
    expect(programmeToday(lateMay)).toBe("2026-06-01");
    expect(lateMay.toISOString().slice(0, 10)).toBe("2026-05-31");

    // Which means the academic year turns over on the right night too.
    expect(currentAcademicYear(lateMay)).toBe("2026-27");
    expect(currentAcademicYear(new Date("2026-05-31T10:00:00Z"))).toBe("2025-26");
  });

  test("a meal logged after midnight belongs to the day the parent is in", async () => {
    const { programmeToday } = await import("./common");
    // 00:30 IST on the 4th is 19:00 UTC on the 3rd. The app's streak uses the
    // device's own date and would say the 4th; the server used to say the 3rd,
    // so the meal went into a day the plan no longer showed.
    const afterMidnightIST = new Date("2026-03-03T19:00:00Z");
    expect(programmeToday(afterMidnightIST)).toBe("2026-03-04");
  });

  test("the zone is named once, not spelled out at each site", () => {
    const common = readFileSync(new globalThis.URL("./common.ts", import.meta.url), "utf8");
    expect(common).toContain('export const PROGRAMME_TZ = "Asia/Kolkata"');
    for (const f of ["index.ts", "referrals.ts", "analytics.ts"]) {
      const src = readFileSync(new globalThis.URL("./" + f, import.meta.url), "utf8");
      // Reading "now" as a UTC calendar day is the thing that was wrong.
      // Date arithmetic on a UTC-constructed date is not — that is how you
      // add days to a date without a timezone getting involved.
      expect(src.includes("new Date().toISOString().slice(0, 10)")).toBe(false);
      expect(src.includes("to_char(NOW(), 'YYYY-MM-DD')")).toBe(false);
    }
  });
});
