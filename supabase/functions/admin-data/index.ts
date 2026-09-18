import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json(503, { error: "runtime_not_configured" });
  }

  const authorization = req.headers.get("Authorization");
  if (!authorization) return json(401, { error: "missing_authorization" });

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return json(401, { error: "invalid_session" });
  }

  const { data: profile, error: profileError } = await userClient
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError || profile?.role !== "admin") {
    return json(403, { error: "admin_required" });
  }

  let body: { view?: string; limit?: number; offset?: number };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const userId = userData.user.id;
  let result;

  if (body.view === "summary") {
    result = await admin.rpc("admin_dashboard_summary", {
      p_admin_user_id: userId,
    });
  } else if (body.view === "orders") {
    result = await admin.rpc("admin_list_orders", {
      p_admin_user_id: userId,
      p_limit: Math.min(Math.max(body.limit ?? 50, 1), 200),
      p_offset: Math.max(body.offset ?? 0, 0),
    });
  } else if (body.view === "jobs") {
    result = await admin.rpc("admin_list_issuance_jobs", {
      p_admin_user_id: userId,
      p_limit: Math.min(Math.max(body.limit ?? 100, 1), 300),
    });
  } else if (body.view === "catalog") {
    result = await admin.rpc("admin_list_catalog", {
      p_admin_user_id: userId,
    });
  } else {
    return json(400, { error: "invalid_view" });
  }

  if (result.error) {
    console.error("admin data rpc failed", result.error.code);
    return json(500, { error: "admin_data_failed" });
  }

  return json(200, { data: result.data });
});
