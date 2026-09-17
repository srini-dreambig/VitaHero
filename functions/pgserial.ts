// Test support only — not reachable from the worker.
//
// Production reads that do not depend on each other are issued together with
// Promise.all, because on Cloudflare each one is a separate outbound request
// to Neon and Neon's HTTP driver is happy to have several in flight. The local
// suite talks to a real Postgres through node-postgres, whose Client can only
// carry one query at a time and warns (and from pg@9, throws) when a second
// starts before the first finishes.
//
// Queueing them here keeps the tests exercising the real, concurrent code path
// instead of forcing the code back into sequential awaits to suit the harness.
export function serialQuery(c: {
  query(text: string, params: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}) {
  let tail: Promise<unknown> = Promise.resolve();
  return (text: string, params: unknown[] = []): Promise<Record<string, unknown>[]> => {
    const queued = tail.then(() => c.query(text, params).then((r) => r.rows));
    // Swallow failures on the chain itself: one query throwing must not stop
    // the next from being sent. The caller still sees its own rejection.
    tail = queued.catch(() => {});
    return queued;
  };
}
