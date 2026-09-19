import fs from "node:fs";

const read = (path) =>
  fs.readFileSync(new URL(path, import.meta.url), "utf8");

const cart = read("../lib/cart.ts");
const options = read("../components/product-purchase-options.tsx");
const cartClient = read("../components/cart-client.tsx");
const checkout = read("../components/checkout-client.tsx");
const paymentStart = read("../supabase/functions/payment-start/index.ts");
const migration = read("../supabase/migrations/20260919100000_cart_checkout.sql");
const catalog = read("../data/catalog.json");

if (!cart.includes("core: 5900") || !cart.includes("pass: 9900")) {
  throw new Error("Package prices must be locked to 5,900 / 9,900.");
}

for (const [name, source] of Object.entries({
  options,
  cartClient,
  migration,
  catalog,
})) {
  if (source.includes("시험직전 벼락치기")) {
    throw new Error("Deprecated CRAM wording found in " + name);
  }
}

for (const required of [
  "PASS PACK 상세 합격교재",
  "CORE 핵심요약",
  "SHEET 공식·숫자 치트시트",
  "CHECK 시험직전 체크리스트",
]) {
  if (!options.includes(required)) {
    throw new Error("Package table missing " + required);
  }
}

if (cart.includes("quantity:") || cartClient.includes("item.quantity")) {
  throw new Error("Digital cart must not sell duplicate quantities.");
}

for (const required of [
  "pg_advisory_xact_lock",
  "idempotency key reused for different cart",
  "duplicate product slug",
  "conflicting package selections",
  "'PM-C2-PASS'",
  "'PM-SS3-PASS'",
  "9900",
]) {
  if (!migration.includes(required)) {
    throw new Error("Cart migration missing " + required);
  }
}

if (
  !checkout.includes("payment.items.map") ||
  !paymentStart.includes("items,") ||
  !paymentStart.includes("conflicting_package_selection")
) {
  throw new Error("Multi-item checkout must remain server-authoritative.");
}

const parsedCatalog = JSON.parse(catalog);
if (
  !Array.isArray(parsedCatalog) ||
  parsedCatalog.some((product) => product.price !== 5900)
) {
  throw new Error("Fallback catalog must use the locked core price.");
}

console.log("PASSMATE cart + package contract OK");
