"use client";
import Link from "next/link";
import { useState } from "react";
import { addToCart } from "@/lib/cart";
export function ProductPurchaseOptions({ slug, title, corePrice }: { slug: string; title: string; corePrice: number }) {
  const [kind, setKind] = useState<"core" | "pass">("core"); const isPass = kind === "pass"; const price = isPass ? corePrice + 6000 : corePrice;
  function add() { addToCart({ slug: isPass ? `${slug}-pass-pack` : slug, title, packageType: kind, price, quantity: 1 }); }
  return <><div className="package-tabs" role="tablist" aria-label="상품 구성 선택"><button className={!isPass ? "package-tab package-tab--active" : "package-tab"} onClick={() => setKind("core")} role="tab" aria-selected={!isPass}>핵심요약 <small>{corePrice.toLocaleString("ko-KR")}원</small></button><button className={isPass ? "package-tab package-tab--active" : "package-tab"} onClick={() => setKind("pass")} role="tab" aria-selected={isPass}>합격팩 <small>{price.toLocaleString("ko-KR")}원</small></button></div><div className="package-compare" aria-label="상품 구성 비교"><div><b>구성품</b><span>핵심요약</span><span>핵심요약 + 벼락치기 + 치트시트 + 체크리스트</span></div><div><b>추천 대상</b><span>빠른 회독</span><span>필기·실기 전체 대비</span></div></div><div className="package-actions"><button type="button" className="button button-primary" onClick={add}>장바구니 담기</button><Link className="button button-ghost" href={`/checkout/?product=${isPass ? `${slug}-pass-pack` : slug}`}>바로 구매</Link></div></>;
}
