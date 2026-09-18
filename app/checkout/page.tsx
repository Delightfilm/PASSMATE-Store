import Link from "next/link";

export default function CheckoutPage() {
  return (
    <section className="section page-section">
      <div className="container checkout-grid">
        <div>
          <span className="eyebrow">CHECKOUT</span>
          <h1 className="page-title">구매 준비</h1>
          <p className="page-lead">현재 결제 기능을 연결하는 중입니다. 오픈 후에는 결제 완료 뒤 내 자료에서 구매한 PDF를 바로 확인하고 다운로드할 수 있습니다.</p>
          <div className="checkout-steps"><p><b>1</b> 상품 선택</p><p><b>2</b> 결제 완료</p><p><b>3</b> 내 자료에서 구매 내역 확인</p><p><b>4</b> PDF 다운로드</p></div>
        </div>
        <aside className="order-box"><span>2027 컴퓨터활용능력 2급</span><strong>6,900원</strong><button disabled>결제 연동 준비 중</button><Link href="/products/computer-literacy-2">← 상품으로 돌아가기</Link></aside>
      </div>
    </section>
  );
}
