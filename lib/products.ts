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
const allowLocalCatalogFallback =
  process.env.PASSMATE_ALLOW_LOCAL_CATALOG_FALLBACK === "true";

function catalogFailure(reason: string): Product[] {
  if (allowLocalCatalogFallback) {
    console.warn(
      `[PASSMATE] ${reason}; explicit local catalog fallback enabled`
    );
    return localProducts;
  }

  console.error(
    `[PASSMATE] ${reason}; production catalog fails closed`
  );
  return [];
}

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

export async function getProducts(): Promise<Product[]> {
  const { url, key } = getPublicSupabaseConfig();

  const endpoint = new URL("/rest/v1/products", url);
  endpoint.searchParams.set(
    "select",
    "code,slug,title,subtitle,description,display_year,badge,features,price_krw"
  );
  endpoint.searchParams.set("is_active", "eq.true");
  endpoint.searchParams.set("order", "created_at.asc");

  let response: Response;
  try {
    response = await fetch(endpoint, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });
  } catch (error) {
    console.error("[PASSMATE] Supabase catalog network error", error);
    return catalogFailure("Supabase catalog network request failed");
  }

  if (!response.ok) {
    return catalogFailure(
      `Supabase catalog request failed (${response.status})`
    );
  }

  let rows: ProductRow[];
  try {
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) {
      return catalogFailure("Supabase catalog returned an invalid payload");
    }
    rows = payload as ProductRow[];
  } catch (error) {
    console.error("[PASSMATE] Supabase catalog JSON parse failed", error);
    return catalogFailure("Supabase catalog returned invalid JSON");
  }

  if (rows.length === 0) {
    // Zero active DB products is an intentional kill switch, not an error.
    // Never resurrect local products unless the explicit fallback flag is on.
    if (allowLocalCatalogFallback) {
      console.warn(
        "[PASSMATE] Supabase catalog has zero active products; explicit local fallback enabled"
      );
      return localProducts;
    }

    console.info("[PASSMATE] catalog source=supabase products=0 fail-closed");
    return [];
  }

  console.info(`[PASSMATE] catalog source=supabase products=${rows.length}`);
  return rows.map(mapRow);
}

export async function getStaticProductSlugs() {
  const products = await getProducts();
  return products.map(({ slug }) => ({ slug }));
}

export async function getProduct(slug: string) {
  const products = await getProducts();
  return products.find((product) => product.slug === slug);
}
