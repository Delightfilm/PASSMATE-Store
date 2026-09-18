import { AccountClient } from "@/components/account-client";

export default function AccountPage() {
  return <section className="section page-section"><div className="container account-shell"><span className="eyebrow">MY ACCOUNT</span><h1 className="page-title">내 계정</h1><p className="page-lead">PASSMATE 계정 정보와 구매 자료를 관리합니다.</p><AccountClient /></div></section>;
}
