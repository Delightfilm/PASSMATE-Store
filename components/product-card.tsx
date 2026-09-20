"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Product } from "@/lib/products";
import { fetchLiveProductPrices } from "@/lib/live-product-prices";
import { getCoreProductTitle, getCustomerCopy } from "@/lib/product-display";
import { ProductCover } from "./product-cover";

export function ProductCard({ product }: { product: Product }) {
  const isStageSoundCore = product.code === "PM-SS3-CORE";
  const [price, setPrice] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function refreshPrice() {
      setPriceLoading(true);
      try {
        const prices = await fetchLiveProductPrices([product.slug]);
        if (active) setPrice(prices[product.slug] ?? null);
      } catch (error) {
        console.error("[PASSMATE] product card price lookup failed", error);
        if (active) setPrice(null);
      } finally {
        if (active) setPriceLoading(false);
      }
    }

    void refreshPrice();
    window.addEventListener("focus", refreshPrice);

    return () => {
      active = false;
      window.removeEventListener("focus", refreshPrice);
    };
  }, [product.slug]);

  return (
    <article className="product-card">
      <div className="product-visual">
        <ProductCover
          small
          theme={isStageSoundCore ? "light" : "dark"}
          year={product.year}
          titleLines={
            isStageSoundCore
              ? ["무대음향", "3급"]
              : ["컴퓨터활용능력", "2급"]
          }
          label="핵심노트"
          subtitle="핵심개념 · 공식·수치 · 시험 직전 체크"
          series={isStageSoundCore ? "STAGE SOUND" : "PASSMATE"}
        />
      </div>
      <div className="product-card-body">
        <span className="eyebrow">{product.badge}</span>
        <h3>{product.year} {getCoreProductTitle(product.title)}</h3>
        <p>{getCustomerCopy(product.subtitle)}</p>
        <div className="product-card-footer">
          <strong>
            {priceLoading
              ? "가격 확인 중"
              : price === null
                ? "판매 준비 중"
                : price.toLocaleString("ko-KR") + "원부터"}
          </strong>
          <Link href={"/products/" + product.slug}>자세히 보기 →</Link>
        </div>
      </div>
    </article>
  );
}
