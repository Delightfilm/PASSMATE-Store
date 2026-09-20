const PRODUCT_SUFFIX =
  /\s*(?:핵심요약\s*패키지|핵심노트|합격팩|시험대비\s*완성패키지)\s*$/;

const FEATURE_LABELS: Record<string, string> = {
  "PASS PACK 상세 합격교재": "상세 개념해설서",
  "CORE 핵심요약": "핵심개념 요약노트",
  "SHEET 공식·숫자 치트시트": "공식·수치 한눈표",
  "CHECK 시험직전 체크리스트": "시험 직전 체크리스트",
};

export function getProductFamilyTitle(title: string) {
  return title.replace(PRODUCT_SUFFIX, "").trim();
}

export function getCoreProductTitle(title: string) {
  return getProductFamilyTitle(title) + " 핵심노트";
}

export function getCustomerFeatureLabel(feature: string) {
  return FEATURE_LABELS[feature] ?? getCustomerCopy(feature);
}

export function getCustomerCopy(value: string) {
  return value
    .replaceAll("핵심요약 패키지", "핵심노트")
    .replaceAll("합격팩", "시험대비 완성패키지")
    .replaceAll("공식·숫자 치트시트", "공식·수치 한눈표")
    .replaceAll("CORE 핵심요약", "핵심개념 요약노트")
    .replaceAll("CHECK 시험직전 체크리스트", "시험 직전 체크리스트");
}
