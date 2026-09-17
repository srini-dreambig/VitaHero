// What "delete my child's data" has to reach.
//
// Erasure is a list of tables written by hand, and the schema is written
// somewhere else. Nothing made the two agree, and they did not: the list named
// twelve tables keyed on a child, the schema had fifteen, and the three it
// missed included finding_photos — the photographs of that child's clinical
// findings, bytes and all. A guardian asked for their child's data to be
// erased and the pictures stayed.
//
// So this does not check the list. It builds the real schema, asks Postgres
// which tables hold a child or a guardian, and fails naming any that erasure
// does not reach. A table added next year is covered by that without anyone
// remembering this file exists.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import pg from "pg";
import type { Sql } from "./common";
import { serialQuery } from "./pgserial";
import { ensureStageASchema } from "./schools";
import { ensureCampSchema } from "./camps";
import { ensureReferralSchema } from "./referrals";
import { ensureLifecycleSchema } from "./lifecycle";
import { ensureMediaSchema } from "./media";
import { ensureMessageSchema } from "./messages";
import { ensureOversightSchema } from "./oversight";
import { readFileSync } from "node:fs";

const DB = process.env.TEST_DATABASE_URL;
const suite = DB ? describe : describe.skip;
function dbUrl(base: string, name: string) {
  const u = new globalThis.URL(base); u.pathname = "/" + name; return u.toString();
}

const SRC = (f: string) =>
  readFileSync(new globalThis.URL("./" + f, import.meta.url), "utf8");

/**
 * Tables erasure deliberately leaves alone, each with the reason.
 *
 * A new name may only be added here with one, because the default has to be
 * "this is a child's data and it goes".
 */
const KEPT_ON_PURPOSE: Record<string, string> = {
  record_access:
    "the log of who looked at the record — erasing it destroys the trail " +
    "rather than the data, and it holds nothing but an id that stops resolving",
  data_rights_log:
    "the evidence that the erasure was asked for and carried out",
};

let client: pg.Client;

async function legacySchema(s: Sql) {
  await s`CREATE SCHEMA IF NOT EXISTS vita_hero`;
  await s`CREATE TABLE IF NOT EXISTS vita_hero.profiles (
    id TEXT PRIMARY KEY, user_id TEXT, phone TEXT, name TEXT NOT NULL DEFAULT '', email TEXT,
    session_token TEXT, auth_provider TEXT, onboarding_complete BOOLEAN DEFAULT false,
    is_logged_in BOOLEAN DEFAULT false, role TEXT DEFAULT 'PARENT',
    provisioned BOOLEAN DEFAULT false, school_id TEXT,
    locale_code TEXT DEFAULT 'en', family_code TEXT DEFAULT '', dark_theme BOOLEAN DEFAULT false,
    notifications_enabled BOOLEAN DEFAULT true, camp_reminders_enabled BOOLEAN DEFAULT true,
    consent_accepted BOOLEAN DEFAULT false, consent_declined BOOLEAN DEFAULT false)`;
  await s`CREATE TABLE IF NOT EXISTS vita_hero.kids (
    id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, user_id TEXT, name TEXT NOT NULL,
    age INT DEFAULT 0, gender TEXT DEFAULT '', school TEXT DEFAULT '', grade TEXT DEFAULT '',
    height_cm DOUBLE PRECISION DEFAULT 0, weight_kg DOUBLE PRECISION DEFAULT 0,
    overall_score INT DEFAULT 80, dental TEXT DEFAULT 'GOOD', eyesight TEXT DEFAULT 'GOOD',
    nutrition TEXT DEFAULT 'GOOD', last_checkup TEXT DEFAULT 'Not yet',
    student_ref TEXT, source TEXT DEFAULT 'PARENT')`;
  await s`CREATE UNIQUE INDEX IF NOT EXISTS kids_profile_studentref
    ON vita_hero.kids(profile_id, student_ref) WHERE student_ref IS NOT NULL`;
  await s`CREATE TABLE IF NOT EXISTS vita_hero.schools (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, city TEXT DEFAULT 'Hyderabad', district TEXT DEFAULT '',
    partner_code TEXT NOT NULL UNIQUE, contact_email TEXT DEFAULT '', description TEXT DEFAULT '',
    active BOOLEAN DEFAULT true)`;
  await s`CREATE TABLE IF NOT EXISTS vita_hero.school_camps (
    id TEXT PRIMARY KEY, school_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT DEFAULT '',
    date TEXT NOT NULL, time TEXT DEFAULT '', status TEXT DEFAULT 'UPCOMING',
    checks JSONB DEFAULT '[]'::jsonb, grades JSONB DEFAULT '[]'::jsonb, capacity INT DEFAULT 200,
    registered_count INT DEFAULT 0, result_summary TEXT, active BOOLEAN DEFAULT true)`;
  await s`CREATE TABLE IF NOT EXISTS vita_hero.school_enrollments (
    id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, school_id TEXT NOT NULL, kid_id TEXT,
    status TEXT DEFAULT 'ACTIVE', enrolled_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE (profile_id, school_id))`;
  await s`CREATE TABLE IF NOT EXISTS vita_hero.camp_registrations (
    id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, school_camp_id TEXT NOT NULL, kid_id TEXT NOT NULL,
    registered_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE (profile_id, school_camp_id, kid_id))`;
  await s`CREATE TABLE IF NOT EXISTS vita_hero.camp_kid_results (
    id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, school_camp_id TEXT NOT NULL, kid_id TEXT NOT NULL,
    dental TEXT DEFAULT 'GOOD', eyesight TEXT DEFAULT 'GOOD', nutrition TEXT DEFAULT 'GOOD',
    height_cm DOUBLE PRECISION, weight_kg DOUBLE PRECISION, recorded_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (school_camp_id, kid_id))`;
  await s`CREATE TABLE IF NOT EXISTS vita_hero.appointments (
    id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, user_id TEXT, doctor_name TEXT NOT NULL,
    doctor_id TEXT, specialty TEXT DEFAULT '', kid_name TEXT DEFAULT '', date TEXT NOT NULL, time TEXT NOT NULL)`;
  await s`CREATE TABLE IF NOT EXISTS vita_hero.meal_items (
    id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, user_id TEXT, kid_id TEXT NOT NULL,
    time_slot TEXT DEFAULT '', name TEXT NOT NULL, detail TEXT DEFAULT '', kcal INT DEFAULT 0,
    eaten BOOLEAN DEFAULT false)`;
  await s`CREATE TABLE IF NOT EXISTS vita_hero.streaks (
    kid_id TEXT PRIMARY KEY, user_id TEXT, current_streak INT DEFAULT 0, best_streak INT DEFAULT 0,
    last_log_date TEXT DEFAULT '')`;
  await s`CREATE TABLE IF NOT EXISTS vita_hero.ai_diet_tips (
    kid_id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, content JSONB NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT NOW())`;
  await s`CREATE TABLE IF NOT EXISTS vita_hero.co_parents (
    id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, user_id TEXT, name TEXT NOT NULL,
    relation TEXT DEFAULT '', joined_date TEXT DEFAULT '')`;
  await s`CREATE TABLE IF NOT EXISTS vita_hero.growth_points (
    id TEXT PRIMARY KEY, kid_id TEXT NOT NULL, user_id TEXT, label TEXT DEFAULT '',
    height DOUBLE PRECISION DEFAULT 0, weight DOUBLE PRECISION DEFAULT 0,
    recorded_at TIMESTAMPTZ DEFAULT NOW())`;
}
suite("erasure reaches every table that holds a child", () => {
  beforeAll(async () => {
    if (!DB) return;
    const admin = new pg.Client({ connectionString: DB });
    await admin.connect();
    await admin.query("DROP DATABASE IF EXISTS vh_erasure");
    await admin.query("CREATE DATABASE vh_erasure");
    await admin.end();
    client = new pg.Client({ connectionString: dbUrl(DB, "vh_erasure") });
    await client.connect();
    const send = serialQuery(client);
    const fn: any = (strings: TemplateStringsArray, ...v: unknown[]) => {
      let t = ""; const p: unknown[] = [];
      for (let i = 0; i < strings.length; i++) {
        t += strings[i];
        if (i < v.length) { p.push(v[i]); t += "$" + p.length; }
      }
      return send(t, p);
    };
    fn.query = (t: string, p: unknown[] = []) => send(t, p);
    const sql = fn as Sql;
    await legacySchema(sql);
    await ensureStageASchema(sql);
    await ensureCampSchema(sql);
    await ensureReferralSchema(sql);
    await ensureLifecycleSchema(sql);
    await ensureMediaSchema(sql);
    await ensureMessageSchema(sql);
    await ensureOversightSchema(sql);
  }, 180_000);

  afterAll(async () => { if (client) await client.end(); });

  async function tablesWith(column: string): Promise<string[]> {
    const rows = await client.query(
      `SELECT table_name FROM information_schema.columns
       WHERE table_schema = 'vita_hero' AND column_name = $1
       ORDER BY table_name`, [column]);
    return rows.rows.map((r) => r.table_name as string);
  }

  test("deleting a child empties every table keyed on one", async () => {
    const lifecycle = SRC("lifecycle.ts");
    const fn = lifecycle.slice(lifecycle.indexOf("export async function deleteChild("));
    const reached = new Set([
      ...[...fn.matchAll(/DELETE FROM vita_hero\.(\w+)\s+WHERE kid_id/g)].map((m) => m[1]),
      // question_messages is reached through its thread, not by kid_id.
      ...[...fn.matchAll(/DELETE FROM vita_hero\.(\w+)\s*\n\s*WHERE thread_id/g)].map((m) => m[1]),
      "kids",
    ]);
    const missing = (await tablesWith("kid_id"))
      .filter((t) => !reached.has(t) && !(t in KEPT_ON_PURPOSE))
      .sort();
    expect(missing).toEqual([]);
  });

  test("deleting an account empties every table keyed on a guardian", async () => {
    const lifecycle = SRC("lifecycle.ts");
    const account = lifecycle.slice(lifecycle.indexOf("export async function deleteAccount("));
    const child = lifecycle.slice(
      lifecycle.indexOf("export async function deleteChild("),
      lifecycle.indexOf("export async function deleteAccount("));
    // deleteAccount runs deleteChild for every child first, so what that
    // reaches counts here too.
    const reached = new Set([
      ...[...account.matchAll(/DELETE FROM vita_hero\.(\w+) WHERE profile_id/g)].map((m) => m[1]),
      ...[...child.matchAll(/DELETE FROM vita_hero\.(\w+)\s+WHERE kid_id/g)].map((m) => m[1]),
      ...[...child.matchAll(/DELETE FROM vita_hero\.(\w+)\s*\n\s*WHERE thread_id/g)].map((m) => m[1]),
      "kids", "profiles", "sessions",
    ]);
    const missing = (await tablesWith("profile_id"))
      .filter((t) => !reached.has(t) && !(t in KEPT_ON_PURPOSE))
      .sort();
    expect(missing).toEqual([]);
  });

  test("merging two guardians carries every table keyed on one", async () => {
    const list = (SRC("lifecycle.ts").match(/TABLES_WITH_PROFILE_ID = \[([\s\S]*?)\];/) || ["", ""])[1]
      .replace(/\/\/[^\n]*/g, "")
      .split(",").map((x) => x.trim().replace(/"/g, ""))
      .filter(Boolean);
    const missing = (await tablesWith("profile_id"))
      .filter((t) => !list.includes(t) && t !== "profiles" && !(t in KEPT_ON_PURPOSE))
      .sort();
    // A guardian who merges two accounts must not lose what the old one held.
    expect(missing).toEqual([]);
  });

  test("what erasure keeps, it keeps for a stated reason", () => {
    for (const [table, reason] of Object.entries(KEPT_ON_PURPOSE)) {
      expect(reason.length).toBeGreaterThan(30);
      expect(table).not.toBe("");
    }
  });
});
