import Link from "next/link";

export function StoreUnavailable() {
  return <section className="store-unavailable" aria-labelledby="store-unavailable-title">
    <div className="container">
      <span className="store-unavailable-symbol" aria-hidden="true">✦</span>
      <h1 id="store-unavailable-title">스토어는 준비중이에요!</h1>
      <p>문제은행에서 먼저 학습을 시작해 보세요.</p>
      <Link className="button button-primary" href="/cbt/" prefetch={false}>문제은행으로 가기</Link>
    </div>
  </section>;
}
