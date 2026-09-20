"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  addToCart,
  getPackageSlug,
  PACKAGE_LABELS,
  PackageType,
} from "@/lib/cart";
import {
  fetchLiveProductPrices,
  LiveProductPriceMap,
} from "@/lib/live-product-prices";
import { getProductFamilyTitle } from "@/lib/product-display";

const packageRows = [
  ["핵심개념 요약노트", true, true],
  ["공식·수치 한눈표", true, true],
  ["시험 직전 체크리스트", true, true],
  ["상세 개념해설서", false, true],
  ["단원별 확인문제·해설", false, true],
] as const;

function priceText(price: number | undefined, loading: boolean) {
  if (loading) return "가격 확인 중";
  if (price === undefined) return "판매 준비 중";
  return price.toLocaleString("ko-KR") + "원";
}

export function ProductPurchaseOptions({
  slug,
  title,
}: {
  slug: string;
  title: string;
}) {
  const [kind, setKind] = useState<PackageType>("core");
  const [notice, setNotice] = useState("");
  const [prices, setPrices] = useState<LiveProductPriceMap>({});
  const [priceLoading, setPriceLoading] = useState(true);
  const familyTitle = getProductFamilyTitle(title);
  const coreSlug = getPackageSlug(slug, "core");
  const passSlug = getPackageSlug(slug, "pass");
  const selectedSlug = getPackageSlug(slug, kind);
  const selectedPrice = prices[selectedSlug];

  useEffect(() => {
    let active = true;

    async function refreshPrices() {
      setPriceLoading(true);
      try {
        const next = await fetchLiveProductPrices([coreSlug, passSlug]);
        if (active) setPrices(next);
      } catch (error) {
        console.error("[PASSMATE] live package price lookup failed", error);
        if (active) setPrices({});
      } finally {
        if (active) setPriceLoading(false);
      }
    }

    void refreshPrices();
    window.addEventListener("focus", refreshPrices);

    return () => {
      active = false;
      window.removeEventListener("focus", refreshPrices);
    };
  }, [coreSlug, passSlug]);

  function add() {
    if (selectedPrice === undefined) {
      setNotice("현재 판매 가능한 가격을 확인한 뒤 다시 시도해주세요.");
      return;
    }

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
  }

  return (
    <>
      <div className="package-tabs" role="tablist" aria-label="상품 구성 선택">
        <button
          type="button"
          className={kind === "core" ? "package-tab package-tab--active" : "package-tab"}
          onClick={() => { setKind("core"); setNotice(""); }}
          role="tab"
          aria-selected={kind === "core"}
        >
          핵심노트
          <small>{priceText(prices[coreSlug], priceLoading)}</small>
        </button>
        <button
          type="button"
          className={kind === "pass" ? "package-tab package-tab--active" : "package-tab"}
          onClick={() => { setKind("pass"); setNotice(""); }}
          role="tab"
          aria-selected={kind === "pass"}
        >
          시험대비 완성패키지
          <small>{priceText(prices[passSlug], priceLoading)}</small>
        </button>
      </div>

      <div className="package-compare" aria-label="상품 구성 비교">
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

      <p className="package-help">
        완성패키지는 핵심노트 3종에 상세 개념해설서와 단원별 확인문제·해설이 추가됩니다.
      </p>

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
            가격 확인 후 구매
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
    </>
  );
}
