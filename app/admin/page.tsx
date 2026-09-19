import { AdminClient } from "@/components/admin-client";

export default function AdminPage() {
  return (
    <section className="section page-section admin-page">
      <div className="container">
        <span className="eyebrow">PASSMATE OWNER</span>
        <h1 className="page-title">관리자 대시보드</h1>
        <p className="page-lead">
          상품, 주문, 결제, 자료 발행 상태를 복잡한 메뉴 없이 한 화면에서 관리합니다.
        </p>
        <AdminClient />
      </div>
    </section>
  );
}
