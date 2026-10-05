import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const compile = (path, dependencies, transform = (_, source) => source) => {
  const code = ts.transpileModule(transform(path, fs.readFileSync(new URL(path, import.meta.url), "utf8")), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(name => {
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    if (name === "react/jsx-runtime") return require(name);
    throw new Error("Unexpected price-contract dependency: " + name);
  }, module, module.exports);
  return module.exports;
};

export async function validateStorePriceBinding(transform) {
  const load = (path, dependencies) => compile(path, dependencies, transform);
  const slugs = ["computer-literacy-2", "computer-literacy-2-pass-pack"];
  // Deliberately differ from catalog defaults: copying 5900/9900 must fail.
  const prices = { [slugs[0]]: 6111, [slugs[1]]: 9777 };
  const states = [];
  let requested;
  let response = prices;
  const hook = load("../lib/use-product-prices.ts", {
    react: {
      useState: initial => { const i = states.length; states.push(initial); return [initial, value => { states[i] = value; }]; },
      useRef: value => ({ current: value }), useCallback: fn => fn, useEffect: () => {},
    },
    "./live-product-prices": { fetchLiveProductPrices: async values => { requested = values; return response; } },
  }).useProductPrices(slugs, {});
  await hook.retry();
  assert.deepEqual(requested, slugs, "Hook must fetch the requested SKUs");
  assert.deepEqual(states, [prices, false, false]);
  response = { [slugs[0]]: 6111 };
  await hook.retry();
  assert.deepEqual(states, [{}, false, true], "Missing SKU must invalidate prices, not retain stale purchasing");

  const cart = load("../lib/cart.ts", {});
  const display = load("../lib/product-display.ts", {});
  const price = load("../components/product-price.tsx", {});
  for (const kind of ["core", "pass"]) {
    for (const loading of [false, true]) {
      const Options = load("../components/product-purchase-options.tsx", {
        react: { useState: initial => [initial === "core" ? kind : initial, () => {}] },
        "next/link": { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) },
        "@/lib/cart": cart, "@/lib/product-display": display, "./product-price": price,
        "@/lib/use-product-prices": { useProductPrices: (values, initial) => {
          assert.deepEqual(values, slugs); assert.deepEqual(initial, prices);
          return { prices, loading, failed: false, retry: () => {} };
        } },
      }).ProductPurchaseOptions;
      const html = renderToStaticMarkup(React.createElement(Options, { slug: slugs[0], title: "2027 컴퓨터활용능력 2급 핵심노트", initialPrices: prices }));
      const bar = html.slice(html.indexOf('class="mobile-purchase-bar"'));
      const selected = kind === "core" ? slugs[0] : slugs[1];
      assert(bar.includes(prices[selected].toLocaleString("ko-KR") + "원"), "Selected SKU must supply displayed price");
      if (loading) {
        assert(!bar.includes("/checkout/"), "Price refresh must disable checkout");
        assert.match(bar, /disabled=""[^>]*>구매하기/);
      } else assert(bar.includes("/checkout/?product=" + selected), "Checkout must use the selected SKU");
    }
  }
}
