export type Product = {
  slug: string;
  code: string;
  year: number;
  title: string;
  subtitle: string;
  price: number;
  badge: string;
  description: string;
  features: string[];
};

export const products: Product[] = [
  {
    slug: "computer-literacy-2",
    code: "PM-C2",
    year: 2027,
    title: "컴퓨터활용능력 2급",
    subtitle: "핵심요약 + 시험직전 벼락치기 + 치트시트",
    price: 6900,
    badge: "2027 EDITION",
    description: "방대한 시험 범위를 빠르게 회독할 수 있도록 핵심만 구조화한 PASSMATE 첫 번째 요약노트입니다.",
    features: ["핵심요약 20~30P", "시험직전 벼락치기 약 10P", "함수·개념 치트시트", "실수방지 체크리스트"]
  }
];

export function getProduct(slug: string) {
  return products.find((product) => product.slug === slug);
}
