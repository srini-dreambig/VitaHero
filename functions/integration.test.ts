// Integration tests for Stage A against a real Postgres.
//
// The unit tests stub the database, which proves the routing and the validator
// but says nothing about whether the SQL is correct. These run the actual DDL
// and the actual upserts, so they catch the things that only a real server
// complains about: a bad ON CONFLICT target, a unique index that does not do
// what the idempotency story claims, a column referenced before it exists.
//
// Skipped automatically unless TEST_DATABASE_URL points at a throwaway database.
//   /usr/lib/postgresql/16/bin/initdb -D pgdata -U postgres --auth=trust
//   /usr/lib/postgresql/16/bin/pg_ctl -D pgdata -o '-p 55432 -k /tmp' start
//   TEST_DATABASE_URL=postgres://postgres@localhost:55432/postgres bun test integration

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import pg from "pg";
import type { Sql } from "./common";
import {
  ensureStageASchema,
  createSchool,
  getSchool,
  listSchools,
  setClasses,
  listClasses,
  addSchoolAdmin,
  listSchoolAdmins,
  removeSchoolAdmin,
  type Actor,
} from "./schools";
import { validateRoster, commitRoster, listRoster, listRosterBatches } from "./roster";

const URL = process.env.TEST_DATABASE_URL;

/** Swap the database name in a connection string. */
function URL2(base: string, db: string): string {
  const u = new globalThis.URL(base);
  u.pathname = "/" + db;
  return u.toString();
}
const suite = URL ? describe : describe.skip;

let client: pg.Client;
let sql: Sql;

/** Adapts node-postgres to the neon tagged-template interface the code expects. */
function neonShim(c: pg.Client): Sql {
  const quoteIdent = (s: string) => '"' + s.replace(/"/g, '""') + '"';
  const fn: any = (strings: TemplateStringsArray | string, ...values: unknown[]) => {
    // The real @neondatabase/serverless v1 driver REJECTS this call. A test
    // double that accepted it is why 248 green tests coexisted with a worker
    // that died on its very first statement: every `${sql(SCHEMA)}` threw
    // "can now be called only as a tagged-template function", the catch around
    // schema init turned it into a generic message, and no test could see it
    // because no test ran the real driver. Fail here the way production does.
    if (typeof strings === "string") {
      throw new Error(
        "sql(identifier) is not supported by the Neon driver \u2014 " +
        "use a literal schema name in the template instead"
      );
    }
    let text = "";
    const params: unknown[] = [];
    for (let i = 0; i < strings.length; i++) {
      text += strings[i];
      if (i < values.length) {
        const v = values[i] as { __ident?: string };
        if (v && typeof v === "object" && v.__ident) text += quoteIdent(v.__ident);
        else { params.push(values[i]); text += "$" + params.length; }
      }
    }
    return c.query(text, params).then((r) => r.rows);
  };
  fn.query = (text: string, params: unknown[]) => c.query(text, params).then((r) => r.rows);
  return fn as Sql;
}

const OPS: Actor = { profileId: "ph_9000000001", name: "Ops", role: "SUPERADMIN", schoolId: null };

/** The minimum of the legacy schema that Stage A builds on top of. */
async function baseSchema(s: Sql) {
  await s`CREATE SCHEMA IF NOT EXISTS vita_hero`;
  await s`
    CREATE TABLE IF NOT EXISTS vita_hero.profiles (
      id TEXT PRIMARY KEY, user_id TEXT, phone TEXT, name TEXT NOT NULL DEFAULT '',
      email TEXT, session_token TEXT, auth_provider TEXT,
      onboarding_complete BOOLEAN DEFAULT false, is_logged_in BOOLEAN DEFAULT false,
      role TEXT DEFAULT 'PARENT', provisioned BOOLEAN DEFAULT false, school_id TEXT
    )`;
  await s`
    CREATE TABLE IF NOT EXISTS vita_hero.kids (
      id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, user_id TEXT, name TEXT NOT NULL,
      age INT DEFAULT 0, gender TEXT DEFAULT '', school TEXT DEFAULT '', grade TEXT DEFAULT '',
      height_cm DOUBLE PRECISION DEFAULT 0, weight_kg DOUBLE PRECISION DEFAULT 0,
      student_ref TEXT, source TEXT DEFAULT 'PARENT'
    )`;
  await s`
    CREATE UNIQUE INDEX IF NOT EXISTS kids_profile_studentref
    ON vita_hero.kids(profile_id, student_ref) WHERE student_ref IS NOT NULL`;
  await s`
    CREATE TABLE IF NOT EXISTS vita_hero.schools (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, city TEXT DEFAULT 'Hyderabad',
      district TEXT DEFAULT '', partner_code TEXT NOT NULL UNIQUE,
      contact_email TEXT DEFAULT '', description TEXT DEFAULT '', active BOOLEAN DEFAULT true
    )`;
  // Roster commit enrols each guardian with the school so the parent app can
  // surface that school's camps to them.
  await s`
    CREATE TABLE IF NOT EXISTS vita_hero.school_enrollments (
      id TEXT PRIMARY KEY, profile_id TEXT NOT NULL, school_id TEXT NOT NULL, kid_id TEXT,
      status TEXT DEFAULT 'ACTIVE', enrolled_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (profile_id, school_id)
    )`;
}

beforeAll(async () => {
  if (!URL) return;
  // Its own database, so the integration suites never race each other.
  const admin = new pg.Client({ connectionString: URL });
  await admin.connect();
  await admin.query("DROP DATABASE IF EXISTS vh_test_stage_a");
  await admin.query("CREATE DATABASE vh_test_stage_a");
  await admin.end();
  client = new pg.Client({ connectionString: URL2(URL, "vh_test_stage_a") });
  await client.connect();
  sql = neonShim(client);
  await client.query("DROP SCHEMA IF EXISTS vita_hero CASCADE");
  await baseSchema(sql);
  await ensureStageASchema(sql);
});

afterAll(async () => { if (client) await client.end(); });

const roster = (n: number, start = 0) =>
  Array.from({ length: n }, (_, i) => ({
    "Admission No": "2026/" + (1000 + start + i),
    "Student Name": "Student " + (start + i),
    "Date of Birth": "14/03/2016",
    Gender: i % 2 ? "F" : "M",
    Class: "Class 4",
    Section: "B",
    "Guardian Name": "Guardian " + (start + i),
    "Guardian Phone": String(9800000000 + start + i),
  }));

suite("Stage A against real Postgres", () => {
  let schoolId = "";

  test("the migration is idempotent", async () => {
    await ensureStageASchema(sql);
    await ensureStageASchema(sql);
    const cols = await client.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema='vita_hero' AND table_name='schools'"
    );
    const names = cols.rows.map((r) => r.column_name);
    for (const c of ["academic_year", "checks_offered", "camp_cadence", "status", "onboarded_at"]) {
      expect(names).toContain(c);
    }
  });

  test("creates a school with a unique partner code", async () => {
    const r = await createSchool(sql, OPS, {
      name: "oakridge international", city: "Hyderabad",
      checksOffered: ["Vision", "Dental"], campCadence: "BIANNUAL",
      academicYear: "2026-27", contactPhone: "9876500000",
    });
    schoolId = r.school.id;
    expect(r.school.name).toBe("Oakridge International");
    expect(r.school.partnerCode).toMatch(/^OAKR/);
    expect(r.school.checksOffered).toEqual(["Vision", "Dental"]);
    expect(r.school.campCadence).toBe("BIANNUAL");
    expect(r.school.contactPhone).toBe("+919876500000");
  });

  test("lists the school with live counts", async () => {
    const r = await listSchools(sql, OPS);
    expect(r.schools.length).toBe(1);
    expect(r.schools[0].studentCount).toBe(0);
  });

  test("sets a grid of classes and sections", async () => {
    const r = await setClasses(sql, OPS, schoolId, {
      academicYear: "2026-27", grades: ["Class 4", "Class 5"], sections: ["A", "B"],
    });
    expect(r.classes.length).toBe(4);
    // Natural ordering, so Class 4 A comes before Class 5 A.
    expect(r.classes[0].grade).toBe("Class 4");
    expect(r.classes[0].section).toBe("A");
  });

  test("re-setting the same classes is a no-op, not a duplicate", async () => {
    await setClasses(sql, OPS, schoolId, {
      academicYear: "2026-27", grades: ["Class 4", "Class 5"], sections: ["A", "B"],
    });
    const r = await listClasses(sql, OPS, schoolId, "2026-27");
    expect(r.classes.length).toBe(4);
  });

  test("validate writes nothing", async () => {
    const before = await client.query("SELECT COUNT(*)::int AS n FROM vita_hero.kids");
    const rep = await validateRoster(sql, OPS, schoolId, { rows: roster(5), filename: "t.csv" });
    expect(rep.create).toBe(5);
    expect(rep.errors).toBe(0);
    const after = await client.query("SELECT COUNT(*)::int AS n FROM vita_hero.kids");
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });

  test("commit creates students and guardian profiles", async () => {
    const rep = await commitRoster(sql, OPS, schoolId, { rows: roster(5), filename: "term1.csv" });
    expect(rep.create).toBe(5);
    expect(rep.batchId).toMatch(/^rb_/);

    const kids = await client.query("SELECT * FROM vita_hero.kids ORDER BY name");
    expect(kids.rowCount).toBe(5);
    expect(kids.rows[0].source).toBe("ADMIN");
    expect(kids.rows[0].school_id).toBe(schoolId);
    expect(kids.rows[0].academic_year).toBe("2026-27");
    expect(kids.rows[0].date_of_birth).toBe("2016-03-14");
    expect(kids.rows[0].school).toBe("Oakridge International");

    const parents = await client.query("SELECT * FROM vita_hero.profiles WHERE role='PARENT'");
    expect(parents.rowCount).toBe(5);
    expect(parents.rows[0].provisioned).toBe(true);
  });

  test("re-uploading the same file changes nothing (A8 idempotency)", async () => {
    const rep = await commitRoster(sql, OPS, schoolId, { rows: roster(5), filename: "term1-again.csv" });
    expect(rep.create).toBe(0);
    expect(rep.unchanged).toBe(5);
    const kids = await client.query("SELECT COUNT(*)::int AS n FROM vita_hero.kids");
    expect(kids.rows[0].n).toBe(5);
  });

  test("a renamed student updates in place rather than duplicating", async () => {
    const rows = roster(5);
    rows[0]["Student Name"] = "Student Zero Renamed";
    const rep = await commitRoster(sql, OPS, schoolId, { rows, filename: "rename.csv" });
    expect(rep.update).toBe(1);
    expect(rep.unchanged).toBe(4);
    const kids = await client.query("SELECT COUNT(*)::int AS n FROM vita_hero.kids");
    expect(kids.rows[0].n).toBe(5);
    const renamed = await client.query(
      "SELECT name FROM vita_hero.kids WHERE student_ref = 'sid_2026-1000'"
    );
    expect(renamed.rows[0].name).toBe("Student Zero Renamed");
  });

  test("the guardian upsert never demotes an administrator who shares a number", async () => {
    // Make one guardian an admin, then re-import: the role must survive.
    await client.query(
      "UPDATE vita_hero.profiles SET role='SCHOOL_ADMIN', name='Real Admin' WHERE id=$1",
      ["ph_9800000000"]
    );
    await commitRoster(sql, OPS, schoolId, { rows: roster(5), filename: "again.csv" });
    const r = await client.query("SELECT role, name FROM vita_hero.profiles WHERE id=$1", ["ph_9800000000"]);
    expect(r.rows[0].role).toBe("SCHOOL_ADMIN");
    expect(r.rows[0].name).toBe("Real Admin");
    await client.query("UPDATE vita_hero.profiles SET role='PARENT' WHERE id=$1", ["ph_9800000000"]);
  });

  test("a large roster commits in batches and stays correct", async () => {
    const rep = await commitRoster(sql, OPS, schoolId, { rows: roster(250, 100), filename: "big.csv" });
    expect(rep.create).toBe(250);
    const kids = await client.query("SELECT COUNT(*)::int AS n FROM vita_hero.kids");
    expect(kids.rows[0].n).toBe(255);
    const parents = await client.query("SELECT COUNT(*)::int AS n FROM vita_hero.profiles WHERE role='PARENT'");
    expect(parents.rows[0].n).toBe(255);
  });

  test("bad rows are skipped and good ones still land", async () => {
    const rows = roster(3, 900);
    rows[1]["Guardian Phone"] = "";
    const rep = await commitRoster(sql, OPS, schoolId, { rows, allowPartial: true, filename: "partial.csv" });
    expect(rep.create).toBe(2);
    expect(rep.errors).toBe(1);
  });

  test("commit refuses a file with errors unless allowPartial is set", async () => {
    const rows = roster(2, 800);
    rows[0]["Date of Birth"] = "rubbish";
    await expect(
      commitRoster(sql, OPS, schoolId, { rows, filename: "bad.csv" })
    ).rejects.toThrow(/could not be read/);
  });

  test("the roster reads back with guardians attached", async () => {
    const r = await listRoster(sql, OPS, schoolId, "2026-27", "", 10, 0);
    expect(r.total).toBe(257);
    expect(r.students.length).toBe(10);
    expect(r.students[0].guardianPhone).toMatch(/^\+91/);
    expect(r.students[0].grade).toBe("Class 4");
  });

  test("roster search matches name, reference and guardian", async () => {
    // Deliberately not searching for the renamed student: a later import in
    // this suite reverts that name, and the search behaviour is what is under
    // test here, not the ordering of the fixtures.
    const byName = await listRoster(sql, OPS, schoolId, "", "student 1", 500, 0);
    expect(byName.students.length).toBeGreaterThan(0);
    expect(byName.students.every((s) => /student 1/i.test(s.name))).toBe(true);

    const byRef = await listRoster(sql, OPS, schoolId, "", "2026-1001", 10, 0);
    expect(byRef.students.length).toBe(1);
    expect(byRef.students[0].studentRef).toBe("sid_2026-1001");

    const byGuardian = await listRoster(sql, OPS, schoolId, "", "9800000002", 10, 0);
    expect(byGuardian.students.length).toBe(1);
    expect(byGuardian.students[0].guardianPhone).toBe("+919800000002");

    const noMatch = await listRoster(sql, OPS, schoolId, "", "zzzznotpresent", 10, 0);
    expect(noMatch.students.length).toBe(0);
  });

  test("class counts reflect the imported roster", async () => {
    const r = await listClasses(sql, OPS, schoolId, "2026-27");
    const c4b = r.classes.find((c) => c.grade === "Class 4" && c.section === "B");
    expect(c4b!.studentCount).toBe(257);
  });

  test("a class still holding students is not deleted", async () => {
    const r = await setClasses(sql, OPS, schoolId, {
      academicYear: "2026-27", grades: ["Class 9"], sections: ["A"],
    });
    expect(r.keptBecauseInUse).toContain("Class 4 B");
    const after = await listClasses(sql, OPS, schoolId, "2026-27");
    expect(after.classes.some((c) => c.grade === "Class 4" && c.section === "B")).toBe(true);
  });

  test("every upload is recorded in the audit trail", async () => {
    const r = await listRosterBatches(sql, OPS, schoolId);
    expect(r.batches.length).toBeGreaterThanOrEqual(6);
    expect(r.batches[0].filename).toBeDefined();
    expect(r.batches.some((b) => b.filename === "term1.csv")).toBe(true);
  });

  test("adds, lists and revokes a school administrator", async () => {
    const added = await addSchoolAdmin(sql, OPS, schoolId, { name: "meera rao", phone: "9123456789" });
    expect(added.admin.phone).toBe("+919123456789");

    const list = await listSchoolAdmins(sql, OPS, schoolId);
    expect(list.admins.length).toBe(1);
    expect(list.admins[0].name).toBe("Meera Rao");
    expect(list.admins[0].hasSignedIn).toBe(false);

    await removeSchoolAdmin(sql, OPS, schoolId, added.admin.profileId);
    const after = await listSchoolAdmins(sql, OPS, schoolId);
    expect(after.admins.length).toBe(0);

    const row = await client.query("SELECT role, school_id FROM vita_hero.profiles WHERE id=$1", [
      added.admin.profileId,
    ]);
    expect(row.rows[0].role).toBe("REVOKED");
    expect(row.rows[0].school_id).toBeNull();
  });

  test("refuses to make an existing parent into an administrator", async () => {
    await expect(
      addSchoolAdmin(sql, OPS, schoolId, { name: "Someone", phone: "9800000001" })
    ).rejects.toThrow(/already registered as a parent/);
  });

  test("a school admin scoped elsewhere cannot read this school", async () => {
    const other: Actor = {
      profileId: "ph_1", name: "Other", role: "SCHOOL_ADMIN", schoolId: "sch_somewhere_else",
    };
    await expect(getSchool(sql, other, schoolId)).rejects.toThrow(/do not have access/);
  });
});
