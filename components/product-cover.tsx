export function ProductCover({ small = false }: { small?: boolean }) {
  return (
    <div className={`product-cover ${small ? "product-cover--small" : ""}`} aria-label="2027 컴퓨터활용능력 2급 PASSMATE 표지 샘플">
      <div className="cover-top"><span>PASSMATE</span><span>CORE 01</span></div>
      <div className="cover-year">2027</div>
      <div className="cover-title">컴퓨터활용능력<br/>2급</div>
      <div className="cover-rule" />
      <div className="cover-label">핵심요약 NOTE</div>
      <div className="cover-sub">필기 + 실기 + 벼락치기</div>
      <div className="cover-bottom"><span>SMART NOTES.<br/>BRIGHTER TOMORROW.</span><span className="cover-check">✓</span></div>
    </div>
  );
}
