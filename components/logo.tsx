export function PassmateLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand-logo ${compact ? "brand-logo--compact" : ""}`} role="img" aria-label="PASSMATE 패스메이트">
      <svg className="brand-mark" viewBox="0 0 84 84" aria-hidden="true">
        <path d="M12 12h35c10 0 18 8 18 18v10H50V31c0-3-2-5-5-5H27v46H12V12Z" fill="currentColor"/>
        <path d="M26 52 38 40l9 9 24-24v22L48 70 26 52Z" fill="#242a32"/>
        <path d="M32 25h10v17l-5-3-5 3V25Z" fill="#55c935"/>
      </svg>
      <div className="brand-wording">
        <div className="brand-wordmark"><span>PASS</span><strong>MATE</strong></div>
        {!compact && <div className="brand-korean">패스메이트</div>}
      </div>
    </div>
  );
}
