import assert from "node:assert/strict";

const base = process.argv[2] || "http://127.0.0.1:3013";
const [xml, text] = await Promise.all(["sitemap.xml", "sitemap.txt"].map(async name => {
  const response = await fetch(`${base}/${name}`, { redirect: "manual" });
  assert.equal(response.status, 200, `${name} must respond directly with 200`);
  assert.match(response.headers.get("content-type") || "", name.endsWith("xml") ? /application\/xml/ : /text\/plain;\s*charset=utf-8/i);
  return response.text();
}));
assert.match(xml, /xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/);
assert.ok(text.endsWith("\n"), "text sitemap must terminate its final URL");
const xmlUrls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
const textUrls = text.trimEnd().split("\n");
assert.ok(xmlUrls.length > 0, "public URL list must not be empty");
assert.deepEqual(textUrls, xmlUrls, "both formats must contain the same canonical URLs in the same order");
assert.equal(new Set(textUrls).size, textUrls.length, "URLs must not be duplicated");
for (const value of textUrls) {
  const url = new URL(value);
  assert.equal(url.origin, "https://www.mypassmate.com");
  assert.equal(url.search, "");
  assert.equal(url.hash, "");
  assert.ok(url.pathname === "/" || url.pathname === "/terms/" || url.pathname.startsWith("/cbt/"));
  assert.ok(url.pathname.endsWith("/"), "page URLs must use their canonical trailing slash");
}
for (const slug of ["전기기능사", "지게차운전기능사", ...["무대음향", "무대기계", "무대조명"].flatMap(name => [1, 2, 3].map(grade => `${name}-${grade}급`))]) {
  assert.ok(textUrls.some(url => new URL(url).pathname === `/cbt/${encodeURIComponent(slug)}/`), `priority qualification missing: ${slug}`);
}
console.log(`PASS sitemap HTTP: ${textUrls.length} matching public URLs; direct 200; correct content types; no private routes`);
