import type { Metadata } from "next";

export const metadata: Metadata = { title: "내 계정 | PASSMATE", description: "계정 정보와 구매 자료, CBT 학습 기록을 관리하세요." };

import { AccountClient } from "@/components/account-client";

export default function AccountPage() {
  return <section className="section page-section"><div className="container account-shell"><span className="eyebrow">내 계정</span><h1 className="page-title">내 계정</h1><p className="page-lead">PASSMATE 계정 정보와 구매 자료를 관리합니다.</p><AccountClient /></div></section>;
}
