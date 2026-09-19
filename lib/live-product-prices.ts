import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export type LiveProductPriceMap = Record<string, number>;

export async function fetchLiveProductPrices(
  slugs: string[]
): Promise<LiveProductPriceMap> {
  const uniqueSlugs = [...new Set(slugs.filter(Boolean))];
  if (uniqueSlugs.length === 0) return {};

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("products")
    .select("slug,price_krw")
    .in("slug", uniqueSlugs)
    .eq("is_active", true);

  if (error) {
    throw new Error("live_product_price_read_failed");
  }

  const prices: LiveProductPriceMap = {};
  for (const row of data ?? []) {
    if (
      typeof row.slug === "string" &&
      typeof row.price_krw === "number" &&
      Number.isInteger(row.price_krw) &&
      row.price_krw >= 0
    ) {
      prices[row.slug] = row.price_krw;
    }
  }

  return prices;
}
