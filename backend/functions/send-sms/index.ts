/**
 * Supabase Edge Function: send-sms
 *
 * Complete phone-auth OTP flow for VitaHero.
 *
 *   POST { action: "send_otp", phone: "+919876543210" }
 *     → Generates 6-digit OTP, stores salted hash in phone_otps table,
 *       sends SMS via Twilio. Returns { success, expiresIn: 300 }.
 *
 *   POST { action: "verify_otp", phone: "+919876543210", otp: "123456" }
 *     → Verifies OTP hash, creates/finds the Supabase Auth user (phone identity),
 *       generates a session, returns { success, access_token, refresh_token, user }.
 *
 * Twilio credentials are passed via x-twilio-account-sid / x-twilio-auth-token
 * headers from the Android app (injected at build time from Rork private env vars).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-twilio-account-sid, x-twilio-auth-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Crypto ─────────────────────────────────────────────────

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

function generateOtp(): string {
  const d = new Uint8Array(6);
  crypto.getRandomValues(d);
  return Array.from(d, (b) => (b % 10).toString()).join("");
}

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  const arr = new Uint8Array(20);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join("");
}

// ── Twilio ─────────────────────────────────────────────────

async function sendTwilioSms(
  phone: string,
  body: string,
  accountSid: string,
  authToken: string,
): Promise<{ ok: boolean; sid?: string; error?: string }> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const encoded = btoa(`${accountSid}:${authToken}`);

  const form = new URLSearchParams();
  form.append("To", phone);
  form.append("Body", body);
  (Deno.env.get("TWILIO_MESSAGING_SERVICE_SID") || Deno.env.get("TWILIO_FROM_NUMBER"))?.let((v) =>
    form.append(Deno.env.get("TWILIO_MESSAGING_SERVICE_SID") ? "MessagingServiceSid" : "From", v),
  );

  const resp = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Basic ${encoded}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const data = await resp.json();
  if (!resp.ok) {
    console.error("Twilio error:", data);
    return { ok: false, error: data.message || "SMS send failed" };
  }
  return { ok: true, sid: data.sid };
}

// ── Supabase clients ───────────────────────────────────────

function adminClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

function anonClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
}

// ── Helpers ────────────────────────────────────────────────

function norm(phone: string): string {
  let p = phone.replace(/\s+/g, "").trim();
  if (!p.startsWith("+")) p = "+" + p;
  return p;
}

// ── Main ───────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const p = await req.json();
    const action = p.action as string;

    if (action === "send_otp") return await handleSendOtp(req, p);
    if (action === "verify_otp") return await handleVerifyOtp(req, p);
    // Legacy hook mode: GoTrue calls us with { phone, otp }
    if (p.phone && p.otp) return await handleSendOtp(req, { ...p, action: "send_otp" });

    return new Response(JSON.stringify({ error: "Use { action: 'send_otp' | 'verify_otp' }" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-sms error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── send_otp ───────────────────────────────────────────────

async function handleSendOtp(req: Request, payload: Record<string, unknown>) {
  const phone = norm((payload.phone as string) || "");
  if (!phone || phone.length < 10) {
    return new Response(JSON.stringify({ error: "Valid phone number required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let sid = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
  let tok = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
  if (!sid || !tok) {
    return new Response(JSON.stringify({ error: "SMS provider not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const otp = (payload.otp as string) || generateOtp();
  const salt = crypto.randomUUID();
  const hash = await sha256(`${phone}:${otp}:${salt}`);

  const { error: dbErr } = await adminClient().from("phone_otps").insert({
    phone, otp_hash: hash, salt,
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  });
  if (dbErr) {
    console.error("OTP store error:", dbErr);
    return new Response(JSON.stringify({ error: "Failed to generate OTP" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const res = await sendTwilioSms(phone, `Your VitaHero verification code is: ${otp}`, sid, tok);
  if (!res.ok) {
    return new Response(JSON.stringify({ error: res.error }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true, expiresIn: 300 }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── verify_otp ─────────────────────────────────────────────

async function handleVerifyOtp(req: Request, payload: Record<string, unknown>) {
  const phone = norm((payload.phone as string) || "");
  const otp = (payload.otp as string) || "";
  if (!phone || otp.length !== 6) {
    return new Response(JSON.stringify({ error: "Phone and 6-digit OTP required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = adminClient();

  // Look up unverified, non-expired OTPs
  const { data: records, error: lookErr } = await admin
    .from("phone_otps")
    .select("*")
    .eq("phone", phone)
    .eq("verified", false)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(5);

  if (lookErr || !records?.length) {
    return new Response(JSON.stringify({ error: "No active OTP found. Request a new code." }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Match OTP against salted hashes
  let matched: (typeof records)[0] | null = null;
  for (const r of records) {
    if ((await sha256(`${phone}:${otp}:${r.salt || ""}`)) === r.otp_hash) {
      matched = r;
      break;
    }
  }
  if (!matched) {
    return new Response(JSON.stringify({ error: "Invalid OTP. Please try again." }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Mark verified
  await admin.from("phone_otps").update({ verified: true }).eq("id", matched.id);

  // ── User provisioning ──────────────────────────────────
  // Find existing user or create a new one
  let userId: string | null = null;
  const { data: users } = await admin.auth.admin.listUsers();
  const existing = users?.users?.find((u) => u.phone === phone);
  if (existing) {
    userId = existing.id;
  }

  const password = generatePassword();

  if (userId) {
    // Update existing user's password so we can sign them in
    await admin.auth.admin.updateUserById(userId, { password });
  } else {
    // Create new user with phone identity + password
    const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
      phone,
      password,
      phone_confirm: true,
      user_metadata: { name: "Parent", signup_method: "phone" },
    });
    if (createErr || !newUser?.user) {
      console.error("User creation failed:", createErr);
      return new Response(JSON.stringify({ error: "Failed to create account" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    userId = newUser.user.id;
  }

  // ── Sign in to get session tokens ──────────────────────
  const { data: session, error: signInErr } = await anonClient().auth.signInWithPassword({
    phone,
    password,
  });

  if (signInErr || !session?.session) {
    console.error("Sign-in failed:", signInErr);
    // Fallback: return just the user_id so the Android app can proceed
    return new Response(JSON.stringify({
      success: true,
      user_id: userId,
      phone,
      note: "User created. Session not available — retry verification.",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({
    success: true,
    user_id: userId,
    phone,
    access_token: session.session.access_token,
    refresh_token: session.session.refresh_token,
    user: session.user ? {
      id: session.user.id,
      email: session.user.email,
      phone: session.user.phone,
    } : null,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
