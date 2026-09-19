"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CartItem,
  getPackagePrice,
  PACKAGE_LABELS,
  readCart,
  writeCart,
} from "@/lib/cart";

export function CartClient() {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    setItems(readCart());
  }, []);

  const total = items.reduce(
    (sum, item) => sum + getPackagePrice(item.packageType),
    0
  );

  function update(next: CartItem[]) {
    setItems(next);
    writeCart(next);
  }

  const checkoutHref = items.length
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
                {getPackagePrice(item.packageType).toLocaleString("ko-KR")}원
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
        <strong>{total.toLocaleString("ko-KR")}원</strong>
        <p className="checkout-account-note">
          실제 결제 금액은 결제 직전 서버에서 다시 확인합니다.
        </p>
        <Link className="button button-primary button-wide" href={checkoutHref}>
          {items.length ? "결제하기" : "상품 선택하기"}
        </Link>
      </aside>
    </div>
  );
}
