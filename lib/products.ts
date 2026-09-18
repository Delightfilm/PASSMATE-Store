import catalog from "@/data/catalog.json";

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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // V1 can build before the Supabase project exists.
  // Once both public env values are configured, Supabase becomes the catalog source.
  if (!url || !key) {
    return localProducts;
  }

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
    throw new Error(`Failed to load PASSMATE catalog: ${response.status}`);
  }

  const rows = (await response.json()) as ProductRow[];
  return rows.map(mapRow);
}

export async function getProduct(slug: string) {
  const products = await getProducts();
  return products.find((product) => product.slug === slug);
}
