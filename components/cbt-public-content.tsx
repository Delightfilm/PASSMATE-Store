import Link from "next/link";
import { publicQualifications, qualificationHref } from "@/lib/cbt-home-catalog";
import { priorityQualifications, qualificationGuide } from "@/lib/cbt-public-content";

type Qualification = (typeof publicQualifications)[number];

export function QualificationIntro({ qualification }: { qualification: Qualification }) {
  const guide = qualificationGuide(qualification.slug);
  return <section className="cbt-public-intro container">
    <nav aria-label="페이지 경로"><Link href="/">PASSMATE</Link><span aria-hidden="true"> / </span><Link href="/cbt/">CBT 문제은행</Link></nav>
    <h1>{qualification.title}</h1>
    <p className="cbt-public-coverage">{qualification.exams.toLocaleString("ko-KR")}회차 · {qualification.questions.toLocaleString("ko-KR")}문항{guide ? ` · ${guide.years}년 자료` : ""}</p>
  </section>;
}

export function QualificationStudyGuide({ qualification }: { qualification: Qualification }) {
  const guide = qualificationGuide(qualification.slug);
  if (!guide) return null;
  const stageField = qualification.title.match(/^무대(음향|기계|조명)/)?.[0];
  const stageGrade = qualification.slug.match(/-([123]급)$/)?.[1];
  const related = priorityQualifications.filter(item => item.slug !== qualification.slug && (stageField ? item.title.startsWith(stageField) || item.slug.endsWith(`-${stageGrade}`) : !item.title.startsWith("무대")));
  const href = qualificationHref(qualification.slug);
  return <section className="cbt-public-guide container" aria-label={`${qualification.title} 학습 안내`}>
    <details className="cbt-study-details">
      <summary>학습 안내 및 자료 범위<DisclosureArrow /></summary>
      <div className="cbt-study-content">
        <h2>종목 안내</h2>
        <p>{guide.introduction}</p>
        <p>제공 과목: {guide.scope}</p>
        <h2>{qualification.title} 문제은행 활용 방법</h2>
        <p>{guide.practice}</p>
        <h3>복습할 때 살펴볼 내용</h3>
        <ul>{guide.checkpoints.map(point => <li key={point}>{point}</li>)}</ul>
        <ol>
          <li><strong>회차별 기출:</strong> 학습 화면에서 연도와 회차를 선택해 문제를 풉니다.</li>
          <li><strong>CBT 모의시험:</strong> 문제 범위와 풀이 방식을 선택해 연습합니다. 사이트의 모의시험 설정은 실제 시험의 운영 방식과 다를 수 있습니다.</li>
          <li><strong>오답 복습:</strong> 정답을 확인하고, 제공되는 AI 해설을 참고해 풀이 과정을 점검합니다. AI 해설에는 오류가 있을 수 있으므로 의심되는 내용은 자료와 대조하세요.</li>
        </ol>
        <nav className="cbt-public-links" aria-label={`${qualification.title} 학습 바로가기`}>
          {/* The learning client reads its initial tab on mount; load the destination with that query. */}
          <a href={`${href}?tab=mock`}>CBT 모의시험 연습</a>
          {qualification.slug !== "지게차운전기능사" && <a href={`${href}?tab=subjects`}>단원별로 복습하기</a>}
          <a href={`${href}?tab=records`}>내 풀이 기록 확인</a>
        </nav>
        <h2>자주 묻는 학습 질문</h2>
        <h3>{guide.question}</h3>
        <p>{guide.answer}</p>
        <h3>여기 있는 기출이 현재 시험과 같은가요?</h3>
        <p>PASSMATE는 수록된 과거 기출로 연습하는 학습 서비스입니다. CBT는 사이트에서 문제를 푸는 방식을 뜻하며, 해당 자격시험이 실제로 CBT로 시행되는지는 공식 시험 안내에서 확인해야 합니다. 수록 연도·과목과 현재 출제기준을 비교한 뒤 학습 범위를 정하세요.</p>
        <h2>학습 전에 확인하세요</h2>
        <p>이 페이지는 현재 제공 중인 {guide.years}년 기출 자료를 안내합니다. 수록된 기출 전체가 최신 출제기준과 일치한다는 뜻은 아닙니다. 시험 일정·응시 요건·현재 출제기준은 해당 시험의 공식 안내에서 확인하세요.</p>
        <p><a href={guide.authority.href}>{guide.authority.label}</a>에서 준비하는 종목·급수와 적용 기간을 확인하세요.</p>
        <nav className="cbt-public-links" aria-label="관련 문제은행">
          <Link href="/cbt/">전체 자격증·시험 문제은행</Link>
          {related.map(item => <Link key={item.slug} href={qualificationHref(item.slug)} prefetch={false}>{item.title}</Link>)}
        </nav>
      </div>
    </details>
  </section>;
}

export function PriorityQualificationLinks({ embedded = false }: { embedded?: boolean } = {}) {
  const skills = priorityQualifications.filter(item => !item.title.startsWith("무대")).sort((a, b) => a.title.localeCompare(b.title, "ko"));
  return <section className={`cbt-topics${embedded ? "" : " container"}`} aria-labelledby="cbt-topics-title">
    <h2 id="cbt-topics-title">종목별 문제은행</h2>
    <div className="cbt-topic-grid">
      {skills.map(item => <Link className="cbt-topic-card" key={item.slug} href={qualificationHref(item.slug)} prefetch={false}>
        <strong>{item.title}<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M5 12h14m-6-6 6 6-6 6" /></svg></strong>
        <span>{item.exams}회차</span>
      </Link>)}
      {["무대음향", "무대기계", "무대조명"].map(field => <article className="cbt-topic-stage" key={field}>
        <h3>{field}</h3>
        <nav className="cbt-topic-grades" aria-label={`${field} 급수 선택`}>
          {[1,2,3].map(grade => {
            const item = priorityQualifications.find(item => item.slug === `${field}-${grade}급`);
            return item ? <Link key={grade} href={qualificationHref(item.slug)} prefetch={false} aria-label={`${field} ${grade}급 문제풀이`}>{grade}급</Link> : null;
          })}
        </nav>
      </article>)}
    </div>
  </section>;
}

export function CbtPublicIntro() {
  return <section className="cbt-public-intro container"><h1>CBT 문제은행</h1></section>;
}

function DisclosureArrow() {
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m6 9 6 6 6-6" /></svg>;
}
