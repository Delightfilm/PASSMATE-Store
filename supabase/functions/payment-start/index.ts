import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const allowedRequestFields = new Set(["productSlug", "idempotencyKey"]);

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
  const storeId = Deno.env.get("PORTONE_STORE_ID");
  const channelKey = Deno.env.get("PORTONE_KCP_CHANNEL_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json(503, { error: "supabase_runtime_not_configured" });
  }

  if (!storeId || !channelKey) {
    return json(503, { error: "payment_provider_not_configured" });
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

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return json(400, { error: "invalid_request_body" });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return json(400, { error: "invalid_json" });
  }

  if (Object.keys(body).some((field) => !allowedRequestFields.has(field))) {
    return json(400, { error: "unexpected_checkout_field" });
  }

  if (typeof body.productSlug !== "string" || body.productSlug.length === 0) {
    return json(400, { error: "product_slug_required" });
  }

  const idempotencyKey =
    typeof body.idempotencyKey === "string" && body.idempotencyKey.length > 0
      ? body.idempotencyKey
      : crypto.randomUUID();

  if (idempotencyKey.length > 128) {
    return json(400, { error: "invalid_idempotency_key" });
  }

  // This value is only a proposal for a new logical checkout. On replay,
  // create_direct_checkout returns the original attempt and we read its
  // persisted merchant_order_id below.
  const proposedPaymentId = `pm-${crypto.randomUUID()}`;
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.rpc("create_direct_checkout", {
    p_user_id: userData.user.id,
    p_product_slug: body.productSlug,
    p_provider: "portone_kcp",
    p_merchant_order_id: proposedPaymentId,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    console.error("create_direct_checkout failed", error.code);
    return json(409, { error: "checkout_not_available" });
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return json(500, { error: "checkout_result_missing" });

  if (
    typeof row.order_id !== "string" ||
    typeof row.payment_attempt_id !== "string" ||
    typeof row.amount_krw !== "number" ||
    !Number.isInteger(row.amount_krw) ||
    row.amount_krw < 0 ||
    typeof row.product_code !== "string" ||
    row.product_code.length === 0 ||
    typeof row.product_title !== "string" ||
    row.product_title.length === 0 ||
    typeof row.product_version !== "string" ||
    row.product_version.length === 0
  ) {
    return json(500, { error: "checkout_result_invalid" });
  }

  const { data: attempt, error: attemptError } = await admin
    .from("payment_attempts")
    .select("id,merchant_order_id")
    .eq("id", row.payment_attempt_id)
    .maybeSingle();

  if (
    attemptError ||
    !attempt ||
    attempt.id !== row.payment_attempt_id ||
    typeof attempt.merchant_order_id !== "string" ||
    attempt.merchant_order_id.length === 0
  ) {
    console.error("payment attempt identity lookup failed");
    return json(500, { error: "checkout_payment_identity_missing" });
  }

  return json(200, {
    orderId: row.order_id,
    paymentAttemptId: row.payment_attempt_id,
    paymentId: attempt.merchant_order_id,
    idempotencyKey,
    storeId,
    channelKey,
    productCode: row.product_code,
    productVersion: row.product_version,
    orderName: row.product_title,
    amountKrw: row.amount_krw,
    currency: "KRW",
    payMethod: "CARD",
  });
});
