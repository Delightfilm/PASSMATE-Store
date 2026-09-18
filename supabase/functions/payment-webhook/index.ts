import { createClient } from "npm:@supabase/supabase-js@2";

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
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const portoneApiSecret = Deno.env.get("PORTONE_API_SECRET");

  if (!supabaseUrl || !serviceRoleKey || !portoneApiSecret) {
    return json(503, { error: "webhook_runtime_not_configured" });
  }

  const rawBody = await req.text();
  let webhook: {
    type?: string;
    timestamp?: string;
    data?: {
      paymentId?: string;
      transactionId?: string;
      cancellationId?: string;
    };
  };

  try {
    webhook = JSON.parse(rawBody);
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const paymentId = webhook.data?.paymentId;
  if (!paymentId) {
    // Non-payment PortOne webhook; acknowledge without mutating PASSMATE state.
    return json(200, { result: "ignored" });
  }

  // Authoritative verification strategy: never trust webhook status itself.
  // Re-fetch the payment from PortOne V2 API and use that response only.
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

  const payment = await response.json() as {
    id?: string;
    status?: string;
    amount?: { total?: number };
    failure?: { code?: string; message?: string };
  };

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: attempt, error: attemptError } = await admin
    .from("payment_attempts")
    .select("id,status,amount_krw")
    .eq("provider", "portone_kcp")
    .eq("merchant_order_id", paymentId)
    .maybeSingle();

  if (attemptError) {
    console.error("payment attempt lookup failed");
    return json(500, { error: "attempt_lookup_failed" });
  }

  if (!attempt) {
    // Unknown payment id: acknowledge so a foreign/test PortOne event does not retry forever.
    return json(200, { result: "unknown_payment" });
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
      eventType = attempt.status === "paid" ? "refunded" : "cancelled";
      break;
    default:
      return json(200, { result: "ignored_status", status: payment.status ?? null });
  }

  const fingerprint = await sha256Hex(rawBody);
  const providerEventId = [
    webhook.type ?? "Transaction.Unknown",
    webhook.data?.transactionId ?? paymentId,
    webhook.data?.cancellationId ?? "-",
    webhook.timestamp ?? "-",
  ].join(":").slice(0, 160);

  const { data: result, error: applyError } = await admin.rpc(
    "apply_payment_event",
    {
      p_attempt_id: attempt.id,
      p_provider: "portone_kcp",
      p_provider_event_id: providerEventId,
      p_event_type: eventType,
      p_payload_sha256: fingerprint,
      p_provider_payment_id:
        webhook.data?.transactionId ?? payment.id ?? paymentId,
      p_amount_krw:
        typeof payment.amount?.total === "number"
          ? payment.amount.total
          : null,
      p_failure_code: payment.failure?.code ?? null,
      p_failure_detail: payment.failure?.message ?? null,
    }
  );

  if (applyError) {
    console.error("apply_payment_event failed", applyError.code);
    return json(409, { error: "payment_state_rejected" });
  }

  return json(200, { result });
});
