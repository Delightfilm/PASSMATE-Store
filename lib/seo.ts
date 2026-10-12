import type { Metadata } from "next";

export const SITE_URL = "https://www.mypassmate.com";
export const SITE_NAME = "패스메이트 PASSMATE";
export const HOME_TITLE = `${SITE_NAME} | 자격증 기출문제·CBT 문제은행`;
export const HOME_DESCRIPTION = "패스메이트에서 자격증·공무원 시험 기출문제를 풀어보세요. 회차별 문제풀이와 모의고사, AI 해설, 오답노트로 학습하고 복습할 수 있습니다.";

export function publicMetadata(title: string, description: string, path: string): Metadata {
  const url = `${SITE_URL}${path}`;
  return {
    title, description,
    alternates: { canonical: url },
    openGraph: { type: "website", locale: "ko_KR", siteName: SITE_NAME, title, description, url },
    twitter: { card: "summary", title, description },
  };
}

export const privateMetadata: Metadata = { robots: { index: false, follow: true } };
