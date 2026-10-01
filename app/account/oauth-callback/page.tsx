import type { Metadata } from "next";

export const metadata: Metadata = { title: "로그인 처리 중 | PASSMATE", description: "로그인 정보를 확인하고 있습니다." };

import { OAuthCallback } from "@/components/oauth-callback";

export default function OAuthCallbackPage() {
  return <section className="section page-section"><div className="container"><OAuthCallback /></div></section>;
}
