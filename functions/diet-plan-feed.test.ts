// The dietician's plan is what earns badges, and the parent hears about it.
//
// On a day a plan covers, only the plan's own targets count toward streaks
// and badges, so the plan slot cannot be something the app simply claims: a
// meal sent under it that is not one of the plan's targets is stored as an
// ordinary item. And a new or changed plan shows in the parent's
// notifications, which it never did. Driven through worker.fetch against a
// real Postgres.

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

const tokens: Record<string, string> = {};

async function call(who: string, method: string, path: string, body?: unknown) {
  const res = await worker.fetch(
    new Request("https://api.test" + path, {
      method,
      headers: { Authorization: `Bearer ${tokens[who]}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), ENV as never);
  return { status: res.status, body: (await res.json()) as any };
}

async function person(id: string, name: string) {
  await sql`INSERT INTO vita_hero.profiles (id, user_id, name) VALUES (${id}, ${id}, ${name})`;
  tokens[id] = `tok_${id}_` + "x".repeat(32);
  await sql`
    INSERT INTO vita_hero.sessions (token, profile_id, expires_at, device)
    VALUES (${tokens[id]}, ${id}, ${new Date(Date.now() + 86_400_000).toISOString()}, 'test')`;
}

const slotOf = async (id: string) =>
  ((await sql`SELECT time_slot FROM vita_hero.meal_items WHERE id = ${id}`)[0]?.time_slot as string) ?? null;

suite("the dietician's plan", () => {
  beforeAll(async () => {
    if (!URL) return;
    const admin = new pg.Client({ connectionString: URL });
    await admin.connect();
    await admin.query("DROP DATABASE IF EXISTS vh_plan");
    await admin.query("CREATE DATABASE vh_plan");
    await admin.end();
    client = new pg.Client({ connectionString: dbUrl(URL, "vh_plan") });
    await client.connect();
    sql = neonShim(client);
    live = sql;
    await migrate(sql, SCHEMA_STEPS, []);

    await person("pp_mum", "Lakshmi");
    await person("pp_other", "Other");
    await sql`INSERT INTO vita_hero.kids (id, profile_id, name, age)
              VALUES ('pk_1', 'pp_mum', 'Anu', 9), ('pk_2', 'pp_other', 'Raju', 9)`;
    await sql`INSERT INTO vita_hero.diet_plans (id, kid_id, author_name, title, targets, status, created_at)
              VALUES ('dp_old', 'pk_1', 'Ms Rani', 'Iron', ${JSON.stringify([{ label: "Dates", value: "2" }])}::jsonb,
                      'ENDED', NOW() - INTERVAL '10 days'),
                     ('dp_1', 'pk_1', 'Ms Rani', 'Iron', ${JSON.stringify([{ label: "Spinach dal", value: "1 bowl" }])}::jsonb,
                      'ACTIVE', NOW() - INTERVAL '1 day')`;
  });
  afterAll(async () => { if (client) await client.end(); });

  test("a real plan target keeps its plan slot", async () => {
    const r = await call("pp_mum", "POST", "/api/meals",
      [{ id: "plan_dp_1_0_2026-10-28", kid_id: "pk_1", time_slot: "Plan", name: "Spinach dal", eaten: true }]);
    expect(r.status).toBe(201);
    expect(await slotOf("plan_dp_1_0_2026-10-28")).toBe("Plan");
  });

  test("anything else sent as a plan item is kept, but out of the plan slot", async () => {
    await call("pp_mum", "POST", "/api/meals", [
      // Not a plan id at all.
      { id: "m_fake", kid_id: "pk_1", time_slot: "Plan", name: "Chips", eaten: true },
      // A plan id, but a label the plan does not have.
      { id: "plan_dp_1_0_2026-10-27", kid_id: "pk_1", time_slot: "Plan", name: "Chips", eaten: true },
      // The real target on another day is still the plan's.
      { id: "plan_dp_1_0_2026-10-26", kid_id: "pk_1", time_slot: "Plan", name: "Spinach dal", eaten: true },
    ]);
    expect(await slotOf("m_fake")).toBe("");
    expect(await slotOf("plan_dp_1_0_2026-10-27")).toBe("");
    expect(await slotOf("plan_dp_1_0_2026-10-26")).toBe("Plan");

    const other = await call("pp_other", "POST", "/api/meals",
      [{ id: "plan_dp_1_0_2026-10-25", kid_id: "pk_2", time_slot: "Plan", name: "Spinach dal", eaten: true }]);
    expect(other.status).toBe(201);
    expect(await slotOf("plan_dp_1_0_2026-10-25")).toBe("");
  });

  test("the parent's notifications say the plan changed, and who changed it", async () => {
    const r = await call("pp_mum", "GET", "/api/notifications");
    expect(r.status).toBe(200);
    const plan = (r.body as any[]).filter((n) => n.id.startsWith("plan_"));
    expect(plan.length).toBe(1);
    expect(plan[0]).toMatchObject({ id: "plan_dp_1", type: "DIET", title: "Diet plan updated", unread: true });
    expect(plan[0].body).toContain("Ms Rani");
    expect(plan[0].body).toContain("Anu");
  });

  test("another family hears nothing about this child's plan", async () => {
    const r = await call("pp_other", "GET", "/api/notifications");
    expect((r.body as any[]).some((n) => String(n.id).startsWith("plan_"))).toBe(false);
  });
});
