import fs from "node:fs";

const read = (path) =>
  fs.readFileSync(new URL(path, import.meta.url), "utf8");

const cart = read("../lib/cart.ts");
const pricing = read("../lib/live-product-prices.ts");
const options = read("../components/product-purchase-options.tsx");
const cartClient = read("../components/cart-client.tsx");
const checkout = read("../components/checkout-client.tsx");
const paymentStart = read("../supabase/functions/payment-start/index.ts");
const migration = read("../supabase/migrations/20260919063638_cart_checkout.sql");
const catalogNormalization = read(
  "../supabase/migrations/20260919124500_normalize_stage_sound_core_slug.sql"
);

if (
  cart.includes("PACKAGE_PRICES") ||
  cart.includes("getPackagePrice") ||
  cartClient.includes("getPackagePrice") ||
  options.includes("getPackagePrice")
) {
  throw new Error("Storefront/cart must not hardcode package prices.");
}

for (const required of [
  '.from("products")',
  '.select("slug,price_krw")',
  '.eq("is_active", true)',
]) {
  if (!pricing.includes(required)) {
    throw new Error("Live price lookup missing: " + required);
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

if (
  !options.includes("fetchLiveProductPrices") ||
  !cartClient.includes("fetchLiveProductPrices")
) {
  throw new Error("Product options and cart must refresh prices from Supabase.");
}

for (const required of [
  "pg_advisory_xact_lock",
  "idempotency key reused for different cart",
  "duplicate product slug",
  "conflicting package selections",
  "v_product.price_krw",
  "v_total := v_total + v_product.price_krw",
]) {
  if (!migration.includes(required)) {
    throw new Error("Cart checkout migration missing: " + required);
  }
}

if (
  !checkout.includes("payment.items.map") ||
  !paymentStart.includes("items,") ||
  !paymentStart.includes("amountKrw: row.amount_krw")
) {
  throw new Error("Multi-item checkout must remain server-authoritative.");
}

for (const required of [
  "code = 'PM-SS3-CORE'",
  "slug = 'stage-sound-level-3'",
  "PM-SS3-CORE slug normalization failed",
]) {
  if (!catalogNormalization.includes(required)) {
    throw new Error("Stage sound cart slug normalization missing: " + required);
  }
}

console.log("PASSMATE cart + dynamic pricing contract OK");
