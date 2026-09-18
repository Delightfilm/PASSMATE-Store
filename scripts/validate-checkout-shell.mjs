import fs from "node:fs";

const required = [
  "../app/checkout/page.tsx",
  "../app/checkout/complete/page.tsx",
  "../components/checkout-client.tsx",
  "../components/checkout-complete-client.tsx",
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

if (!page.includes("https://cdn.portone.io/v2/browser-sdk.js")) {
  throw new Error("PortOne V2 browser SDK is not loaded.");
}

if (!client.includes('currency: "CURRENCY_KRW"')) {
  throw new Error("Checkout must request KRW through PortOne V2 currency enum.");
}

if (!client.includes("redirectUrl")) {
  throw new Error("Checkout must support mobile redirect flow.");
}

if (!complete.includes("provider_order_id")) {
  throw new Error("Completion page must verify the server-side order state.");
}

for (const source of [page, client, complete]) {
  if (/PORTONE_API_SECRET|SUPABASE_SERVICE_ROLE_KEY/.test(source)) {
    throw new Error("Checkout browser code contains a server-only secret name.");
  }
}

console.log("PASSMATE V3 checkout shell guard OK");
