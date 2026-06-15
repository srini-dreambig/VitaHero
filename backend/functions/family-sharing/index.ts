/**
 * Supabase Edge Function: family-sharing
 *
 * Handles VitaHero family sharing — code validation, joining families,
 * and fetching shared kid data for co-parents.
 *
 *   POST { action: "validate_code", code: "ABC123" }
 *     → Validates a family code and returns the parent's profile info.
 *
 *   POST { action: "join_family", code: "ABC123", coParentName: "Dad", relation: "Father" }
 *     → Adds a co-parent to the family. Requires auth.
 *
 *   GET /shared-kids?familyCode=ABC123
 *     → Returns kids shared in this family. Requires auth (co-parent check).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "");

    if (req.method === "GET" && path.endsWith("/shared-kids")) {
      return await handleSharedKids(req, url);
    }

    const payload = await req.json();
    const action = payload.action as string;

    if (action === "validate_code") return await handleValidateCode(payload);
    if (action === "join_family") return await handleJoinFamily(req, payload);

    return new Response(JSON.stringify({ error: "Use action: 'validate_code' | 'join_family', or GET /shared-kids" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("family-sharing error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── Validate Family Code ──────────────────────────────────

async function handleValidateCode(payload: Record<string, unknown>) {
  const code = ((payload.code as string) || "").toUpperCase().trim();
  if (code.length < 4) {
    return new Response(JSON.stringify({ valid: false, error: "Code too short" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!
  );

  const { data: profiles, error } = await client
    .from("profiles")
    .select("id, name, family_code")
    .eq("family_code", code)
    .limit(1);

  if (error || !profiles?.length) {
    return new Response(JSON.stringify({ valid: false, error: "Family not found. Check the code and try again." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({
    valid: true,
    familyOwner: profiles[0].name,
    profileId: profiles[0].id,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Join Family ───────────────────────────────────────────

async function handleJoinFamily(req: Request, payload: Record<string, unknown>) {
  const code = ((payload.code as string) || "").toUpperCase().trim();
  const coParentName = ((payload.coParentName as string) || "").trim();
  const relation = ((payload.relation as string) || "Co-parent").trim();

  if (!code || !coParentName) {
    return new Response(JSON.stringify({ error: "Code and name required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Extract user from auth header
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Get the authenticated user
  const { data: { user }, error: authErr } = await admin.auth.getUser(
    authHeader.replace("Bearer ", "")
  );
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Invalid authentication" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Find the family by code
  const { data: profiles, error: profileErr } = await admin
    .from("profiles")
    .select("id, user_id, family_code")
    .eq("family_code", code)
    .limit(1);

  if (profileErr || !profiles?.length) {
    return new Response(JSON.stringify({ error: "Family not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const familyProfile = profiles[0];

  // Prevent joining own family
  if (familyProfile.user_id === user.id) {
    return new Response(JSON.stringify({ error: "You cannot join your own family" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Add co-parent record
  const coParentId = `cp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const { error: insertErr } = await admin.from("co_parents").insert({
    id: coParentId,
    profile_id: familyProfile.id,
    user_id: user.id,
    name: coParentName,
    relation,
    joined_date: new Date().toISOString().split("T")[0],
  });

  if (insertErr) {
    console.error("Co-parent insert error:", insertErr);
    return new Response(JSON.stringify({ error: "Failed to join family" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({
    success: true,
    coParentId,
    familyCode: code,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Shared Kids ───────────────────────────────────────────

async function handleSharedKids(req: Request, url: URL) {
  const familyCode = url.searchParams.get("familyCode")?.toUpperCase().trim();
  if (!familyCode) {
    return new Response(JSON.stringify({ error: "familyCode query parameter required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: { user }, error: authErr } = await admin.auth.getUser(
    authHeader.replace("Bearer ", "")
  );
  if (authErr || !user) {
    return new Response(JSON.stringify({ error: "Invalid authentication" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Find the family profile
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, user_id")
    .eq("family_code", familyCode)
    .limit(1);

  if (!profiles?.length) {
    return new Response(JSON.stringify({ error: "Family not found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const familyProfile = profiles[0];

  // Check if user is a co-parent or the owner
  const isOwner = familyProfile.user_id === user.id;
  let isCoParent = false;
  if (!isOwner) {
    const { data: cpData } = await admin
      .from("co_parents")
      .select("id")
      .eq("profile_id", familyProfile.id)
      .eq("user_id", user.id)
      .limit(1);
    isCoParent = (cpData?.length ?? 0) > 0;
  }

  if (!isOwner && !isCoParent) {
    return new Response(JSON.stringify({ error: "Not authorized to view this family" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fetch kids for this family
  const { data: kids, error: kidsErr } = await admin
    .from("kids")
    .select("*")
    .eq("profile_id", familyProfile.id)
    .order("name");

  if (kidsErr) {
    return new Response(JSON.stringify({ error: "Failed to fetch kids" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({
    kids: kids?.map(k => ({
      id: k.id,
      name: k.name,
      age: k.age,
      gender: k.gender,
      school: k.school,
      grade: k.grade,
      heightCm: k.height_cm,
      weightKg: k.weight_kg,
      overallScore: k.overall_score,
      dental: k.dental,
      eyesight: k.eyesight,
      nutrition: k.nutrition,
      lastCheckup: k.last_checkup,
    })) || [],
    isOwner,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
