// VitaHero Neon DB Backend — Cloudflare Worker
// Connects to Neon Postgres (vita_hero schema) for all CRUD operations.
// Handles Google Sign-In, phone OTP via Twilio, and session-token auth.

import { neon } from "@neondatabase/serverless";

const SCHEMA = "vita_hero";
const GOOGLE_TOKENINFO = "https://oauth2.googleapis.com/tokeninfo";
const TWILIO_API = "https://api.twilio.com/2010-04-01";
const OTP_EXPIRY_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;

interface Env {
  DATABASE_URL: string;
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
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

function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ─── Session Auth ───────────────────────────────────────────

async function authenticateSession(
  sql: ReturnType<typeof neon>,
  token: string
): Promise<{ profileId: string; userId: string; name: string } | null> {
  if (!token || token.length < 30) return null;
  try {
    const rows = await sql`
      SELECT id, user_id, name FROM ${sql(SCHEMA)}.profiles
      WHERE session_token = ${token} LIMIT 1
    `;
    if (rows.length === 0) return null;
    return { profileId: rows[0].id, userId: rows[0].user_id || "", name: rows[0].name };
  } catch {
    return null;
  }
}

// ─── Twilio SMS ─────────────────────────────────────────────

async function sendTwilioSms(
  env: Env,
  to: string,
  body: string
): Promise<boolean> {
  const sid = env.TWILIO_ACCOUNT_SID;
  const token = env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    console.error("Twilio credentials not configured");
    return false;
  }
  try {
    const resp = await fetch(
      `${TWILIO_API}/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(`${sid}:${token}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: to,
          From: "+12562828337", // Will be overridden by Twilio trial/project number
          Body: body,
        }),
      }
    );
    return resp.ok;
  } catch (e) {
    console.error("Twilio send error:", e);
    return false;
  }
}

// ─── Google Token Verification ──────────────────────────────

async function verifyGoogleToken(idToken: string): Promise<{
  sub: string; email: string; name: string; picture?: string;
} | null> {
  try {
    const resp = await fetch(`${GOOGLE_TOKENINFO}?id_token=${encodeURIComponent(idToken)}`);
    if (!resp.ok) return null;
    const data = await resp.json() as Record<string, unknown>;
    if (!data.sub || !data.email) return null;
    return {
      sub: data.sub as string,
      email: data.email as string,
      name: (data.name as string) || data.email.split("@")[0],
      picture: data.picture as string | undefined,
    };
  } catch {
    return null;
  }
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

    try {
      const sql = neon(dbUrl);

      // ── Schema Init (idempotent) ─────────────────────
      try {
        await sql`CREATE SCHEMA IF NOT EXISTS ${sql(SCHEMA)}`;
      } catch { /* schema may already exist */ }

      try {
        await sql`
          CREATE TABLE IF NOT EXISTS ${sql(SCHEMA)}.profiles (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            phone TEXT,
            name TEXT NOT NULL DEFAULT '',
            email TEXT,
            session_token TEXT,
            auth_provider TEXT,
            onboarding_complete BOOLEAN DEFAULT false,
            is_logged_in BOOLEAN DEFAULT false,
            dark_theme BOOLEAN DEFAULT false,
            locale_code TEXT DEFAULT 'en',
            family_code TEXT DEFAULT '',
            notifications_enabled BOOLEAN DEFAULT true,
            camp_reminders_enabled BOOLEAN DEFAULT true,
            consent_accepted BOOLEAN DEFAULT false,
            consent_declined BOOLEAN DEFAULT false
          )
        `;
      } catch { /* table may already exist */ }

      try {
        await sql`
          CREATE TABLE IF NOT EXISTS ${sql(SCHEMA)}.phone_otps (
            phone TEXT PRIMARY KEY,
            otp TEXT NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            attempts INT DEFAULT 0
          )
        `;
      } catch { /* table may already exist */ }

      // ── Health Check ─────────────────────────────────
      if (path === "/ping") {
        const rows = await sql`SELECT 1 AS ok, NOW() AS now`;
        return json({ ok: true, db: rows[0] });
      }

      // ═══════════════════════════════════════════════════
      // AUTH ENDPOINTS
      // ═══════════════════════════════════════════════════

      // ── Google Sign-In ────────────────────────────────
      if (path === "/api/auth/google" && request.method === "POST") {
        const body: Record<string, unknown> = await request.json();
        const idToken = body.id_token as string;
        if (!idToken) return json({ error: "Missing id_token" }, 400);

        const googleUser = await verifyGoogleToken(idToken);
        if (!googleUser) return json({ error: "Invalid Google ID token" }, 401);

        const profileId = `g_${googleUser.sub.slice(0, 24)}`;
        const sessionToken = generateToken();

        // Upsert profile for this Google user
        const existing = await sql`
          SELECT id FROM ${sql(SCHEMA)}.profiles WHERE id = ${profileId} LIMIT 1
        `;

        if (existing.length === 0) {
          await sql`
            INSERT INTO ${sql(SCHEMA)}.profiles
              (id, user_id, name, email, session_token, auth_provider,
               onboarding_complete, is_logged_in)
            VALUES (
              ${profileId}, ${googleUser.sub}, ${googleUser.name},
              ${googleUser.email}, ${sessionToken}, 'GOOGLE', true, true
            )
          `;
        } else {
          await sql`
            UPDATE ${sql(SCHEMA)}.profiles
            SET session_token = ${sessionToken}, is_logged_in = true,
                name = ${googleUser.name}, email = ${googleUser.email}
            WHERE id = ${profileId}
          `;
        }

        return json({
          token: sessionToken,
          profile: {
            id: profileId,
            user_id: googleUser.sub,
            name: googleUser.name,
            email: googleUser.email,
            auth_provider: "GOOGLE",
          },
        });
      }

      // ── Phone OTP: Send ──────────────────────────────
      if (path === "/api/auth/phone/send" && request.method === "POST") {
        const body: Record<string, unknown> = await request.json();
        const phone = (body.phone as string)?.trim();
        if (!phone) return json({ error: "Missing phone" }, 400);

        const otp = generateOtp();
        const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60_000);

        await sql`
          INSERT INTO ${sql(SCHEMA)}.phone_otps (phone, otp, expires_at, attempts)
          VALUES (${phone}, ${otp}, ${expiresAt.toISOString()}, 0)
          ON CONFLICT (phone) DO UPDATE SET
            otp = EXCLUDED.otp,
            expires_at = EXCLUDED.expires_at,
            attempts = 0
        `;

        const sent = await sendTwilioSms(
          env, phone,
          `Your VitaHero verification code is: ${otp}`
        );

        return json({ success: sent, note: sent ? undefined : "OTP generated but SMS delivery may be delayed" });
      }

      // ── Phone OTP: Verify ────────────────────────────
      if (path === "/api/auth/phone/verify" && request.method === "POST") {
        const body: Record<string, unknown> = await request.json();
        const phone = (body.phone as string)?.trim();
        const otp = (body.otp as string)?.trim();
        if (!phone || !otp) return json({ error: "Missing phone or otp" }, 400);

        const rows = await sql`
          SELECT otp, expires_at, attempts
          FROM ${sql(SCHEMA)}.phone_otps WHERE phone = ${phone} LIMIT 1
        `;

        if (rows.length === 0) {
          return json({ error: "No OTP requested for this number" }, 400);
        }

        const record = rows[0];
        if (record.attempts >= OTP_MAX_ATTEMPTS) {
          return json({ error: "Too many attempts. Request a new OTP." }, 429);
        }
        if (new Date(record.expires_at) < new Date()) {
          return json({ error: "OTP expired. Request a new one." }, 410);
        }

        // Increment attempts
        await sql`
          UPDATE ${sql(SCHEMA)}.phone_otps
          SET attempts = attempts + 1 WHERE phone = ${phone}
        `;

        if (record.otp !== otp) {
          return json({ error: "Invalid OTP" }, 401);
        }

        // OTP verified — clean up
        await sql`DELETE FROM ${sql(SCHEMA)}.phone_otps WHERE phone = ${phone}`;

        // Create or update profile
        const profileId = `ph_${phone.replace(/\D/g, "").slice(-10)}`;
        const sessionToken = generateToken();

        const existing = await sql`
          SELECT id FROM ${sql(SCHEMA)}.profiles WHERE id = ${profileId} LIMIT 1
        `;

        if (existing.length === 0) {
          await sql`
            INSERT INTO ${sql(SCHEMA)}.profiles
              (id, phone, name, session_token, auth_provider,
               onboarding_complete, is_logged_in)
            VALUES (
              ${profileId}, ${phone}, 'Parent', ${sessionToken}, 'PHONE',
              true, true
            )
          `;
        } else {
          await sql`
            UPDATE ${sql(SCHEMA)}.profiles
            SET session_token = ${sessionToken}, is_logged_in = true, phone = ${phone}
            WHERE id = ${profileId}
          `;
        }

        // Also delete any old OTPs
        try {
          await sql`DELETE FROM ${sql(SCHEMA)}.phone_otps WHERE expires_at < NOW()`;
        } catch { /* best effort */ }

        return json({
          token: sessionToken,
          profile: {
            id: profileId,
            phone,
            name: "Parent",
            auth_provider: "PHONE",
          },
        });
      }

      // ── Verify Session Token ─────────────────────────
      if (path === "/api/auth/me" && request.method === "GET") {
        const token = extractToken(request);
        const session = await authenticateSession(sql, token);
        if (!session) return json({ error: "Invalid or expired session" }, 401);

        const profile = await sql`
          SELECT * FROM ${sql(SCHEMA)}.profiles WHERE id = ${session.profileId} LIMIT 1
        `;
        return json(profile[0] || null);
      }

      // ── Logout ───────────────────────────────────────
      if (path === "/api/auth/logout" && request.method === "POST") {
        const token = extractToken(request);
        if (token) {
          await sql`
            UPDATE ${sql(SCHEMA)}.profiles
            SET session_token = NULL, is_logged_in = false
            WHERE session_token = ${token}
          `;
        }
        return json({ success: true });
      }

      // ═══════════════════════════════════════════════════
      // AUTHENTICATED DATA ENDPOINTS
      // ═══════════════════════════════════════════════════

      const token = extractToken(request);
      const session = await authenticateSession(sql, token);

      // ═══════════════════════════════════════════════════
      // Profiles
      // ═══════════════════════════════════════════════════

      if (path === "/api/profiles" && request.method === "GET") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const rows = await sql`SELECT * FROM ${sql(SCHEMA)}.profiles WHERE id = ${session.profileId} LIMIT 1`;
        // Don't leak session token
        if (rows[0]) delete rows[0].session_token;
        return json(rows[0] || null);
      }

      if (path === "/api/profiles" && request.method === "POST") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const body: Record<string, unknown> = await request.json();
        const row = await sql`
          INSERT INTO ${sql(SCHEMA)}.profiles
            (id, user_id, phone, name, email,
             onboarding_complete, is_logged_in,
             dark_theme, locale_code, family_code,
             notifications_enabled, camp_reminders_enabled,
             consent_accepted, consent_declined,
             auth_provider, session_token)
          VALUES (
            ${session.profileId},
            ${(body.user_id as string) || session.userId},
            ${(body.phone as string) || null},
            ${(body.name as string) || session.name},
            ${(body.email as string) || null},
            ${(body.onboarding_complete as boolean) || false},
            ${(body.is_logged_in as boolean) || false},
            ${(body.dark_theme as boolean) || false},
            ${(body.locale_code as string) || "en"},
            ${(body.family_code as string) || ""},
            ${(body.notifications_enabled as boolean) ?? true},
            ${(body.camp_reminders_enabled as boolean) ?? true},
            ${(body.consent_accepted as boolean) || false},
            ${(body.consent_declined as boolean) || false},
            ${(body.auth_provider as string) || "GOOGLE"},
            ${token}
          )
          ON CONFLICT (id) DO UPDATE SET
            user_id = EXCLUDED.user_id, phone = EXCLUDED.phone,
            name = EXCLUDED.name, email = EXCLUDED.email,
            onboarding_complete = EXCLUDED.onboarding_complete,
            is_logged_in = EXCLUDED.is_logged_in,
            dark_theme = EXCLUDED.dark_theme,
            locale_code = EXCLUDED.locale_code,
            family_code = EXCLUDED.family_code,
            notifications_enabled = EXCLUDED.notifications_enabled,
            camp_reminders_enabled = EXCLUDED.camp_reminders_enabled,
            consent_accepted = EXCLUDED.consent_accepted,
            consent_declined = EXCLUDED.consent_declined,
            auth_provider = EXCLUDED.auth_provider
          RETURNING *
        `;
        if (row[0]) delete row[0].session_token;
        return json(row[0], 201);
      }

      // ═══════════════════════════════════════════════════
      // Kids
      // ═══════════════════════════════════════════════════

      if (path === "/api/kids" && request.method === "GET") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const profileId = session.profileId;
        const rows = await sql`SELECT * FROM ${sql(SCHEMA)}.kids WHERE profile_id = ${profileId} ORDER BY name`;
        return json(rows);
      }

      if (path === "/api/kids" && request.method === "POST") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const body: Record<string, unknown> = await request.json();
        const row = await sql`
          INSERT INTO ${sql(SCHEMA)}.kids
            (id, profile_id, user_id, name, age, gender, school, grade,
             height_cm, weight_kg, avatar_color, overall_score, dental,
             eyesight, nutrition, last_checkup)
          VALUES (
            ${body.id as string}, ${session.profileId},
            ${session.userId || null}, ${body.name as string},
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
        if (!session) return json({ error: "Unauthorized" }, 401);
        const kidId = path.split("/")[3];
        await sql`DELETE FROM ${sql(SCHEMA)}.kids WHERE id = ${kidId} AND profile_id = ${session.profileId}`;
        return json({ deleted: true });
      }

      // ═══════════════════════════════════════════════════
      // Appointments
      // ═══════════════════════════════════════════════════

      if (path === "/api/appointments" && request.method === "GET") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const rows = await sql`SELECT * FROM ${sql(SCHEMA)}.appointments WHERE profile_id = ${session.profileId} ORDER BY date, time`;
        return json(rows);
      }

      if (path === "/api/appointments" && request.method === "POST") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const body: Record<string, unknown> = await request.json();
        const row = await sql`
          INSERT INTO ${sql(SCHEMA)}.appointments
            (id, profile_id, user_id, doctor_name, specialty, kid_name, date, time)
          VALUES (
            ${body.id as string}, ${session.profileId},
            ${session.userId || null}, ${body.doctor_name as string},
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
        if (!session) return json({ error: "Unauthorized" }, 401);
        const apptId = path.split("/")[3];
        await sql`DELETE FROM ${sql(SCHEMA)}.appointments WHERE id = ${apptId} AND profile_id = ${session.profileId}`;
        return json({ deleted: true });
      }

      // ═══════════════════════════════════════════════════
      // Camps
      // ═══════════════════════════════════════════════════

      if (path === "/api/camps" && request.method === "GET") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const rows = await sql`SELECT * FROM ${sql(SCHEMA)}.camps WHERE profile_id = ${session.profileId} ORDER BY date`;
        return json(rows);
      }

      if (path === "/api/camps" && request.method === "POST") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const body: Record<string, unknown> = await request.json();
        const row = await sql`
          INSERT INTO ${sql(SCHEMA)}.camps
            (id, profile_id, user_id, title, school, date, time, status, checks, result_summary)
          VALUES (
            ${body.id as string}, ${session.profileId},
            ${session.userId || null}, ${body.title as string},
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

      // ═══════════════════════════════════════════════════
      // Meals
      // ═══════════════════════════════════════════════════

      if (path === "/api/meals" && request.method === "GET") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const rows = await sql`SELECT * FROM ${sql(SCHEMA)}.meal_items WHERE profile_id = ${session.profileId} ORDER BY kid_id, time_slot`;
        return json(rows);
      }

      if (path === "/api/meals" && request.method === "POST") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const body = await request.json() as Record<string, unknown>[];
        const meals = Array.isArray(body) ? body : [body];
        const results = [];
        for (const m of meals) {
          const row = await sql`
            INSERT INTO ${sql(SCHEMA)}.meal_items
              (id, profile_id, user_id, kid_id, time_slot, name, detail, kcal, eaten)
            VALUES (
              ${m.id as string}, ${session.profileId},
              ${session.userId || null}, ${m.kid_id as string},
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

      // ═══════════════════════════════════════════════════
      // Streaks
      // ═══════════════════════════════════════════════════

      if (path === "/api/streaks" && request.method === "GET") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const kidId = url.searchParams.get("kid_id");
        if (!kidId) return json({ error: "Missing kid_id" }, 400);
        const rows = await sql`SELECT * FROM ${sql(SCHEMA)}.streaks WHERE kid_id = ${kidId} LIMIT 1`;
        return json(rows[0] || null);
      }

      if (path === "/api/streaks" && request.method === "POST") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const body: Record<string, unknown> = await request.json();
        const row = await sql`
          INSERT INTO ${sql(SCHEMA)}.streaks
            (kid_id, user_id, current_streak, best_streak, last_log_date)
          VALUES (
            ${body.kid_id as string}, ${session.userId || null},
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

      // ═══════════════════════════════════════════════════
      // Growth Points
      // ═══════════════════════════════════════════════════

      if (path === "/api/growth-points" && request.method === "GET") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const kidId = url.searchParams.get("kid_id");
        if (!kidId) return json({ error: "Missing kid_id" }, 400);
        const rows = await sql`SELECT * FROM ${sql(SCHEMA)}.growth_points WHERE kid_id = ${kidId} ORDER BY recorded_at`;
        return json(rows);
      }

      if (path === "/api/growth-points" && request.method === "POST") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const body: Record<string, unknown> = await request.json();
        const row = await sql`
          INSERT INTO ${sql(SCHEMA)}.growth_points
            (id, kid_id, user_id, label, height, weight)
          VALUES (
            ${body.id as string}, ${body.kid_id as string},
            ${session.userId || null}, ${body.label as string},
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

      // ═══════════════════════════════════════════════════
      // Co-Parents
      // ═══════════════════════════════════════════════════

      if (path === "/api/co-parents" && request.method === "GET") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const rows = await sql`SELECT * FROM ${sql(SCHEMA)}.co_parents WHERE profile_id = ${session.profileId} ORDER BY name`;
        return json(rows);
      }

      if (path === "/api/co-parents" && request.method === "POST") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const body: Record<string, unknown> = await request.json();
        const row = await sql`
          INSERT INTO ${sql(SCHEMA)}.co_parents
            (id, profile_id, user_id, name, relation, joined_date)
          VALUES (
            ${body.id as string}, ${session.profileId},
            ${session.userId || null}, ${body.name as string},
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

      // ═══════════════════════════════════════════════════
      // Family Code Lookup
      // ═══════════════════════════════════════════════════

      if (path === "/api/family-lookup" && request.method === "GET") {
        if (!session) return json({ error: "Unauthorized" }, 401);
        const code = url.searchParams.get("code");
        if (!code) return json({ error: "Missing code" }, 400);
        const rows = await sql`
          SELECT id, name, family_code FROM ${sql(SCHEMA)}.profiles
          WHERE family_code = ${code} AND id != ${session.profileId} LIMIT 1
        `;
        return json(rows[0] || null);
      }

      return json({ error: "Not found", path }, 404);

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Worker error:", message);
      return json({ error: message }, 500);
    }
  },
};
