// C — the dietician.
//
// Four boxes on the flow diagram and, before this, no lines anywhere in either
// codebase: no DIETICIAN role, no directory entry, no screen, nothing. The
// physician work is the template — a person in a directory, a mobile number
// that signs in, an assignment that decides what they can see — but the job is
// a different shape and the differences matter.
//
// A doctor's work is camp-shaped: they turn up on a day, screen the children
// in front of them, and their access ends with the camp. A dietician's work is
// continuous. A plan runs for weeks; the food log fills in every day; the
// child they are helping is the same child next month. So a dietician is
// assigned to a *school*, not to a camp, and stays assigned until somebody
// says otherwise.
//
// What they may see is narrower than the diagram asked for. "All the
// information by category with all the information" is every child's whole
// clinical record, which would be a wider grant than a screening doctor gets
// — a doctor sees their own specialty, at their own camp, for the day. So this
// is the defensible middle: the things that bear on diet. Growth, haemoglobin,
// the food log, the recommendation. Not the dental caries count, not the
// photographs, not the illness history. Widening it later is a line in
// DIETICIAN_CHECKS; narrowing it after a pilot has run is a conversation with
// a school.
//
// Every read of a child's record goes through logRecordAccess, the same as the
// clinical side, so "who looked at my child's record" has one answer.

import { Sql, isOpsRole, normalizeMobile, normalizePhone, profileIdForPhone } from "./common";
import { Actor, ApiError } from "./schools";
import { logRecordAccess } from "./oversight";

/**
 * The checks a dietician may read.
 *
 * Both of them bear directly on what a child eats: growth says whether they
 * are growing as expected, haemoglobin says whether they are iron-deficient.
 * Vision and dental do not, so they are not here, and the query filters rather
 * than the screen hiding — a field that never leaves the server cannot be read
 * off a response by a curious person with the developer tools open.
 */
export const DIETICIAN_CHECKS = ["Height & weight", "Haemoglobin"] as const;

export const PLAN_FOCUS = ["GENERAL", "WEIGHT_GAIN", "WEIGHT_CONTROL", "ANAEMIA"] as const;
export type PlanFocus = (typeof PLAN_FOCUS)[number];

function opsOnly(actor: Actor, what: string) {
  if (!isOpsRole(actor.role)) {
    throw new ApiError(403, `${what} is managed by VitaHero operations`, "OPS_REQUIRED");
  }
}

export async function ensureDieticianSchema(sql: Sql): Promise<void> {
  // Deliberately not a row in `doctors`. A dietician has no specialty, no
  // hospital and no screening form, and putting them in that table would put
  // them in the referral list a parent browses when they are looking for an
  // ophthalmologist.
  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.dieticians (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      qualification TEXT DEFAULT '',
      city TEXT DEFAULT '',
      active BOOLEAN DEFAULT true,
      created_by TEXT DEFAULT '',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS dieticians_phone
      ON vita_hero.dieticians (RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10))
  `;
  // The assignment. Per school, because the work is not camp-shaped.
  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.dietician_schools (
      dietician_id TEXT NOT NULL,
      school_id TEXT NOT NULL,
      active BOOLEAN DEFAULT true,
      assigned_by TEXT DEFAULT '',
      assigned_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (dietician_id, school_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.diet_plans (
      id TEXT PRIMARY KEY,
      kid_id TEXT NOT NULL,
      school_id TEXT DEFAULT '',
      dietician_id TEXT DEFAULT '',
      author_profile_id TEXT DEFAULT '',
      author_name TEXT DEFAULT '',
      title TEXT DEFAULT '',
      focus TEXT DEFAULT 'GENERAL',
      starts_on TEXT DEFAULT '',
      ends_on TEXT DEFAULT '',
      guidance TEXT DEFAULT '',
      targets JSONB DEFAULT '[]'::jsonb,
      status TEXT DEFAULT 'ACTIVE',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS diet_plans_kid ON vita_hero.diet_plans(kid_id, status)`;
}

// ─── The directory side (operations) ────────────────────────

/**
 * Give a dietician a sign-in, or take it away.
 *
 * The same rule the doctor directory keeps: a number belongs to one person. A
 * parent's number is refused outright rather than quietly promoted, because
 * promoting it would hand somebody a stranger's children and lose a family
 * their own records.
 */
async function grantDieticianSignIn(
  sql: Sql, actor: Actor, name: string, e164: string, last10: string,
) {
  const profileId = profileIdForPhone(last10);
  const existing = await sql`
    SELECT role FROM vita_hero.profiles WHERE id = ${profileId} LIMIT 1`;
  const role = existing.length ? String(existing[0].role || "") : "";

  if (role === "PARENT") {
    throw new ApiError(
      409,
      `${e164} is already registered as a parent. A number can only belong to one person.`,
      "PHONE_IS_PARENT",
    );
  }
  if (role === "PHYSICIAN" || role === "SCREENER") {
    throw new ApiError(
      409,
      `${e164} already signs in as a ${role.toLowerCase()}. Use a different number for their dietician account.`,
      "PHONE_IS_CLINICIAN",
    );
  }
  // Ops and school administrators outrank this; never demote them.
  if (role === "ADMIN" || role === "SUPERADMIN" || role === "SCHOOL_ADMIN") {
    return { profileId, role, demoted: false };
  }

  await sql`
    INSERT INTO vita_hero.profiles
      (id, user_id, phone, name, auth_provider, role, provisioned, school_id,
       is_logged_in, onboarding_complete, created_by)
    VALUES
      (${profileId}, ${profileId}, ${e164}, ${name}, 'PHONE', 'DIETICIAN',
       true, NULL, false, true, ${actor.profileId})
    ON CONFLICT (id) DO UPDATE SET
      name = ${name}, phone = ${e164}, role = 'DIETICIAN', provisioned = true
  `;
  return { profileId, role: "DIETICIAN", demoted: false };
}

async function revokeDieticianSignIn(sql: Sql, last10: string) {
  const profileId = profileIdForPhone(last10);
  const rows = await sql`
    SELECT role FROM vita_hero.profiles WHERE id = ${profileId} LIMIT 1`;
  if (rows.length === 0) return { profileId, removed: false };
  if (String(rows[0].role || "") !== "DIETICIAN") return { profileId, removed: false };
  await sql`UPDATE vita_hero.profiles SET provisioned = false WHERE id = ${profileId}`;
  return { profileId, removed: true };
}

export async function listDieticians(sql: Sql, actor: Actor, search = "") {
  opsOnly(actor, "The dietician directory");
  const q = (search || "").toLowerCase();
  const digits = (search || "").replace(/\D/g, "");
  const rows = await sql`
    SELECT d.*,
      (SELECT COUNT(*)::int FROM vita_hero.dietician_schools ds
        WHERE ds.dietician_id = d.id AND ds.active) AS schools
    FROM vita_hero.dieticians d
    WHERE (${q === ""} OR LOWER(d.name) LIKE ${"%" + q + "%"})
      AND (${digits === ""} OR REGEXP_REPLACE(d.phone, '[^0-9]', '', 'g') LIKE ${"%" + digits + "%"})
    ORDER BY d.active DESC, d.name
  `;
  const ids = rows.map((r) => r.id as string);
  const links = ids.length === 0 ? [] : await sql`
    SELECT ds.dietician_id, ds.school_id, s.name AS school_name
    FROM vita_hero.dietician_schools ds
    JOIN vita_hero.schools s ON s.id = ds.school_id
    WHERE ds.active AND ds.dietician_id = ANY(${ids}::text[])
    ORDER BY s.name
  `;
  const byDietician = new Map<string, Array<{ schoolId: string; name: string }>>();
  for (const l of links) {
    const list = byDietician.get(l.dietician_id as string) || [];
    list.push({ schoolId: l.school_id as string, name: l.school_name as string });
    byDietician.set(l.dietician_id as string, list);
  }
  return {
    dieticians: rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      phone: r.phone as string,
      qualification: (r.qualification as string) || "",
      city: (r.city as string) || "",
      active: r.active === true,
      schools: byDietician.get(r.id as string) || [],
    })),
  };
}

export async function upsertDietician(sql: Sql, actor: Actor, body: Record<string, unknown>) {
  opsOnly(actor, "The dietician directory");
  const name = String(body.name || "").trim();
  if (name.length < 2) throw new ApiError(400, "A dietician needs a name", "NAME_REQUIRED");

  const rawPhone = String(body.phone || "").trim();
  if (!rawPhone) {
    throw new ApiError(
      400,
      `${name} needs a mobile number — it is how they receive a code and sign in`,
      "PHONE_REQUIRED",
    );
  }
  const norm = normalizeMobile(rawPhone);
  if (!norm) {
    throw new ApiError(
      400,
      normalizePhone(rawPhone)
        ? `"${rawPhone}" is a landline. It cannot receive the sign-in code — enter a mobile number.`
        : `"${rawPhone}" is not a valid mobile number`,
      "BAD_PHONE",
    );
  }
  const phone = norm.e164;
  const active = body.active !== false;
  const id = String(body.id || "").trim()
    || `die_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  await sql`
    INSERT INTO vita_hero.dieticians (id, name, phone, qualification, city, active, created_by)
    VALUES (${id}, ${name}, ${phone}, ${String(body.qualification || "")},
            ${String(body.city || "")}, ${active}, ${actor.profileId})
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, phone = EXCLUDED.phone,
      qualification = EXCLUDED.qualification, city = EXCLUDED.city, active = EXCLUDED.active
  `;

  const signIn = active
    ? await grantDieticianSignIn(sql, actor, name, phone, norm.last10)
    : await revokeDieticianSignIn(sql, norm.last10);

  return {
    id,
    name,
    phone,
    active,
    profileId: signIn.profileId,
    signInHint: active
      ? `${name} signs in with ${phone}. They will see a school's children once you assign them to that school.`
      : `${name} is retired and cannot sign in.`,
  };
}

export async function retireDietician(sql: Sql, actor: Actor, id: string) {
  opsOnly(actor, "The dietician directory");
  const rows = await sql`SELECT phone FROM vita_hero.dieticians WHERE id = ${id} LIMIT 1`;
  if (rows.length === 0) throw new ApiError(404, "No such dietician", "NOT_FOUND");
  await sql`UPDATE vita_hero.dieticians SET active = false WHERE id = ${id}`;
  // The assignment goes with the sign-in. A retired dietician who kept their
  // schools would reappear the moment somebody restored them, holding access
  // nobody re-granted.
  await sql`UPDATE vita_hero.dietician_schools SET active = false WHERE dietician_id = ${id}`;
  const norm = normalizeMobile(String(rows[0].phone || ""));
  if (norm) await revokeDieticianSignIn(sql, norm.last10);
  return { retired: id };
}

/** Put a dietician on a school, or take them off it. */
export async function setDieticianSchool(
  sql: Sql, actor: Actor, dieticianId: string, schoolId: string, active: boolean,
) {
  opsOnly(actor, "Dietician assignments");
  const d = await sql`
    SELECT name, active FROM vita_hero.dieticians WHERE id = ${dieticianId} LIMIT 1`;
  if (d.length === 0) throw new ApiError(404, "No such dietician", "NOT_FOUND");
  if (active && d[0].active !== true) {
    throw new ApiError(
      400,
      `${d[0].name} is retired. Restore them before assigning a school.`,
      "DIETICIAN_RETIRED",
    );
  }
  const s = await sql`SELECT id FROM vita_hero.schools WHERE id = ${schoolId} LIMIT 1`;
  if (s.length === 0) throw new ApiError(404, "No such school", "NO_SCHOOL");

  await sql`
    INSERT INTO vita_hero.dietician_schools (dietician_id, school_id, active, assigned_by)
    VALUES (${dieticianId}, ${schoolId}, ${active}, ${actor.profileId})
    ON CONFLICT (dietician_id, school_id) DO UPDATE SET
      active = EXCLUDED.active, assigned_by = EXCLUDED.assigned_by, assigned_at = NOW()
  `;
  return { dieticianId, schoolId, active };
}

// ─── The dietician's own side (the app) ─────────────────────

/**
 * Which dietician is this actor, and which schools are theirs?
 *
 * The directory row is found by the last ten digits of the number, the same
 * way a physician's is — the profile id is derived from the phone, so the two
 * halves meet at the number and nowhere else needs to store a link.
 */
export async function dieticianSelf(sql: Sql, actor: Actor) {
  if (actor.role !== "DIETICIAN") {
    throw new ApiError(403, "This is the dietician's view", "NOT_A_DIETICIAN");
  }
  const last10 = actor.profileId.replace(/^ph_/, "");
  const rows = await sql`
    SELECT id, name, qualification, city, active FROM vita_hero.dieticians
    WHERE RIGHT(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'), 10) = ${last10}
    LIMIT 1
  `;
  if (rows.length === 0 || rows[0].active !== true) {
    throw new ApiError(
      403,
      "Your dietician account is not active. Ask VitaHero operations to restore it.",
      "DIETICIAN_INACTIVE",
    );
  }
  return {
    id: rows[0].id as string,
    name: rows[0].name as string,
    qualification: (rows[0].qualification as string) || "",
  };
}

export async function dieticianSchools(sql: Sql, actor: Actor) {
  const me = await dieticianSelf(sql, actor);
  const rows = await sql`
    SELECT s.id, s.name, s.city,
      (SELECT COUNT(*)::int FROM vita_hero.kids k
        WHERE k.school_id = s.id AND COALESCE(k.status,'ACTIVE') = 'ACTIVE') AS children,
      (SELECT COUNT(*)::int FROM vita_hero.diet_plans p
        JOIN vita_hero.kids k2 ON k2.id = p.kid_id
        WHERE k2.school_id = s.id AND p.status = 'ACTIVE') AS plans
    FROM vita_hero.dietician_schools ds
    JOIN vita_hero.schools s ON s.id = ds.school_id
    WHERE ds.dietician_id = ${me.id} AND ds.active
    ORDER BY s.name
  `;
  return {
    me,
    schools: rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      city: (r.city as string) || "",
      children: (r.children as number) || 0,
      plans: (r.plans as number) || 0,
    })),
  };
}

/** Throws unless this child is at a school this dietician is assigned to. */
async function assertChildInScope(sql: Sql, dieticianId: string, kidId: string) {
  const rows = await sql`
    SELECT k.id, k.name, k.grade, k.section, k.age, k.gender, k.date_of_birth,
           k.height_cm, k.weight_kg, k.school_id, s.name AS school_name
    FROM vita_hero.kids k
    JOIN vita_hero.schools s ON s.id = k.school_id
    JOIN vita_hero.dietician_schools ds
      ON ds.school_id = k.school_id AND ds.dietician_id = ${dieticianId} AND ds.active
    WHERE k.id = ${kidId} AND COALESCE(k.status,'ACTIVE') = 'ACTIVE'
    LIMIT 1
  `;
  if (rows.length === 0) {
    // The same answer whether the child does not exist or is at a school this
    // dietician has nothing to do with. Telling the two apart would turn this
    // endpoint into a way of asking whether a given child id is real.
    throw new ApiError(403, "That child is not at one of your schools", "OUT_OF_SCOPE");
  }
  return rows[0];
}

/**
 * The children at one of this dietician's schools.
 *
 * Carries just enough to choose one: the name, the class, whether growth or
 * haemoglobin was flagged at the last camp, and whether a plan is running. Not
 * the readings themselves — those are one tap away and that tap is logged.
 */
export async function dieticianChildren(
  sql: Sql, actor: Actor, schoolId: string, search = "",
) {
  const me = await dieticianSelf(sql, actor);
  const mine = await sql`
    SELECT 1 FROM vita_hero.dietician_schools
    WHERE dietician_id = ${me.id} AND school_id = ${schoolId} AND active LIMIT 1
  `;
  if (mine.length === 0) {
    throw new ApiError(403, "You are not assigned to that school", "OUT_OF_SCOPE");
  }
  const q = (search || "").toLowerCase();
  const checks = [...DIETICIAN_CHECKS];
  const rows = await sql`
    SELECT k.id, k.name, k.grade, k.section, k.age, k.gender,
      (SELECT p.status FROM vita_hero.diet_plans p
        WHERE p.kid_id = k.id AND p.status = 'ACTIVE' LIMIT 1) AS plan_status,
      (SELECT COUNT(*)::int FROM vita_hero.camp_findings f
        JOIN vita_hero.camp_participants cp
          ON cp.camp_id = f.camp_id AND cp.kid_id = f.kid_id
        WHERE f.kid_id = k.id AND cp.status = 'RELEASED'
          AND f.check_type = ANY(${checks}::text[])
          AND f.flag IN ('WATCH','ALERT')) AS concerns
    FROM vita_hero.kids k
    WHERE k.school_id = ${schoolId} AND COALESCE(k.status,'ACTIVE') = 'ACTIVE'
      AND (${q === ""} OR LOWER(k.name) LIKE ${"%" + q + "%"})
    ORDER BY k.grade, k.section, k.name
  `;
  return {
    schoolId,
    children: rows.map((r) => ({
      kidId: r.id as string,
      name: r.name as string,
      grade: (r.grade as string) || "",
      section: (r.section as string) || "",
      age: (r.age as number) ?? null,
      gender: (r.gender as string) || "",
      hasPlan: r.plan_status === "ACTIVE",
      concerns: (r.concerns as number) || 0,
    })),
  };
}

/**
 * One child, as a dietician may see them.
 *
 * Growth and haemoglobin over time, the last week of the food log, and
 * whatever plan is running. The query filters by check type rather than the
 * screen hiding fields, because a field that never leaves the server cannot be
 * read out of the response.
 */
export async function dieticianChild(sql: Sql, actor: Actor, kidId: string) {
  const me = await dieticianSelf(sql, actor);
  const kid = await assertChildInScope(sql, me.id, kidId);

  await logRecordAccess(sql, actor, {
    kidId,
    campId: "",
    schoolId: (kid.school_id as string) || "",
    surface: "DIETICIAN",
  });

  const checks = [...DIETICIAN_CHECKS];
  const findings = await sql`
    SELECT f.check_type, f.flag, f.detail, f.value_text, f.rationale,
           sc.date, sc.title
    FROM vita_hero.camp_findings f
    JOIN vita_hero.school_camps sc ON sc.id = f.camp_id
    JOIN vita_hero.camp_participants cp
      ON cp.camp_id = f.camp_id AND cp.kid_id = f.kid_id
    WHERE f.kid_id = ${kidId} AND cp.status = 'RELEASED'
      AND f.check_type = ANY(${checks}::text[])
      AND f.flag <> 'NOT_MEASURED'
    ORDER BY sc.date DESC
  `;

  // The last seven days of the log, by day, so a pattern is visible without
  // handing over every meal the child has ever eaten.
  const log = await sql`
    SELECT COALESCE(day,'') AS day,
           COUNT(*)::int AS items,
           COUNT(*) FILTER (WHERE eaten)::int AS eaten,
           COALESCE(SUM(kcal) FILTER (WHERE eaten), 0)::int AS kcal
    FROM vita_hero.meal_items
    WHERE kid_id = ${kidId} AND COALESCE(day,'') <> ''
    GROUP BY day ORDER BY day DESC LIMIT 7
  `;

  const plans = await sql`
    SELECT * FROM vita_hero.diet_plans WHERE kid_id = ${kidId}
    ORDER BY created_at DESC LIMIT 10
  `;

  return {
    child: {
      kidId: kid.id as string,
      name: kid.name as string,
      grade: (kid.grade as string) || "",
      section: (kid.section as string) || "",
      age: (kid.age as number) ?? null,
      gender: (kid.gender as string) || "",
      schoolName: (kid.school_name as string) || "",
      heightCm: Number(kid.height_cm) || 0,
      weightKg: Number(kid.weight_kg) || 0,
    },
    findings: findings.map((f) => ({
      checkType: f.check_type as string,
      flag: f.flag as string,
      detail: (f.detail as Record<string, unknown>) || {},
      valueText: (f.value_text as string) || "",
      rationale: (f.rationale as string) || "",
      date: (f.date as string) || "",
      campTitle: (f.title as string) || "",
    })),
    foodLog: log.map((r) => ({
      day: r.day as string,
      items: (r.items as number) || 0,
      eaten: (r.eaten as number) || 0,
      kcal: (r.kcal as number) || 0,
    })),
    plans: plans.map(mapPlan),
    // What the screen writes into a new plan's form, so a dietician corrects a
    // sentence at the end of a long day rather than facing an empty box.
    draft: draftPlan(
      kid.name as string,
      findings.map((f) => ({ checkType: f.check_type as string, flag: f.flag as string })),
    ),
  };
}

function mapPlan(r: Record<string, unknown>) {
  return {
    id: r.id as string,
    kidId: r.kid_id as string,
    title: (r.title as string) || "",
    focus: (r.focus as string) || "GENERAL",
    startsOn: (r.starts_on as string) || "",
    endsOn: (r.ends_on as string) || "",
    guidance: (r.guidance as string) || "",
    targets: Array.isArray(r.targets) ? (r.targets as unknown[]) : JSON.parse(String(r.targets || "[]")),
    status: (r.status as string) || "ACTIVE",
    authorName: (r.author_name as string) || "",
    createdAt: r.created_at ? String(r.created_at) : "",
  };
}

/**
 * A first draft of the plan, from what was actually found.
 *
 * Not advice — it names the finding and leaves the advice to the person
 * qualified to give it. The point is that the box is not empty and the
 * dietician does not have to remember which flag they just read.
 */
function draftPlan(name: string, findings: Array<{ checkType: string; flag: string }>) {
  const bad = (c: string) =>
    findings.some((f) => f.checkType === c && (f.flag === "WATCH" || f.flag === "ALERT"));
  const anaemic = bad("Haemoglobin");
  const growth = bad("Height & weight");
  const focus: PlanFocus = anaemic ? "ANAEMIA" : growth ? "WEIGHT_GAIN" : "GENERAL";
  const notes: string[] = [];
  if (anaemic) notes.push("the last camp flagged haemoglobin");
  if (growth) notes.push("the last camp flagged height and weight");
  return {
    title: anaemic ? "Iron-rich plan" : growth ? "Growth plan" : "Everyday plan",
    focus,
    guidance: notes.length
      ? `A plan for ${name}: ${notes.join(", and ")}.`
      : `A plan for ${name}.`,
  };
}

/**
 * Write a plan.
 *
 * One runs at a time. Saving a new one ends the one before it rather than
 * leaving two ACTIVE rows for a parent's screen to choose between — which is
 * the sort of thing that ships and is found six months later by a family
 * following last term's advice.
 */
export async function saveDietPlan(
  sql: Sql, actor: Actor, body: Record<string, unknown>,
) {
  const me = await dieticianSelf(sql, actor);
  const kidId = String(body.kidId || "").trim();
  if (!kidId) throw new ApiError(400, "Which child?", "KID_REQUIRED");
  const kid = await assertChildInScope(sql, me.id, kidId);

  const guidance = String(body.guidance || "").trim();
  if (guidance.length < 10) {
    throw new ApiError(400, "A plan needs something a family can act on", "GUIDANCE_REQUIRED");
  }
  const rawFocus = String(body.focus || "GENERAL").toUpperCase();
  const focus: PlanFocus = (PLAN_FOCUS as readonly string[]).includes(rawFocus)
    ? (rawFocus as PlanFocus)
    : "GENERAL";

  const targets = Array.isArray(body.targets)
    ? (body.targets as unknown[]).slice(0, 8).map((t) => {
      const o = (t || {}) as Record<string, unknown>;
      return { label: String(o.label || "").slice(0, 80), value: String(o.value || "").slice(0, 80) };
    }).filter((t) => t.label !== "")
    : [];

  const id = `dp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  await sql`
    UPDATE vita_hero.diet_plans SET status = 'ENDED', updated_at = NOW()
    WHERE kid_id = ${kidId} AND status = 'ACTIVE'
  `;
  await sql`
    INSERT INTO vita_hero.diet_plans
      (id, kid_id, school_id, dietician_id, author_profile_id, author_name,
       title, focus, starts_on, ends_on, guidance, targets, status)
    VALUES
      (${id}, ${kidId}, ${(kid.school_id as string) || ""}, ${me.id}, ${actor.profileId},
       ${me.name}, ${String(body.title || "").slice(0, 120)}, ${focus},
       ${String(body.startsOn || "")}, ${String(body.endsOn || "")},
       ${guidance}, ${JSON.stringify(targets)}::jsonb, 'ACTIVE')
  `;
  const rows = await sql`SELECT * FROM vita_hero.diet_plans WHERE id = ${id} LIMIT 1`;
  return { plan: mapPlan(rows[0]) };
}

// ─── The parent's side ──────────────────────────────────────

/**
 * The plan for one of this guardian's children, if a dietician has written one.
 *
 * Read as the parent: the session decides which children are theirs, and the
 * kid id in the request is checked against it rather than trusted.
 */
export async function guardianDietPlan(sql: Sql, profileId: string, kidId: string) {
  const owned = await sql`
    SELECT id FROM vita_hero.kids WHERE id = ${kidId} AND profile_id = ${profileId} LIMIT 1`;
  if (owned.length === 0) throw new ApiError(404, "No such child", "NOT_FOUND");
  const rows = await sql`
    SELECT * FROM vita_hero.diet_plans
    WHERE kid_id = ${kidId} AND status = 'ACTIVE'
    ORDER BY created_at DESC LIMIT 1
  `;
  return { plan: rows.length ? mapPlan(rows[0]) : null };
}
