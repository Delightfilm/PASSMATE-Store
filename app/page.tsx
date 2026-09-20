import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { PassmateLogo } from "@/components/logo";
import { getProducts } from "@/lib/products";
import { getCoreProductTitle } from "@/lib/product-display";

export default async function Home() {
  const products = await getProducts();
  const firstProduct = products[0];

  return (
    <>
      <section className="hero section">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="pill">SMART NOTES · BETTER PASS</span>
            <PassmateLogo />
            <h1>시험에 필요한 것만.<br/><span>합격까지 함께.</span></h1>
            <p className="hero-lead">긴 교재를 다시 읽는 대신, 마지막 회독에 필요한 핵심만 정리합니다. PASSMATE는 자격증별 핵심개념 요약노트·공식과 수치 한눈표·시험 직전 체크리스트를 한 번에 제공합니다.</p>
            <div className="hero-actions">
              <Link
                className="button button-primary"
                href={firstProduct ? "/products/" + firstProduct.slug : "/products"}
              >
                {firstProduct ? getCoreProductTitle(firstProduct.title) + " 미리보기" : "요약노트 준비 현황 보기"}
              </Link>
              <Link className="button button-ghost" href="/products">요약노트 둘러보기</Link>
            </div>
            <div className="trust-row">
              <span>✓ 핵심만 압축</span>
              <span>✓ 시험 직전 빠른 회독</span>
              <span>✓ 공식·수치 한눈표</span>
            </div>
          </div>
          <div className="hero-panel" aria-hidden="true">
            <div className="floating-card card-a"><b>01</b><span>핵심개념</span></div>
            <div className="floating-card card-b"><b>03</b><span>시험 직전</span></div>
            <div className="floating-card card-c"><b>02</b><span>공식·수치</span></div>
            <div className="hero-symbol"><div className="symbol-p">P</div><div className="symbol-check">✓</div><div className="symbol-m">M</div></div>
          </div>
        </div>
      </section>

      <section className="section section-soft">
        <div className="container">
          <div className="section-heading"><span className="eyebrow">PASSMATE METHOD</span><h2>많이 담는 대신, 필요한 순서로 압축합니다.</h2></div>
          <div className="feature-grid">
            <article className="feature-card"><span>01</span><h3>핵심개념</h3><p>시험 범위의 핵심 개념을 빠르게 다시 볼 수 있는 본편 요약노트.</p></article>
            <article className="feature-card"><span>02</span><h3>공식·수치</h3><p>공식·수치처럼 반복 확인이 필요한 내용을 빠르게 찾는 한눈표.</p></article>
            <article className="feature-card feature-card-dark"><span>03</span><h3>시험 직전</h3><p>시험장에서 놓치기 쉬운 항목을 마지막으로 점검하는 체크리스트.</p></article>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-heading row-heading">
            <div><span className="eyebrow">FIRST RELEASE</span><h2>첫 번째 PASSMATE</h2></div>
            <Link href="/products" className="text-link">전체 요약노트 →</Link>
          </div>
          {products.length > 0 ? (
            <div className="product-list">{products.map((p) => <ProductCard key={p.slug} product={p} />)}</div>
          ) : (
            <p className="page-lead">현재 판매 중인 요약노트가 없습니다.</p>
          )}
        </div>
      </section>

      <section className="section section-soft">
        <div className="container">
          <div className="section-heading"><span className="eyebrow">HOW TO USE</span><h2>처음부터 다시 공부하지 말고,<br/>필요한 순간에 필요한 만큼.</h2></div>
          <div className="feature-grid">
            <article className="feature-card"><span>STEP 1</span><h3>이해</h3><p>핵심개념 요약노트로 시험 범위를 빠르게 정리하고 전체 흐름을 잡습니다.</p></article>
            <article className="feature-card"><span>STEP 2</span><h3>암기</h3><p>공식·수치 한눈표로 헷갈리는 기준을 반복해서 확인합니다.</p></article>
            <article className="feature-card feature-card-dark"><span>STEP 3</span><h3>점검</h3><p>시험 직전 체크리스트로 놓치기 쉬운 항목을 마지막에 확인합니다.</p></article>
          </div>
        </div>
      </section>
    </>
  );
}
