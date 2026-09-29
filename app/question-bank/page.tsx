export default function QuestionBankPage() {
  return (
    <section className="question-bank-page">
      <div className="container">
        <header className="question-bank-hero">
          <div>
            <span className="eyebrow">PASSMATE QUESTION BANK</span>
            <h1>실전처럼 풀고,<br />바로 약점을 확인하세요.</h1>
            <p>자격증과 시험 회차를 고르면 실제 시험 흐름에 맞춘 모의테스트를 시작할 수 있습니다.</p>
          </div>
          <span className="question-bank-status">데이터 연결 준비 중</span>
        </header>

        <div className="question-bank-grid">
          <section className="question-setup-card">
            <div className="question-card-head">
              <span>01</span>
              <div>
                <strong>모의테스트 설정</strong>
                <p>응시할 시험을 선택해주세요.</p>
              </div>
            </div>

            <div className="question-select-grid">
              <label>
                <span>자격증 종목</span>
                <select disabled defaultValue=""><option value="">등록된 종목이 없습니다</option></select>
              </label>
              <label>
                <span>시험 연도</span>
                <select disabled defaultValue=""><option value="">연도 선택</option></select>
              </label>
              <label>
                <span>시험 회차</span>
                <select disabled defaultValue=""><option value="">회차 선택</option></select>
              </label>
              <label>
                <span>문항 수</span>
                <select disabled defaultValue=""><option value="">전체 문항</option></select>
              </label>
            </div>

            <div className="question-mode-list" aria-label="테스트 방식">
              <div className="question-mode question-mode--selected">
                <span>실전 모드</span>
                <small>모든 문제를 푼 뒤 한 번에 채점합니다.</small>
              </div>
              <div className="question-mode">
                <span>학습 모드</span>
                <small>문제마다 정답을 바로 확인합니다.</small>
              </div>
            </div>

            <button className="button question-start-button" type="button" disabled>
              문제 데이터 등록 후 시작할 수 있어요
            </button>
          </section>

          <section className="question-preview-card" aria-label="문제 풀이 화면 미리보기">
            <div className="question-preview-top">
              <div><span>문제</span><strong>— / —</strong></div>
              <span className="question-timer">--:--</span>
            </div>
            <div className="question-preview-progress"><span /></div>
            <div className="question-preview-empty">
              <div className="question-preview-icon">Q</div>
              <strong>문제가 여기에 표시됩니다.</strong>
              <p>종목·연도·회차를 선택하면 문제와 보기가 차례로 나타납니다.</p>
            </div>
            <div className="question-choice-preview" aria-hidden="true">
              <span><b>1</b></span><span><b>2</b></span><span><b>3</b></span><span><b>4</b></span>
            </div>
            <div className="question-preview-actions">
              <button type="button" disabled>이전 문제</button>
              <button type="button" disabled>다음 문제</button>
            </div>
          </section>
        </div>

        <div className="question-bank-flow">
          <article><span>01</span><strong>시험 선택</strong><p>종목·연도·회차를 선택합니다.</p></article>
          <article><span>02</span><strong>모의테스트</strong><p>실전과 같은 순서로 문제를 풉니다.</p></article>
          <article><span>03</span><strong>결과 확인</strong><p>점수와 틀린 문제를 바로 확인합니다.</p></article>
        </div>
      </div>
    </section>
  );
}
