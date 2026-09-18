// Shared constants and provisioning helpers used by the worker entrypoint and
// the Stage A admin modules (schools.ts, roster.ts).
//
// These live here rather than in index.ts so the roster importer and the school
// management endpoints can reuse the exact same normalisation rules. Two copies
// of phone normalisation would eventually disagree, and a disagreement there
// means a parent's invite goes to a number that doesn't match their profile id.

import type { NeonQueryFunction } from "@neondatabase/serverless";

/**
 * The concrete type `neon(url)` returns with default options.
 *
 * `ReturnType<typeof neon>` widens the generics to `boolean`, which then refuses
 * the `NeonQueryFunction<false, false>` the entrypoint actually creates. Naming
 * the concrete type here keeps the Stage A modules typecheck-clean.
 */
export type Sql = NeonQueryFunction<false, false>;

export const SCHEMA = "vita_hero";
export const DEFAULT_COUNTRY_CODE = "91"; // India

/** Roles recognised by the platform, widest access last. */
export const ROLE_PARENT = "PARENT";
export const ROLE_SCHOOL_ADMIN = "SCHOOL_ADMIN";
export const ROLE_ADMIN = "ADMIN";
export const ROLE_SUPERADMIN = "SUPERADMIN";

/** Ops-level roles may act across every school. */
export function isOpsRole(role: string): boolean {
  return role === ROLE_ADMIN || role === ROLE_SUPERADMIN;
}

/** Normalize a raw phone string into E.164 + the 10-digit local key. */
export function normalizePhone(
  raw: string | undefined | null
): { e164: string; last10: string } | null {
  if (!raw) return null;
  const hadPlus = raw.trim().startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const last10 = digits.slice(-10);
  // Preserve an explicit country code if one was provided, else default.
  //
  // The leading zero is a trunk prefix, not a country code. Indians write
  // their own numbers as 09876543210 and landlines as 04023456789 constantly,
  // and both used to come out of here as "+0..." — a country code of zero,
  // which is not a country. The last10 was right, so the profile id was right
  // and nothing looked broken; it was the stored E.164 that was malformed, and
  // every message sent to it went nowhere.
  let cc = DEFAULT_COUNTRY_CODE;
  if (digits.length > 10) {
    cc = digits.slice(0, digits.length - 10).replace(/^0+/, "") || DEFAULT_COUNTRY_CODE;
  } else if (hadPlus) cc = ""; // already E.164-ish without national digits — unlikely
  const e164 = `+${cc || DEFAULT_COUNTRY_CODE}${last10}`;
  return { e164, last10 };
}

/**
 * The same, but it must be a number that can actually receive an OTP.
 *
 * normalizePhone() accepts any ten digits, which is right for a hospital
 * switchboard — a family rings it and a person answers. It is wrong for
 * anyone who signs in. A Hyderabad landline, 040 2345 6789, normalises to
 * +914023456789 and was accepted as a doctor's number: the profile was
 * created, the OTP was sent, and it went to a desk phone that cannot read it.
 * Nothing failed loudly; the doctor simply could never get in.
 *
 * Several call sites already told the user "not a valid mobile number". This
 * is the check that makes that sentence true.
 *
 * Indian mobile numbers are ten digits beginning 6, 7, 8 or 9. Landlines,
 * toll-free and premium ranges begin with other digits and are rejected here.
 * A number with a country code other than India is accepted on its digits
 * alone, because this rule is about the Indian numbering plan and guessing at
 * another country's would do more harm than good.
 */
export function normalizeMobile(
  raw: string | undefined | null
): { e164: string; last10: string } | null {
  const n = normalizePhone(raw);
  if (!n) return null;
  const indian = n.e164 === `+${DEFAULT_COUNTRY_CODE}${n.last10}`;
  if (!indian) return n;
  return /^[6-9]\d{9}$/.test(n.last10) ? n : null;
}

/** True when this is a number an OTP could reach. */
export function isMobile(raw: string | undefined | null): boolean {
  return normalizeMobile(raw) !== null;
}

export function profileIdForPhone(last10: string): string {
  return `ph_${last10}`;
}

export function slugify(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Stable per-child identity so re-imports across camps update the same kid row. */
export function buildStudentRef(
  provided: string | undefined,
  last10: string,
  name: string,
  dobOrAge: string
): string {
  const explicit = (provided || "").trim();
  if (explicit) return `sid_${slugify(explicit)}`;
  return `auto_${last10}_${slugify(name)}_${slugify(dobOrAge || "na")}`;
}

export function parseNum(v: string): number | null {
  if (!v) return null;
  const n = parseFloat(v.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function deriveAge(dob: string, age: string): number {
  const a = parseInt(age, 10);
  if (Number.isFinite(a) && a > 0 && a < 25) return a;
  // dob like YYYY-MM-DD or DD-MM-YYYY or YYYY
  const yearMatch = dob.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) {
    const y = parseInt(yearMatch[0], 10);
    const now = new Date().getFullYear();
    const diff = now - y;
    if (diff > 0 && diff < 25) return diff;
  }
  return 0;
}

/** Case-insensitive, punctuation-insensitive field accessor for a CSV/Excel row. */
export function rowField(row: Record<string, unknown>, ...wanted: string[]): string {
  for (const k of Object.keys(row)) {
    const norm = k.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (wanted.includes(norm)) {
      const v = row[k];
      return v == null ? "" : String(v).trim();
    }
  }
  return "";
}

/**
 * Parse a date of birth in the formats Indian school offices actually produce.
 * Returns an ISO date string (YYYY-MM-DD) or null.
 *
 * Ambiguity rule: DD/MM/YYYY is assumed over MM/DD/YYYY, because these rosters
 * come from Indian schools. Where the first component is > 12 the reading is
 * unambiguous and we say so, which lets the validator warn on the rest.
 */
export function parseDob(raw: string): { iso: string; ambiguous: boolean } | null {
  const s = (raw || "").trim();
  if (!s) return null;

  // ISO first: YYYY-MM-DD or YYYY/MM/DD
  const iso = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (iso) {
    const built = buildDate(+iso[1], +iso[2], +iso[3]);
    return built ? { iso: built, ambiguous: false } : null;
  }

  // DD-MM-YYYY / DD/MM/YYYY / DD.MM.YYYY
  const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) {
    const d = +dmy[1];
    const m = +dmy[2];
    const built = buildDate(+dmy[3], m, d);
    if (!built) return null;
    // If both components could be a month, the reading is a guess.
    return { iso: built, ambiguous: d <= 12 && m <= 12 };
  }

  // Textual: 12 Mar 2016 / 12-March-2016 / Mar 12, 2016
  //
  // Matched explicitly rather than handed to Date.parse, which is far too
  // lenient for this job: it turns "sometime in 2016" and even "born 2016"
  // into 1 January 2016. A silently invented birthday shifts the child's age
  // by up to a year, and with it their growth percentile.
  const dMonY = s.match(/^(\d{1,2})[\s\-/.]+([A-Za-z]{3,9})[\s\-/.]+(\d{4})$/);
  if (dMonY) {
    const m = monthFromName(dMonY[2]);
    const built = m ? buildDate(+dMonY[3], m, +dMonY[1]) : null;
    return built ? { iso: built, ambiguous: false } : null;
  }

  const monDY = s.match(/^([A-Za-z]{3,9})[\s\-/.]+(\d{1,2}),?[\s\-/.]+(\d{4})$/);
  if (monDY) {
    const m = monthFromName(monDY[1]);
    const built = m ? buildDate(+monDY[3], m, +monDY[2]) : null;
    return built ? { iso: built, ambiguous: false } : null;
  }

  return null;
}

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** 1-12 for a full or three-letter month name, else null. */
function monthFromName(raw: string): number | null {
  const s = (raw || "").toLowerCase();
  for (let i = 0; i < MONTH_NAMES.length; i++) {
    const full = MONTH_NAMES[i];
    if (s === full || s === full.slice(0, 3)) return i + 1;
  }
  return null;
}

function buildDate(y: number, m: number, d: number): string | null {
  if (!y || !m || !d) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  // Reject 31 Feb and friends — Date rolls them forward silently.
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return null;
  }
  return dt.toISOString().slice(0, 10);
}

/** Whole years between an ISO date of birth and now. */
export function ageFromIsoDob(isoDob: string): number | null {
  const t = Date.parse(isoDob);
  if (!Number.isFinite(t)) return null;
  const dob = new Date(t);
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const before =
    now.getUTCMonth() < dob.getUTCMonth() ||
    (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() < dob.getUTCDate());
  if (before) age -= 1;
  return age;
}

/** Normalise the many ways a roster spells a child's sex. */
export function normalizeGender(raw: string): string {
  const s = (raw || "").trim().toLowerCase();
  if (!s) return "";
  if (["m", "male", "boy", "b", "son"].includes(s)) return "Male";
  if (["f", "female", "girl", "g", "daughter"].includes(s)) return "Female";
  return "Other";
}

/**
 * Title-case a name without destroying the ones that are already correct.
 * "RAHUL SHARMA" and "rahul sharma" both become "Rahul Sharma"; "D'Souza" and
 * "McKenzie" are left alone because they are already mixed case.
 */
export function tidyName(raw: string): string {
  const s = (raw || "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  const allOneCase = s === s.toUpperCase() || s === s.toLowerCase();
  if (!allOneCase) return s;
  return s
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

/** A short, unambiguous partner code. Excludes characters people misread. */
export function generatePartnerCode(name: string): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const prefix =
    (name || "")
      .replace(/[^a-zA-Z]/g, "")
      .slice(0, 4)
      .toUpperCase() || "SCHL";
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  let suffix = "";
  for (const b of bytes) suffix += alphabet[b % alphabet.length];
  return `${prefix}${suffix}`;
}

/**
 * The programme's own calendar day.
 *
 * Everything that means "today" to a person — which day a meal belongs to,
 * whether a referral is overdue, which academic year it is — was computed in
 * UTC, because that is what toISOString() gives you. The schools are in India,
 * so the day was turning over at half past five in the morning local time.
 *
 * The visible consequence was in meals. The app stamps its streak with the
 * device's own LocalDate, and the server filed the meal under UTC's: a parent
 * logging something after midnight had the streak move to the new day while
 * the meal went into the old one, and then vanished from today's plan at
 * 05:30. The two ends were keeping different calendars.
 *
 * One place, named, and overridable — a programme that runs somewhere else
 * sets PROGRAMME_TZ rather than discovering this the same way.
 */
export const PROGRAMME_TZ = "Asia/Kolkata";

export function programmeToday(now = new Date(), tz = PROGRAMME_TZ): string {
  // en-CA renders as YYYY-MM-DD, which is the shape every date column here uses.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

/** Current academic year in Indian convention (June start), e.g. "2026-27". */
export function currentAcademicYear(now = new Date()): string {
  // The programme's calendar, not UTC's: the year turns over on 1 June where
  // the schools are, not five and a half hours later.
  const [y, m] = programmeToday(now).split("-").map(Number);
  const startYear = m >= 6 ? y : y - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

/** Split an array into fixed-size chunks for batched SQL statements. */
/**
 * Send many rows as one statement.
 *
 * `template` carries the marker `%VALUES%` where the row tuples belong, and
 * every row must have the same width. Batched at a hundred rows, because a
 * single statement with thousands of parameters is its own problem.
 *
 * This exists because "one round trip per row" is the failure this codebase
 * keeps rediscovering: it took the schema migration down, it made releasing a
 * camp's results impossible at any real school size, and on Cloudflare — where
 * every statement is an outbound subrequest against a hard cap — it is never
 * merely slow.
 */
export async function insertRows(
  sql: Sql,
  template: string,
  rows: unknown[][]
): Promise<void> {
  if (rows.length === 0) return;
  const width = rows[0].length;
  for (const group of chunk(rows, 100)) {
    const values = group
      .map((_, i) => `(${Array.from({ length: width }, (_, k) => "$" + (i * width + k + 1)).join(", ")})`)
      .join(", ");
    // The function form of replace, so a `$` sequence in the generated tuples
    // is never read as a capture-group reference. Today they are only `$1`,
    // `$2`, … which survive intact, but `$&` would not, and a helper that is
    // safe only by accident is one edit away from producing broken SQL.
    await sql.query(template.replace("%VALUES%", () => values), group.flat());
  }
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
