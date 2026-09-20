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

const storefrontCopy = [
  "../app/page.tsx",
  "../app/products/[slug]/page.tsx",
  "../components/admin-product-preview.tsx",
  "../components/product-card.tsx",
  "../components/product-cover.tsx",
].map((path) => fs.readFileSync(new URL(path, import.meta.url), "utf8")).join("\n");

for (const unsupported of ["기출 기반", "기출 출제이력", "기출 함정", "CRAM", "벼락치기"]) {
  if (storefrontCopy.includes(unsupported)) {
    throw new Error(`Unsupported or retired storefront claim: ${unsupported}`);
  }
}

for (const required of ['"light"', '"dark"', "aria-pressed", "setCoverTheme"]) {
  if (!storefrontCopy.includes(required)) {
    throw new Error(`Stage Sound cover theme preview missing: ${required}`);
  }
}

const stageSoundQaMigration = fs.readFileSync(
  new URL("../supabase/migrations/20260920011743_qa_stage_sound_content.sql", import.meta.url),
  "utf8"
);

for (const required of ["PM-SS3-CORE", "PM-SS3-PASS", "DRAFT · QA 중", "is_active = false"]) {
  if (!stageSoundQaMigration.includes(required)) {
    throw new Error(`Stage Sound content QA migration missing: ${required}`);
  }
}

console.log(`PASSMATE catalog OK: ${catalog.length} product(s)`);
