"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Product } from "@/lib/products";
import { getPackageSlug } from "@/lib/cart";
import { fetchLiveProductPrices } from "@/lib/live-product-prices";
import { getProductFamilyTitle } from "@/lib/product-display";
import { ProductCover } from "./product-cover";

export function HomeProducts({ product }: { product: Product | null }) {
  const [prices, setPrices] = useState<Record<string, number>>(product ? { [product.slug]: product.price } : {});
  const [priceReady, setPriceReady] = useState(false);
  const coreSlug = product?.slug ?? "";
  const passSlug = product ? getPackageSlug(product.slug, "pass") : "";

  useEffect(() => {
    if (!product) return;
    let active = true;
    void fetchLiveProductPrices([coreSlug, passSlug]).then((next) => {
      if (active) setPrices(next);
    }).catch((error) => {
      console.error("[PASSMATE] home price lookup failed", error);
    }).finally(() => { if (active) setPriceReady(true); });
    return () => { active = false; };
  }, [product, coreSlug, passSlug]);

  if (!product) return <section className="home-empty section"><div className="container"><h1>판매 중인 상품을 확인하고 있습니다.</h1><p>잠시 후 다시 방문해 주세요.</p></div></section>;

  const family = getProductFamilyTitle(product.title);
  const coreTitle = `${product.year} ${family} 핵심노트`;
  const passTitle = `${product.year} ${family} 시험대비 완성패키지`;
  const href = `/products/${product.slug}`;
  const priceText = (slug: string) => prices[slug] === undefined ? priceReady ? "가격 확인 불가" : "가격 확인 중" : `${prices[slug].toLocaleString("ko-KR")}원`;

  return <>
    <section className="home-hero">
      <div className="container home-hero-grid">
        <div className="home-hero-copy">
          <span className="eyebrow">PASSMATE · {product.year} EDITION</span>
          <h1>시험에 필요한 핵심을 짧게 정리하세요.</h1>
          <p>컴퓨터활용능력 2급 핵심노트로 핵심개념, 공식·수치, 시험 직전 점검을 한 번에 살펴보세요.</p>
        </div>
        <article className="home-featured-product" aria-label="대표 상품">
          <div className="home-featured-cover"><ProductCover small year={product.year} titleLines={["컴퓨터활용능력", "2급"]} label="핵심노트" subtitle="핵심개념 · 공식·수치 · 시험 직전 체크" series="PASSMATE" /></div>
          <div className="home-featured-info">
            <span className="eyebrow">대표 상품</span>
            <h2>{coreTitle}</h2>
            <p>핵심개념 요약노트 · 공식·수치 한눈표 · 시험 직전 체크리스트</p>
            <strong>{priceText(coreSlug)}</strong>
            <Link className="button button-primary" href={href}>상품 상세 보기</Link>
          </div>
        </article>
      </div>
    </section>

    <section className="home-products section" aria-labelledby="home-products-title">
      <div className="container">
        <div className="section-heading"><span className="eyebrow">상품 비교</span><h2 id="home-products-title">내 학습에 맞는 구성을 고르세요.</h2></div>
        <div className="home-product-grid">
          <article className="home-product-option">
            <span className="home-option-type">빠른 회독</span>
            <h3>{coreTitle}</h3>
            <p>핵심개념 요약노트 · 공식·수치 한눈표 · 시험 직전 체크리스트</p>
            <div className="home-option-bottom"><strong>{priceText(coreSlug)}</strong><Link className="button button-secondary" href={href}>핵심노트 자세히 보기</Link></div>
          </article>
          <article className="home-product-option">
            <span className="home-option-type">개념부터 문제까지</span>
            <h3>{passTitle}</h3>
            <p>핵심노트 전체 + 상세 개념해설서 + 단원별 확인문제·해설</p>
            <div className="home-option-bottom"><strong>{priceText(passSlug)}</strong><Link className="button button-secondary" href={href}>완성패키지 구성 보기</Link></div>
          </article>
        </div>
      </div>
    </section>
  </>;
}
