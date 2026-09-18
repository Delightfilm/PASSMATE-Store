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

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

type PortOnePayment = {
  paymentId?: string;
  id?: string;
  transactionId?: string;
  status?: string;
  storeId?: string;
  currency?: string;
  amount?: { total?: number };
  failure?: {
    reason?: string;
    pgCode?: string;
    pgMessage?: string;
    code?: string;
    message?: string;
  };
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const portoneApiSecret = Deno.env.get("PORTONE_API_SECRET");
  const expectedStoreId = Deno.env.get("PORTONE_STORE_ID");

  if (
    !supabaseUrl ||
    !anonKey ||
    !serviceRoleKey ||
    !portoneApiSecret ||
    !expectedStoreId
  ) {
    return json(503, { error: "payment_sync_runtime_not_configured" });
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

  if (
    Object.keys(body).some((field) => field !== "paymentId") ||
    typeof body.paymentId !== "string" ||
    body.paymentId.length < 1 ||
    body.paymentId.length > 128
  ) {
    return json(400, { error: "invalid_payment_id" });
  }

  const paymentId = body.paymentId;
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: attempt, error: attemptError } = await admin
    .from("payment_attempts")
    .select("id,order_id,status,amount_krw,currency,merchant_order_id")
    .eq("provider", "portone_kcp")
    .eq("merchant_order_id", paymentId)
    .maybeSingle();

  if (attemptError) {
    console.error("payment-sync attempt lookup failed");
    return json(500, { error: "attempt_lookup_failed" });
  }
  if (!attempt) return json(404, { error: "payment_not_found" });

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id,user_id,status")
    .eq("id", attempt.order_id)
    .maybeSingle();

  if (orderError) {
    console.error("payment-sync order lookup failed");
    return json(500, { error: "order_lookup_failed" });
  }
  if (!order || order.user_id !== userData.user.id) {
    return json(404, { error: "payment_not_found" });
  }

  const providerResponse = await fetch(
    `https://api.portone.io/payments/${encodeURIComponent(paymentId)}`,
    {
      headers: {
        Authorization: `PortOne ${portoneApiSecret}`,
        Accept: "application/json",
      },
    }
  );

  if (providerResponse.status === 404) {
    return json(202, { result: "provider_pending" });
  }
  if (!providerResponse.ok) {
    console.error("payment-sync PortOne lookup failed", providerResponse.status);
    return json(502, { error: "provider_lookup_failed" });
  }

  const payment = (await providerResponse.json()) as PortOnePayment;

  if (
    payment.paymentId !== paymentId ||
    payment.storeId !== expectedStoreId ||
    payment.currency !== "KRW" ||
    attempt.currency !== "KRW"
  ) {
    console.error("payment-sync provider identity mismatch", {
      paymentId,
      providerPaymentId: payment.paymentId ?? null,
      providerStoreId: payment.storeId ?? null,
      providerCurrency: payment.currency ?? null,
    });
    return json(409, { error: "provider_identity_mismatch" });
  }

  if (
    typeof payment.amount?.total !== "number" ||
    !Number.isInteger(payment.amount.total) ||
    payment.amount.total !== attempt.amount_krw
  ) {
    console.error("payment-sync amount mismatch", paymentId);
    return json(409, { error: "payment_amount_mismatch" });
  }

  let eventType: "paid" | "failed" | "cancelled" | "refunded" | null = null;
  switch (payment.status) {
    case "PAID":
      eventType = "paid";
      break;
    case "FAILED":
      eventType = "failed";
      break;
    case "CANCELLED":
      eventType = attempt.status === "paid" || attempt.status === "refunded"
        ? "refunded"
        : "cancelled";
      break;
    case "PARTIAL_CANCELLED":
      console.error("payment-sync partial cancellation requires manual review", paymentId);
      return json(409, { error: "partial_cancellation_not_supported" });
    case "READY":
    case "PENDING":
    case "PAY_PENDING":
    case "VIRTUAL_ACCOUNT_ISSUED":
    case "CANCEL_PENDING":
      return json(202, { result: "provider_pending", status: payment.status });
    default:
      console.error("payment-sync unexpected provider status", payment.status);
      return json(409, {
        error: "unexpected_provider_status",
        status: payment.status ?? null,
      });
  }

  const providerPaymentId =
    payment.transactionId ?? payment.id ?? payment.paymentId;
  const providerEventId =
    "sync:" +
    await sha256Hex(
      [paymentId, payment.status ?? "-", providerPaymentId ?? "-"].join("|")
    );
  const payloadFingerprint = await sha256Hex(JSON.stringify(payment));

  const { data: result, error: applyError } = await admin.rpc(
    "apply_payment_event",
    {
      p_attempt_id: attempt.id,
      p_provider: "portone_kcp",
      p_provider_event_id: providerEventId,
      p_event_type: eventType,
      p_payload_sha256: payloadFingerprint,
      p_provider_payment_id: providerPaymentId,
      p_amount_krw: payment.amount.total,
      p_failure_code:
        payment.failure?.pgCode ??
        payment.failure?.code ??
        null,
      p_failure_detail:
        payment.failure?.reason ??
        payment.failure?.pgMessage ??
        payment.failure?.message ??
        null,
    }
  );

  if (applyError) {
    console.error("payment-sync apply_payment_event failed", applyError.code);
    return json(409, { error: "payment_state_rejected" });
  }

  return json(200, { result, status: payment.status });
});
