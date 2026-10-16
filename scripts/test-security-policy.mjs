import fs from "node:fs";
import assert from "node:assert/strict";
const root = new URL("../", import.meta.url);
const policy = JSON.parse(fs.readFileSync(new URL("security/vercel-firewall.json", root), "utf8"));
const matches = (rule, path, method = "GET", request = {}) => rule.conditionGroup.some(group => group.conditions.every(condition => {
  const values = { path: new URL(decodeURIComponent(path), "https://www.mypassmate.com").pathname, method, ...request };
  const value = values[condition.type];
  assert.notEqual(value, undefined, "Test all configured request conditions explicitly");
  if (condition.op === "re") return new RegExp(condition.value).test(value);
  if (condition.op === "pre") return value.startsWith(condition.value);
  if (condition.op === "inc") return condition.value.includes(value);
  if (condition.op === "eq") return condition.value === value;
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
const audit = policy.rules.find(rule => rule.name === "PASSMATE verified SE Ranking audit");
assert.ok(audit, "Verified SE Ranking audit requires a scoped exception");
assert.equal(audit.active, true);
assert.equal(audit.action.mitigate.action, "bypass");
assert.ok(policy.rules.indexOf(audit) > policy.rules.indexOf(scan), "Exploit protection must run first");
assert.ok(policy.rules.indexOf(audit) > policy.rules.indexOf(rate), "API protection must run first");
assert.equal(audit.conditionGroup.length, 1, "Do not OR together weaker exceptions");
assert.deepEqual(audit.conditionGroup[0].conditions.map(c => [c.type, c.op]).sort(),
  [["path", "re"], ["user_agent", "eq"], ["ip_address", "inc"], ["method", "inc"], ["host", "eq"]].sort());
const auditIps = audit.conditionGroup[0].conditions.find(c => c.type === "ip_address").value;
assert.equal(new Set(auditIps).size, 29, "Keep the reviewed official IP snapshot bounded");
assert.ok(auditIps.every(ip => /^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip)), "Exact IPv4 addresses only, no wildcard/CIDR expansion");
// Approval snapshot from SE Ranking's official audit-crawler FAQ, verified 2026-10-17.
const approvedAuditIps = [
  "5.9.48.208", "23.88.36.149", "37.27.13.192", "37.27.22.37", "37.27.22.127", "37.27.29.8",
  "46.4.81.149", "62.238.32.219", "116.202.175.208", "136.243.103.47", "138.201.137.152",
  "142.132.195.214", "144.76.14.242", "144.76.15.151", "144.76.69.81", "144.76.164.62",
  "144.76.237.123", "162.55.94.175", "162.55.94.176", "162.55.244.19", "167.233.95.57",
  "167.233.145.180", "167.233.148.147", "167.233.156.129", "168.119.64.236", "176.9.41.54",
  "176.9.64.179", "176.9.74.49", "178.63.105.151",
];
assert.deepEqual([...auditIps].sort(), [...approvedAuditIps].sort(), "Only the reviewed official IPs may bypass");
assert.deepEqual([...audit.conditionGroup[0].conditions.find(c => c.type === "method").value].sort(), ["GET", "HEAD"], "Only reviewed read methods may bypass");
const trustedAudit = { ip_address: "178.63.105.151", user_agent: "SEBot-WA", host: "www.mypassmate.com" };
for (const path of ["/", "/cbt", "/cbt/", "/cbt/전기기능사/", "/robots.txt", "/sitemap.xml", "/sitemap.txt", "/favicon.ico", "/_next/static/app.js", "/terms", "/terms/", "/privacy", "/privacy/", "/cbtmate-logo.png"]) {
  assert.ok(matches(audit, path, "GET", trustedAudit), `Allow verified public audit: ${path}`);
}
for (const path of ["/admin/", "/api/cbt/", "/api/admin/", "/account/", "/library/", "/store/", "/analytics-settings/", "/checkout/", "/.env", "/.git/config", "/wp-admin/", "/cbt/../admin/", "/cbt/%2e%2e/admin/", "/cbt-other/", "/robots.txt/extra", "/terms/admin/", "/privacy/admin/", "/cbtmate-logo.png/extra"]) {
  assert.ok(!matches(audit, path, "GET", trustedAudit), `Do not bypass protected/nonpublic route: ${path}`);
}
assert.ok(matches(audit, "/", "HEAD", trustedAudit));
for (const method of ["POST", "DELETE", "OPTIONS"]) assert.ok(!matches(audit, "/", method, trustedAudit));
for (const request of [
  { ...trustedAudit, ip_address: "192.0.2.1" },
  { ...trustedAudit, user_agent: "Googlebot" },
  { ...trustedAudit, user_agent: "SEBot-WA spoof" },
  { ...trustedAudit, host: "mypassmate.com" },
]) assert.ok(!matches(audit, "/", "GET", request), "Every identity and host condition is required");
console.log("Security policy PASS: exploit/API protections preserved; verified SE audit limited by IP, UA, host, method and public path");
