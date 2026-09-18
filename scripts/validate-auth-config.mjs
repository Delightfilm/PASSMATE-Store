import fs from "node:fs";

const publicConfig = fs.readFileSync(
  new URL("../lib/public-supabase-config.ts", import.meta.url),
  "utf8"
);
const browserClient = fs.readFileSync(
  new URL("../lib/supabase-browser.ts", import.meta.url),
  "utf8"
);
const authForm = fs.readFileSync(
  new URL("../components/auth-form.tsx", import.meta.url),
  "utf8"
);
const oauthCallback = fs.readFileSync(
  new URL("../components/oauth-callback.tsx", import.meta.url),
  "utf8"
);
const authNav = fs.readFileSync(
  new URL("../components/auth-nav.tsx", import.meta.url),
  "utf8"
);

if (!publicConfig.includes("sb_publishable_")) {
  throw new Error("Auth config must use a Supabase publishable key.");
}

for (const [name, source] of [
  ["public config", publicConfig],
  ["browser client", browserClient],
  ["auth form", authForm],
  ["OAuth callback", oauthCallback],
  ["auth nav", authNav],
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
  "../app/account/oauth-callback/page.tsx",
  "../app/library/page.tsx",
]) {
  if (!fs.existsSync(new URL(route, import.meta.url))) {
    throw new Error(`Missing V2 auth route: ${route}`);
  }
}

for (const required of [
  'signInWithOAuth("google")',
  'signInWithOAuth("kakao")',
  "signInWithOAuth",
  "/account/oauth-callback/",
]) {
  if (!authForm.includes(required)) {
    throw new Error(`Missing SNS auth integration: ${required}`);
  }
}

if (
  !authForm.includes("skipBrowserRedirect: true") ||
  !authForm.includes("window.location.assign(data.url)") ||
  !authForm.includes('sessionStorage.setItem("passmate.oauth.next"')
) {
  throw new Error("OAuth navigation must preserve the current deployment origin and next path explicitly.");
}

if (!oauthCallback.includes('sessionStorage.getItem("passmate.oauth.next")')) {
  throw new Error("OAuth callback must restore the next path without widening redirect URL matching.");
}

if (!oauthCallback.includes("getSafeNextPath") || !oauthCallback.includes("getSession")) {
  throw new Error("OAuth callback must validate next and restore the Supabase session.");
}

if (!authNav.includes('search.get("error_description")') || !authNav.includes('"oauth_error"')) {
  throw new Error("Global auth navigation must recover OAuth errors that fall back to the Site URL.");
}

console.log("PASSMATE V2 auth public-config guard OK");
