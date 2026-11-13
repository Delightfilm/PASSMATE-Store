import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { publicQualifications, qualificationHref } from "@/lib/cbt-home-catalog";
import { qualificationGuide } from "@/lib/cbt-public-content";
import { findLearningGuide, learningGuides, learningGuideHref, learningGuideCheckedAt } from "@/lib/public-learning-guides";
import { publicMetadata, privateMetadata, SITE_URL } from "@/lib/seo";

type Props = { params: Promise<{ certSlug: string }> };
export function generateStaticParams() { return learningGuides.map(guide => ({ certSlug: guide.slug })); }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const guide = findLearningGuide((await params).certSlug);
  return guide ? publicMetadata(`${guide.title} | PASSMATE`, guide.description, learningGuideHref(guide.slug)) : { title: "학습 안내를 찾을 수 없습니다 | PASSMATE", ...privateMetadata };
}
export default async function LearningGuidePage({ params }: Props) {
  const guide = findLearningGuide((await params).certSlug);
  if (!guide) notFound();
  const qualification = publicQualifications.find(item => item.slug === guide.slug);
  if (!qualification) notFound();
  const archive = qualificationGuide(guide.slug);
  const href = qualificationHref(guide.slug);
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "CBT 문제은행", item: `${SITE_URL}/cbt/` },
      { "@type": "ListItem", position: 2, name: qualification.title, item: `${SITE_URL}${href}` },
      { "@type": "ListItem", position: 3, name: "학습 안내", item: `${SITE_URL}${learningGuideHref(guide.slug)}` },
    ],
  };
  return <article className="learning-guide-page container">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb).replace(/</g, "\\u003c") }} />
    <nav className="learning-guide-breadcrumb" aria-label="페이지 경로"><Link href="/cbt/">CBT 문제은행</Link><span aria-hidden="true"> / </span><Link href={href}>{qualification.title}</Link><span aria-hidden="true"> / </span><span>학습 안내</span></nav>
    <header><h1>{guide.title}</h1><p>{guide.introduction}</p><p className="learning-guide-meta">PASSMATE 자체 제작 · 계산·단위·참고자료 대조일 <time dateTime={learningGuideCheckedAt}>{learningGuideCheckedAt}</time></p></header>
    <nav className="cbt-public-links" aria-label="학습 안내 목차"><a href="#study-order">공부 순서</a><a href="#concept-questions">핵심 질문</a><a href="#worked-examples">개념 풀이 예시</a><a href="#archive-scope">수록 범위</a><a href="#references">참고자료</a></nav>
    <section id="study-order"><h2>기출을 활용하는 공부 순서</h2><ol>{guide.approach.map(step => <li key={step}>{step}</li>)}</ol><h3>복습할 때 확인하세요</h3><ul>{guide.checkpoints.map(point => <li key={point}>{point}</li>)}</ul></section>
    <section id="concept-questions"><h2>개념을 먼저 짚어보세요</h2>{guide.questions.map(question => <section className="learning-example" key={question.id} aria-labelledby={`${question.id}-title`}><h3 id={`${question.id}-title`}>{question.question}</h3><p>{question.answer}</p><p className="learning-example-source">개념 근거: {question.sourceIds.map((id, index) => { const source = guide.sources.find(item => item.id === id)!; return <span key={id}>{index > 0 && " · "}<a href={source.href}>{source.label}</a></span>; })}</p><nav className="cbt-public-links" aria-label={question.question}><a href={`#${question.exampleId}`}>풀이 예시로 확인하기</a></nav></section>)}</section>
    <section id="worked-examples"><h2>개념 풀이 예시 {guide.examples.length}개</h2><p>공식 기출문제를 재현한 것이 아닌 자체 제작 연습 예시입니다. 각 문제의 가정 안에서 풀이를 확인하고, 실제 장비의 조작·정격·안전 기준은 별도로 확인하세요.</p>
      {guide.examples.map((example, index) => <section className="learning-example" id={example.id} key={example.id} aria-labelledby={`${example.id}-title`}>
        <h3 id={`${example.id}-title`}>{index + 1}. {example.concept}</h3><p className="learning-example-question">{example.question}</p><p><strong>가정</strong> {example.assumption}</p><p className="learning-example-formula">{example.formula}</p><ol>{example.steps.map(step => <li key={step}>{step}</li>)}</ol><p><strong>답: {example.answer}</strong></p><p><strong>헷갈리기 쉬운 점</strong> {example.mistake}</p><p className="learning-example-source">개념 근거: {example.sourceIds.map((id, sourceIndex) => { const source = guide.sources.find(item => item.id === id)!; return <span key={id}>{sourceIndex > 0 && " · "}<a href={source.href}>{source.label}</a></span>; })}</p>
      </section>)}
    </section>
    <section id="archive-scope"><h2>현재 문제은행의 수록 범위</h2><p>{qualification.title} 문제은행은 {qualification.exams.toLocaleString("ko-KR")}회차 · {qualification.questions.toLocaleString("ko-KR")}문항{archive ? ` · ${archive.years}년 자료` : ""}를 제공합니다.</p><p>과거 기출 전체가 현재 출제기준과 일치한다는 뜻은 아닙니다. 이 페이지의 기초 예시 {guide.examples.length}개도 전체 시험 범위를 대신하지 않습니다.{archive && <> 응시 요건·일정·적용 출제기준은 <a href={archive.authority.href}>{archive.authority.label}</a>에서 확인하세요.</>}</p><nav className="cbt-public-links" aria-label="문제풀이로 이동"><Link href={href}>회차별 기출 풀어보기</Link><a href={`${href}?tab=mock`}>모의시험으로 연습하기</a></nav></section>
    <section id="references"><h2>참고자료와 확인 범위</h2><p>아래 자료의 물리 법칙과 신호 처리 개념을 대조해 예시를 작성하고 계산식·단위를 확인했습니다. 공식 기출의 정답이나 외부 전문가 검수본을 뜻하지 않습니다.</p><ul>{guide.sources.map(source => <li key={source.id}><a href={source.href}>{source.label}</a></li>)}</ul><p>기출 오류는 문제풀이 화면의 오류 신고로, 이 학습 안내의 수정 의견은 <a href="mailto:report@mypassmate.com">report@mypassmate.com</a>으로 알려주세요.</p></section>
  </article>;
}
