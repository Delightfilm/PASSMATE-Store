import fs from "node:fs";

const read = (path) =>
  fs.readFileSync(new URL(path, import.meta.url), "utf8");

const adminClient = read("../components/admin-client.tsx");
const adminAction = read("../supabase/functions/admin-action/index.ts");
const adminMigration = read(
  "../supabase/migrations/20260919024757_admin_product_data_management.sql"
);
const cartMigration = read(
  "../supabase/migrations/20260919063638_cart_checkout.sql"
);
const paymentStart = read("../supabase/functions/payment-start/index.ts");
const checkout = read("../components/checkout-client.tsx");

const chain = [
  [adminClient, "priceKrw: String(product.price_krw)"],
  [adminClient, "priceKrw,"],
  [adminAction, "p_price_krw: Math.trunc(body.priceKrw)"],
  [adminMigration, "price_krw = p_price_krw"],
  [cartMigration, "unit_price_krw"],
  [cartMigration, "v_product.price_krw"],
  [cartMigration, "v_total := v_total + v_product.price_krw"],
  [paymentStart, "amountKrw: row.amount_krw"],
  [checkout, "totalAmount: payment.amountKrw"],
];

for (const [source, required] of chain) {
  if (!source.includes(required)) {
    throw new Error("Admin price -> payment amount chain missing: " + required);
  }
}

if (
  checkout.includes("totalAmount: 5900") ||
  checkout.includes("totalAmount: 9900") ||
  paymentStart.includes("amountKrw: 5900") ||
  paymentStart.includes("amountKrw: 9900")
) {
  throw new Error("Payment amount must never be a hardcoded package price.");
}

console.log(
  "PASSMATE admin price -> DB price_krw -> order total -> PortOne amount contract OK"
);
