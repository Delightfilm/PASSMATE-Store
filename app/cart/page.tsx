import type { Metadata } from "next";

export const metadata: Metadata = { title: "장바구니 | PASSMATE", description: "선택한 요약노트를 확인하고 구매를 준비하세요." };

import { CartClient } from "@/components/cart-client";

export default function CartPage() {
  return <section className="section page-section"><div className="container"><h1 className="page-title">장바구니</h1><CartClient /></div></section>;
}
