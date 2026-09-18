export default function LibraryPage() {
  return (
    <section className="section page-section">
      <div className="container library-wrap">
        <span className="eyebrow">MY PASSMATE</span>
        <h1 className="page-title">내 자료</h1>
        <p className="page-lead">로그인과 결제가 연결되면 구매한 요약노트와 다운로드 내역을 이곳에서 확인할 수 있습니다.</p>
        <div className="empty-state"><div className="empty-icon">PM</div><h2>아직 연결 전입니다.</h2><p>회원 기능과 구매내역 기능을 순차적으로 연결할 예정입니다.</p></div>
      </div>
    </section>
  );
}
