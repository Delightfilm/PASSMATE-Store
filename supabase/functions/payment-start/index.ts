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
  const storeId = Deno.env.get("PORTONE_STORE_ID");
  const channelKey = Deno.env.get("PORTONE_KCP_CHANNEL_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json(503, { error: "supabase_runtime_not_configured" });
  }

  // Do not create an order if client-side PortOne identifiers are not ready.
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

  let body: { productSlug?: string; idempotencyKey?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  if (!body.productSlug || typeof body.productSlug !== "string") {
    return json(400, { error: "product_slug_required" });
  }

  const idempotencyKey =
    typeof body.idempotencyKey === "string" && body.idempotencyKey.length > 0
      ? body.idempotencyKey
      : crypto.randomUUID();

  if (idempotencyKey.length > 128) {
    return json(400, { error: "invalid_idempotency_key" });
  }

  const paymentId = `pm-${crypto.randomUUID()}`;
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.rpc("create_direct_checkout", {
    p_user_id: userData.user.id,
    p_product_slug: body.productSlug,
    p_provider: "portone_kcp",
    p_merchant_order_id: paymentId,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    console.error("create_direct_checkout failed", error.code);
    return json(409, { error: "checkout_not_available" });
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return json(500, { error: "checkout_result_missing" });

  return json(200, {
    orderId: row.order_id,
    paymentAttemptId: row.payment_attempt_id,
    paymentId,
    idempotencyKey,
    storeId,
    channelKey,
    orderName: row.product_title,
    amountKrw: row.amount_krw,
    currency: "KRW",
    payMethod: "CARD",
  });
});
