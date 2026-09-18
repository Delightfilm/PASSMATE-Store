import { createClient } from "npm:@supabase/supabase-js@2";
import * as PortOne from "jsr:@portone/server-sdk@0.19.0";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
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
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const portoneApiSecret = Deno.env.get("PORTONE_API_SECRET");
  const webhookSecret = Deno.env.get("PORTONE_WEBHOOK_SECRET");
  const expectedStoreId = Deno.env.get("PORTONE_STORE_ID");

  if (
    !supabaseUrl ||
    !serviceRoleKey ||
    !portoneApiSecret ||
    !webhookSecret ||
    !expectedStoreId
  ) {
    return json(503, { error: "webhook_runtime_not_configured" });
  }

  const rawBody = await req.text();

  try {
    await PortOne.Webhook.verify(
      webhookSecret,
      rawBody,
      Object.fromEntries(req.headers.entries())
    );
  } catch (error) {
    console.warn("PortOne webhook signature verification failed", error);
    return json(400, { error: "invalid_webhook_signature" });
  }

  let webhook: {
    type?: string;
    timestamp?: string;
    data?: {
      paymentId?: string;
      storeId?: string;
      transactionId?: string;
      cancellationId?: string;
    };
  };

  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return json(400, { error: "invalid_webhook_body" });
    }
    webhook = parsed as typeof webhook;
  } catch {
    return json(400, { error: "invalid_webhook_json" });
  }

  const paymentId = webhook.data?.paymentId;
  if (!paymentId) {
    return json(200, { result: "ignored" });
  }

  if (webhook.data?.storeId !== expectedStoreId) {
    console.error("PortOne webhook store mismatch", {
      paymentId,
      storeId: webhook.data?.storeId ?? null,
    });
    return json(400, { error: "webhook_store_mismatch" });
  }

  if (webhook.type === "Transaction.PartialCancelled") {
    console.error("Partial cancellation requires manual review", paymentId);
    return json(200, {
      result: "manual_review_required",
      reason: "partial_cancellation_not_supported",
    });
  }

  const response = await fetch(
    `https://api.portone.io/payments/${encodeURIComponent(paymentId)}`,
    {
      headers: {
        Authorization: `PortOne ${portoneApiSecret}`,
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    console.error("PortOne payment lookup failed", response.status);
    return json(502, { error: "provider_lookup_failed" });
  }

  const payment = (await response.json()) as PortOnePayment;

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: attempt, error: attemptError } = await admin
    .from("payment_attempts")
    .select("id,status,amount_krw,currency")
    .eq("provider", "portone_kcp")
    .eq("merchant_order_id", paymentId)
    .maybeSingle();

  if (attemptError) {
    console.error("payment attempt lookup failed");
    return json(500, { error: "attempt_lookup_failed" });
  }

  if (!attempt) {
    return json(200, { result: "unknown_payment" });
  }

  if (
    payment.paymentId !== paymentId ||
    payment.storeId !== expectedStoreId ||
    payment.currency !== "KRW" ||
    attempt.currency !== "KRW"
  ) {
    console.error("PortOne authoritative payment identity mismatch", {
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
    console.error("PortOne authoritative payment amount mismatch", paymentId);
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
      console.error("Partial cancellation requires manual review", paymentId);
      return json(200, {
        result: "manual_review_required",
        reason: "partial_cancellation_not_supported",
      });
    case "READY":
    case "PENDING":
    case "PAY_PENDING":
    case "VIRTUAL_ACCOUNT_ISSUED":
    case "CANCEL_PENDING":
      return json(200, { result: "ignored_status", status: payment.status });
    default:
      console.error("Unexpected PortOne payment status", payment.status);
      return json(200, {
        result: "manual_review_required",
        status: payment.status ?? null,
      });
  }

  const fingerprint = await sha256Hex(rawBody);
  const providerEventId = [
    webhook.type ?? "Transaction.Unknown",
    webhook.data?.transactionId ?? payment.transactionId ?? paymentId,
    webhook.data?.cancellationId ?? "-",
    webhook.timestamp ?? "-",
  ].join(":").slice(0, 160);

  const providerPaymentId =
    payment.transactionId ??
    webhook.data?.transactionId ??
    payment.id ??
    payment.paymentId;

  const { data: result, error: applyError } = await admin.rpc(
    "apply_payment_event",
    {
      p_attempt_id: attempt.id,
      p_provider: "portone_kcp",
      p_provider_event_id: providerEventId,
      p_event_type: eventType,
      p_payload_sha256: fingerprint,
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
    console.error("apply_payment_event failed", applyError.code);
    return json(409, { error: "payment_state_rejected" });
  }

  return json(200, { result });
});
