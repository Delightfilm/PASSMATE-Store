"use client";

import Link from "next/link";
import type { Product } from "@/lib/products";
import { useProductPrices } from "@/lib/use-product-prices";
import { ProductPrice } from "./product-price";
import { getCoreProductTitle, getCustomerCopy } from "@/lib/product-display";
import { ProductCover } from "./product-cover";

export function ProductCard({ product, initialPrice }: { product: Product; initialPrice?: number }) {
  const isStageSoundCore = product.code === "PM-SS3-CORE";
  const { prices, failed, retry } = useProductPrices([product.slug], initialPrice === undefined ? {} : { [product.slug]: initialPrice });

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
        <h3>{product.year} {getCoreProductTitle(product.title)}</h3>
        <p>{getCustomerCopy(product.subtitle)}</p>
        <div className="product-card-footer">
          <strong>
            <ProductPrice price={prices[product.slug]} failed={failed} retry={retry} suffix="원부터" />
          </strong>
          <Link className="product-card-link" href={"/products/" + product.slug} aria-label={`${getCoreProductTitle(product.title)} 자세히 보기`}>자세히 보기 →</Link>
        </div>
      </div>
    </article>
  );
}
