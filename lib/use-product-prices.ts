"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchLiveProductPrices, type LiveProductPriceMap } from "./live-product-prices";

export function useProductPrices(slugs: string[], initial: LiveProductPriceMap = {}) {
  const key = slugs.join("|");
  const [prices, setPrices] = useState(initial);
  const [loading, setLoading] = useState(slugs.some(slug => initial[slug] === undefined));
  const [failed, setFailed] = useState(false);
  const generation = useRef(0);
  const retry = useCallback(async () => {
    const run = ++generation.current;
    setLoading(true); setFailed(false);
    try {
      const requested = key.split("|").filter(Boolean);
      const next = await fetchLiveProductPrices(requested);
      if (requested.some(slug => next[slug] === undefined)) throw new Error("missing_active_price");
      if (run === generation.current) setPrices(next);
    } catch {
      if (run === generation.current) { setPrices({}); setFailed(true); }
    } finally { if (run === generation.current) setLoading(false); }
  }, [key]);
  useEffect(() => {
    void retry(); window.addEventListener("focus", retry);
    return () => { generation.current++; window.removeEventListener("focus", retry); };
  }, [retry]);
  return { prices, loading, failed, retry };
}
