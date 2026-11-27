import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { Script } from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const root = path.resolve(import.meta.dirname, "..");
// Match next.config.ts when rendering Next links outside the Next runtime.
process.env.__NEXT_TRAILING_SLASH = "true";
assert.ok(fs.existsSync(path.join(root, "components/cbt-public-content.tsx")), "public content must exist before client hydration");
const cache = new Map();
function load(file) {
  if (file.endsWith(".css")) return {};
  for (const suffix of ["", ".ts", ".tsx", ".mjs", ".json"]) if (fs.existsSync(file + suffix) && fs.statSync(file + suffix).isFile()) { file += suffix; break; }
  if (file.endsWith(".json") || file.endsWith(".mjs")) return createRequire(import.meta.url)(file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const js = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const require = name => name.startsWith("@/") ? load(path.join(root, name.slice(2))) : name.startsWith(".") ? load(path.resolve(path.dirname(file), name)) : createRequire(file)(name);
  new Script(`(function(require,module,exports){${js}\n})`, { filename: file }).runInThisContext()(require, module, module.exports);
  return module.exports;
}
const route = load(path.join(root, "app/cbt/[certSlug]/page.tsx"));
for (const [slug, years] of [["전기기능사", "2002–2016"], ["지게차운전기능사", "2004–2011"], ...["무대음향", "무대기계", "무대조명"].flatMap(field => [1,2,3].map(grade => [`${field}-${grade}급`, "2008–2026"]))]) {
  const params = Promise.resolve({ certSlug: encodeURIComponent(slug) });
  const html = renderToStaticMarkup(await route.default({ params }));
  assert.ok(html.includes(`<h1>${slug.replace(/-([123]급)$/, " $1")}</h1>`), `qualification heading should only name the subject: ${slug}`);
  assert.ok(html.includes(years), `${slug} must disclose actual archived years without client loading`);
  assert.ok(html.includes('href="/cbt/"'), "public hub must be a real link");
  assert.ok(!html.includes('/exam/'), "personal attempts must not become public SEO links");
  assert.match(html, /<details class="cbt-study-details">/, "long guidance must remain in a user-openable section");
  assert.ok(!/<details[^>]*\sopen(?:=|\s|>)/.test(html), "long guidance must be collapsed initially");
  const meta = await route.generateMetadata({ params });
  assert.ok(meta.alternates.canonical.includes(encodeURIComponent(slug)));
  const study = html.slice(html.indexOf('class="cbt-public-guide'));
  assert.ok(study.includes(`/cbt/${encodeURIComponent(slug)}/#mock`), `${slug}: guidance must lead directly to its own mock exam`);
  assert.equal(study.includes(`/cbt/${encodeURIComponent(slug)}/#subjects`), slug !== "지게차운전기능사", "subject links must reflect the available archive structure");
  assert.ok(!study.includes("/?tab="), "in-page tabs stay in the fragment: a query would publish a second URL whose canonical is this page");
  if (slug.startsWith("무대")) {
    for (const target of ["무대음향-2급", "무대기계-2급", "무대조명-2급"]) {
      if (slug.endsWith("2급") && target !== slug) assert.ok(study.includes(`/cbt/${encodeURIComponent(target)}/`), "stage learners must be able to reach the other fields at the same grade");
    }
    assert.ok(study.includes('href="https://www.ntok.go.kr/staff/"'), "stage guidance must link to the official qualification authority");
  } else {
    assert.ok(study.includes('href="https://www.q-net.or.kr/cst006.do?'), "technical qualification guidance must link to official examination standards");
  }
}
const hub = renderToStaticMarkup(load(path.join(root, "app/cbt/page.tsx")).default());
const topics = renderToStaticMarkup(load(path.join(root, "components/cbt-public-content.tsx")).PriorityQualificationLinks());
for (const field of ["무대음향", "무대기계", "무대조명"]) {
  for (const grade of [1,2,3]) assert.ok(topics.includes(`aria-label="${field} ${grade}급 문제풀이"`), "short grade links must identify the field for assistive technology");
}
const { AppRouterContext } = createRequire(import.meta.url)("next/dist/shared/lib/app-router-context.shared-runtime");
const home = renderToStaticMarkup(React.createElement(AppRouterContext.Provider, { value: {} }, load(path.join(root, "app/page.tsx")).default()));
for (const slug of ["전기기능사", "지게차운전기능사", ...["무대음향", "무대기계", "무대조명"].flatMap(field => [1,2,3].map(grade => `${field}-${grade}급`))]) {
  assert.ok(hub.includes(`/cbt/${encodeURIComponent(slug)}/`), `cold hub link missing: ${slug}`);
  assert.ok(home.includes(`/cbt/${encodeURIComponent(slug)}/`), `cold home link missing: ${slug}`);
}
assert.match(hub, /문제은행/); assert.match(hub, /CBT/);
for (const slug of ["missing-qualification", "%E0%A4%A"]) {
  const meta = await route.generateMetadata({ params: Promise.resolve({ certSlug: slug }) });
  assert.equal(meta.robots.index, false);
  await assert.rejects(route.default({ params: Promise.resolve({ certSlug: slug }) }),
    error => error.digest === "NEXT_HTTP_ERROR_FALLBACK;404",
    "nonexistent or malformed qualifications must return a real 404, not a successful client shell");
}
// Actual Search Console examples: valid archives must survive a cold render without the NAS.
for (const slug of ["종자산업기사", "전기산업기사", "기상기사"]) {
  const html = renderToStaticMarkup(await route.default({ params: Promise.resolve({ certSlug: slug }) }));
  assert.ok(html.includes(`<h1>${slug}</h1>`));
  assert.match(html, /회차.*문항/);
  assert.ok(!html.includes("종목을 찾을 수 없습니다"));
}
for (const alias of ["jo"]) {
  const params = Promise.resolve({ certSlug: alias });
  await assert.rejects(route.default({ params }),
    error => error.digest?.startsWith("NEXT_REDIRECT;") && error.digest.includes(`/cbt/${encodeURIComponent("전기기능사")}/;308;`),
    "known source identifiers must keep working through a permanent canonical redirect");
}
// Crawled Korean slugs arrive decomposed (macOS copy) or in compatibility forms. Those URLs name
// the same qualification, so they must reach the canonical page instead of answering 404.
for (const slug of ["전기기능사", "무대음향-3급"]) {
  for (const variant of [slug.normalize("NFD"), slug.replace(/-/g, " ")].filter(value => value !== slug)) {
    const params = Promise.resolve({ certSlug: encodeURIComponent(variant) });
    await assert.rejects(route.default({ params }),
      error => error.digest?.startsWith("NEXT_REDIRECT;") && error.digest.includes(`/cbt/${encodeURIComponent(slug)}/;308;`),
      `equivalent slug form must redirect to the canonical page: ${JSON.stringify(variant)}`);
  }
}
const notFound = renderToStaticMarkup(load(path.join(root, "app/not-found.tsx")).default());
assert.match(notFound, /페이지를 찾을 수 없습니다/, "404 page must explain the state in Korean");
assert.ok(notFound.includes('href="/cbt/"'), "404 page must lead back to the public hub");
const notFoundMeta = load(path.join(root, "app/not-found.tsx")).metadata;
assert.match(notFoundMeta.title, /페이지를 찾을 수 없습니다/);
assert.equal(notFoundMeta.robots.index, false, "a 404 page must not be offered for indexing");
console.log("Public SEO cold-render tests passed: 11 qualifications, verified coverage, canonical links, fragment-only in-page tabs, equivalent-slug redirects, hub navigation, private/invalid URL boundaries");
