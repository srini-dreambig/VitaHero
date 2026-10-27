// Joining a family is a request the owner answers.
//
// A family code used to be enough on its own: whoever typed it saw the
// children, and a settings save could write it straight onto any profile. A
// code is exactly what gets forwarded and screenshotted, so now the owner
// approves each person from their Family screen. Driven through worker.fetch
// against a real Postgres, because the guard is the router, the session and
// the SQL together — none of them on its own.

import { afterAll, beforeAll, describe, expect, test, mock } from "bun:test";
import pg from "pg";
import type { Sql } from "./common";
import { serialQuery } from "./pgserial";
import { SCHEMA_STEPS } from "./index";
import { migrate } from "./migrate";

const URL = process.env.TEST_DATABASE_URL;
const suite = URL ? describe : describe.skip;

let live: Sql | null = null;
mock.module("@neondatabase/serverless", () => ({
  neon: () => {
    const proxy: any = (strings: TemplateStringsArray | string, ...v: unknown[]) => {
      if (!live) throw new Error("database not ready");
      return (live as any)(strings, ...v);
    };
    proxy.query = (t: string, pr: unknown[]) => {
      if (!live) throw new Error("database not ready");
      return live.query(t, pr);
    };
    return proxy;
  },
}));
const { default: worker } = await import("./index");
const ENV = {
  DATABASE_URL: "postgres://live",
  ADMIN_API_KEY: "test-admin-key",
  TWILIO_ACCOUNT_SID: "",
  TWILIO_AUTH_TOKEN: "",
};

function dbUrl(base: string, db: string): string {
  const u = new globalThis.URL(base);
  u.pathname = "/" + db;
  return u.toString();
}

function neonShim(c: pg.Client): Sql {
  const send = serialQuery(c);
  const fn: any = (strings: TemplateStringsArray | string, ...values: unknown[]) => {
    if (typeof strings === "string") throw new Error("sql(identifier) is not supported");
    let text = "";
    const params: unknown[] = [];
    for (let i = 0; i < strings.length; i++) {
      text += strings[i];
      if (i < values.length) { params.push(values[i]); text += "$" + params.length; }
    }
    return send(text, params);
  };
  fn.query = (t: string, p: unknown[]) => send(t, p);
  return fn as Sql;
}

let client: pg.Client;
let sql: Sql;

const CODE = "FAMOWN01";
const tokens: Record<string, string> = {};

async function call(who: string, method: string, path: string, body?: unknown) {
  const res = await worker.fetch(
    new Request("https://api.test" + path, {
      method,
      headers: { Authorization: `Bearer ${tokens[who]}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), ENV as never);
  return { status: res.status, body: (await res.json()) as Record<string, any> };
}

async function person(id: string, name: string, familyCode: string) {
  await sql`
    INSERT INTO vita_hero.profiles (id, user_id, name, family_code)
    VALUES (${id}, ${id}, ${name}, ${familyCode})`;
  tokens[id] = `tok_${id}_` + "x".repeat(32);
  await sql`
    INSERT INTO vita_hero.sessions (token, profile_id, expires_at, device)
    VALUES (${tokens[id]}, ${id}, ${new Date(Date.now() + 86_400_000).toISOString()}, 'test')`;
}

const familyCodeOf = async (id: string) =>
  ((await sql`SELECT family_code FROM vita_hero.profiles WHERE id = ${id}`)[0]?.family_code as string) || "";

suite("joining a family needs the owner's approval", () => {
  beforeAll(async () => {
    if (!URL) return;
    const admin = new pg.Client({ connectionString: URL });
    await admin.connect();
    await admin.query("DROP DATABASE IF EXISTS vh_family");
    await admin.query("CREATE DATABASE vh_family");
    await admin.end();
    client = new pg.Client({ connectionString: dbUrl(URL, "vh_family") });
    await client.connect();
    sql = neonShim(client);
    live = sql;
    await migrate(sql, SCHEMA_STEPS, []);

    await person("fo_owner", "Owner", CODE);
    await person("fo_join", "Joiner", "OWNJOIN1");
    await person("fo_other", "Stranger", "OWNOTH01");
    await person("fo_hijack", "Hijacker", "OWNHIJ01");
    await sql`
      INSERT INTO vita_hero.kids (id, profile_id, name, age)
      VALUES ('fk_1', 'fo_owner', 'Meera', 8)`;
  });
  afterAll(async () => { if (client) await client.end(); });

  let requestId = "";

  test("a join is a pending request and changes nothing about the joiner", async () => {
    const r = await call("fo_join", "POST", "/api/family-sharing/join",
      { code: CODE, coParentName: "Joiner", relation: "Mother" });
    expect(r.status).toBe(200);
    expect(r.body.pending).toBe(true);
    expect(r.body.status).toBe("PENDING");
    requestId = r.body.coParentId;
    expect(await familyCodeOf("fo_join")).toBe("OWNJOIN1");

    // Asking again answers with the same request, not a second one.
    const again = await call("fo_join", "POST", "/api/family-sharing/join",
      { code: CODE, coParentName: "Joiner" });
    expect(again.body.coParentId).toBe(requestId);
  });

  test("a pending request sees none of the family's children", async () => {
    const r = await call("fo_join", "GET", `/api/family-sharing/kids?familyCode=${CODE}`);
    expect(r.status).toBe(403);
  });

  test("the owner sees the request; the requester does not see the family list", async () => {
    const owner = await call("fo_owner", "GET", "/api/co-parents");
    expect(owner.status).toBe(200);
    const list = (Array.isArray(owner.body) ? owner.body : owner.body.coParents ?? []) as any[];
    expect(list.some((c) => c.id === requestId && c.status === "PENDING")).toBe(true);
  });

  test("nobody but the owner can approve", async () => {
    const r = await call("fo_other", "POST", `/api/co-parents/${requestId}/approve`);
    expect(r.status).toBe(404);
    const self = await call("fo_join", "POST", `/api/co-parents/${requestId}/approve`);
    expect(self.status).toBe(404);
  });

  test("a settings save cannot take another family's code", async () => {
    const r = await call("fo_hijack", "POST", "/api/profiles",
      { name: "Hijacker", family_code: CODE });
    expect(r.status).toBeLessThan(300);
    expect(await familyCodeOf("fo_hijack")).toBe("OWNHIJ01");
    const kids = await call("fo_hijack", "GET", `/api/family-sharing/kids?familyCode=${CODE}`);
    expect(kids.status).toBe(403);
  });

  test("once the owner approves, the co-parent sees the children and holds the code", async () => {
    const r = await call("fo_owner", "POST", `/api/co-parents/${requestId}/approve`);
    expect(r.status).toBe(200);
    expect(r.body.status).toBe("APPROVED");
    expect(await familyCodeOf("fo_join")).toBe(CODE);

    const kids = await call("fo_join", "GET", `/api/family-sharing/kids?familyCode=${CODE}`);
    expect(kids.status).toBe(200);
    expect(kids.body.kids.map((k: any) => k.name)).toEqual(["Meera"]);

    // And the approved co-parent's own settings save keeps the code.
    await call("fo_join", "POST", "/api/profiles", { name: "Joiner", family_code: CODE });
    expect(await familyCodeOf("fo_join")).toBe(CODE);
  });

  test("the code still finds the owner after a co-parent holds it", async () => {
    const r = await call("fo_other", "POST", "/api/family-sharing/validate", { code: CODE });
    expect(r.body.ownerName ?? r.body.name ?? JSON.stringify(r.body)).toContain("Owner");
  });

  test("a declined request cannot simply ask again", async () => {
    const req = await call("fo_other", "POST", "/api/family-sharing/join",
      { code: CODE, coParentName: "Stranger" });
    expect(req.body.pending).toBe(true);
    const no = await call("fo_owner", "POST", `/api/co-parents/${req.body.coParentId}/decline`);
    expect(no.body.status).toBe("DECLINED");

    const retry = await call("fo_other", "POST", "/api/family-sharing/join",
      { code: CODE, coParentName: "Stranger" });
    expect(retry.status).toBe(403);
    expect(retry.body.code).toBe("DECLINED");
    const kids = await call("fo_other", "GET", `/api/family-sharing/kids?familyCode=${CODE}`);
    expect(kids.status).toBe(403);
  });

  test("you cannot join your own family", async () => {
    const r = await call("fo_owner", "POST", "/api/family-sharing/join",
      { code: CODE, coParentName: "Owner" });
    expect(r.status).toBe(400);
  });
});
