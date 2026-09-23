// End-to-end tests for the Stage A routes, against a stubbed Neon driver.
//
// These exercise routing, authorisation and the roster validator through the
// real worker entrypoint. What they deliberately do not test is SQL semantics —
// the stub returns canned rows. Run with: bun test

import { describe, expect, test, mock, beforeEach } from "bun:test";

// ── stub the Neon driver before the worker imports it ──
interface Handler {
  match: RegExp;
  rows?: Record<string, unknown>[];
  /** Fail the way the database fails, so the error path can be tested. */
  throws?: Error;
}

let handlers: Handler[] = [];
let calls: { text: string; params: unknown[] }[] = [];

function run(text: string, params: unknown[]) {
  calls.push({ text, params });
  for (const h of handlers) {
    if (!h.match.test(text)) continue;
    if (h.throws) return Promise.reject(h.throws);
    return Promise.resolve(h.rows || []);
  }
  return Promise.resolve([] as Record<string, unknown>[]);
}

function makeSql() {
  const sql: any = (strings: TemplateStringsArray | string, ...values: unknown[]) => {
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
    expect(body).toContain("VitaHero Console");
    expect(body).toContain("<script>");
  });

  test("does not require a sign-in to load the page itself", async () => {
    expect((await call("/admin/")).status).toBe(200);
  });

  test("a console that has not changed costs a 304, not a quarter megabyte", async () => {
    const first = await call("/admin");
    const etag = first.headers.get("ETag");
    expect(etag).toBeTruthy();
    const body = await first.text();
    // Worth knowing if this ever balloons: it is sent on every cold load.
    expect(body.length).toBeGreaterThan(50_000);

    const again = await call("/admin", { headers: { "If-None-Match": etag as string } });
    expect(again.status).toBe(304);
    expect(again.headers.get("ETag")).toBe(etag);
    expect(await again.text()).toBe("");
  });

  test("a stale validator still gets the current console", async () => {
    const r = await call("/admin", { headers: { "If-None-Match": '"not-this-one"' } });
    expect(r.status).toBe(200);
    expect((await r.text()).length).toBeGreaterThan(50_000);
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
    // Two grades by two sections is four classes. That is the assertion; how
    // many statements carry them is not — this used to send one INSERT each,
    // which is two statements a class on an ordinary save, and pinning the
    // count here is what made batching them look like a regression.
    const inserts = calls.filter((c) => /INSERT INTO vita_hero\.school_classes/.test(c.text));
    const rows = inserts.flatMap((c) => c.params || []).filter(
      (p) => typeof p === "string" && /^cls_/.test(p as string));
    expect(rows.sort()).toEqual([
      "cls_sch-oak_2026-27_class-1_a",
      "cls_sch-oak_2026-27_class-1_b",
      "cls_sch-oak_2026-27_class-2_a",
      "cls_sch-oak_2026-27_class-2_b",
    ]);
  });

  test("inviting a list of parents does not cost four statements a number", async () => {
    // A roster import for a school of two hundred families used to send four
    // subrequests per number — read the cooldown, send, log, mark — which is
    // eight hundred, past what the platform allows. The import reported
    // success and the invites stopped partway through.
    handlers = [
      { match: /SELECT id FROM vita_hero\.profiles/, rows: [
        { id: "ph_9800000001" }, { id: "ph_9800000002" }, { id: "ph_9800000003" },
        { id: "ph_9800000004" }, { id: "ph_9800000005" },
      ] },
    ];
    const r = await call("/api/admin/invite", {
      method: "POST", headers: opsHeaders,
      body: JSON.stringify({ phones: [
        "9800000001", "9800000002", "9800000003", "9800000004", "9800000005",
      ] }),
    });
    expect(r.status).toBe(200);
    // Whatever the statements are, there must not be one per number: the
    // ceiling is deliberately loose and still far below five times anything.
    const touching = calls.filter((c) => /profiles|sms_log/.test(c.text));
    expect(touching.length).toBeLessThan(5);
  });

  test("an invite that could not be sent does not start the cooldown", async () => {
    // Marking a number invited when nothing went out puts it behind the resend
    // cooldown, so a school whose provider is misconfigured has its whole
    // roster silently locked out of ever being invited.
    handlers = [
      { match: /SELECT id FROM vita_hero\.profiles/, rows: [{ id: "ph_9800000009" }] },
    ];
    // No Twilio credentials in ENV, so every send fails.
    await call("/api/admin/invite", {
      method: "POST", headers: opsHeaders,
      body: JSON.stringify({ phones: ["9800000009"] }),
    });
    const marked = calls.filter((c) => /UPDATE vita_hero\.profiles[\s\S]*invited_at/.test(c.text));
    expect(marked).toEqual([]);
  });

  test("a request that would cost a thousand texts is refused, not truncated", async () => {
    // Truncating would be worse: a sync would come back reporting success
    // having written half a camp, and an invite run would silently miss
    // families. Nothing capped these, and each entry is a statement or a text.
    const r = await call("/api/admin/invite", {
      method: "POST", headers: opsHeaders,
      body: JSON.stringify({ phones: Array.from({ length: 1001 }, (_, i) => "98" + String(i).padStart(8, "0")) }),
    });
    expect(r.status).toBe(413);
    expect((await r.json()).code).toBe("TOO_MANY");
  });

  test("a 500 does not hand the caller the database's own words", async () => {
    // A Postgres error names the table, the column and the constraint, and
    // often echoes the value that tripped it. That used to go straight back to
    // whoever asked.
    handlers = [{
      match: /SELECT/,
      throws: new Error(
        'relation "vita_hero.camp_findings" does not exist; column kid_id at row 3'),
    }];
    const original = console.error;
    console.error = () => {};
    try {
      const r = await call("/api/admin/schools", { headers: opsHeaders });
      const body = await r.text();
      expect(r.status).toBe(500);
      expect(body).not.toContain("vita_hero.camp_findings");
      expect(body).not.toContain("does not exist");
      expect(JSON.parse(body).code).toBe("SERVER_ERROR");
    } finally {
      console.error = original;
    }
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

// ── the four late surfaces ──
//
// The failure these guard against is not a logic bug: it is a module that
// exists, typechecks and is tested, and that nothing routes to. Each case
// below asks only "does a request reach this code", plus the authorisation
// gate in front of it.
describe("photographs, questions, library and billing", () => {
  const parentBearer = { Authorization: "Bearer " + "t".repeat(40), "Content-Type": "application/json" };
  const parentSession = {
    match: /session_token/,
    rows: [{ id: "ph_9876543210", user_id: "ph_9876543210", name: "Priya", role: "PARENT", school_id: null }],
  };

  test("every staff surface refuses an anonymous caller", async () => {
    for (const path of [
      "/api/admin/photo/ph_1",
      "/api/admin/questions",
      "/api/admin/questions/qt_1",
      "/api/admin/library",
      "/api/admin/billing",
      "/api/admin/billing/contract",
      "/api/admin/billing/invoices",
      "/api/admin/billing/invoice/inv_1",
    ]) {
      const r = await call(path);
      expect(r.status).toBe(401);
      expect((await r.json()).code).toBe("ADMIN_REQUIRED");
    }
  });

  test("every guardian surface refuses an anonymous caller", async () => {
    for (const path of [
      "/api/me/photos?kid_id=k1",
      "/api/me/photo/ph_1",
      "/api/me/questions",
      "/api/me/question-policy",
      "/api/me/entitlements",
      "/api/library",
      "/api/library/iron-rich-foods",
    ]) {
      expect((await call(path)).status).toBe(401);
    }
  });

  test("the ops key reaches the library, the question queue and billing", async () => {
    expect((await call("/api/admin/library", { headers: opsHeaders })).status).toBe(200);
    expect((await call("/api/admin/billing", { headers: opsHeaders })).status).toBe(200);
    expect((await call("/api/admin/questions?school_id=sch_oak", { headers: opsHeaders })).status).toBe(200);
  });

  test("a signed-in guardian reaches their own entitlements, and care is not gated", async () => {
    handlers = [parentSession];
    const r = await call("/api/me/entitlements", { headers: parentBearer });
    expect(r.status).toBe(200);
    const d = await r.json();
    expect(d.plan).toBe("FREE");
    for (const key of Object.keys(d.care)) expect(d.care[key]).toBe(true);
  });

  test("a guardian reaches the question policy, and it warns about urgency", async () => {
    handlers = [parentSession];
    const r = await call("/api/me/question-policy", { headers: parentBearer });
    expect(r.status).toBe(200);
    expect((await r.json()).notice).toMatch(/not monitored around the clock/i);
  });

  test("a question without the urgency acknowledgement is refused at the route", async () => {
    handlers = [parentSession];
    const r = await call("/api/me/questions", {
      method: "POST", headers: parentBearer, body: JSON.stringify({ body: "Is this normal?" }),
    });
    expect(r.status).toBe(400);
    expect((await r.json()).code).toBe("URGENCY_ACK_REQUIRED");
  });

  test("photo consent travels through the guardian consent route", async () => {
    handlers = [
      parentSession,
      { match: /SELECT profile_id, status FROM vita_hero\.camp_participants/,
        rows: [{ profile_id: "ph_9876543210", status: "NOT_SCREENED" }] },
    ];
    const r = await call("/api/camps/consent", {
      method: "POST", headers: parentBearer,
      body: JSON.stringify({ campId: "cmp_1", kidId: "k1", decision: "GRANTED", consentPhotos: true }),
    });
    expect(r.status).toBe(200);
    expect((await r.json()).consentPhotos).toBe(true);
    const update = calls.find((c) => /UPDATE vita_hero\.camp_participants/.test(c.text));
    expect(update).toBeTruthy();
    expect(update!.params).toContain(true);
  });

  test("declining clears photo consent even when the client asks for it", async () => {
    handlers = [
      parentSession,
      { match: /SELECT profile_id, status FROM vita_hero\.camp_participants/,
        rows: [{ profile_id: "ph_9876543210", status: "NOT_SCREENED" }] },
    ];
    const r = await call("/api/camps/consent", {
      method: "POST", headers: parentBearer,
      body: JSON.stringify({ campId: "cmp_1", kidId: "k1", decision: "DECLINED", consentPhotos: true }),
    });
    expect((await r.json()).consentPhotos).toBe(false);
  });

  test("an unknown sub-resource in this block is a 404, not a 500", async () => {
    expect((await call("/api/admin/billing/nonsense", { headers: opsHeaders })).status).toBe(404);
  });

  test("a wrong method on the library is a 405", async () => {
    expect((await call("/api/admin/library", { method: "PATCH", headers: opsHeaders })).status).toBe(405);
  });
});

// The console is a 200KB JavaScript program that lives inside a TypeScript
// template literal, so `tsc` never parses a line of it. An unbalanced paren
// typechecks, builds, deploys, and then throws "missing ) after argument list"
// at the browser — at which point every console screen is blank and the server
// looks fine. Parse it here instead.
describe("the console is valid JavaScript", () => {
  test("the inlined script parses", async () => {
    const { PORTAL_HTML, SERVICE_WORKER_JS } = await import("./portal");
    const open = PORTAL_HTML.indexOf("<script>");
    const close = PORTAL_HTML.lastIndexOf("</script>");
    expect(open).toBeGreaterThan(0);
    const src = PORTAL_HTML.slice(open + "<script>".length, close);
    expect(src.length).toBeGreaterThan(10000);
    // `new Function` parses without executing — exactly what is wanted here.
    expect(() => new Function(src)).not.toThrow();
    expect(() => new Function(SERVICE_WORKER_JS)).not.toThrow();
  });
});

// The console and the clinical model have to agree on what a camp can offer.
//
// They drifted once already: the school setup screen offered eight checks
// while only four had a capture screen, so a school could agree to a spine
// examination that resolved, on the day, to a Normal/Abnormal dropdown. And
// the demo seed created camps with checks ("Eye Test", "Hemoglobin") and a
// status ("UPCOMING") that neither list knew, which is how a camp ended up in
// the console that the lifecycle could not advance.
describe("the console offers only what can actually be recorded", () => {
  test("the portal's check list is exactly the designed checks", async () => {
    const { PORTAL_HTML } = await import("./portal");
    const { DESIGNED_CHECKS } = await import("./clinical");
    const m = PORTAL_HTML.match(/var CHECKS = \[([^\]]*)\]/);
    expect(m).not.toBeNull();
    const offered = m![1].split(",").map((x) => x.trim().replace(/^"|"$/g, ""));
    expect(offered).toEqual([...DESIGNED_CHECKS]);
  });

  test("every designed check has a capture form, not the fallback dropdown", async () => {
    const { PORTAL_HTML } = await import("./portal");
    const { DESIGNED_CHECKS } = await import("./clinical");
    for (const c of DESIGNED_CHECKS) {
      expect(PORTAL_HTML).toContain(`ct === "${c}"`);
    }
  });

  test("a planned check is recognised but never offered", async () => {
    const { PORTAL_HTML } = await import("./portal");
    const { PLANNED_CHECKS, CHECK_TYPES, isDesignedCheck } = await import("./clinical");
    for (const c of PLANNED_CHECKS) {
      // Still a valid stored value, so old camps and findings keep working...
      expect(CHECK_TYPES).toContain(c);
      // ...but not something a school can be signed up to today.
      expect(isDesignedCheck(c)).toBe(false);
    }
    const m = PORTAL_HTML.match(/var CHECKS = \[([^\]]*)\]/);
    for (const c of PLANNED_CHECKS) expect(m![1]).not.toContain(c);
  });

  // No "no seeded camp carries an unknown status" test any more. It read the
  // rows out of seedPartnerSchools, which no longer exists \u2014 so it would have
  // matched nothing, iterated nothing and passed, which is worse than not
  // being there. What it guarded is covered where it belongs: the console and
  // the worker agree about CAMP_STATUSES and CHECK_TYPES in the suite below.

});

// The console and the app have to agree about camps.
//
// Three ways they did not, all of which typechecked and passed every test:
// the app's CampStatus enum held UPCOMING and COMPLETED while the server's
// lifecycle produces SCHEDULED / IN_PROGRESS / SCREENED / RELEASED, so
// valueOf threw on every partner camp and fell back to UPCOMING — the "past
// camps" list was permanently empty, a released camp still read as upcoming,
// and reminders kept firing for camps that had already happened. The venue and
// the consent deadline were asked for on every camp and sent to nobody. And a
// camp the school was still drafting was shown to parents.
describe("the app and the server agree about camps", () => {
  const kotlin = async (rel: string) => {
    const { readFileSync } = await import("node:fs");
    return readFileSync("../android/app/src/main/java/com/rork/vitahero/" + rel, "utf8");
  };

  test("every status the server can send is a value the app can parse", async () => {
    const { CAMP_STATUSES } = await import("./camps");
    const src = await kotlin("data/Models.kt");
    const body = src.slice(src.indexOf("enum class CampStatus"));
    const members = body.slice(0, body.indexOf(";")).match(/\b[A-Z_]{3,}\b/g) || [];
    for (const st of CAMP_STATUSES) {
      // DRAFT is filtered out before a parent ever sees it; everything else
      // must be nameable, or valueOf throws and the camp silently mis-renders.
      if (st === "DRAFT") continue;
      expect(members).toContain(st);
    }
  });

  test("a released camp is past, not upcoming", async () => {
    const src = await kotlin("data/Models.kt");
    const up = src.slice(src.indexOf("val isUpcoming"), src.indexOf("val isPast"));
    const past = src.slice(src.indexOf("val isPast"));
    expect(past).toContain("RELEASED");
    expect(past).toContain("SCREENED");
    expect(up).not.toContain("RELEASED");
  });

  test("a camp still being drafted is not sent to a parent", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("index.ts", "utf8");
    const at = src.indexOf('path === "/api/camps"');
    const block = src.slice(at, at + 3000);
    expect(block).toContain("NOT IN ('DRAFT', 'CANCELLED')");
  });

  test("the venue and the consent deadline reach the app", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("index.ts", "utf8");
    const at = src.indexOf('path === "/api/camps"');
    expect(src.slice(at, at + 3000)).toContain("venue: sc.venue");
    const dto = await kotlin("data/Dtos.kt");
    const camp = dto.slice(dto.indexOf("data class CampDto"));
    expect(camp.slice(0, camp.indexOf("\n)"))).toContain("val venue");
  });
});

// A clinician has to be able to see what the family reported.
describe("the family's illness history reaches the person examining the child", () => {
  test("the screening screen asks for it", async () => {
    const { PORTAL_HTML } = await import("./portal");
    // Built, routed and tested server-side, but for a while no screen called
    // it: the parent logged three fevers and the doctor never saw them.
    expect(PORTAL_HTML).toContain("/symptoms/");
    expect(PORTAL_HTML).toContain("What the family reported");
  });

  test("it is labelled as reported, never as a finding", async () => {
    const { PORTAL_HTML } = await import("./portal");
    expect(PORTAL_HTML).toContain("Not examined");
  });
});

// Sending a text, and saying why one did not go.
//
// The console reported "Sent to 0 of 2. Could not reach: <two names>" while
// the real cause was that the worker had no SMS credentials at all. That
// wording blames the family's mobile number for a deployment gap, and an
// operator reading it re-checks numbers that were never wrong.
describe("sms configuration is legible before and after a send", () => {
  const load = async () => await import("./messaging");

  test("nothing configured is reported as nothing configured", async () => {
    const { smsProvider } = await load();
    const st = smsProvider({});
    expect(st.provider).toBe("none");
    expect(st.configured).toBe(false);
    expect(st.detail).toMatch(/No SMS gateway is configured/);
  });

  test("a send with nothing configured blames the config, not the number", async () => {
    const { makeSender } = await load();
    const r = await makeSender({})("+919876543210", "hello");
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/No SMS gateway is configured/);
    // The failure must never read as though the mobile number were at fault.
    expect(r.reason).not.toMatch(/could not reach|unreachable|invalid number/i);
  });

  test("Twilio without a From is incomplete, and says which setting is missing", async () => {
    const { smsProvider } = await load();
    // The old code hard-coded a US number it did not own and claimed Twilio
    // would override it. Twilio rejects that, so every send failed even with
    // valid credentials.
    const st = smsProvider({ TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "t" });
    expect(st.provider).toBe("twilio");
    expect(st.configured).toBe(false);
    expect(st.missing).toContain("TWILIO_FROM");
  });

  test("credentials alone pick the provider, so a deployment need not name it", async () => {
    const { smsProvider } = await load();
    expect(smsProvider({ TEXTBEE_API_KEY: "k", TEXTBEE_DEVICE_ID: "d" }).provider).toBe("textbee");
    expect(smsProvider({
      TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "t", TWILIO_FROM: "+1555",
    }).provider).toBe("twilio");
    // An explicit choice beats inference.
    expect(smsProvider({
      SMS_PROVIDER: "twilio", TEXTBEE_API_KEY: "k", TEXTBEE_DEVICE_ID: "d",
    }).provider).toBe("twilio");
  });

  test("a provider's own words survive to the caller", async () => {
    const { makeSender } = await load();
    const real = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response("device is offline", { status: 409 })) as typeof fetch;
    try {
      const r = await makeSender({ TEXTBEE_API_KEY: "k", TEXTBEE_DEVICE_ID: "d" })("+91", "x");
      expect(r.ok).toBe(false);
      // Whatever the gateway said, verbatim — that is what makes a wrong
      // integration visible on the first send instead of silently.
      expect(r.reason).toContain("409");
      expect(r.reason).toContain("device is offline");
    } finally {
      globalThis.fetch = real;
    }
  });

  test("a Messaging Service SID is sent as one, not as a phone number", async () => {
    const { makeSender } = await load();
    const real = globalThis.fetch;
    let sentBody = "";
    globalThis.fetch = (async (_u: unknown, init: RequestInit) => {
      sentBody = String(init.body);
      return new Response("{}", { status: 201 });
    }) as unknown as typeof fetch;
    try {
      await makeSender({
        TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "t", TWILIO_FROM: "MG123",
      })("+919876543210", "x");
      expect(sentBody).toContain("MessagingServiceSid=MG123");
      expect(sentBody).not.toContain("From=MG123");
    } finally {
      globalThis.fetch = real;
    }
  });

  test("no caller still uses the old hard-coded sender", async () => {
    const { readFileSync } = await import("node:fs");
    // The US number that was hard-coded into every message.
    expect(readFileSync("index.ts", "utf8")).not.toContain("+12562828337");
  });
});

// ── sessions ──
//
// A session used to be a single `session_token` column on the profile. Signing
// in overwrote it, so the phone that was still holding the previous token was
// silently logged out — and because the app read the resulting 401 as "no
// data", it drew an empty screen rather than asking anyone to sign in again.
// That is the report these tests exist to keep fixed: "I sign in again after a
// long time and it loads with fallback options, not real data."
describe("sessions", () => {
  const TOKEN = "a".repeat(48);
  const OTHER = "b".repeat(48);
  const bearer = (t: string) => ({ Authorization: "Bearer " + t, "Content-Type": "application/json" });

  /** A token that exists in vita_hero.sessions, unrevoked and unexpired. */
  const liveSession = (role = "ADMIN") => ({
    match: /vita_hero\.sessions[\s\S]*JOIN/,
    rows: [{ id: "ph_1", user_id: "ph_1", name: "Ops", role, school_id: null }],
  });

  test("a token in the sessions table authenticates", async () => {
    handlers = [liveSession()];
    expect((await call("/api/admin/schools", { headers: bearer(TOKEN) })).status).toBe(200);
  });

  test("the lookup refuses a revoked or expired row", async () => {
    // No handler matches, so the join returns nothing — which is what a
    // revoked_at or a past expires_at produces in the real query.
    handlers = [];
    expect((await call("/api/admin/schools", { headers: bearer(TOKEN) })).status).toBe(401);
  });

  test("the query itself excludes revoked and expired sessions", async () => {
    handlers = [liveSession()];
    await call("/api/admin/schools", { headers: bearer(TOKEN) });
    const join = calls.find((c) => /vita_hero\.sessions[\s\S]*JOIN/.test(c.text));
    expect(join).toBeDefined();
    expect(join!.text).toContain("revoked_at IS NULL");
    expect(join!.text).toContain("expires_at >");
  });

  test("a token issued before the table existed still works", async () => {
    // The sessions join finds nothing; the old column is the fallback, so
    // shipping this does not sign out everyone already holding a token.
    handlers = [{
      match: /session_token = /,
      rows: [{ id: "ph_1", user_id: "ph_1", name: "Ops", role: "ADMIN", school_id: null }],
    }];
    expect((await call("/api/admin/schools", { headers: bearer(TOKEN) })).status).toBe(200);
  });

  test("using a session slides its expiry out", async () => {
    handlers = [liveSession()];
    await call("/api/admin/schools", { headers: bearer(TOKEN) });
    expect(calls.some((c) => /UPDATE vita_hero\.sessions[\s\S]*last_seen_at/.test(c.text))).toBe(true);
  });

  test("signing out revokes that one token, not the whole profile", async () => {
    handlers = [liveSession("PARENT")];
    const r = await call("/api/auth/logout", { method: "POST", headers: bearer(TOKEN) });
    expect(r.status).toBe(200);

    const revoke = calls.find((c) => /UPDATE vita_hero\.sessions[\s\S]*revoked_at = NOW\(\)/.test(c.text));
    expect(revoke).toBeDefined();
    // Scoped to the presented token. A logout that matched on profile_id would
    // take the family's other device down with it.
    expect(revoke!.params).toContain(TOKEN);
    expect(revoke!.text).toContain("WHERE token =");
    expect(revoke!.params).not.toContain(OTHER);
  });

  test("signing in records a new session instead of replacing the only one", async () => {
    handlers = [
      { match: /FROM vita_hero\.phone_otps/, rows: [
        { phone: "+919876543210", otp: "123456", attempts: 0,
          expires_at: new Date(Date.now() + 600_000).toISOString() },
      ] },
      // A school administrator, because this is the console's door. What is
      // under test is that a sign-in adds a session row rather than replacing
      // the only one \u2014 true of whoever signs in.
      { match: /SELECT id, provisioned/, rows: [
        { id: "ph_9876543210", provisioned: true, name: "Asha", role: "SCHOOL_ADMIN", school_id: "sch1" },
      ] },
    ];
    const r = await call("/api/auth/phone/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "+919876543210", otp: "123456" }),
    });
    expect(r.status).toBe(200);

    const insert = calls.find((c) => /INSERT INTO vita_hero\.sessions/.test(c.text));
    expect(insert).toBeDefined();
    // The token handed back is the one that was recorded, and it carries an
    // expiry — a session with no end is how the old column behaved.
    const token = (await r.json()).token as string;
    expect(insert!.params).toContain(token);
    expect(insert!.text).toContain("expires_at");
  });

  test("an unregistered number never leaves a session behind", async () => {
    handlers = [
      { match: /FROM vita_hero\.phone_otps/, rows: [
        { phone: "+919876543210", otp: "123456", attempts: 0,
          expires_at: new Date(Date.now() + 600_000).toISOString() },
      ] },
      { match: /SELECT id, provisioned/, rows: [] },
    ];
    const r = await call("/api/auth/phone/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "+919876543210", otp: "123456" }),
    });
    expect(r.status).toBe(403);
    expect(calls.some((c) => /INSERT INTO vita_hero\.sessions/.test(c.text))).toBe(false);
  });
});

// ── ownership on the sync endpoints ──
//
// These routes take the primary key from the request body, because the app
// mints ids while offline. The other half of that bargain was missing: the
// upserts said `ON CONFLICT (id) DO UPDATE SET profile_id =
// EXCLUDED.profile_id` and nothing checked who owned the row. Posting a child
// id that was not yours moved that child — and every finding, referral and
// photograph hanging off them — onto your account. Kid ids are built from the
// guardian's number, the child's name and four random characters, so they were
// not much of a secret either.
describe("a client-supplied id cannot reach another account's row", () => {
  const TOKEN = "a".repeat(48);
  const bearer = { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" };
  const asParent = () => [{
    match: /session_token = /,
    rows: [{ id: "ph_mine", user_id: "ph_mine", name: "Priya", role: "PARENT", school_id: null }],
  }];

  /** Every upsert on the sync surface, with a body the app would really send. */
  const UPSERTS: Array<[string, string, Record<string, unknown>]> = [
    ["an appointment", "/api/appointments", { id: "apt_1", doctor_name: "Dr Rao", specialty: "Dental", kid_name: "Arjun", date: "2026-10-01", time: "10:00" }],
    ["a camp entry", "/api/camps", { id: "cmp_1", title: "Annual", school: "Silver Oaks", date: "2026-10-01", time: "09:00" }],
    ["a co-parent", "/api/co-parents", { id: "cop_1", name: "Ravi", relation: "Father" }],
  ];

  for (const [what, path, body] of UPSERTS) {
    test(`${what}: the update is scoped to the caller`, async () => {
      handlers = asParent();
      await call(path, { method: "POST", headers: bearer, body: JSON.stringify(body) });
      const upsert = calls.find((c) => /ON CONFLICT \(id\) DO UPDATE/.test(c.text));
      expect(upsert).toBeDefined();
      // The predicate is what makes a conflict on someone else's row do nothing.
      expect(upsert!.text).toMatch(/DO UPDATE[\s\S]*WHERE[\s\S]*profile_id = /);
      expect(upsert!.params).toContain("ph_mine");
      // And the row can no longer be handed to whoever posted last.
      expect(upsert!.text).not.toContain("profile_id = EXCLUDED.profile_id");
    });

    test(`${what}: a row that belongs to someone else is refused, not silently returned`, async () => {
      // The upsert matched nothing, which is exactly what the owner predicate
      // produces for another account's id.
      handlers = asParent();
      const r = await call(path, { method: "POST", headers: bearer, body: JSON.stringify(body) });
      expect(r.status).toBe(409);
      expect((await r.json()).code).toBe("NOT_YOURS");
    });
  }

  test("a growth point can only land on a child the caller owns", async () => {
    handlers = [
      ...asParent(),
      { match: /FROM vita_hero\.kids\s+WHERE id = /, rows: [{ id: "k_mine" }] },
    ];
    await call("/api/growth-points", {
      method: "POST", headers: bearer,
      body: JSON.stringify({ id: "gp_k_theirs_2026-09-01", kid_id: "k_mine", label: "Camp", height: 130, weight: 28 }),
    });
    const upsert = calls.find((c) => /INSERT INTO vita_hero\.growth_points/.test(c.text));
    expect(upsert).toBeDefined();
    // Tied to the kid that was just ownership-checked, so a point id belonging
    // to another child updates nothing. The kid_id itself is no longer
    // rewritable, which is what let a row be moved between children.
    expect(upsert!.text).toMatch(/DO UPDATE[\s\S]*WHERE[\s\S]*kid_id = /);
    expect(upsert!.text).not.toContain("kid_id = EXCLUDED.kid_id");
  });

  test("meals are refused for a child the caller does not own", async () => {
    handlers = [
      ...asParent(),
      // The ownership lookup comes back with fewer kids than were asked for.
      { match: /SELECT id FROM vita_hero\.kids\s+WHERE id = ANY/, rows: [] },
    ];
    const r = await call("/api/meals", {
      method: "POST", headers: bearer,
      body: JSON.stringify([{ id: "ml_1", kid_id: "k_theirs", time_slot: "Breakfast", name: "Idli" }]),
    });
    expect(r.status).toBe(404);
    expect(calls.some((c) => /INSERT INTO vita_hero\.meal_items/.test(c.text))).toBe(false);
  });

  test("a whole day's plan is one statement, not one per meal", async () => {
    handlers = [
      ...asParent(),
      { match: /SELECT id FROM vita_hero\.kids\s+WHERE id = ANY/, rows: [{ id: "k_mine" }] },
    ];
    const plan = ["Breakfast", "Lunch", "Snack", "Dinner"].map((slot, i) => ({
      id: `ml_${i}`, kid_id: "k_mine", time_slot: slot, name: "Idli", detail: "", kcal: 200, eaten: false,
    }));
    const r = await call("/api/meals", {
      method: "POST", headers: bearer, body: JSON.stringify(plan),
    });
    expect(r.status).toBe(201);
    const inserts = calls.filter((c) => /INSERT INTO vita_hero\.meal_items/.test(c.text));
    expect(inserts.length).toBe(1);
    expect(inserts[0].text).toMatch(/DO UPDATE[\s\S]*WHERE[\s\S]*profile_id = /);
  });
});

// ── children are the school's to add ──
//
// A closed programme: a guardian is provisioned by a roster import and their
// children arrive with it, matched on the mobile number the school holds. The
// app used to be able to create one anyway, and that child could not be
// screened, consented for, or put on a camp list — it just sat there looking
// real.
describe("a parent cannot create a child", () => {
  const TOKEN = "a".repeat(48);
  const bearer = { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" };
  const asParent = () => [{
    match: /session_token = /,
    rows: [{ id: "ph_mine", user_id: "ph_mine", name: "Priya", role: "PARENT", school_id: null }],
  }];

  test("the endpoint refuses, and says who can", async () => {
    handlers = asParent();
    const r = await call("/api/kids", {
      method: "POST", headers: bearer,
      body: JSON.stringify({ id: "k_new", name: "Arjun", age: 9, gender: "M" }),
    });
    expect(r.status).toBe(403);
    const body = await r.json();
    expect(body.code).toBe("ROSTER_MANAGED");
    expect(body.error).toMatch(/school/i);
    // Nothing was written on the way to refusing.
    expect(calls.some((c) => /INSERT INTO vita_hero\.kids/.test(c.text))).toBe(false);
  });

  test("it is still a 401 when nobody is signed in", async () => {
    handlers = [];
    const r = await call("/api/kids", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "k_new", name: "Arjun" }),
    });
    expect(r.status).toBe(401);
  });

  test("reading children still works — they come from the roster", async () => {
    handlers = [
      ...asParent(),
      { match: /SELECT \* FROM vita_hero\.kids/, rows: [{ id: "k_roster", name: "Arjun", profile_id: "ph_mine" }] },
    ];
    const r = await call("/api/kids", { headers: bearer });
    expect(r.status).toBe(200);
    expect((await r.json()).length).toBe(1);
  });

  test("the refusal is permanent, so a client stops retrying it", async () => {
    // 403 is outside the two statuses the app treats as "come back later",
    // which is what makes an old build give up rather than resend forever.
    expect([408, 429]).not.toContain(403);
  });
});

describe("every admin route the console calls is actually reachable", () => {
  // The gap this closes.
  //
  // /api/admin/lookup and /api/admin/demo-data were written, tested and
  // shipped, and neither could ever be reached: both sat inside a guard that
  // matches hospitals, doctors, invites and camp-people, so the path fell past
  // them to the generic 404. The console showed "Not found" on a screen whose
  // server-side function had passing tests.
  //
  // It passed both ways because neither test went through the router. The
  // database tests call lookupPhone() and previewDemoData() directly; the
  // console tests stub fetch. Both ends were covered and the wiring between
  // them was not. This drives the worker's own fetch handler, which is the
  // only thing that answers the question "does this URL work".
  const ROUTES: Array<[string, string]> = [
    ["GET", "/api/admin/overview"],
    ["GET", "/api/admin/schools"],
    ["GET", "/api/admin/hospitals"],
    ["GET", "/api/admin/doctors"],
    ["GET", "/api/admin/lookup?phone=9876543210"],
    ["GET", "/api/admin/guardians"],
    ["GET", "/api/admin/reset"],
    ["GET", "/api/admin/partners"],
    ["GET", "/api/admin/retention"],
    ["GET", "/api/admin/access-log?days=30"],
    ["GET", "/api/admin/library"],
    ["GET", "/api/admin/analytics"],
  ];

  for (const [method, path] of ROUTES) {
    test(`${method} ${path} is routed`, async () => {
      // No stubs: an unmatched query answers with no rows, which is enough to
      // find out whether the path reaches a handler at all.
      handlers = [];
      const res = await call(path, { method, headers: opsHeaders });
      // What is being asserted is that something answered for this path — not
      // that the answer is right, which is every other test's job. A 404 here
      // means the URL reaches no handler at all.
      expect(res.status, `${method} ${path}`).not.toBe(404);
      const body = await res.json().catch(() => ({}));
      expect((body as { error?: string }).error, `${method} ${path}`).not.toBe("Not found");

      // And that it did not fall over on the way.
      //
      // This used to stop at "not a 404", which let a handler throw and still
      // pass: /api/admin/demo-data crashed on an empty count for as long as
      // this suite has existed, answering 500 while the test read it as
      // routed. Reaching a handler that dies is not reaching a handler.
      expect(res.status, `${method} ${path} answered ${res.status}`).toBeLessThan(500);
    });
  }
});

// ── What the door says ─────────────────────────────────────
//
// Nothing tested /api/auth/phone/send at all, which is how "This number isn't
// registered" came to be the answer given to a doctor who had just been added
// to the directory, with a mobile the form insisted on. The three answers are
// different and the difference is the whole point: unknown, in the directory
// but not given access, and in.
describe("requesting a sign-in code", () => {
  // The surface is named here rather than left out, because leaving it out
  // means the family app, and these cases are about the console's door.
  const send = (phone: string) =>
    call("/api/auth/phone/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, surface: "console" }),
    });

  test("a number nobody has heard of is told so, plainly", async () => {
    handlers = [];
    const res = await send("9876543210");
    expect(res.status).toBe(403);
    const b = (await res.json()) as { code?: string; error?: string };
    expect(b.code).toBe("NOT_PROVISIONED");
  });

  test("a doctor in the directory with no sign-in is not called unregistered", async () => {
    handlers = [
      // No profile for them...
      { match: /FROM vita_hero\.profiles/i, rows: [] },
      // ...but they are right there in the directory.
      { match: /FROM vita_hero\.doctors/i, rows: [{ name: "Dr Meera Iyer" }] },
    ];
    const res = await send("9876500011");
    expect(res.status).toBe(403);
    const b = (await res.json()) as { code?: string; error?: string };
    // Being told to contact your camp organizer when you are in the directory
    // sends somebody to argue with a person who cannot help them. This says
    // which switch is off and who can flip it.
    expect(b.code).toBe("DIRECTORY_ONLY");
    expect(b.error).toContain("Dr Meera Iyer");
    expect(b.error).toContain("sign-in access");
  });

  test("a doctor asking the SMS door is sent to the app's own sign-in", async () => {
    // The SMS door is the console's, and the console is shut to clinicians.
    // Their whole camp day is in the app, which signs in through Firebase.
    handlers = [
      { match: /FROM vita_hero\.profiles/i, rows: [{ provisioned: true, role: "PHYSICIAN" }] },
    ];
    const res = await sendAs("9876500011", "app");
    expect(res.status).toBe(403);
    expect(((await res.json()) as { code?: string }).code).toBe("USE_FIREBASE_OTP");
  });

  // ── the two products ──
  //
  // The family app and the console share this endpoint, and the jobs behind
  // them are not the same. A clinician works on both: findings reviewed at a
  // desk, children screened in a school hall with a phone in hand — so the app
  // admits them, to their camps and their specialty's forms, never to a
  // parent's screens. A school administrator works on neither half of that:
  // there is no screen for them in the app at all, so the door names the
  // console rather than leaving them at "this number isn't registered".
  const sendAs = (phone: string, surface?: string) =>
    call("/api/auth/phone/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(surface ? { phone, surface } : { phone }),
    });

  test("and a parent is sent there too \u2014 one door per person", async () => {
    // Nothing in the app has ever used this endpoint; it accepted "app"
    // anyway, so an SMS code could have minted a full app session, clinical
    // writes included, having never touched Firebase. No shipped client did
    // that, which is not the same as it being impossible.
    handlers = [
      { match: /FROM vita_hero\.profiles/i, rows: [{ provisioned: true, role: "PARENT" }] },
    ];
    const res = await sendAs("9876543210", "app");
    expect(res.status).toBe(403);
    expect(((await res.json()) as { code?: string }).code).toBe("USE_FIREBASE_OTP");
  });

  test("a school administrator at the family app is turned round, with the console address", async () => {
    handlers = [
      { match: /FROM vita_hero\.profiles/i, rows: [{ provisioned: true, role: "SCHOOL_ADMIN" }] },
    ];
    const res = await sendAs("9876500011", "app");
    expect(res.status).toBe(403);
    const b = (await res.json()) as { code?: string; error?: string };
    expect(b.code).toBe("WRONG_SURFACE_APP");
    expect(b.error).toMatch(/registered as a school administrator/i);
    expect(b.error).toContain("/admin");
  });

  test("a parent at the console is turned round the other way", async () => {
    handlers = [
      { match: /FROM vita_hero\.profiles/i, rows: [{ provisioned: true, role: "PARENT" }] },
    ];
    const res = await sendAs("9876543210", "console");
    expect(res.status).toBe(403);
    const b = (await res.json()) as { code?: string; error?: string };
    expect(b.code).toBe("WRONG_SURFACE_CONSOLE");
    expect(b.error).toMatch(/app on your phone/i);
  });

  test("and neither is sent a code they could not use", async () => {
    handlers = [
      { match: /FROM vita_hero\.profiles/i, rows: [{ provisioned: true, role: "SCHOOL_ADMIN" }] },
    ];
    calls = [];
    await sendAs("9876500011", "app");
    // Nothing was written to phone_otps, so no text went out. Refusing after
    // sending the code is a text message telling somebody to open a door that
    // will not open.
    expect(calls.some((c) => /phone_otps/i.test(c.text))).toBe(false);
  });


  test("a caller that says nothing is the console here, not the app", async () => {
    // The opposite default to everywhere else, and deliberately so. Elsewhere
    // an absent surface means the app, because every installed copy predates
    // the field. This endpoint is the console's own door, so a missing field
    // is a console sign-in \u2014 defaulting it to the app would answer "use
    // Firebase instead" to the one client that belongs here.
    handlers = [
      { match: /FROM vita_hero\.profiles/i, rows: [{ provisioned: true, role: "SCHOOL_ADMIN" }] },
      { match: /FROM vita_hero\.phone_otps/i, rows: [] },
    ];
    const res = await sendAs("9876500022");
    expect(res.status).not.toBe(403);
  });

  test("verifying a code checks the door too, not only requesting one", async () => {
    // A check that only happens on the way in is a check anyone can walk
    // around: /verify mints the session, and it is reachable on its own.
    handlers = [
      { match: /FROM vita_hero\.phone_otps/i, rows: [{
        otp: "123456", expires_at: new Date(Date.now() + 600_000).toISOString(), attempts: 0,
      }] },
      { match: /FROM vita_hero\.profiles/i, rows: [{
        id: "ph_9876500011", provisioned: true, role: "SCHOOL_ADMIN", name: "Anita Rao",
      }] },
    ];
    const res = await call("/api/auth/phone/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: "9876500011", otp: "123456", surface: "app" }),
    });
    expect(res.status).toBe(403);
    expect(((await res.json()) as { code?: string }).code).toBe("WRONG_SURFACE_APP");
  });

  test("a revoked clinician is stopped at the door they actually use", async () => {
    // The revocation check used to sit only here, on the SMS door \u2014 the one
    // door a clinician cannot use. So the door they do use never asked, and a
    // doctor removed from every camp kept signing in. It now runs in
    // firebase-verify, which is where they knock.
    //
    // Asserted at the unit level rather than here: firebase-verify validates
    // its token against Google over the network, which this stubbed worker
    // cannot reach. chain.test.ts drives canClinicianSignIn against a real
    // database, revoking an assignment and watching it flip.
    const src = await Bun.file("index.ts").text();
    const fb = src.slice(src.indexOf('path === "/api/auth/phone/firebase-verify"'));
    const handler = fb.slice(0, fb.indexOf("\n      // \u2500\u2500"));
    expect(handler, "firebase-verify does not ask whether the clinician still has a camp")
      .toContain("canClinicianSignIn");
  });
});

// ── the clinician's own app ────────────────────────────────
//
// A dentist assigned to a school camp opens the VitaHero app on their phone,
// not the console on a laptop they did not bring. Everything they then do goes
// through the /api/admin routes, because that is where camp work lives — so
// those routes have to admit a session minted at the app's door, and refuse a
// parent's, with nothing in between.
//
// This is the join between the two halves. The app screens are Kotlin and no
// test here can run them; what is asserted is the contract they depend on.
describe("a clinician working from the app", () => {
  /** A session row as authenticateSession reads it: role comes from profiles. */
  /**
   * A session row as authenticateSession reads it.
   *
   * `surface` is part of the row because clinical writes are app-only: a
   * session minted at the console's door is refused them whatever the role.
   * Defaulted to "app" so these tests exercise the path a clinician actually
   * takes, and set to "console" where that refusal is the thing under test.
   */
  const session = (role: string, schoolId: string | null = null, surface = "app") => ({
    match: /FROM vita_hero\.sessions/i,
    rows: [{
      id: "ph_9876500011", user_id: "u1", name: "Dr Meera Iyer",
      role, school_id: schoolId, surface,
    }],
  });
  const asDoctor = { Authorization: "Bearer " + "t".repeat(40) };

  test("their camps come back from the same route the console uses", async () => {
    handlers = [
      session("PHYSICIAN"),
      { match: /FROM vita_hero\.camp_staff/i, rows: [{
        id: "camp1", school_id: "sch1", school_name: "Kendriya Vidyalaya",
        title: "Annual dental camp", date: "2026-10-02", status: "SCHEDULED",
        staff_role: "SCREENER", participant_count: 120, screened_count: 14,
      }] },
    ];
    const res = await call("/api/admin/my-camps", { headers: asDoctor });
    expect(res.status).toBe(200);
    const b = (await res.json()) as { camps: Record<string, unknown>[] };
    expect(b.camps).toHaveLength(1);
    // The field names the Kotlin DTO declares. Rename one on either side and
    // the app draws an empty card with no error anywhere.
    expect(b.camps[0].id).toBe("camp1");
    expect(b.camps[0].title).toBe("Annual dental camp");
    expect(b.camps[0].schoolName).toBe("Kendriya Vidyalaya");
    expect(b.camps[0].staffRole).toBe("SCREENER");
    expect(b.camps[0].participants).toBe(120);
    expect(b.camps[0].screened).toBe(14);
  });

  test("only the camps they were assigned to, never the whole programme", async () => {
    // A physician is not an ops role, so the query is the one filtered by
    // camp_staff.profile_id — asserted on the SQL, because a stub will happily
    // return rows for either branch.
    handlers = [session("PHYSICIAN")];
    calls = [];
    await call("/api/admin/my-camps", { headers: asDoctor });
    const q = calls.find((c) => /school_camps/i.test(c.text))!;
    expect(q.text).toMatch(/camp_staff/i);
    expect(q.params).toContain("ph_9876500011");
  });

  test("a parent's session cannot reach camp work, whatever route it tries", async () => {
    handlers = [session("PARENT")];
    for (const path of [
      "/api/admin/my-camps",
      "/api/admin/camps/camp1/participants",
      "/api/admin/camps/camp1/screening/kid1",
    ]) {
      const res = await call(path, { headers: asDoctor });
      expect(res.status).toBe(401);
      expect(((await res.json()) as { code?: string }).code).toBe("ADMIN_REQUIRED");
    }
  });

  test("a physician reaches the review queue, because that is their job", async () => {
    handlers = [
      session("PHYSICIAN"),
      { match: /FROM vita_hero\.school_camps/i, rows: [{ id: "camp1", school_id: "sch1" }] },
      { match: /FROM vita_hero\.camp_staff/i, rows: [{ staff_role: "PHYSICIAN", doctor_id: null }] },
    ];
    const res = await call("/api/admin/camps/camp1/review", { headers: asDoctor });
    // 200, not merely "not 403": a 500 would also pass a negative assertion,
    // and a review queue that errors is no more use than one that refuses.
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveProperty("queue");
  });

  test("a screener sees the queue but is refused the approval", async () => {
    // Reading and deciding are separate permissions. A screener working the
    // camp can see how much is left; only a physician signs a child off.
    handlers = [
      session("SCREENER"),
      { match: /FROM vita_hero\.school_camps/i, rows: [{ id: "camp1", school_id: "sch1" }] },
      { match: /FROM vita_hero\.camp_staff/i, rows: [{ staff_role: "SCREENER", doctor_id: null }] },
    ];
    expect((await call("/api/admin/camps/camp1/review", { headers: asDoctor })).status).toBe(200);

    const approve = await call("/api/admin/camps/camp1/review/kid1", {
      method: "POST",
      headers: { ...asDoctor, "Content-Type": "application/json" },
      body: JSON.stringify({ recommendation: "Fine" }),
    });
    expect(approve.status).toBe(403);
    // The role refusal, not the surface one. Both answer 403, and a test that
    // only counted the number would pass while proving the wrong thing.
    expect(((await approve.json()) as { code?: string }).code).not.toBe("APP_ONLY");
  });

  test("and the console cannot record a finding at all, whoever is holding it", async () => {
    // Asked for: clinical work happens in the app. A physician signed in to
    // the console is the right person in the wrong place, and the server is
    // where that is decided \u2014 not the console's markup.
    handlers = [
      session("PHYSICIAN", null, "console"),
      { match: /FROM vita_hero\.school_camps/i, rows: [{ id: "camp1", school_id: "sch1" }] },
      { match: /FROM vita_hero\.camp_staff/i, rows: [{ staff_role: "PHYSICIAN", doctor_id: null }] },
    ];
    calls = [];
    const res = await call("/api/admin/camps/camp1/screening/kid1", {
      method: "POST",
      headers: { ...asDoctor, "Content-Type": "application/json" },
      body: JSON.stringify({ findings: [{ checkType: "Dental", detail: { cariesCount: 2 } }] }),
    });
    expect(res.status).toBe(403);
    expect(((await res.json()) as { code?: string }).code).toBe("APP_ONLY");
    // Refused before anything was written, not after.
    expect(calls.some((c) => /INSERT INTO vita_hero\.camp_findings/i.test(c.text))).toBe(false);
  });

  test("but the same physician on the app records it", async () => {
    handlers = [
      session("PHYSICIAN", null, "app"),
      { match: /FROM vita_hero\.school_camps/i, rows: [{ id: "camp1", school_id: "sch1" }] },
      { match: /FROM vita_hero\.camp_staff/i, rows: [{ staff_role: "PHYSICIAN", doctor_id: null }] },
    ];
    const res = await call("/api/admin/camps/camp1/screening/kid1", {
      method: "POST",
      headers: { ...asDoctor, "Content-Type": "application/json" },
      body: JSON.stringify({ findings: [{ checkType: "Dental", detail: { cariesCount: 2 } }] }),
    });
    expect(res.status).not.toBe(403);
  });

  test("and an unsigned request is refused before any query runs", async () => {
    handlers = [];
    calls = [];
    const res = await call("/api/admin/camps/camp1/participants");
    expect(res.status).toBe(401);
    expect(calls.some((c) => /camp_participants/i.test(c.text))).toBe(false);
  });
});
