type ProductCoverProps = {
  small?: boolean;
  theme?: "dark" | "light";
  year?: number;
  titleLines?: string[];
  label?: string;
  subtitle?: string;
  series?: string;
};

export function ProductCover({
  small = false,
  theme = "dark",
  year = 2027,
  titleLines = ["컴퓨터활용능력", "2급"],
  label = "핵심요약 NOTE",
  subtitle = "CORE + SHEET + CHECK",
  series = "CORE 01",
}: ProductCoverProps) {
  const title = titleLines.join(" ");

  return (
    <div
      className={`product-cover ${small ? "product-cover--small" : ""} ${theme === "light" ? "product-cover--light" : ""}`}
      role="img"
      aria-label={`${year} ${title} PASSMATE 표지 샘플`}
    >
      <div className="cover-top"><span>PASSMATE</span><span>{series}</span></div>
      <div className="cover-year">{year}</div>
      <div className="cover-title">
        {titleLines.map((line, index) => (
          <span key={line + index}>{line}{index < titleLines.length - 1 ? <br /> : null}</span>
        ))}
      </div>
      <div className="cover-rule" />
      <div className="cover-label">{label}</div>
      <div className="cover-sub">{subtitle}</div>
      <div className="cover-bottom"><span>SMART NOTES.<br/>BRIGHTER TOMORROW.</span><span className="cover-check">✓</span></div>
    </div>
  );
}
