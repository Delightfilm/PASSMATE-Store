import Link from "next/link";
import { publicQualifications, qualificationHref } from "@/lib/cbt-home-catalog";
import { priorityQualifications, qualificationGuide } from "@/lib/cbt-public-content";

type Qualification = (typeof publicQualifications)[number];

export function QualificationIntro({ qualification }: { qualification: Qualification }) {
  const guide = qualificationGuide(qualification.slug);
  return <section className="cbt-public-intro container">
    <nav aria-label="페이지 경로"><Link href="/">PASSMATE</Link><span aria-hidden="true"> / </span><Link href="/cbt/">CBT 문제은행</Link></nav>
    <h1>{qualification.title} 기출문제·CBT 문제은행</h1>
    <p>{guide?.introduction || `${qualification.title} 회차별 기출문제를 선택하고 CBT 모의시험으로 학습 내용을 점검하세요. 풀이 뒤 정답을 확인하고 틀린 문제를 다시 복습할 수 있습니다.`}</p>
    <p className="cbt-public-coverage">제공 자료{guide ? `: ${guide.years}년` : ""} · {qualification.exams.toLocaleString("ko-KR")}회차 · {qualification.questions.toLocaleString("ko-KR")}문항{guide ? ` · ${guide.scope}` : ""}</p>
  </section>;
}

export function QualificationStudyGuide({ qualification }: { qualification: Qualification }) {
  const guide = qualificationGuide(qualification.slug);
  if (!guide) return null;
  const stageField = qualification.title.match(/^무대(음향|기계|조명)/)?.[0];
  const related = priorityQualifications.filter(item => item.slug !== qualification.slug && (stageField ? item.title.startsWith(stageField) : !item.title.startsWith("무대")));
  return <section className="cbt-public-guide container" aria-label={`${qualification.title} 학습 안내`}>
    <h2>{qualification.title} 문제은행 활용 방법</h2>
    <p>{guide.practice}</p>
    <ol>
      <li><strong>회차별 기출:</strong> 학습 화면에서 연도와 회차를 선택해 문제를 풉니다.</li>
      <li><strong>CBT 모의시험:</strong> 문제 범위와 풀이 방식을 선택해 연습합니다. 사이트의 모의시험 설정은 실제 시험의 운영 방식과 다를 수 있습니다.</li>
      <li><strong>오답 복습:</strong> 정답을 확인하고, 제공되는 AI 해설을 참고해 풀이 과정을 점검합니다. AI 해설에는 오류가 있을 수 있으므로 의심되는 내용은 자료와 대조하세요.</li>
    </ol>
    <h2>학습 전에 확인하세요</h2>
    <p>이 페이지는 현재 제공 중인 {guide.years}년 기출 자료를 안내합니다. 수록된 기출 전체가 최신 출제기준과 일치한다는 뜻은 아닙니다. 시험 일정·응시 요건·현재 출제기준은 해당 시험의 공식 안내에서 확인하세요.</p>
    <nav className="cbt-public-links" aria-label="관련 문제은행">
      <Link href="/cbt/">전체 자격증·시험 문제은행</Link>
      {related.map(item => <Link key={item.slug} href={qualificationHref(item.slug)} prefetch={false}>{item.title} 기출문제</Link>)}
    </nav>
  </section>;
}

export function PriorityQualificationLinks() {
  const skills = priorityQualifications.filter(item => !item.title.startsWith("무대"));
  const stage = priorityQualifications.filter(item => item.title.startsWith("무대"));
  return <section className="cbt-public-guide container" aria-label="추천 문제은행">
    <h2>전기·지게차 필기 기출문제</h2>
    <nav className="cbt-public-links" aria-label="기능사 기출문제">{skills.map(item => <Link key={item.slug} href={qualificationHref(item.slug)} prefetch={false}>{item.title} 필기 기출문제·CBT</Link>)}</nav>
    <h2>무대음향·무대기계·무대조명 문제은행</h2>
    <p>준비하는 분야와 급수를 선택하세요. 1·2·3급 기출문제를 각각 확인하고 회차별 풀이와 단원별 학습을 시작할 수 있습니다.</p>
    <nav className="cbt-public-links" aria-label="무대 분야 급수별 기출문제">{stage.map(item => <Link key={item.slug} href={qualificationHref(item.slug)} prefetch={false}>{item.title} 기출문제·CBT</Link>)}</nav>
  </section>;
}

export function CbtPublicIntro() {
  return <section className="cbt-public-intro container"><h1>자격증 기출문제·CBT 문제은행</h1><p>PASSMATE에서 준비하는 자격증과 시험의 기출문제를 찾아보세요. 종목을 선택하면 제공되는 연도와 회차를 확인하고, 회차별 문제풀이·모의시험·오답 복습을 이어갈 수 있습니다.</p></section>;
}
