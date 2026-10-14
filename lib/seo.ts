import type { Metadata } from "next";

export const SITE_URL = "https://www.mypassmate.com";
export const SITE_NAME = "패스메이트 PASSMATE";
export const HOME_TITLE = "CBT 문제은행·자격증 기출문제 풀어보기 | PASSMATE";
export const HOME_DESCRIPTION = "전기기능사, 지게차운전기능사, 무대예술전문인 등 시험을 선택해 기출문제를 풀어보세요. PASSMATE CBT 문제은행에서 회차별 문제풀이와 모의시험, 오답 복습으로 학습을 이어가세요.";

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
