// VitaHero Neon DB Backend — Cloudflare Worker
// Connects to Neon Postgres (vita_hero schema) for all CRUD operations.

import { neon } from "@neondatabase/serverless";

const SCHEMA = "vita_hero";

interface Env {
  DATABASE_URL: string;
}

// ─── Helpers ────────────────────────────────────────────────

function cors(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type,Authorization");
  headers.set("Access-Control-Max-Age", "86400");
  return new Response(response.body, { status: response.status, headers });
}

function json(data: unknown, status = 200): Response {
  return cors(new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  }));
}

function extractToken(request: Request): string {
  return (request.headers.get("Authorization") || "").replace("Bearer ", "");
}

function paginationParams(url: URL) {
  return {
    limit: Math.min(parseInt(url.searchParams.get("limit") || "50"), 200),
    offset: parseInt(url.searchParams.get("offset") || "0"),
  };
}

// ─── Entrypoint ─────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));

    const url = new URL(request.url);
    const path = url.pathname;
    const dbUrl = env.DATABASE_URL;

    if (!dbUrl) {
      return json({ error: "DATABASE_URL not configured" }, 500);
    }

    const token = extractToken(request);

    try {
      const sql = neon(dbUrl);

      // ── Profiles ──────────────────────────────────────
      if (path === "/api/profiles" && request.method === "GET") {
        const userId = url.searchParams.get("user_id");
        const profileId = url.searchParams.get("id");

        if (userId) {
          const rows = await sql`SELECT * FROM ${sql(SCHEMA)}.profiles WHERE user_id = ${userId} LIMIT 1`;
          return json(rows[0] || null);
        }
        if (profileId) {
          const rows = await sql`SELECT * FROM ${sql(SCHEMA)}.profiles WHERE id = ${profileId} LIMIT 1`;
          return json(rows[0] || null);
        }
        return json({ error: "Missing user_id or id parameter" }, 400);
      }

      if (path === "/api/profiles" && request.method === "POST") {
        const body: Record<string, unknown> = await request.json();
        const row = await sql`
          INSERT INTO ${sql(SCHEMA)}.profiles
            (id, user_id, phone, name, onboarding_complete, is_logged_in,
             dark_theme, locale_code, family_code, notifications_enabled,
             camp_reminders_enabled, consent_accepted, consent_declined)
          VALUES (
            ${body.id as string}, ${(body.user_id as string) || null},
            ${(body.phone as string) || null}, ${(body.name as string) || ""},
            ${(body.onboarding_complete as boolean) || false},
            ${(body.is_logged_in as boolean) || false},
            ${(body.dark_theme as boolean) || false},
            ${(body.locale_code as string) || "en"},
            ${(body.family_code as string) || ""},
            ${(body.notifications_enabled as boolean) ?? true},
            ${(body.camp_reminders_enabled as boolean) ?? true},
            ${(body.consent_accepted as boolean) || false},
            ${(body.consent_declined as boolean) || false}
          )
          ON CONFLICT (id) DO UPDATE SET
            user_id = EXCLUDED.user_id, phone = EXCLUDED.phone,
            name = EXCLUDED.name, onboarding_complete = EXCLUDED.onboarding_complete,
            is_logged_in = EXCLUDED.is_logged_in, dark_theme = EXCLUDED.dark_theme,
            locale_code = EXCLUDED.locale_code, family_code = EXCLUDED.family_code,
            notifications_enabled = EXCLUDED.notifications_enabled,
            camp_reminders_enabled = EXCLUDED.camp_reminders_enabled,
            consent_accepted = EXCLUDED.consent_accepted,
            consent_declined = EXCLUDED.consent_declined
          RETURNING *
        `;
        return json(row[0], 201);
      }

      // ── Kids ──────────────────────────────────────────
      if (path === "/api/kids" && request.method === "GET") {
        const profileId = url.searchParams.get("profile_id");
        if (!profileId) return json({ error: "Missing profile_id" }, 400);
        const rows = await sql`SELECT * FROM ${sql(SCHEMA)}.kids WHERE profile_id = ${profileId} ORDER BY name`;
        return json(rows);
      }

      if (path === "/api/kids" && request.method === "POST") {
        const body: Record<string, unknown> = await request.json();
        const row = await sql`
          INSERT INTO ${sql(SCHEMA)}.kids
            (id, profile_id, user_id, name, age, gender, school, grade,
             height_cm, weight_kg, avatar_color, overall_score, dental,
             eyesight, nutrition, last_checkup)
          VALUES (
            ${body.id as string}, ${body.profile_id as string},
            ${(body.user_id as string) || null}, ${body.name as string},
            ${body.age as number}, ${body.gender as string},
            ${(body.school as string) || ""}, ${(body.grade as string) || ""},
            ${(body.height_cm as number) || 0}, ${(body.weight_kg as number) || 0},
            ${(body.avatar_color as number) || 0}, ${(body.overall_score as number) || 80},
            ${(body.dental as string) || "GOOD"}, ${(body.eyesight as string) || "GOOD"},
            ${(body.nutrition as string) || "GOOD"}, ${(body.last_checkup as string) || "Not yet"}
          )
          ON CONFLICT (id) DO UPDATE SET
            profile_id = EXCLUDED.profile_id, user_id = EXCLUDED.user_id,
            name = EXCLUDED.name, age = EXCLUDED.age, gender = EXCLUDED.gender,
            school = EXCLUDED.school, grade = EXCLUDED.grade,
            height_cm = EXCLUDED.height_cm, weight_kg = EXCLUDED.weight_kg,
            avatar_color = EXCLUDED.avatar_color, overall_score = EXCLUDED.overall_score,
            dental = EXCLUDED.dental, eyesight = EXCLUDED.eyesight,
            nutrition = EXCLUDED.nutrition, last_checkup = EXCLUDED.last_checkup
          RETURNING *
        `;
        return json(row[0], 201);
      }

      if (path.startsWith("/api/kids/") && request.method === "DELETE") {
        const kidId = path.split("/")[3];
        await sql`DELETE FROM ${sql(SCHEMA)}.kids WHERE id = ${kidId}`;
        return json({ deleted: true });
      }

      // ── Appointments ──────────────────────────────────
      if (path === "/api/appointments" && request.method === "GET") {
        const profileId = url.searchParams.get("profile_id");
        if (!profileId) return json({ error: "Missing profile_id" }, 400);
        const rows = await sql`SELECT * FROM ${sql(SCHEMA)}.appointments WHERE profile_id = ${profileId} ORDER BY date, time`;
        return json(rows);
      }

      if (path === "/api/appointments" && request.method === "POST") {
        const body: Record<string, unknown> = await request.json();
        const row = await sql`
          INSERT INTO ${sql(SCHEMA)}.appointments
            (id, profile_id, user_id, doctor_name, specialty, kid_name, date, time)
          VALUES (
            ${body.id as string}, ${body.profile_id as string},
            ${(body.user_id as string) || null}, ${body.doctor_name as string},
            ${body.specialty as string}, ${body.kid_name as string},
            ${body.date as string}, ${body.time as string}
          )
          ON CONFLICT (id) DO UPDATE SET
            profile_id = EXCLUDED.profile_id, user_id = EXCLUDED.user_id,
            doctor_name = EXCLUDED.doctor_name, specialty = EXCLUDED.specialty,
            kid_name = EXCLUDED.kid_name, date = EXCLUDED.date, time = EXCLUDED.time
          RETURNING *
        `;
        return json(row[0], 201);
      }

      if (path.startsWith("/api/appointments/") && request.method === "DELETE") {
        const apptId = path.split("/")[3];
        await sql`DELETE FROM ${sql(SCHEMA)}.appointments WHERE id = ${apptId}`;
        return json({ deleted: true });
      }

      // ── Camps ─────────────────────────────────────────
      if (path === "/api/camps" && request.method === "GET") {
        const profileId = url.searchParams.get("profile_id");
        if (!profileId) return json({ error: "Missing profile_id" }, 400);
        const rows = await sql`SELECT * FROM ${sql(SCHEMA)}.camps WHERE profile_id = ${profileId} ORDER BY date`;
        return json(rows);
      }

      if (path === "/api/camps" && request.method === "POST") {
        const body: Record<string, unknown> = await request.json();
        const row = await sql`
          INSERT INTO ${sql(SCHEMA)}.camps
            (id, profile_id, user_id, title, school, date, time, status, checks, result_summary)
          VALUES (
            ${body.id as string}, ${body.profile_id as string},
            ${(body.user_id as string) || null}, ${body.title as string},
            ${body.school as string}, ${body.date as string}, ${body.time as string},
            ${(body.status as string) || "UPCOMING"},
            ${JSON.stringify(body.checks || [])}::jsonb,
            ${(body.result_summary as string) || null}
          )
          ON CONFLICT (id) DO UPDATE SET
            profile_id = EXCLUDED.profile_id, user_id = EXCLUDED.user_id,
            title = EXCLUDED.title, school = EXCLUDED.school,
            date = EXCLUDED.date, time = EXCLUDED.time,
            status = EXCLUDED.status, checks = EXCLUDED.checks,
            result_summary = EXCLUDED.result_summary
          RETURNING *
        `;
        return json(row[0], 201);
      }

      // ── Meals ─────────────────────────────────────────
      if (path === "/api/meals" && request.method === "GET") {
        const profileId = url.searchParams.get("profile_id");
        if (!profileId) return json({ error: "Missing profile_id" }, 400);
        const rows = await sql`SELECT * FROM ${sql(SCHEMA)}.meal_items WHERE profile_id = ${profileId} ORDER BY kid_id, time_slot`;
        return json(rows);
      }

      if (path === "/api/meals" && request.method === "POST") {
        const body = await request.json() as Record<string, unknown>[];
        const meals = Array.isArray(body) ? body : [body];
        const results = [];
        for (const m of meals) {
          const row = await sql`
            INSERT INTO ${sql(SCHEMA)}.meal_items
              (id, profile_id, user_id, kid_id, time_slot, name, detail, kcal, eaten)
            VALUES (
              ${m.id as string}, ${m.profile_id as string},
              ${(m.user_id as string) || null}, ${m.kid_id as string},
              ${m.time_slot as string}, ${m.name as string},
              ${(m.detail as string) || ""}, ${(m.kcal as number) || 0},
              ${(m.eaten as boolean) || false}
            )
            ON CONFLICT (id) DO UPDATE SET
              profile_id = EXCLUDED.profile_id, user_id = EXCLUDED.user_id,
              kid_id = EXCLUDED.kid_id, time_slot = EXCLUDED.time_slot,
              name = EXCLUDED.name, detail = EXCLUDED.detail,
              kcal = EXCLUDED.kcal, eaten = EXCLUDED.eaten
            RETURNING *
          `;
          results.push(row[0]);
        }
        return json(results, 201);
      }

      // ── Streaks ───────────────────────────────────────
      if (path === "/api/streaks" && request.method === "GET") {
        const kidId = url.searchParams.get("kid_id");
        if (!kidId) return json({ error: "Missing kid_id" }, 400);
        const rows = await sql`SELECT * FROM ${sql(SCHEMA)}.streaks WHERE kid_id = ${kidId} LIMIT 1`;
        return json(rows[0] || null);
      }

      if (path === "/api/streaks" && request.method === "POST") {
        const body: Record<string, unknown> = await request.json();
        const row = await sql`
          INSERT INTO ${sql(SCHEMA)}.streaks
            (kid_id, user_id, current_streak, best_streak, last_log_date)
          VALUES (
            ${body.kid_id as string}, ${(body.user_id as string) || null},
            ${(body.current_streak as number) || 0},
            ${(body.best_streak as number) || 0},
            ${(body.last_log_date as string) || ""}
          )
          ON CONFLICT (kid_id) DO UPDATE SET
            user_id = EXCLUDED.user_id, current_streak = EXCLUDED.current_streak,
            best_streak = EXCLUDED.best_streak, last_log_date = EXCLUDED.last_log_date
          RETURNING *
        `;
        return json(row[0], 201);
      }

      // ── Growth Points ─────────────────────────────────
      if (path === "/api/growth-points" && request.method === "GET") {
        const kidId = url.searchParams.get("kid_id");
        if (!kidId) return json({ error: "Missing kid_id" }, 400);
        const rows = await sql`SELECT * FROM ${sql(SCHEMA)}.growth_points WHERE kid_id = ${kidId} ORDER BY recorded_at`;
        return json(rows);
      }

      if (path === "/api/growth-points" && request.method === "POST") {
        const body: Record<string, unknown> = await request.json();
        const row = await sql`
          INSERT INTO ${sql(SCHEMA)}.growth_points
            (id, kid_id, user_id, label, height, weight)
          VALUES (
            ${body.id as string}, ${body.kid_id as string},
            ${(body.user_id as string) || null}, ${body.label as string},
            ${(body.height as number) || 0}, ${(body.weight as number) || 0}
          )
          ON CONFLICT (id) DO UPDATE SET
            kid_id = EXCLUDED.kid_id, user_id = EXCLUDED.user_id,
            label = EXCLUDED.label, height = EXCLUDED.height,
            weight = EXCLUDED.weight
          RETURNING *
        `;
        return json(row[0], 201);
      }

      // ── Co-Parents ────────────────────────────────────
      if (path === "/api/co-parents" && request.method === "GET") {
        const profileId = url.searchParams.get("profile_id");
        if (!profileId) return json({ error: "Missing profile_id" }, 400);
        const rows = await sql`SELECT * FROM ${sql(SCHEMA)}.co_parents WHERE profile_id = ${profileId} ORDER BY name`;
        return json(rows);
      }

      if (path === "/api/co-parents" && request.method === "POST") {
        const body: Record<string, unknown> = await request.json();
        const row = await sql`
          INSERT INTO ${sql(SCHEMA)}.co_parents
            (id, profile_id, user_id, name, relation, joined_date)
          VALUES (
            ${body.id as string}, ${body.profile_id as string},
            ${(body.user_id as string) || null}, ${body.name as string},
            ${body.relation as string}, ${(body.joined_date as string) || ""}
          )
          ON CONFLICT (id) DO UPDATE SET
            profile_id = EXCLUDED.profile_id, user_id = EXCLUDED.user_id,
            name = EXCLUDED.name, relation = EXCLUDED.relation,
            joined_date = EXCLUDED.joined_date
          RETURNING *
        `;
        return json(row[0], 201);
      }

      // ── Family Code Lookup ────────────────────────────
      if (path === "/api/family-lookup" && request.method === "GET") {
        const code = url.searchParams.get("code");
        if (!code) return json({ error: "Missing code" }, 400);
        const rows = await sql`
          SELECT id, name, family_code FROM ${sql(SCHEMA)}.profiles
          WHERE family_code = ${code} LIMIT 1
        `;
        return json(rows[0] || null);
      }

      // ── Health Check ──────────────────────────────────
      if (path === "/ping") {
        const rows = await sql`SELECT 1 AS ok, NOW() AS now`;
        return json({ ok: true, db: rows[0] });
      }

      return json({ error: "Not found", path }, 404);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Worker error:", message);
      return json({ error: message }, 500);
    }
  },
};
