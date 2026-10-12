import fs from "node:fs";
import assert from "node:assert/strict";
const root = new URL("../", import.meta.url);
const policy = JSON.parse(fs.readFileSync(new URL("security/vercel-firewall.json", root), "utf8"));
const matches = (rule, path, method = "GET") => rule.conditionGroup.some(group => group.conditions.every(condition => {
  const value = condition.type === "path" ? path : condition.type === "method" ? method : undefined;
  assert.notEqual(value, undefined, "Test all configured request conditions explicitly");
  if (condition.op === "re") return new RegExp(condition.value).test(value);
  if (condition.op === "pre") return value.startsWith(condition.value);
  if (condition.op === "inc") return condition.value.includes(value);
  throw new Error(`Untested condition operator: ${condition.op}`);
}));
const scan = policy.rules.find(rule => rule.name === "PASSMATE exploit probes");
assert.ok(scan);
for (const path of ["/.env", "/.env.local", "/.git/config", "/wp-login.php", "/wp-admin/", "/xmlrpc.php", "/phpmyadmin/"]) assert.ok(matches(scan, path), `Probe blocked: ${path}`);
for (const path of ["/", "/cbt/", "/cbt/c2/exam/attempt-1/", "/account/callback/", "/account/login/", "/api/cbt/attempts/1/submit/", "/admin/", "/terms/", "/robots.txt", "/sitemap.xml", "/_next/static/app.js", "/library/", "/checkout/complete/", "/images/example.png"]) {
  assert.ok(!matches(scan, path), `Do not ban normal routes: ${path}`);
}
const rate = policy.rules.find(rule => rule.action.mitigate.action === "rate_limit");
assert.ok(matches(rate, "/api/cbt/question-stats/", "POST"));
assert.ok(!matches(rate, "/account/login/"));
assert.ok(!matches(rate, "/_next/static/app.js"));
assert.ok(!matches(rate, "/api/payments/webhook/", "POST"));
assert.deepEqual(rate.action.mitigate.rateLimit.keys, ["ip"]);
assert.equal(rate.action.mitigate.rateLimit.window, 60);
assert.equal(rate.action.mitigate.rateLimit.action, "rate_limit");
assert.ok(rate.action.mitigate.rateLimit.limit >= 600, "Allow shared-network learning bursts");
assert.equal(policy.managed["bot-protection"], "challenge");
assert.equal(policy.managed["ai-bots"], "deny");
assert.ok(!JSON.stringify(policy).includes("mac_address"), "Do not claim a remote device MAC address is available");
assert.ok(!policy.rules.some(rule => rule.action.mitigate.actionDuration), "No unreviewed permanent or persistent IP ban");
console.log("Security policy PASS: exploit probes, normal/auth/download/SEO routes preserved, bounded CBT API rate limit, no MAC/persistent ban");
