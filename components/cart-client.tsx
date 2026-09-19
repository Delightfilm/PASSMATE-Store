"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CartItem,
  PACKAGE_LABELS,
  readCart,
  writeCart,
} from "@/lib/cart";
import {
  fetchLiveProductPrices,
  LiveProductPriceMap,
} from "@/lib/live-product-prices";

export function CartClient() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [prices, setPrices] = useState<LiveProductPriceMap>({});
  const [priceLoading, setPriceLoading] = useState(true);

  async function refresh(nextItems = readCart()) {
    setItems(nextItems);

    if (nextItems.length === 0) {
      setPrices({});
      setPriceLoading(false);
      return;
    }

    setPriceLoading(true);
    try {
      setPrices(
        await fetchLiveProductPrices(nextItems.map((item) => item.slug))
      );
    } catch (error) {
      console.error("[PASSMATE] cart live price lookup failed", error);
      setPrices({});
    } finally {
      setPriceLoading(false);
    }
  }

  useEffect(() => {
    const handleRefresh = () => {
      void refresh();
    };

    void refresh();
    window.addEventListener("focus", handleRefresh);
    window.addEventListener("storage", handleRefresh);
    window.addEventListener("passmate-cart-change", handleRefresh);

    return () => {
      window.removeEventListener("focus", handleRefresh);
      window.removeEventListener("storage", handleRefresh);
      window.removeEventListener("passmate-cart-change", handleRefresh);
    };
  }, []);

  const checkoutReady =
    items.length > 0 &&
    !priceLoading &&
    items.every((item) => prices[item.slug] !== undefined);

  const total = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + (prices[item.slug] ?? 0),
        0
      ),
    [items, prices]
  );

  function update(next: CartItem[]) {
    writeCart(next);
    void refresh(next);
  }

  const checkoutHref = checkoutReady
    ? "/checkout/?products=" +
      encodeURIComponent(items.map((item) => item.slug).join(","))
    : "/products/";

  return (
    <div className="cart-layout">
      <div className="cart-list">
        {items.length ? (
          items.map((item) => (
            <article className="cart-item" key={item.familySlug}>
              <div>
                <b>{item.title}</b>
                <span>{PACKAGE_LABELS[item.packageType]}</span>
                <small>
                  {item.packageType === "pass"
                    ? "PASS PACK + CORE + SHEET + CHECK"
                    : "CORE + SHEET + CHECK"}
                </small>
              </div>
              <strong>
                {priceLoading
                  ? "가격 확인 중"
                  : prices[item.slug] === undefined
                    ? "판매 준비 중"
                    : prices[item.slug].toLocaleString("ko-KR") + "원"}
              </strong>
              <button
                type="button"
                onClick={() =>
                  update(
                    items.filter(
                      (entry) => entry.familySlug !== item.familySlug
                    )
                  )
                }
              >
                삭제
              </button>
            </article>
          ))
        ) : (
          <div className="cart-empty">
            <p className="page-lead">장바구니가 비어 있습니다.</p>
            <Link className="button button-primary" href="/products/">
              상품 보러가기
            </Link>
          </div>
        )}
      </div>

      <aside className="order-box">
        <span>선택 상품</span>
        <b>{items.length}개</b>
        <span>장바구니 합계</span>
        <strong>
          {priceLoading
            ? "가격 확인 중"
            : checkoutReady
              ? total.toLocaleString("ko-KR") + "원"
              : "확인 필요"}
        </strong>
        <p className="checkout-account-note">
          현재 판매가를 표시하며, 실제 결제 금액은 결제 직전 서버가 다시 확정합니다.
        </p>
        {checkoutReady ? (
          <Link className="button button-primary button-wide" href={checkoutHref}>
            결제하기
          </Link>
        ) : (
          <Link className="button button-primary button-wide" href="/products/">
            {items.length ? "상품 상태 확인" : "상품 선택하기"}
          </Link>
        )}
      </aside>
    </div>
  );
}
