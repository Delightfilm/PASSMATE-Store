import Link from "next/link";
import { CertificationSearch } from "./certification-search";
import { qualificationHref, quickQualifications } from "@/lib/cbt-home-catalog";

export function LearningHome() {
  return <section className="learning-home" aria-labelledby="learning-home-title">
    <div className="container learning-home-container">
      <div className="learning-hero">
        <h1 id="learning-home-title">내 시험 기출부터,<br />틀린 문제 복습까지.</h1>
        <p className="learning-home-description">자격증을 찾아 기출문제를 풀어보세요.</p>
        <CertificationSearch />
      </div>
      <section className="learning-quick" aria-labelledby="learning-quick-title">
        <h2 id="learning-quick-title">바로 풀 자격증</h2>
        <div className="learning-quick-grid">
          {quickQualifications.map(item => <Link href={qualificationHref(item.slug)} prefetch={false} key={item.code}>
            <strong>{item.title}</strong><span>{item.exams.toLocaleString("ko-KR")}개 회차</span>
          </Link>)}
        </div>
      </section>
      <nav className="learning-actions" aria-label="학습 서비스">
        <Link className="learning-all" href="/cbt/" prefetch={false}>전체 자격증 보기 <span aria-hidden="true">→</span></Link>
        <Link className="learning-store" href="/store/" prefetch={false}>핵심노트 스토어 <span aria-hidden="true">→</span></Link>
      </nav>
    </div>
  </section>;
}
