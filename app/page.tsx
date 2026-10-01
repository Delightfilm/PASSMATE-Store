import type { Metadata } from "next";
import { HomeProducts } from "@/components/home-products";
import { getProducts } from "@/lib/products";

export const metadata: Metadata = { title: "컴퓨터활용능력 2급 요약노트 | PASSMATE", description: "2027 컴퓨터활용능력 2급 핵심노트와 시험대비 완성패키지의 구성과 가격을 비교하세요." };

export default async function Home() {
  const products = await getProducts();
  const featured = products.find((product) => product.code === "PM-C2") ?? null;

  return <>
    <HomeProducts product={featured} />
    <section className="home-method section section-soft" aria-labelledby="home-method-title">
      <div className="container">
        <div className="section-heading"><span className="eyebrow">학습 순서</span><h2 id="home-method-title">핵심을 이해하고, 외우고, 점검하세요.</h2></div>
        <div className="home-method-grid">
          <article><strong>01 이해</strong><p>핵심개념 요약노트로 필요한 내용을 빠르게 다시 봅니다.</p></article>
          <article><strong>02 암기</strong><p>공식·수치 한눈표로 헷갈리는 기준을 확인합니다.</p></article>
          <article><strong>03 점검</strong><p>시험 직전 체크리스트로 놓친 항목을 살핍니다.</p></article>
        </div>
      </div>
    </section>
  </>;
}
