import fs from "node:fs";

const publicConfig = fs.readFileSync(new URL("../lib/public-supabase-config.ts", import.meta.url), "utf8");
const browserClient = fs.readFileSync(new URL("../lib/supabase-browser.ts", import.meta.url), "utf8");

if (!publicConfig.includes("sb_publishable_")) throw new Error("Auth config must use a Supabase publishable key.");

for (const [name, source] of [["public config", publicConfig], ["browser client", browserClient]]) {
  if (/service[_-]?role/i.test(source)) throw new Error(`${name} must never contain a service-role credential.`);
}

for (const route of [
  "../app/account/login/page.tsx",
  "../app/account/signup/page.tsx",
  "../app/account/forgot-password/page.tsx",
  "../app/account/reset-password/page.tsx",
  "../app/library/page.tsx",
]) {
  if (!fs.existsSync(new URL(route, import.meta.url))) throw new Error(`Missing V2 auth route: ${route}`);
}

console.log("PASSMATE V2 auth public-config guard OK");
