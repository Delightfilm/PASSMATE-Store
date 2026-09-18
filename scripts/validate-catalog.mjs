import fs from "node:fs";

const catalog = JSON.parse(fs.readFileSync(new URL("../data/catalog.json", import.meta.url), "utf8"));

if (!Array.isArray(catalog) || catalog.length === 0) {
  throw new Error("Catalog must contain at least one product.");
}

const codes = new Set();
const slugs = new Set();

for (const product of catalog) {
  const required = ["slug", "code", "year", "title", "subtitle", "price", "badge", "description", "features"];
  for (const key of required) {
    if (product[key] === undefined || product[key] === null || product[key] === "") {
      throw new Error(`Missing ${key} for ${product.code ?? product.slug ?? "unknown product"}`);
    }
  }

  if (!Number.isInteger(product.year) || product.year < 2026) {
    throw new Error(`Invalid year for ${product.code}`);
  }

  if (!Number.isInteger(product.price) || product.price < 0) {
    throw new Error(`Invalid price for ${product.code}`);
  }

  if (!Array.isArray(product.features) || product.features.length === 0) {
    throw new Error(`Product ${product.code} must have at least one feature.`);
  }

  if (codes.has(product.code)) throw new Error(`Duplicate code: ${product.code}`);
  if (slugs.has(product.slug)) throw new Error(`Duplicate slug: ${product.slug}`);

  codes.add(product.code);
  slugs.add(product.slug);
}

const productsSource = fs.readFileSync(
  new URL("../lib/products.ts", import.meta.url),
  "utf8"
);

for (const required of [
  "PASSMATE_ALLOW_LOCAL_CATALOG_FALLBACK",
  "production catalog fails closed",
  "catalog source=supabase products=0 fail-closed",
  "catch (error)",
]) {
  if (!productsSource.includes(required)) {
    throw new Error("Catalog fail-closed guard missing: " + required);
  }
}

if (
  !productsSource.includes("export async function getStaticProductSlugs()") ||
  !productsSource.includes("const products = await getProducts()")
) {
  throw new Error(
    "Static product routes must come from the authoritative catalog source."
  );
}

console.log(`PASSMATE catalog OK: ${catalog.length} product(s)`);
