"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Product } from "@/lib/products";
import { fetchLiveProductPrices } from "@/lib/live-product-prices";
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
          label="핵심요약 NOTE"
          subtitle={
            isStageSoundCore
              ? "핵심 개념 · 공식 · 숫자 · 체크리스트"
              : "CORE + SHEET + CHECK"
          }
          series={isStageSoundCore ? "STAGE SOUND" : "CORE 01"}
        />
      </div>
      <div className="product-card-body">
        <span className="eyebrow">{product.badge}</span>
        <h3>{product.year} {product.title}</h3>
        <p>{product.subtitle}</p>
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
