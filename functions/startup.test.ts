// What a first request on a completely fresh database costs.
//
// Its own file on purpose. This installs a counting stub over the Neon driver
// with `mock.module`, and that replacement is global for the rest of the file
// it runs in — it cannot see the per-test `handlers` every other suite uses, so
// sharing a file with them silently turns their sessions into 401s. It did
// exactly that for an afternoon.
import { describe, expect, test, mock } from "bun:test";

const ENV = {
  DATABASE_URL: "postgres://stub",
  TWILIO_ACCOUNT_SID: "",
  TWILIO_AUTH_TOKEN: "",
  ADMIN_API_KEY: "test-admin-key",
};
const opsHeaders = { "X-Admin-Key": "test-admin-key", "Content-Type": "application/json" };

// ── what a first request on a fresh database costs ──
//
// Cloudflare allows 50 outbound subrequests on the free plan, and the route
// still has its own queries to make after the database is brought up to date.
// The DDL has been batched since the outage that prompted migrate.ts; the
// seeds had not been, and ran one statement at a time after it. This pins the
// whole budget so neither half can creep back up unnoticed.
describe("bringing up a fresh database", () => {
  test("costs a small, flat number of subrequests", async () => {
    let statements = 0;
    let transactions = 0;

    const makeCounted = () => {
      const run = () => { statements++; return Promise.resolve([] as Record<string, unknown>[]); };
      const sql: any = (strings: TemplateStringsArray | string) => {
        if (typeof strings === "string") throw new Error("sql(identifier) is not supported by the Neon driver");
        return run();
      };
      sql.query = () => run();
      // The Neon driver sends a whole transaction as one request, so the
      // statements inside it must not be counted twice.
      sql.transaction = (queries: unknown[]) => {
        statements -= queries.length;
        transactions++;
        return Promise.resolve([]);
      };
      return sql;
    };

    mock.module("@neondatabase/serverless", () => ({ neon: () => makeCounted() }));
    // A distinct specifier, so this gets its own module instance: bun shares
    // the registry across test files, and index.ts latches "schema is ready"
    // after the first request. Without this the migration never runs and the
    // measurement is of nothing — which the floor assertion below catches.
    const fresh = (await import("./index?fresh-db-budget")).default;
    await fresh.fetch(
      new Request("https://api.test/api/admin/schools", { headers: opsHeaders }),
      ENV as never
    );

    const subrequests = transactions + statements;
    console.log(`    fresh database: ${transactions} transactions + ${statements} statements = ${subrequests} subrequests`);
    // Guard against the test passing because the module-level "schema ready"
    // latch was already set by an earlier test and migrate() never ran.
    expect(transactions).toBeGreaterThan(0);
    // Measured at 13: four batched DDL transactions, the version gate, three
    // seed guards, four seed inserts and the version write. Generous headroom,
    // but far below the 50 that took the worker down before.
    expect(subrequests).toBeLessThan(25);

    // The seeds are the half that used to scale with their own content: an
    // article per locale, a school per row. They are flat now, so adding seed
    // data cannot walk the worker back into the cap.
    expect(statements).toBeLessThan(12);
  });
});

