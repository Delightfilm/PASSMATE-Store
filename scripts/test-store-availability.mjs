import fs from "node:fs";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const require = createRequire(import.meta.url);
const react = require("react");
const root = new URL("../", import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), "utf8");
assert.match(read("lib/store-availability.ts"), /export const STORE_ENABLED = (?:true|false);/);
function load(file, enabled, calls) {
  const exports = {}, product = { slug:"qa-core", code:"PM-C2", title:"QA", year:2027, description:"QA" };
  const component = ({children}) => React.createElement("div", null, children);
  const imports = {
    "react":react,"react/jsx-runtime":require("react/jsx-runtime"),
    "next/link":{default:({children,href,...props})=>React.createElement("a",{href,...props},children)},
    "next/script":{default:props=>React.createElement("script",props)},
    "next/navigation":{notFound:()=>{throw Error("unexpected_not_found");}},
    "@/lib/store-availability":{STORE_ENABLED:enabled},
    "@/components/store-unavailable":{StoreUnavailable:()=>React.createElement("h1",null,"스토어는 준비중이에요!")},
    "@/lib/products":{getProducts:async()=>{calls.catalog++;return[product];},getProduct:async()=>{calls.catalog++;return product;}},
    "@/lib/server-product-prices":{getServerProductPrices:async()=>{calls.prices++;return{};}},
    "@/lib/cart":{getPackageSlug:slug=>slug},
    "@/lib/product-display":{getCoreProductTitle:s=>s,getCustomerCopy:s=>s},
    "@/components/home-products":{HomeProducts:component},"@/components/product-card":{ProductCard:component},
    "@/components/product-gallery":{ProductGallery:component},"@/components/product-purchase-options":{ProductPurchaseOptions:component},
    "@/components/scroll-reveal":{ScrollReveal:component},"@/components/product-section-nav":{ProductSectionNav:component},
    "@/components/cart-client":{CartClient:component},"@/components/checkout-client":{CheckoutClient:component},
  };
  const code=ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  Function("require","exports",code)(name=>{assert.ok(name in imports,`Unmapped presentation dependency ${name}`);return imports[name];},exports);
  return exports;
}
const pages=["app/store/page.tsx","app/products/page.tsx","app/products/[slug]/page.tsx","app/cart/page.tsx","app/checkout/page.tsx"];
for(const enabled of[false,true])for(const file of pages){
  const calls={catalog:0,prices:0},page=load(file,enabled,calls);
  const html=renderToStaticMarkup(await page.default({params:Promise.resolve({slug:"qa-core"})}));
  if(!enabled){assert.match(html,/스토어는 준비중이에요!/);assert.deepEqual(calls,{catalog:0,prices:0});assert.doesNotMatch(html,/portone|장바구니/);}
  else{assert.doesNotMatch(html,/스토어는 준비중이에요!/);if(file.includes("products")||file.includes("store/"))assert.ok(calls.catalog>0&&calls.prices>0,"Reopening restores the existing catalog and price path");if(file.includes("checkout"))assert.match(html,/https:\/\/cdn.portone.io\/v2\/browser-sdk.js/);}
  if(page.generateMetadata){const before=calls.catalog;await page.generateMetadata({params:Promise.resolve({slug:"qa-core"})});assert.equal(calls.catalog-before,enabled?1:0);}
}
assert.match(read("components/site-header.tsx"),/STORE_ENABLED && <Link/);
assert.match(read("components/auth-nav.tsx"),/STORE_ENABLED && service === "passmate"/);
assert.match(read("components/learning-home.tsx"),/STORE_ENABLED && <Link/);
assert.doesNotMatch(read("app/checkout/complete/page.tsx")+read("app/library/page.tsx"),/STORE_ENABLED|StoreUnavailable/);
console.log("Store availability PASS: closed pages/read-free metadata, reversible catalog/prices/SDK, preserved library and payment completion");
