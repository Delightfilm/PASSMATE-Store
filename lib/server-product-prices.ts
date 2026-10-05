import "server-only";
import { getPublicSupabaseConfig } from "./public-supabase-config";
import type { LiveProductPriceMap } from "./live-product-prices";

// Public active prices only; checkout continues to pin the DB price itself.
export async function getServerProductPrices(slugs: string[]): Promise<LiveProductPriceMap> {
  const unique = [...new Set(slugs.filter(Boolean))];
  if (!unique.length) return {};
  const { url, key } = getPublicSupabaseConfig();
  const endpoint = new URL("/rest/v1/products", url);
  endpoint.searchParams.set("select", "slug,price_krw");
  endpoint.searchParams.set("slug", `in.(${unique.join(",")})`);
  endpoint.searchParams.set("is_active", "eq.true");
  try {
    const response = await fetch(endpoint, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store", signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return {};
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) return {};
    return Object.fromEntries(rows.filter(row => typeof row.slug === "string" && Number.isInteger(row.price_krw) && row.price_krw >= 0).map(row => [row.slug, row.price_krw]));
  } catch { return {}; }
}
