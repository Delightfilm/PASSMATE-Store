import fs from "node:fs";

for (const path of [
  "../app/admin/page.tsx",
  "../components/admin-client.tsx",
  "../supabase/functions/admin-data/index.ts",
  "../supabase/functions/admin-action/index.ts",
  "../supabase/migrations/0010_v7_admin_ops.sql",
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

console.log("PASSMATE V7 admin contract OK");
