import { createSupabaseContext } from "npm:@supabase/server@1.7.0";

const BUCKET = "passmate-artifacts";
const EXPIRES_IN_SECONDS = 60;

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

function safeFilename(productCode: string, productVersion: string): string {
  const safe = (value: string) =>
    value.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return "PASSMATE-" + safe(productCode) + "-" + safe(productVersion) + ".pdf";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const { data: ctx, error: contextError } =
    await createSupabaseContext(req, { auth: "user" });

  if (contextError || !ctx?.userClaims?.id) {
    return json(contextError?.status ?? 401, { error: "invalid_session" });
  }

  let body: { entitlementId?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  if (
    !body.entitlementId ||
    !/^[0-9a-fA-F-]{36}$/.test(body.entitlementId)
  ) {
    return json(400, { error: "invalid_entitlement_id" });
  }

  const admin = ctx.supabaseAdmin;

  const { data, error: resolveError } = await admin.rpc(
    "resolve_download_artifact",
    {
      p_user_id: ctx.userClaims.id,
      p_entitlement_id: body.entitlementId,
    }
  );

  if (resolveError) {
    console.error("resolve_download_artifact failed", resolveError.code);
    return json(500, { error: "download_resolution_failed" });
  }

  const artifact = Array.isArray(data) ? data[0] : null;
  if (!artifact) {
    return json(409, { error: "artifact_not_ready" });
  }

  const filename = safeFilename(
    artifact.product_code,
    artifact.product_version
  );

  const { data: signed, error: signError } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(
      artifact.storage_key,
      EXPIRES_IN_SECONDS,
      { download: filename }
    );

  if (signError || !signed?.signedUrl) {
    console.error("storage sign failed", signError?.message);
    return json(502, { error: "download_link_failed" });
  }

  const expiresAt = new Date(
    Date.now() + EXPIRES_IN_SECONDS * 1000
  ).toISOString();

  const { error: logError } = await admin
    .from("download_events")
    .insert({
      user_id: ctx.userClaims.id,
      entitlement_id: body.entitlementId,
      issuance_job_id: artifact.issuance_job_id,
      event_type: "signed_url_created",
      expires_at: expiresAt,
    });

  if (logError) {
    console.error("download event log failed", logError.code);
  }

  return json(200, {
    url: signed.signedUrl,
    filename,
    expiresIn: EXPIRES_IN_SECONDS,
    expiresAt,
    sha256: artifact.sha256,
    sizeBytes: artifact.size_bytes,
  });
});
