import type { Metadata } from "next";

export const metadata: Metadata = { title: "내 계정 | PASSMATE", description: "계정 정보와 구매 자료, CBT 학습 기록을 관리하세요." };

import { AccountClient } from "@/components/account-client";
import { homeCatalog } from "@/lib/cbt-home-catalog";

export default function AccountPage() {
  const qualificationNames = Object.fromEntries(homeCatalog.qualifications.map(item => [item.code, item.title]));
  return <section className="section page-section account-page"><div className="container account-shell"><h1 className="page-title">내 계정</h1><AccountClient qualificationNames={qualificationNames} /></div></section>;
}
