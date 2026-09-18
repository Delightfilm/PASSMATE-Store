import { AdminClient } from "@/components/admin-client";

export default function AdminPage() {
  return (
    <section className="section page-section admin-page">
      <div className="container">
        <span className="eyebrow">PASSMATE OPERATIONS</span>
        <h1 className="page-title">관리자</h1>
        <p className="page-lead">
          주문, 결제 상태, 자료 준비 상태와 운영 대기 항목을 확인합니다.
        </p>
        <AdminClient />
      </div>
    </section>
  );
}
