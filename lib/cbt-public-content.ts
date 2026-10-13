import { publicQualifications } from "./cbt-home-catalog";

export const priorityQualifications = publicQualifications.filter(item => item.slug === "전기기능사" || item.slug === "지게차운전기능사" || /^무대(음향|기계|조명)-[123]급$/.test(item.slug));

// Coverage verified against the actual published bundles on 2026-10-13.
// Counts remain sourced from the validated local catalog, not editorial copy.
export function qualificationGuide(slug: string) {
  if (slug === "전기기능사") return {
    years: "2002–2016", scope: "전기 이론·전기 기기·전기 설비",
    introduction: "전기기능사 필기 기출문제를 회차별로 풀고, CBT 모의시험으로 학습한 내용을 점검하세요. 계산 문제는 정답만 외우기보다 사용한 공식과 단위를 함께 확인하고, 전기 기기와 설비 문제는 선택지의 차이를 비교하며 복습해 보세요.",
    practice: "처음에는 회차별 기출로 틀리는 유형을 확인하세요. 전기 이론의 계산, 기기의 원리, 설비 용어처럼 헷갈리는 내용을 정리한 뒤 단원별 문제와 모의시험을 번갈아 풀면 복습 범위를 정하기 쉽습니다.",
  };
  if (slug === "지게차운전기능사") return {
    years: "2004–2011", scope: "과목 구분 없이 제공되는 필기 기출",
    introduction: "지게차운전기능사 필기 기출문제를 문제은행에서 회차별로 풀어보세요. 먼저 한 회차를 풀어 익숙한 내용과 헷갈리는 내용을 나누고, 정답을 확인한 뒤 틀린 선택지를 다시 비교해 보세요. ‘지게차 기능사’로 찾는 수험생도 이 페이지에서 학습을 시작할 수 있습니다.",
    practice: "회차별 풀이로 기초를 점검한 뒤 모의시험으로 시간을 정해 연습하세요. 지게차 자료는 과목이 나뉘어 있지 않으므로 단원 구분보다 오답의 원인과 헷갈린 용어를 기준으로 복습하는 편이 좋습니다. 이 문제은행은 필기 학습용이며 실기 작업 연습을 대신하지 않습니다.",
  };
  const stage = slug.match(/^(무대음향|무대기계|무대조명)-([123])급$/);
  if (!stage) return undefined;
  const field = stage[1], grade = stage[2];
  const focus = field === "무대음향" ? "음향 신호의 흐름과 장비 연결을 구분하며" : field === "무대기계" ? "무대 장치의 동작과 작업 안전을 함께 살피며" : "조명 장비의 역할과 제어 흐름을 구분하며";
  return {
    years: "2008–2026", scope: `공연장 안전 및 관련 법규·무대기술일반·${field}`,
    introduction: `${field} ${grade}급 기출문제를 회차별로 선택해 풀 수 있습니다. 공연장 안전 및 관련 법규, 무대기술일반, ${field} 자료를 구분해 학습하세요. 준비하는 급수의 문제부터 확인하고, ${focus} 헷갈린 개념을 정리해 보세요.`,
    practice: `${field} ${grade}급의 회차별 풀이로 시작한 뒤 단원별 문제에서 복습할 범위를 좁혀 보세요. 다른 급수는 별도 페이지에서 선택할 수 있습니다. 법규와 안전 기준은 기출 당시와 달라질 수 있으므로 시험 준비에 적용할 때 현행 기준을 따로 확인하세요.`,
  };
}
