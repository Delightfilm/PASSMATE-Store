import fs from "node:fs";

const required = [
  "../app/checkout/page.tsx",
  "../app/checkout/complete/page.tsx",
  "../components/checkout-client.tsx",
  "../components/checkout-complete-client.tsx",
  "../supabase/functions/payment-start/index.ts",
  "../supabase/functions/payment-sync/index.ts",
];

for (const file of required) {
  if (!fs.existsSync(new URL(file, import.meta.url))) {
    throw new Error("Missing checkout shell file: " + file);
  }
}

const page = fs.readFileSync(
  new URL("../app/checkout/page.tsx", import.meta.url),
  "utf8"
);
const client = fs.readFileSync(
  new URL("../components/checkout-client.tsx", import.meta.url),
  "utf8"
);
const complete = fs.readFileSync(
  new URL("../components/checkout-complete-client.tsx", import.meta.url),
  "utf8"
);
const paymentStart = fs.readFileSync(
  new URL("../supabase/functions/payment-start/index.ts", import.meta.url),
  "utf8"
);
const paymentSync = fs.readFileSync(
  new URL("../supabase/functions/payment-sync/index.ts", import.meta.url),
  "utf8"
);

if (!page.includes("https://cdn.portone.io/v2/browser-sdk.js")) {
  throw new Error("PortOne V2 browser SDK is not loaded.");
}

if (!client.includes('currency: "CURRENCY_KRW"')) {
  throw new Error("Checkout must request KRW through PortOne V2 currency enum.");
}

if (!client.includes("redirectUrl")) {
  throw new Error("Checkout must support mobile redirect flow.");
}

if (/\d[\d,]*\s*원/.test(client) || client.includes("컴퓨터활용능력 2급")) {
  throw new Error("Checkout must not hardcode a product title or KRW amount.");
}

for (const dynamicField of [
  "payment.orderName",
  "payment.productCode",
  "payment.productVersion",
  "payment.amountKrw",
]) {
  if (!client.includes(dynamicField)) {
    throw new Error(`Checkout must display server field: ${dynamicField}`);
  }
}

if (
  !client.includes('type="checkbox"') ||
  !client.includes("checked={confirmed}") ||
  !client.includes("disabled={!confirmed || busy}") ||
  !client.includes("onClick={confirmPayment}")
) {
  throw new Error("Checkout must require explicit confirmation before payment.");
}

const confirmStart = client.indexOf("async function confirmPayment()");
const requestPayment = client.indexOf("window.PortOne.requestPayment");
const renderStart = client.indexOf("\n  return (", confirmStart);
if (
  confirmStart === -1 ||
  requestPayment < confirmStart ||
  renderStart === -1 ||
  requestPayment > renderStart
) {
  throw new Error("PortOne must only be invoked by the explicit confirmation action.");
}

const requestBodyStart = client.indexOf("body: JSON.stringify({");
const requestBodyEnd = client.indexOf("}),", requestBodyStart);
if (requestBodyStart === -1 || requestBodyEnd === -1) {
  throw new Error("Checkout payment-start request body is missing.");
}

const requestBody = client.slice(requestBodyStart, requestBodyEnd);
if (/amount|price|orderName|productCode|productVersion|currency/i.test(requestBody)) {
  throw new Error("Browser catalog values must not be sent to payment-start.");
}

if (
  !paymentStart.includes(
    'const allowedRequestFields = new Set(["productSlug", "productSlugs", "idempotencyKey"])'
  ) ||
  !paymentStart.includes('error: "unexpected_checkout_field"')
) {
  throw new Error("payment-start must reject browser-supplied catalog fields.");
}

for (const mapping of [
  "productCode: row.product_code",
  "productVersion: row.product_version",
  "orderName: row.order_name",
  "amountKrw: row.amount_krw",
]) {
  if (!paymentStart.includes(mapping)) {
    throw new Error(`payment-start must return authoritative RPC field: ${mapping}`);
  }
}

if (
  !complete.includes('"/functions/v1/payment-sync"') ||
  !complete.includes("body: JSON.stringify({ paymentId })")
) {
  throw new Error("Completion page must request authenticated server reconciliation.");
}

if (
  !paymentSync.includes('.eq("merchant_order_id", paymentId)') ||
  !paymentSync.includes("order.user_id !== ctx.userClaims.id")
) {
  throw new Error("payment-sync must bind the payment to the authenticated purchaser.");
}

if (!complete.includes("provider_order_id")) {
  throw new Error("Completion page must verify the server-side order state.");
}

for (const source of [page, client, complete]) {
  if (/PORTONE_API_SECRET|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY/.test(source)) {
    throw new Error("Checkout browser code contains a server-only secret name.");
  }
}

console.log("PASSMATE checkout authority guard OK");
