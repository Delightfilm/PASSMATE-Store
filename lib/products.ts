import catalog from "@/data/catalog.json";
import { getPublicSupabaseConfig } from "@/lib/public-supabase-config";

export type Product = {
  slug: string;
  code: string;
  year: number;
  title: string;
  subtitle: string;
  price: number;
  badge: string;
  description: string;
  features: string[];
};

type ProductRow = {
  slug: string;
  code: string;
  display_year: number | null;
  title: string;
  subtitle: string | null;
  price_krw: number;
  badge: string | null;
  description: string | null;
  features: unknown;
};

const localProducts = catalog as Product[];

function mapRow(row: ProductRow): Product {
  return {
    slug: row.slug,
    code: row.code,
    year: row.display_year ?? 0,
    title: row.title,
    subtitle: row.subtitle ?? "",
    price: row.price_krw,
    badge: row.badge ?? "",
    description: row.description ?? "",
    features: Array.isArray(row.features)
      ? row.features.filter((item): item is string => typeof item === "string")
      : [],
  };
}

export function getStaticProductSlugs() {
  return localProducts.map(({ slug }) => ({ slug }));
}

export async function getProducts(): Promise<Product[]> {
  const { url, key } = getPublicSupabaseConfig();

  const endpoint = new URL("/rest/v1/products", url);
  endpoint.searchParams.set(
    "select",
    "code,slug,title,subtitle,description,display_year,badge,features,price_krw"
  );
  endpoint.searchParams.set("is_active", "eq.true");
  endpoint.searchParams.set("order", "created_at.asc");

  const response = await fetch(endpoint, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });

  if (!response.ok) {
    console.warn(
      `[PASSMATE] Supabase catalog request failed (${response.status}); using local fallback`
    );
    return localProducts;
  }

  const rows = (await response.json()) as ProductRow[];
  if (rows.length === 0) {
    console.warn("[PASSMATE] Supabase catalog returned no active products; using local fallback");
    return localProducts;
  }

  console.info(`[PASSMATE] catalog source=supabase products=${rows.length}`);
  return rows.map(mapRow);
}

export async function getProduct(slug: string) {
  const products = await getProducts();
  return products.find((product) => product.slug === slug);
}
