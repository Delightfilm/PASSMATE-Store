import fs from "node:fs";

const edgeFunctionPaths = [
  "../supabase/functions/payment-start/index.ts",
  "../supabase/functions/payment-sync/index.ts",
  "../supabase/functions/payment-webhook/index.ts",
  "../supabase/functions/download-url/index.ts",
  "../supabase/functions/admin-data/index.ts",
  "../supabase/functions/admin-action/index.ts",
];

for (const path of edgeFunctionPaths) {
  const source = fs.readFileSync(new URL(path, import.meta.url), "utf8");

  if (!source.includes('npm:@supabase/server@1.7.0')) {
    throw new Error(path + " must use the pinned @supabase/server adapter.");
  }

  if (
    source.includes("SUPABASE_ANON_KEY") ||
    source.includes("SUPABASE_SERVICE_ROLE_KEY")
  ) {
    throw new Error(path + " still depends on a legacy Supabase API key.");
  }

  if (!source.includes("createSupabaseContext")) {
    throw new Error(path + " must resolve Supabase auth/context through @supabase/server.");
  }
}

for (const path of [
  "../supabase/functions/payment-start/index.ts",
  "../supabase/functions/payment-sync/index.ts",
  "../supabase/functions/download-url/index.ts",
  "../supabase/functions/admin-data/index.ts",
  "../supabase/functions/admin-action/index.ts",
]) {
  const source = fs.readFileSync(new URL(path, import.meta.url), "utf8");
  if (!source.includes('auth: "user"')) {
    throw new Error(path + " must require authenticated user context.");
  }
}

const webhook = fs.readFileSync(
  new URL("../supabase/functions/payment-webhook/index.ts", import.meta.url),
  "utf8"
);
if (!webhook.includes('auth: "none"') || !webhook.includes("PortOne.Webhook.verify")) {
  throw new Error(
    "payment-webhook must use provider signature auth before unauthenticated Supabase context."
  );
}
if (webhook.indexOf("PortOne.Webhook.verify") > webhook.indexOf('auth: "none"')) {
  throw new Error(
    "payment-webhook must verify the PortOne signature before creating admin context."
  );
}

const workerConfig = fs.readFileSync(
  new URL("../worker/passmate_worker/config.py", import.meta.url),
  "utf8"
);
const workerClient = fs.readFileSync(
  new URL("../worker/passmate_worker/client.py", import.meta.url),
  "utf8"
);
const workerStorage = fs.readFileSync(
  new URL("../worker/passmate_worker/storage.py", import.meta.url),
  "utf8"
);

for (const required of [
  "SUPABASE_SECRET_KEY",
  "production mode requires SUPABASE_SECRET_KEY",
]) {
  if (!workerConfig.includes(required)) {
    throw new Error("Worker modern server-key gate missing: " + required);
  }
}

for (const source of [workerClient, workerStorage]) {
  if (!source.includes('startswith("sb_secret_")')) {
    throw new Error("Worker must distinguish opaque modern secret keys from legacy JWT keys.");
  }
}

console.log("PASSMATE Supabase modern-key migration guard OK");
