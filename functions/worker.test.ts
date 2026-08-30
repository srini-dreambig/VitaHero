// End-to-end tests for the Stage A routes, against a stubbed Neon driver.
//
// These exercise routing, authorisation and the roster validator through the
// real worker entrypoint. What they deliberately do not test is SQL semantics —
// the stub returns canned rows. Run with: bun test

import { describe, expect, test, mock, beforeEach } from "bun:test";

// ── stub the Neon driver before the worker imports it ──
interface Handler { match: RegExp; rows: Record<string, unknown>[] }

let handlers: Handler[] = [];
let calls: { text: string; params: unknown[] }[] = [];

function run(text: string, params: unknown[]) {
  calls.push({ text, params });
  for (const h of handlers) if (h.match.test(text)) return Promise.resolve(h.rows);
  return Promise.resolve([] as Record<string, unknown>[]);
}

function makeSql() {
  const sql: any = (strings: TemplateStringsArray | string, ...values: unknown[]) => {
    if (typeof strings === "string") return { identifier: strings }; // sql(SCHEMA)
    return run(strings.join(" ? "), values);
  };
  sql.query = (text: string, params: unknown[]) => run(text, params);
  return sql;
}

mock.module("@neondatabase/serverless", () => ({ neon: () => makeSql() }));

const { default: worker } = await import("./index");

const ENV = {
  DATABASE_URL: "postgres://stub",
  TWILIO_ACCOUNT_SID: "",
  TWILIO_AUTH_TOKEN: "",
  ADMIN_API_KEY: "test-admin-key",
};

function req(path: string, init: RequestInit = {}) {
  return new Request("https://api.test" + path, init);
}
function call(path: string, init: RequestInit = {}) {
  return worker.fetch(req(path, init), ENV as never);
}
const opsHeaders = { "X-Admin-Key": "test-admin-key", "Content-Type": "application/json" };

beforeEach(() => {
  handlers = [];
  calls = [];
});

// ── portal ──
describe("the portal", () => {
  test("is served as HTML at /admin", async () => {
    const r = await call("/admin");
    expect(r.status).toBe(200);
    expect(r.headers.get("Content-Type")).toContain("text/html");
    const body = await r.text();
    expect(body).toContain("School administration");
    expect(body).toContain("<script>");
  });

  test("does not require a sign-in to load the page itself", async () => {
    expect((await call("/admin/")).status).toBe(200);
  });
});

// ── authorisation ──
describe("admin authorisation", () => {
  test("refuses an anonymous caller", async () => {
    const r = await call("/api/admin/schools");
    expect(r.status).toBe(401);
    expect((await r.json()).code).toBe("ADMIN_REQUIRED");
  });

  test("refuses a wrong API key", async () => {
    const r = await call("/api/admin/schools", { headers: { "X-Admin-Key": "nope" } });
    expect(r.status).toBe(401);
  });

  test("accepts the bootstrap API key", async () => {
    const r = await call("/api/admin/schools", { headers: opsHeaders });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ schools: [] });
  });

  test("refuses a parent's session token", async () => {
    handlers = [{
      match: /session_token/,
      rows: [{ id: "ph_9876543210", user_id: "ph_9876543210", name: "Priya", role: "PARENT", school_id: null }],
    }];
    const r = await call("/api/admin/schools", {
      headers: { Authorization: "Bearer " + "t".repeat(40) },
    });
    expect(r.status).toBe(401);
  });

  test("refuses a revoked administrator", async () => {
    handlers = [{
      match: /session_token/,
      rows: [{ id: "ph_1", user_id: "ph_1", name: "Old Admin", role: "REVOKED", school_id: null }],
    }];
    expect((await call("/api/admin/schools", {
      headers: { Authorization: "Bearer " + "t".repeat(40) },
    })).status).toBe(401);
  });
});

// ── school scoping ──
describe("school scoping", () => {
  const schoolAdminSession = (schoolId: string) => ({
    match: /session_token/,
    rows: [{ id: "ph_5", user_id: "ph_5", name: "Meera", role: "SCHOOL_ADMIN", school_id: schoolId }],
  });
  const bearer = { Authorization: "Bearer " + "t".repeat(40), "Content-Type": "application/json" };

  test("a school admin can read their own school", async () => {
    handlers = [
      schoolAdminSession("sch_oak"),
      { match: /FROM vita_hero\.schools s WHERE s\.id/, rows: [{ id: "sch_oak", name: "Oakridge", checks_offered: [] }] },
    ];
    const r = await call("/api/admin/schools/sch_oak", { headers: bearer });
    expect(r.status).toBe(200);
    expect((await r.json()).school.id).toBe("sch_oak");
  });

  test("a school admin cannot read another school", async () => {
    handlers = [schoolAdminSession("sch_oak")];
    const r = await call("/api/admin/schools/sch_other", { headers: bearer });
    expect(r.status).toBe(403);
    expect((await r.json()).code).toBe("SCHOOL_FORBIDDEN");
  });

  test("a school admin cannot create a school", async () => {
    handlers = [schoolAdminSession("sch_oak")];
    const r = await call("/api/admin/schools", {
      method: "POST", headers: bearer, body: JSON.stringify({ name: "New School" }),
    });
    expect(r.status).toBe(403);
    expect((await r.json()).code).toBe("OPS_REQUIRED");
  });

  test("a school admin cannot upload a roster to another school", async () => {
    handlers = [schoolAdminSession("sch_oak")];
    const r = await call("/api/admin/schools/sch_other/roster/validate", {
      method: "POST", headers: bearer, body: JSON.stringify({ rows: [{ name: "x" }] }),
    });
    expect(r.status).toBe(403);
  });
});

// ── school creation ──
describe("creating a school", () => {
  test("rejects a missing name", async () => {
    const r = await call("/api/admin/schools", {
      method: "POST", headers: opsHeaders, body: JSON.stringify({ city: "Hyderabad" }),
    });
    expect(r.status).toBe(400);
    expect((await r.json()).code).toBe("NAME_REQUIRED");
  });

  test("rejects an unknown camp cadence", async () => {
    const r = await call("/api/admin/schools", {
      method: "POST", headers: opsHeaders,
      body: JSON.stringify({ name: "Oakridge International", campCadence: "WEEKLY" }),
    });
    expect(r.status).toBe(400);
    expect((await r.json()).code).toBe("BAD_CADENCE");
  });

  test("rejects an unreadable contact phone", async () => {
    const r = await call("/api/admin/schools", {
      method: "POST", headers: opsHeaders,
      body: JSON.stringify({ name: "Oakridge International", contactPhone: "12" }),
    });
    expect(r.status).toBe(400);
    expect((await r.json()).code).toBe("BAD_PHONE");
  });

  test("issues a partner code and stores the programme config", async () => {
    handlers = [{ match: /FROM vita_hero\.schools s WHERE s\.id/, rows: [{ id: "x", name: "Oakridge International", checks_offered: ["Vision"] }] }];
    const r = await call("/api/admin/schools", {
      method: "POST", headers: opsHeaders,
      body: JSON.stringify({
        name: "oakridge international", city: "Hyderabad",
        checksOffered: ["Vision", "Dental", "Nonsense"], campCadence: "BIANNUAL",
      }),
    });
    expect(r.status).toBe(201);
    const insert = calls.find((c) => /INSERT INTO vita_hero\.schools/.test(c.text));
    expect(insert).toBeDefined();
    // Name is tidied, unknown check types are dropped, cadence is kept.
    expect(insert!.params).toContain("Oakridge International");
    expect(insert!.params).toContain("BIANNUAL");
    expect(insert!.params).toContain(JSON.stringify(["Vision", "Dental"]));
    const code = insert!.params.find((p) => typeof p === "string" && /^OAKR[A-Z0-9]{4}$/.test(p));
    expect(code).toBeDefined();
  });
});

// ── roster validation ──
describe("roster validation", () => {
  const school = { match: /SELECT id, name, academic_year FROM vita_hero\.schools/, rows: [{ id: "sch_oak", name: "Oakridge", academic_year: "2026-27" }] };
  const classes = { match: /FROM vita_hero\.school_classes/, rows: [{ grade: "Class 4", section: "B" }, { grade: "Class 5", section: "A" }] };

  function validate(rows: Record<string, unknown>[], extra: Handler[] = []) {
    handlers = [school, classes, ...extra];
    return call("/api/admin/schools/sch_oak/roster/validate", {
      method: "POST", headers: opsHeaders, body: JSON.stringify({ rows, filename: "roster.csv" }),
    }).then((r) => r.json());
  }

  const good = {
    "Admission No": "2026/0412", "Student Name": "rahul sharma", "Date of Birth": "14/03/2016",
    Gender: "M", Class: "Class 4", Section: "B",
    "Guardian Name": "priya sharma", "Guardian Phone": "9876543210",
  };

  test("a clean row is classified as a create with no issues", async () => {
    const rep = await validate([good]);
    expect(rep.total).toBe(1);
    expect(rep.create).toBe(1);
    expect(rep.errors).toBe(0);
    expect(rep.warnings).toBe(0);
    expect(rep.rows[0].studentName).toBe("Rahul Sharma");
    expect(rep.rows[0].guardianName).toBe("Priya Sharma");
    expect(rep.rows[0].gender).toBe("Male");
    expect(rep.rows[0].dob).toBe("2016-03-14");
    expect(rep.rows[0].phone).toBe("+919876543210");
  });

  test("never writes anything during validation", async () => {
    await validate([good]);
    expect(calls.some((c) => /^\s*INSERT|^\s*UPDATE|^\s*DELETE/i.test(c.text))).toBe(false);
  });

  test("a missing phone blocks the row", async () => {
    const rep = await validate([{ ...good, "Guardian Phone": "" }]);
    expect(rep.errors).toBe(1);
    expect(rep.rows[0].action).toBe("skip");
    expect(rep.rows[0].issues[0].field).toBe("phone");
  });

  test("an unreadable date of birth blocks the row", async () => {
    const rep = await validate([{ ...good, "Date of Birth": "sometime in 2016" }]);
    expect(rep.rows[0].issues.some((i: { message: string }) => /not a date we can read/.test(i.message))).toBe(true);
    expect(rep.rows[0].action).toBe("skip");
  });

  test("an impossible date is rejected rather than rolled forward", async () => {
    const rep = await validate([{ ...good, "Date of Birth": "31/02/2016" }]);
    expect(rep.rows[0].action).toBe("skip");
  });

  test("an out-of-range age blocks the row", async () => {
    const rep = await validate([{ ...good, "Date of Birth": "14/03/1980" }]);
    expect(rep.rows[0].issues.some((i: { message: string }) => /outside the 2-21 range/.test(i.message))).toBe(true);
  });

  test("an ambiguous date warns but still imports", async () => {
    const rep = await validate([{ ...good, "Date of Birth": "03/04/2016" }]);
    expect(rep.errors).toBe(0);
    expect(rep.create).toBe(1);
    expect(rep.rows[0].issues.some((i: { message: string }) => /day\/month order assumed/.test(i.message))).toBe(true);
  });

  test("a duplicate student reference in the same file blocks the second row", async () => {
    const rep = await validate([good, { ...good, "Student Name": "Rahul S" }]);
    expect(rep.create).toBe(1);
    expect(rep.rows[1].action).toBe("skip");
    expect(rep.rows[1].issues.some((i: { message: string }) => /Duplicate of row 1/.test(i.message))).toBe(true);
  });

  test("a class the school has not configured is a warning, not a block", async () => {
    const rep = await validate([{ ...good, Class: "Class 9" }]);
    expect(rep.errors).toBe(0);
    expect(rep.create).toBe(1);
    expect(rep.rows[0].issues.some((i: { message: string }) => /not one of the classes configured/.test(i.message))).toBe(true);
  });

  test("a landline warns that the invite will not arrive", async () => {
    const rep = await validate([{ ...good, "Guardian Phone": "4023456789" }]);
    expect(rep.errors).toBe(0);
    expect(rep.rows[0].issues.some((i: { message: string }) => /SMS invite may not arrive/.test(i.message))).toBe(true);
  });

  test("a missing admission number warns about future duplicates", async () => {
    const rep = await validate([{ ...good, "Admission No": "" }]);
    expect(rep.rows[0].issues.some((i: { message: string }) => /generated reference/.test(i.message))).toBe(true);
    expect(rep.create).toBe(1);
  });

  test("an existing student with no changes is reported as unchanged", async () => {
    const rep = await validate([good], [{
      match: /FROM vita_hero\.kids k\s+WHERE k\.school_id/,
      rows: [{
        id: "k_1", student_ref: "sid_2026-0412", profile_id: "ph_9876543210",
        name: "Rahul Sharma", grade: "Class 4", section: "B", gender: "Male",
        date_of_birth: "2016-03-14", age: 10, guardian_name: "Priya Sharma",
      }],
    }]);
    // age is derived from today's date, so accept either unchanged or update —
    // what matters is that it is not treated as a new student.
    expect(rep.create).toBe(0);
    expect(rep.unchanged + rep.update).toBe(1);
  });

  test("counts distinct guardians, not rows", async () => {
    const rep = await validate([
      good,
      { ...good, "Admission No": "2026/0413", "Student Name": "Ananya Sharma", "Date of Birth": "02/11/2015" },
    ]);
    expect(rep.total).toBe(2);
    expect(rep.create).toBe(2);
    expect(rep.guardians).toBe(1);
  });

  test("rejects an empty file", async () => {
    handlers = [school, classes];
    const r = await call("/api/admin/schools/sch_oak/roster/validate", {
      method: "POST", headers: opsHeaders, body: JSON.stringify({ rows: [] }),
    });
    expect(r.status).toBe(400);
    expect((await r.json()).code).toBe("NO_ROWS");
  });

  test("rejects a file beyond the row cap", async () => {
    handlers = [school, classes];
    const rows = Array.from({ length: 3001 }, () => good);
    const r = await call("/api/admin/schools/sch_oak/roster/validate", {
      method: "POST", headers: opsHeaders, body: JSON.stringify({ rows }),
    });
    expect(r.status).toBe(413);
    expect((await r.json()).code).toBe("TOO_MANY_ROWS");
  });
});

// ── roster commit ──
describe("roster commit", () => {
  const school = { match: /SELECT id, name, academic_year FROM vita_hero\.schools/, rows: [{ id: "sch_oak", name: "Oakridge", academic_year: "2026-27" }] };
  const good = {
    "Admission No": "2026/0412", "Student Name": "Rahul Sharma", "Date of Birth": "14/03/2016",
    Gender: "M", Class: "Class 4", Section: "B",
    "Guardian Name": "Priya Sharma", "Guardian Phone": "9876543210",
  };

  test("refuses to commit a file with blocking errors unless told to skip them", async () => {
    handlers = [school];
    const r = await call("/api/admin/schools/sch_oak/roster/commit", {
      method: "POST", headers: opsHeaders,
      body: JSON.stringify({ rows: [{ ...good, "Guardian Phone": "" }] }),
    });
    expect(r.status).toBe(422);
    expect((await r.json()).code).toBe("HAS_ERRORS");
  });

  test("allowPartial imports the good rows and skips the rest", async () => {
    handlers = [school];
    const r = await call("/api/admin/schools/sch_oak/roster/commit", {
      method: "POST", headers: opsHeaders,
      body: JSON.stringify({
        rows: [good, { ...good, "Admission No": "2026/0499", "Guardian Phone": "" }],
        allowPartial: true,
      }),
    });
    expect(r.status).toBe(200);
    const rep = await r.json();
    expect(rep.create).toBe(1);
    expect(rep.errors).toBe(1);
    expect(rep.batchId).toMatch(/^rb_/);
  });

  test("writes guardians and students in batched statements, not per row", async () => {
    handlers = [school];
    const rows = Array.from({ length: 250 }, (_, i) => ({
      ...good,
      "Admission No": "2026/" + (1000 + i),
      "Student Name": "Student " + i,
      "Guardian Phone": String(9800000000 + i),
    }));
    await call("/api/admin/schools/sch_oak/roster/commit", {
      method: "POST", headers: opsHeaders, body: JSON.stringify({ rows }),
    });
    const kidInserts = calls.filter((c) => /INSERT INTO vita_hero\.kids/.test(c.text));
    const profileInserts = calls.filter((c) => /INSERT INTO vita_hero\.profiles/.test(c.text));
    // 250 students in chunks of 100 => 3 statements each, not 250.
    expect(kidInserts.length).toBe(3);
    expect(profileInserts.length).toBe(3);
    expect(calls.length).toBeLessThan(60);
  });

  test("records a batch in the audit trail", async () => {
    handlers = [school];
    await call("/api/admin/schools/sch_oak/roster/commit", {
      method: "POST", headers: opsHeaders, body: JSON.stringify({ rows: [good], filename: "term1.csv" }),
    });
    const batch = calls.find((c) => /INSERT INTO vita_hero\.roster_batches/.test(c.text));
    expect(batch).toBeDefined();
    expect(batch!.params).toContain("term1.csv");
  });

  test("the guardian upsert never demotes an existing admin", async () => {
    handlers = [school];
    await call("/api/admin/schools/sch_oak/roster/commit", {
      method: "POST", headers: opsHeaders, body: JSON.stringify({ rows: [good] }),
    });
    const ins = calls.find((c) => /INSERT INTO vita_hero\.profiles/.test(c.text));
    expect(ins!.text).toContain("WHERE vita_hero.profiles.role = 'PARENT'");
  });
});

// ── classes ──
describe("classes", () => {
  test("rejects a malformed academic year", async () => {
    const r = await call("/api/admin/schools/sch_oak/classes", {
      method: "POST", headers: opsHeaders,
      body: JSON.stringify({ academicYear: "2026", grades: ["Class 1"] }),
    });
    expect(r.status).toBe(400);
    expect((await r.json()).code).toBe("BAD_YEAR");
  });

  test("expands a grid of grades and sections", async () => {
    handlers = [{ match: /SELECT academic_year FROM vita_hero\.schools/, rows: [{ academic_year: "2026-27" }] }];
    await call("/api/admin/schools/sch_oak/classes", {
      method: "POST", headers: opsHeaders,
      body: JSON.stringify({ academicYear: "2026-27", grades: ["Class 1", "Class 2"], sections: ["A", "B"] }),
    });
    const inserts = calls.filter((c) => /INSERT INTO vita_hero\.school_classes/.test(c.text));
    expect(inserts.length).toBe(4);
  });

  test("requires a body it can understand", async () => {
    handlers = [{ match: /SELECT academic_year FROM vita_hero\.schools/, rows: [{ academic_year: "2026-27" }] }];
    const r = await call("/api/admin/schools/sch_oak/classes", {
      method: "POST", headers: opsHeaders, body: JSON.stringify({ academicYear: "2026-27" }),
    });
    expect(r.status).toBe(400);
    expect((await r.json()).code).toBe("BAD_BODY");
  });
});

// ── administrators ──
describe("school administrators", () => {
  const school = { match: /SELECT id, name FROM vita_hero\.schools/, rows: [{ id: "sch_oak", name: "Oakridge" }] };

  test("refuses a number already registered as a parent", async () => {
    handlers = [school, {
      match: /SELECT id, role, school_id, name FROM vita_hero\.profiles/,
      rows: [{ id: "ph_9876543210", role: "PARENT", school_id: "sch_oak", name: "Priya" }],
    }];
    const r = await call("/api/admin/schools/sch_oak/admins", {
      method: "POST", headers: opsHeaders,
      body: JSON.stringify({ name: "Meera", phone: "9876543210" }),
    });
    expect(r.status).toBe(409);
    expect((await r.json()).code).toBe("PHONE_IS_PARENT");
  });

  test("refuses an administrator of a different school", async () => {
    handlers = [school, {
      match: /SELECT id, role, school_id, name FROM vita_hero\.profiles/,
      rows: [{ id: "ph_1", role: "SCHOOL_ADMIN", school_id: "sch_other", name: "Meera" }],
    }];
    const r = await call("/api/admin/schools/sch_oak/admins", {
      method: "POST", headers: opsHeaders,
      body: JSON.stringify({ name: "Meera", phone: "9876543210" }),
    });
    expect(r.status).toBe(409);
    expect((await r.json()).code).toBe("PHONE_OTHER_SCHOOL");
  });

  test("creates a scoped administrator who signs in by phone", async () => {
    handlers = [school];
    const r = await call("/api/admin/schools/sch_oak/admins", {
      method: "POST", headers: opsHeaders,
      body: JSON.stringify({ name: "meera rao", phone: "98765 43210" }),
    });
    expect(r.status).toBe(201);
    const body = await r.json();
    expect(body.admin.name).toBe("Meera Rao");
    expect(body.admin.phone).toBe("+919876543210");
    const ins = calls.find((c) => /INSERT INTO vita_hero\.profiles/.test(c.text));
    expect(ins!.params).toContain("SCHOOL_ADMIN");
    expect(ins!.params).toContain("sch_oak");
  });

  test("rejects a bad phone", async () => {
    handlers = [school];
    const r = await call("/api/admin/schools/sch_oak/admins", {
      method: "POST", headers: opsHeaders, body: JSON.stringify({ name: "Meera", phone: "123" }),
    });
    expect(r.status).toBe(400);
    expect((await r.json()).code).toBe("BAD_PHONE");
  });
});

// ── routing hygiene ──
describe("routing", () => {
  test("an unknown sub-resource is a 404, not a 500", async () => {
    const r = await call("/api/admin/schools/sch_oak/nonsense", { headers: opsHeaders });
    expect(r.status).toBe(404);
  });

  test("a wrong method is a 405", async () => {
    const r = await call("/api/admin/schools", { method: "DELETE", headers: opsHeaders });
    expect(r.status).toBe(405);
  });

  test("malformed JSON is a 400 with a clear message", async () => {
    const r = await call("/api/admin/schools", {
      method: "POST", headers: opsHeaders, body: "{not json",
    });
    expect(r.status).toBe(400);
    expect((await r.json()).code).toBe("BAD_JSON");
  });

  test("the ops bootstrap endpoint requires the API key", async () => {
    const r = await call("/api/admin/ops/grant", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "9876543210", name: "Srini" }),
    });
    expect(r.status).toBe(403);
  });

  test("the ops bootstrap endpoint promotes a phone with the key", async () => {
    const r = await call("/api/admin/ops/grant", {
      method: "POST", headers: opsHeaders,
      body: JSON.stringify({ phone: "9876543210", name: "srini elluri" }),
    });
    expect(r.status).toBe(200);
    expect((await r.json()).role).toBe("ADMIN");
  });
});
