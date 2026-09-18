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

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
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

  const { data: profile } = await userClient
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return json(403, { error: "admin_required" });
  }

  let body: {
    action?: string;
    jobId?: string;
    artifactId?: string;
  };

  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (body.action === "retry_issuance") {
    if (!body.jobId || !/^[0-9a-fA-F-]{36}$/.test(body.jobId)) {
      return json(400, { error: "invalid_job_id" });
    }

    const { data, error } = await admin.rpc("admin_retry_issuance_job", {
      p_admin_user_id: userData.user.id,
      p_job_id: body.jobId,
    });

    if (error) {
      console.error("admin retry failed", error.code);
      return json(409, { error: "admin_action_rejected" });
    }

    return json(200, { result: data });
  }

  if (body.action === "verify_artifact") {
    if (!body.artifactId || !/^[0-9a-fA-F-]{36}$/.test(body.artifactId)) {
      return json(400, { error: "invalid_artifact_id" });
    }

    const { data: rows, error: artifactError } = await admin.rpc(
      "admin_get_issuance_artifact",
      {
        p_admin_user_id: userData.user.id,
        p_artifact_id: body.artifactId,
      }
    );

    if (artifactError) {
      console.error("artifact lookup failed", artifactError.code);
      return json(409, { error: "artifact_lookup_failed" });
    }

    const artifact = Array.isArray(rows) ? rows[0] : null;
    if (!artifact) return json(404, { error: "artifact_not_found" });

    const { data: object, error: downloadError } = await admin.storage
      .from("passmate-artifacts")
      .download(artifact.storage_key);

    if (downloadError || !object) {
      const { error: recordError } = await admin.rpc(
        "admin_record_artifact_integrity",
        {
          p_admin_user_id: userData.user.id,
          p_artifact_id: body.artifactId,
          p_integrity_status: "unavailable",
          p_observed_sha256: null,
          p_observed_size_bytes: null,
        }
      );

      if (recordError) {
        console.error("artifact unavailable record failed", recordError.code);
      }

      return json(200, { result: "unavailable" });
    }

    const bytes = await object.arrayBuffer();
    const observedSha256 = await sha256Hex(bytes);
    const observedSizeBytes = bytes.byteLength;
    const integrityStatus =
      observedSha256 === artifact.expected_sha256 &&
      observedSizeBytes === artifact.expected_size_bytes
        ? "verified"
        : "mismatch";

    const { error: recordError } = await admin.rpc(
      "admin_record_artifact_integrity",
      {
        p_admin_user_id: userData.user.id,
        p_artifact_id: body.artifactId,
        p_integrity_status: integrityStatus,
        p_observed_sha256: observedSha256,
        p_observed_size_bytes: observedSizeBytes,
      }
    );

    if (recordError) {
      console.error("artifact integrity record failed", recordError.code);
      return json(409, { error: "integrity_record_failed" });
    }

    return json(200, { result: integrityStatus });
  }

  return json(400, { error: "invalid_action" });
});
