import fs from "node:fs";

const publicConfig = fs.readFileSync(
  new URL("../lib/public-supabase-config.ts", import.meta.url),
  "utf8"
);
const browserClient = fs.readFileSync(
  new URL("../lib/supabase-browser.ts", import.meta.url),
  "utf8"
);

if (!publicConfig.includes("sb_publishable_")) {
  throw new Error("Auth config must use a Supabase publishable key.");
}

for (const [name, source] of [
  ["public config", publicConfig],
  ["browser client", browserClient],
]) {
  const forbiddenPatterns = [
    /SUPABASE_SERVICE_ROLE_KEY/,
    /service_role_key/i,
    /"role"\s*:\s*"service_role"/i,
    /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/,
  ];

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(source)) {
      throw new Error(`${name} appears to contain a server-only credential.`);
    }
  }
}

for (const route of [
  "../app/account/login/page.tsx",
  "../app/account/signup/page.tsx",
  "../app/account/forgot-password/page.tsx",
  "../app/account/reset-password/page.tsx",
  "../app/library/page.tsx",
]) {
  if (!fs.existsSync(new URL(route, import.meta.url))) {
    throw new Error(`Missing V2 auth route: ${route}`);
  }
}

console.log("PASSMATE V2 auth public-config guard OK");
