import { createSupabaseContext } from "npm:@supabase/server@1.7.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const allowedRequestFields = new Set(["productSlug", "productSlugs", "idempotencyKey"]);
const PASS_PACK_SUFFIX = "-pass-pack";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function familySlug(slug: string) {
  return slug.endsWith(PASS_PACK_SUFFIX)
    ? slug.slice(0, -PASS_PACK_SUFFIX.length)
    : slug;
}

function parseProductSlugs(body: Record<string, unknown>) {
  let productSlugs: string[];

  if (Array.isArray(body.productSlugs)) {
    if (
      body.productSlugs.length === 0 ||
      body.productSlugs.length > 20 ||
      body.productSlugs.some(
        (value) =>
          typeof value !== "string" ||
          value.length < 1 ||
          value.length > 160
      )
    ) {
      return { error: "invalid_product_slugs" as const };
    }
    productSlugs = body.productSlugs as string[];
  } else if (
    typeof body.productSlug === "string" &&
    body.productSlug.length >= 1 &&
    body.productSlug.length <= 160
  ) {
    productSlugs = [body.productSlug];
  } else {
    return { error: "product_slug_required" as const };
  }

  if (
    typeof body.productSlug === "string" &&
    body.productSlug !== productSlugs[0]
  ) {
    return { error: "product_slug_mismatch" as const };
  }

  if (new Set(productSlugs).size !== productSlugs.length) {
    return { error: "duplicate_product_slug" as const };
  }

  const families = productSlugs.map(familySlug);
  if (new Set(families).size !== families.length) {
    return { error: "conflicting_package_selection" as const };
  }

  return { productSlugs };
}

type PaymentItem = {
  slug: string;
  code: string;
  title: string;
  version: string;
  amountKrw: number;
};

function isPaymentItem(value: unknown): value is PaymentItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.slug === "string" &&
    item.slug.length > 0 &&
    typeof item.code === "string" &&
    item.code.length > 0 &&
    typeof item.title === "string" &&
    item.title.length > 0 &&
    typeof item.version === "string" &&
    item.version.length > 0 &&
    typeof item.amountKrw === "number" &&
    Number.isInteger(item.amountKrw) &&
    item.amountKrw >= 0
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  const storeId = Deno.env.get("PORTONE_STORE_ID");
  const channelKey = Deno.env.get("PORTONE_KCP_CHANNEL_KEY");
  if (!storeId || !channelKey) {
    return json(503, { error: "payment_provider_not_configured" });
  }

  const { data: ctx, error: contextError } =
    await createSupabaseContext(req, { auth: "user" });

  if (contextError || !ctx?.userClaims?.id) {
    return json(contextError?.status ?? 401, { error: "invalid_session" });
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

  const parsedSlugs = parseProductSlugs(body);
  if ("error" in parsedSlugs) {
    return json(400, { error: parsedSlugs.error });
  }
  const productSlugs = parsedSlugs.productSlugs;

  const idempotencyKey =
    typeof body.idempotencyKey === "string" && body.idempotencyKey.length > 0
      ? body.idempotencyKey
      : crypto.randomUUID();

  if (idempotencyKey.length > 128) {
    return json(400, { error: "invalid_idempotency_key" });
  }

  const proposedPaymentId = `pm-${crypto.randomUUID()}`;
  const admin = ctx.supabaseAdmin;

  const { data, error } = await admin.rpc("create_direct_checkout", {
    p_user_id: ctx.userClaims.id,
    p_product_slug: productSlugs[0],
    p_product_slugs: productSlugs,
    p_provider: "portone_kcp",
    p_merchant_order_id: proposedPaymentId,
    p_idempotency_key: idempotencyKey,
  });

  if (error) {
    console.error("create_direct_checkout failed", error.code);
    return json(409, { error: "checkout_not_available" });
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) {
    return json(500, { error: "checkout_result_missing" });
  }

  const items: unknown = row.items;
  if (
    typeof row.order_id !== "string" ||
    typeof row.payment_attempt_id !== "string" ||
    typeof row.amount_krw !== "number" ||
    !Number.isInteger(row.amount_krw) ||
    row.amount_krw < 0 ||
    typeof row.product_code !== "string" ||
    typeof row.product_title !== "string" ||
    typeof row.product_version !== "string" ||
    typeof row.order_name !== "string" ||
    !Array.isArray(items) ||
    items.length === 0 ||
    !items.every(isPaymentItem) ||
    items.reduce((sum, item) => sum + item.amountKrw, 0) !== row.amount_krw
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
    orderName: row.order_name,
    items,
    amountKrw: row.amount_krw,
    currency: "KRW",
    payMethod: "CARD",
  });
});
