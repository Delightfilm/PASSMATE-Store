import fs from "node:fs";

for (const path of [
  "../app/admin/page.tsx",
  "../components/admin-client.tsx",
  "../supabase/functions/admin-data/index.ts",
  "../supabase/functions/admin-action/index.ts",
  "../supabase/migrations/0010_v7_admin_ops.sql",
  "../supabase/migrations/20260918143000_admin_p1_dml_hard_delete.sql",
]) {
  if (!fs.existsSync(new URL(path, import.meta.url))) {
    throw new Error("Missing V7 admin file: " + path);
  }
}

const client = fs.readFileSync(
  new URL("../components/admin-client.tsx", import.meta.url),
  "utf8"
);
const dataFunction = fs.readFileSync(
  new URL("../supabase/functions/admin-data/index.ts", import.meta.url),
  "utf8"
);
const actionFunction = fs.readFileSync(
  new URL("../supabase/functions/admin-action/index.ts", import.meta.url),
  "utf8"
);
const adminHardening = fs.readFileSync(
  new URL(
    "../supabase/migrations/20260918143000_admin_p1_dml_hard_delete.sql",
    import.meta.url
  ),
  "utf8"
);

if (!client.includes('profile?.role !== "admin"')) {
  throw new Error("Admin UI must gate on the admin profile role.");
}

if (!dataFunction.includes('profile?.role !== "admin"')) {
  throw new Error("admin-data must verify the admin role.");
}

if (!actionFunction.includes('profile?.role !== "admin"')) {
  throw new Error("admin-action must verify the admin role.");
}

if (!actionFunction.includes('"retry_issuance"')) {
  throw new Error("V7 admin action allowlist is missing retry_issuance.");
}

if (/SUPABASE_SERVICE_ROLE_KEY/.test(client)) {
  throw new Error("Admin browser code must never reference service-role secrets.");
}

for (const forbiddenPolicy of [
  "products_admin_insert",
  "products_admin_update",
  "products_admin_delete",
  "product_versions_admin_insert",
  "product_versions_admin_update",
  "product_versions_admin_delete",
  "orders_admin_insert",
  "orders_admin_update",
  "orders_admin_delete",
  "order_items_admin_insert",
  "order_items_admin_update",
  "order_items_admin_delete",
  "entitlements_admin_insert",
  "entitlements_admin_update",
  "entitlements_admin_delete",
]) {
  if (!adminHardening.includes(`drop policy if exists "${forbiddenPolicy}"`)) {
    throw new Error(
      "Admin P1 must remove authenticated direct DML policy: " + forbiddenPolicy
    );
  }
}

for (const required of [
  "reject_runtime_hard_delete",
  "passmate_block_runtime_delete",
  "passmate_block_runtime_truncate",
  "revoke delete, truncate",
]) {
  if (!adminHardening.includes(required)) {
    throw new Error("Admin P1 hard-delete guard missing: " + required);
  }
}

console.log("PASSMATE V7 admin contract OK");
