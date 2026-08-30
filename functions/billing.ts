// K3 and K5 — school contracts, invoicing, and parent entitlements.
//
// I declined these first time round because no price has survived contact with
// a school, and building billing before the first contract is signed usually
// means building the wrong billing. That reasoning still holds, so what is
// built here is deliberately price-agnostic:
//
//   - a contract records a *shape* (per student per year, per camp, or a flat
//     fee) and a rate the school actually agreed to; the code has no opinion
//     about what that rate should be
//   - an invoice is generated from delivered volume — students actually
//     screened, camps actually run — so it can only ever bill for work done
//   - there is no payment gateway. Invoices are documents that go out and get
//     marked paid. Adding Razorpay before anyone has agreed to pay would be
//     the premature part
//
// On parent subscriptions there is one rule this file enforces in code rather
// than leaving to good intentions:
//
//   PAYWALLABLE lists what a plan may gate. Clinical results, referrals,
//   consent and data rights are not on it and cannot be added by configuration.
//   A child's health findings are not a premium feature, and a family that
//   cannot pay must never be a family that cannot see whether their child
//   needs a doctor.

import { Sql, isOpsRole, slugify } from "./common";
import { Actor, ApiError, assertSchoolAccess } from "./schools";

export const CONTRACT_SHAPES = ["PER_STUDENT_YEAR", "PER_CAMP", "FLAT_ANNUAL", "FREE"] as const;
export const INVOICE_STATUSES = ["DRAFT", "SENT", "PAID", "VOID"] as const;
export const PARENT_PLANS = ["FREE", "PLUS"] as const;

/**
 * The only features a paid plan may ever gate.
 *
 * Everything absent from this list is free for every family, permanently:
 * camp results, flags, the physician's recommendation, referrals and their
 * closure, consent, export, correction, deletion, and the ability to ask the
 * school a question.
 */
export const PAYWALLABLE = [
  "AI_DIET_COACH",       // the generated meal suggestions
  "FOOD_PHOTO_LOGGING",  // convenience, not care
  "EXTRA_CHILD_PROFILES", // beyond the children a school enrolled
  "WEARABLE_SYNC",
] as const;
export type Paywallable = (typeof PAYWALLABLE)[number];

/** What each plan unlocks. FREE is the floor, and the floor includes all care. */
const PLAN_FEATURES: Record<string, Paywallable[]> = {
  FREE: [],
  PLUS: ["AI_DIET_COACH", "FOOD_PHOTO_LOGGING", "EXTRA_CHILD_PROFILES", "WEARABLE_SYNC"],
};

export async function ensureBillingSchema(sql: Sql): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.school_contracts (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      shape TEXT NOT NULL DEFAULT 'FREE',
      rate_paise BIGINT DEFAULT 0,
      currency TEXT DEFAULT 'INR',
      academic_year TEXT DEFAULT '',
      starts_on TEXT DEFAULT '',
      ends_on TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      active BOOLEAN DEFAULT true,
      created_by TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS contracts_school ON vita_hero.school_contracts(school_id, active)`;

  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.invoices (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      contract_id TEXT DEFAULT '',
      number TEXT NOT NULL,
      academic_year TEXT DEFAULT '',
      period_start TEXT DEFAULT '',
      period_end TEXT DEFAULT '',
      status TEXT DEFAULT 'DRAFT',
      subtotal_paise BIGINT DEFAULT 0,
      currency TEXT DEFAULT 'INR',
      issued_at TIMESTAMPTZ,
      paid_at TIMESTAMPTZ,
      note TEXT DEFAULT '',
      created_by TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS invoices_school ON vita_hero.invoices(school_id, status)`;

  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.invoice_lines (
      id TEXT PRIMARY KEY,
      invoice_id TEXT NOT NULL,
      description TEXT NOT NULL,
      quantity INT DEFAULT 0,
      unit_paise BIGINT DEFAULT 0,
      amount_paise BIGINT DEFAULT 0,
      evidence TEXT DEFAULT ''
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS invoice_lines_inv ON vita_hero.invoice_lines(invoice_id)`;

  await sql`ALTER TABLE vita_hero.profiles ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'FREE'`;
  await sql`ALTER TABLE vita_hero.profiles ADD COLUMN IF NOT EXISTS plan_until TIMESTAMPTZ`;
}

const rupees = (paise: number) => Math.round(paise) / 100;

// ─── K3 · Contracts ─────────────────────────────────────────

export async function setContract(
  sql: Sql,
  actor: Actor,
  schoolId: string,
  body: Record<string, unknown>
) {
  if (!isOpsRole(actor.role)) {
    throw new ApiError(403, "Contracts are set by VitaHero operations", "OPS_REQUIRED");
  }
  const shape = String(body.shape || "FREE").toUpperCase();
  if (!CONTRACT_SHAPES.includes(shape as (typeof CONTRACT_SHAPES)[number])) {
    throw new ApiError(400, `Shape must be one of ${CONTRACT_SHAPES.join(", ")}`, "BAD_SHAPE");
  }
  // Stored in paise so no arithmetic here ever touches a float.
  const rate = Math.max(0, Math.round(Number(body.ratePaise) || 0));
  if (shape !== "FREE" && rate === 0) {
    throw new ApiError(400, "A paid contract needs a rate", "NO_RATE");
  }

  await sql`UPDATE vita_hero.school_contracts SET active = false WHERE school_id = ${schoolId}`;
  const id = `con_${slugify(schoolId).slice(0, 20)}_${Date.now().toString(36)}`;
  await sql`
    INSERT INTO vita_hero.school_contracts
      (id, school_id, shape, rate_paise, academic_year, starts_on, ends_on, notes, active, created_by)
    VALUES (${id}, ${schoolId}, ${shape}, ${rate}, ${String(body.academicYear || "")},
            ${String(body.startsOn || "")}, ${String(body.endsOn || "")},
            ${String(body.notes || "")}, true, ${actor.profileId})
  `;
  return { contractId: id, shape, ratePaise: rate, rateRupees: rupees(rate) };
}

export async function getContract(sql: Sql, actor: Actor, schoolId: string) {
  assertSchoolAccess(actor, schoolId);
  const rows = await sql`
    SELECT * FROM vita_hero.school_contracts
    WHERE school_id = ${schoolId} AND active = true ORDER BY created_at DESC LIMIT 1
  `;
  if (rows.length === 0) return { contract: null };
  const c = rows[0];
  return {
    contract: {
      id: c.id as string,
      shape: c.shape as string,
      ratePaise: Number(c.rate_paise) || 0,
      rateRupees: rupees(Number(c.rate_paise) || 0),
      currency: (c.currency as string) || "INR",
      academicYear: (c.academic_year as string) || "",
      startsOn: (c.starts_on as string) || "",
      endsOn: (c.ends_on as string) || "",
      notes: (c.notes as string) || "",
    },
  };
}

// ─── K3 · Invoicing from delivered volume ───────────────────

/**
 * Build an invoice from what was actually delivered.
 *
 * Quantities come from released camp participation, never from a headcount
 * someone typed in, so an invoice cannot bill for a child who was never
 * screened. Every line carries the evidence it was derived from.
 */
export async function generateInvoice(
  sql: Sql,
  actor: Actor,
  schoolId: string,
  body: Record<string, unknown>
) {
  if (!isOpsRole(actor.role)) {
    throw new ApiError(403, "Invoices are raised by VitaHero operations", "OPS_REQUIRED");
  }
  const { contract } = await getContract(sql, actor, schoolId);
  if (!contract) throw new ApiError(400, "This school has no contract yet", "NO_CONTRACT");
  if (contract.shape === "FREE") {
    throw new ApiError(400, "This school is on a free contract — there is nothing to invoice", "FREE_CONTRACT");
  }

  const year = String(body.academicYear || contract.academicYear || "");
  const from = String(body.periodStart || contract.startsOn || "");
  const to = String(body.periodEnd || contract.endsOn || "");

  const camps = await sql`
    SELECT sc.id, sc.title, sc.date,
      (SELECT COUNT(DISTINCT p.kid_id)::int FROM vita_hero.camp_participants p
        WHERE p.camp_id = sc.id AND p.status = 'RELEASED') AS screened
    FROM vita_hero.school_camps sc
    WHERE sc.school_id = ${schoolId} AND sc.active = true AND sc.status = 'RELEASED'
      AND (${year === ""} OR sc.academic_year = ${year})
      AND (${from === ""} OR sc.date >= ${from})
      AND (${to === ""} OR sc.date <= ${to})
    ORDER BY sc.date
  `;

  const lines: Array<{ description: string; quantity: number; unit: number; amount: number; evidence: string }> = [];

  if (contract.shape === "PER_STUDENT_YEAR") {
    // Distinct children, so a child screened at two camps is billed once.
    const distinct = await sql`
      SELECT COUNT(DISTINCT p.kid_id)::int AS n
      FROM vita_hero.camp_participants p
      JOIN vita_hero.school_camps sc ON sc.id = p.camp_id
      WHERE sc.school_id = ${schoolId} AND p.status = 'RELEASED'
        AND (${year === ""} OR sc.academic_year = ${year})
    `;
    const n = (distinct[0]?.n as number) || 0;
    lines.push({
      description: `Health screening, ${year || "current year"} — per student`,
      quantity: n,
      unit: contract.ratePaise,
      amount: n * contract.ratePaise,
      evidence: `${n} distinct ${n === 1 ? "child" : "children"} with released results across ${camps.length} camp(s)`,
    });
  } else if (contract.shape === "PER_CAMP") {
    for (const c of camps) {
      lines.push({
        description: `${c.title as string} — ${c.date as string}`,
        quantity: 1,
        unit: contract.ratePaise,
        amount: contract.ratePaise,
        evidence: `${(c.screened as number) || 0} children screened and released`,
      });
    }
  } else if (contract.shape === "FLAT_ANNUAL") {
    lines.push({
      description: `Annual programme fee, ${year || "current year"}`,
      quantity: 1,
      unit: contract.ratePaise,
      amount: contract.ratePaise,
      evidence: `${camps.length} camp(s) delivered`,
    });
  }

  if (lines.length === 0 || lines.every((l) => l.quantity === 0)) {
    throw new ApiError(
      400,
      "Nothing has been delivered in this period yet, so there is nothing to invoice.",
      "NOTHING_DELIVERED"
    );
  }

  const subtotal = lines.reduce((a, l) => a + l.amount, 0);
  const seq = await sql`SELECT COUNT(*)::int AS n FROM vita_hero.invoices`;
  const number = `VH-${new Date().getUTCFullYear()}-${String(((seq[0]?.n as number) || 0) + 1).padStart(4, "0")}`;
  const id = `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  await sql`
    INSERT INTO vita_hero.invoices
      (id, school_id, contract_id, number, academic_year, period_start, period_end,
       status, subtotal_paise, note, created_by)
    VALUES (${id}, ${schoolId}, ${contract.id}, ${number}, ${year}, ${from}, ${to},
            'DRAFT', ${subtotal}, ${String(body.note || "")}, ${actor.profileId})
  `;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    await sql`
      INSERT INTO vita_hero.invoice_lines
        (id, invoice_id, description, quantity, unit_paise, amount_paise, evidence)
      VALUES (${`${id}_l${i}`}, ${id}, ${l.description}, ${l.quantity}, ${l.unit}, ${l.amount}, ${l.evidence})
    `;
  }

  return getInvoice(sql, actor, id);
}

export async function getInvoice(sql: Sql, actor: Actor, invoiceId: string) {
  const rows = await sql`
    SELECT i.*, s.name AS school_name, s.city
    FROM vita_hero.invoices i
    LEFT JOIN vita_hero.schools s ON s.id = i.school_id
    WHERE i.id = ${invoiceId} LIMIT 1
  `;
  if (rows.length === 0) throw new ApiError(404, "Invoice not found", "NOT_FOUND");
  const inv = rows[0];
  assertSchoolAccess(actor, inv.school_id as string);

  const lines = await sql`
    SELECT * FROM vita_hero.invoice_lines WHERE invoice_id = ${invoiceId} ORDER BY id
  `;
  return {
    invoice: {
      id: inv.id as string,
      number: inv.number as string,
      schoolName: (inv.school_name as string) || "",
      city: (inv.city as string) || "",
      academicYear: (inv.academic_year as string) || "",
      periodStart: (inv.period_start as string) || "",
      periodEnd: (inv.period_end as string) || "",
      status: (inv.status as string) || "DRAFT",
      subtotalPaise: Number(inv.subtotal_paise) || 0,
      subtotalRupees: rupees(Number(inv.subtotal_paise) || 0),
      currency: (inv.currency as string) || "INR",
      issuedAt: inv.issued_at ? String(inv.issued_at) : "",
      paidAt: inv.paid_at ? String(inv.paid_at) : "",
      note: (inv.note as string) || "",
    },
    lines: lines.map((l) => ({
      description: l.description as string,
      quantity: (l.quantity as number) || 0,
      unitRupees: rupees(Number(l.unit_paise) || 0),
      amountRupees: rupees(Number(l.amount_paise) || 0),
      evidence: (l.evidence as string) || "",
    })),
  };
}

export async function listInvoices(sql: Sql, actor: Actor, schoolId: string) {
  assertSchoolAccess(actor, schoolId);
  const rows = await sql`
    SELECT id, number, academic_year, status, subtotal_paise, issued_at, paid_at, created_at
    FROM vita_hero.invoices WHERE school_id = ${schoolId} ORDER BY created_at DESC LIMIT 100
  `;
  return {
    invoices: rows.map((r) => ({
      id: r.id as string,
      number: r.number as string,
      academicYear: (r.academic_year as string) || "",
      status: (r.status as string) || "DRAFT",
      amountRupees: rupees(Number(r.subtotal_paise) || 0),
      issuedAt: r.issued_at ? String(r.issued_at) : "",
      paidAt: r.paid_at ? String(r.paid_at) : "",
    })),
  };
}

/** Mark an invoice sent, paid, or void. There is no payment gateway by design. */
export async function setInvoiceStatus(
  sql: Sql,
  actor: Actor,
  invoiceId: string,
  status: string
) {
  if (!isOpsRole(actor.role)) {
    throw new ApiError(403, "Invoice status is set by VitaHero operations", "OPS_REQUIRED");
  }
  const s = status.toUpperCase();
  if (!INVOICE_STATUSES.includes(s as (typeof INVOICE_STATUSES)[number])) {
    throw new ApiError(400, `Status must be one of ${INVOICE_STATUSES.join(", ")}`, "BAD_STATUS");
  }
  const rows = await sql`
    UPDATE vita_hero.invoices
    SET status = ${s},
        issued_at = CASE WHEN ${s} = 'SENT' THEN COALESCE(issued_at, NOW()) ELSE issued_at END,
        paid_at = CASE WHEN ${s} = 'PAID' THEN NOW() ELSE paid_at END
    WHERE id = ${invoiceId}
    RETURNING id, status
  `;
  if (rows.length === 0) throw new ApiError(404, "Invoice not found", "NOT_FOUND");
  return { id: invoiceId, status: rows[0].status as string };
}

// ─── K5 · Parent entitlements ───────────────────────────────

/**
 * What this family can use.
 *
 * `care` is always true and is not derived from the plan. It exists so that
 * any future caller reaching for a gate has an obvious, correct answer for
 * anything clinical rather than being tempted to check the plan.
 */
export async function entitlements(sql: Sql, profileId: string) {
  const rows = await sql`
    SELECT plan, plan_until FROM vita_hero.profiles WHERE id = ${profileId} LIMIT 1
  `;
  let plan = (rows[0]?.plan as string) || "FREE";
  const until = rows[0]?.plan_until ? new Date(String(rows[0].plan_until)) : null;
  if (plan !== "FREE" && until && until.getTime() < Date.now()) plan = "FREE";

  const unlocked = PLAN_FEATURES[plan] || [];
  const features: Record<string, boolean> = {};
  for (const f of PAYWALLABLE) features[f] = unlocked.includes(f);

  return {
    plan,
    planUntil: until ? until.toISOString() : "",
    features,
    // Never gated, on any plan, ever.
    care: {
      campResults: true,
      referrals: true,
      consent: true,
      dataRights: true,
      askTheSchool: true,
      growthCharts: true,
    },
    notice:
      "Your child's health results, follow-ups and records are free and always will be. " +
      "A paid plan only adds convenience features.",
  };
}

/** Guard for a paywallable feature. Refuses outright for anything clinical. */
export async function requireFeature(sql: Sql, profileId: string, feature: string) {
  if (!(PAYWALLABLE as readonly string[]).includes(feature)) {
    // A programming error, not a user-facing one: something tried to gate care.
    throw new ApiError(
      500,
      `"${feature}" is not a feature that may be gated behind a plan.`,
      "NOT_PAYWALLABLE"
    );
  }
  const e = await entitlements(sql, profileId);
  if (!e.features[feature]) {
    throw new ApiError(402, "That is part of VitaHero Plus.", "UPGRADE_REQUIRED");
  }
  return true;
}

/** Ops sets a family's plan. No gateway: this is how a pilot comps accounts. */
export async function setParentPlan(
  sql: Sql,
  actor: Actor,
  profileId: string,
  plan: string,
  untilIso: string
) {
  if (!isOpsRole(actor.role)) {
    throw new ApiError(403, "Plans are set by VitaHero operations", "OPS_REQUIRED");
  }
  const p = plan.toUpperCase();
  if (!PARENT_PLANS.includes(p as (typeof PARENT_PLANS)[number])) {
    throw new ApiError(400, `Plan must be one of ${PARENT_PLANS.join(", ")}`, "BAD_PLAN");
  }
  await sql`
    UPDATE vita_hero.profiles
    SET plan = ${p}, plan_until = ${untilIso || null}
    WHERE id = ${profileId}
  `;
  return { profileId, plan: p, until: untilIso || "" };
}

/** Revenue actually recognised, for the ops view. Nothing projected. */
export async function billingSummary(sql: Sql, actor: Actor) {
  if (!isOpsRole(actor.role)) {
    throw new ApiError(403, "This is an operations view", "OPS_REQUIRED");
  }
  const inv = await sql`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'DRAFT')::int AS draft,
      COUNT(*) FILTER (WHERE status = 'SENT')::int AS sent,
      COUNT(*) FILTER (WHERE status = 'PAID')::int AS paid,
      COALESCE(SUM(subtotal_paise) FILTER (WHERE status = 'PAID'), 0) AS paid_paise,
      COALESCE(SUM(subtotal_paise) FILTER (WHERE status = 'SENT'), 0) AS outstanding_paise
    FROM vita_hero.invoices
  `;
  const contracts = await sql`
    SELECT shape, COUNT(*)::int AS n FROM vita_hero.school_contracts
    WHERE active = true GROUP BY shape
  `;
  const plans = await sql`
    SELECT COALESCE(plan,'FREE') AS plan, COUNT(*)::int AS n
    FROM vita_hero.profiles WHERE role = 'PARENT' GROUP BY plan
  `;
  // An aggregate always returns a row against Postgres, but a caller that
  // hands us an empty result should get zeros rather than a 500.
  const i = (inv[0] || {}) as Record<string, unknown>;
  return {
    invoices: {
      total: (i.total as number) || 0,
      draft: (i.draft as number) || 0,
      sent: (i.sent as number) || 0,
      paid: (i.paid as number) || 0,
      paidRupees: rupees(Number(i.paid_paise) || 0),
      outstandingRupees: rupees(Number(i.outstanding_paise) || 0),
    },
    contracts: contracts.map((c) => ({ shape: c.shape as string, schools: (c.n as number) || 0 })),
    parentPlans: plans.map((p) => ({ plan: p.plan as string, families: (p.n as number) || 0 })),
  };
}
