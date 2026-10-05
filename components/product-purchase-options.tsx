"use client";

import Link from "next/link";
import { useState } from "react";
import {
  addToCart,
  getPackageSlug,
  PACKAGE_LABELS,
  PackageType,
} from "@/lib/cart";
import type { LiveProductPriceMap } from "@/lib/live-product-prices";
import { useProductPrices } from "@/lib/use-product-prices";
import { ProductPrice } from "./product-price";
import { getProductFamilyTitle } from "@/lib/product-display";

const packageRows = [
  ["핵심개념 요약노트", true, true],
  ["공식·수치 한눈표", true, true],
  ["시험 직전 체크리스트", true, true],
  ["상세 개념해설서", false, true],
  ["단원별 확인문제·해설", false, true],
] as const;

function priceText(price: number | undefined, loading: boolean) {
  if (price === undefined) return loading ? <span className="price-skeleton" role="status" aria-label="가격 조회 중" /> : "—";
  return price.toLocaleString("ko-KR") + "원";
}

export function ProductPurchaseOptions({
  slug,
  title,
  initialPrices = {},
}: {
  slug: string;
  title: string;
  initialPrices?: LiveProductPriceMap;
}) {
  const [kind, setKind] = useState<PackageType>("core");
  const [notice, setNotice] = useState("");
  const familyTitle = getProductFamilyTitle(title);
  const coreSlug = getPackageSlug(slug, "core");
  const passSlug = getPackageSlug(slug, "pass");
  const { prices, loading: priceLoading, failed, retry } = useProductPrices([coreSlug, passSlug], initialPrices);
  const selectedSlug = getPackageSlug(slug, kind);
  const selectedPrice = prices[selectedSlug];

  function add() {
    if (selectedPrice === undefined || priceLoading) {
      setNotice("현재 판매 가능한 가격을 확인한 뒤 다시 시도해주세요.");
      return;
    }

    try {
      const result = addToCart({
        familySlug: slug,
        title: familyTitle,
        packageType: kind,
      });

      setNotice(
        result === "replaced"
          ? PACKAGE_LABELS[kind] + "으로 장바구니 구성을 변경했습니다."
          : result === "unchanged"
            ? "이미 같은 상품이 장바구니에 있습니다."
            : PACKAGE_LABELS[kind] + "을 장바구니에 담았습니다."
      );
    } catch {
      setNotice("장바구니를 저장하지 못했어요. 브라우저 저장소 설정과 여유 공간을 확인한 뒤 다시 시도해주세요.");
    }
  }

  return (
    <>
      <div className="package-tabs" role="group" aria-label="상품 구성 선택">
        <button
          type="button"
          className={kind === "core" ? "package-tab package-tab--active" : "package-tab"}
          onClick={() => { setKind("core"); setNotice(""); }}
          aria-pressed={kind === "core"}
        >
          핵심노트
          <small>{priceText(prices[coreSlug], priceLoading)}</small>
        </button>
        <button
          type="button"
          className={kind === "pass" ? "package-tab package-tab--active" : "package-tab"}
          onClick={() => { setKind("pass"); setNotice(""); }}
          aria-pressed={kind === "pass"}
        >
          시험대비 완성패키지
          <small>{priceText(prices[passSlug], priceLoading)}</small>
        </button>
      </div>

      <div className={`package-compare package-compare--${kind}`} aria-label="상품 구성 비교">
        <div className="package-compare-row package-compare-head">
          <b>구성품</b><b>핵심노트</b><b>완성패키지</b>
        </div>
        {packageRows.map(([label, core, pass]) => (
          <div className="package-compare-row" key={label}>
            <span>{label}</span>
            <span aria-label={core ? "포함" : "미포함"}>{core ? "✓" : "—"}</span>
            <span aria-label={pass ? "포함" : "미포함"}>{pass ? "✓" : "—"}</span>
          </div>
        ))}
      </div>

      <div className="mobile-package-checklists" aria-label="패키지별 구성">
        {(["core", "pass"] as const).map((pack) => <article className={`mobile-package-card${kind === pack ? " is-selected" : ""}`} key={pack}>
          <h3><button type="button" aria-pressed={kind === pack} onClick={() => { setKind(pack); setNotice(""); }}>{PACKAGE_LABELS[pack]}<span aria-hidden="true">{kind === pack ? "✓" : "+"}</span></button></h3>
          <ul>{packageRows.filter((row) => row[pack === "core" ? 1 : 2]).map(([label]) => <li key={label}><span aria-hidden="true">✓</span> {label}</li>)}</ul>
        </article>)}
      </div>
      {failed && <div className="package-price-error"><ProductPrice failed retry={retry} /></div>}


      <div className="package-actions">
        <button
          type="button"
          className="button button-primary"
          onClick={add}
          disabled={selectedPrice === undefined || priceLoading}
        >
          장바구니 담기
        </button>
        {selectedPrice === undefined || priceLoading ? (
          <button type="button" className="button button-ghost" disabled>
            구매하기
          </button>
        ) : (
          <Link
            className="button button-ghost"
            href={"/checkout/?product=" + encodeURIComponent(selectedSlug)}
          >
            {selectedPrice.toLocaleString("ko-KR")}원 바로 구매
          </Link>
        )}
      </div>

      {notice ? <p className="package-cart-notice" role="status">{notice}</p> : null}
      <div className="mobile-purchase-bar" aria-label="선택한 패키지 구매">
        {notice && <p className="mobile-cart-notice" role="status">{notice}</p>}
        <div className="mobile-purchase-summary"><span>{PACKAGE_LABELS[kind]}</span><strong><ProductPrice price={selectedPrice} failed={failed} retry={retry} /></strong></div>
        <div className="mobile-purchase-actions">
          <button type="button" className="button button-ghost" disabled={selectedPrice === undefined || priceLoading} onClick={add}>장바구니</button>
          {selectedPrice === undefined || priceLoading ? <button className="button button-primary" type="button" disabled>구매하기</button> : <Link className="button button-primary" href={"/checkout/?product=" + encodeURIComponent(selectedSlug)}>구매하기</Link>}
        </div>
      </div>
    </>
  );
}
