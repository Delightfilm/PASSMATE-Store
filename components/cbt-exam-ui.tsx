"use client";

import { useEffect, useRef, useState } from "react";

export const CBT_RIGHTS_NOTICE = "허락 없는 복제·배포는 금지됩니다. 문제와 해설은 개인 학습용으로 이용해 주세요.";

export function toggleAnswerSelection(answers: Record<string, number>, questionId: string, choice: number) {
  const next = { ...answers };
  if (next[questionId] === choice) delete next[questionId]; else next[questionId] = choice;
  return next;
}

export function AnswerChoices({ number, selected, disabled, onSelect, count = 4 }: { number: number; selected?: number; disabled: boolean; onSelect: (choice: number) => void; count?: number }) {
  const [focus, setFocus] = useState(selected ?? 0);
  useEffect(() => { setFocus(selected ?? 0); }, [selected]);
  return <div className="cbt-answer-choices" role="radiogroup" aria-label={`${number}번 문항 답안`} onKeyDown={(event) => {
    event.stopPropagation();
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = (focus + (event.key === "ArrowRight" ? 1 : count - 1)) % count;
    setFocus(next);
    event.currentTarget.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
  }}>
    {Array.from({ length: count }, (_, choice) => <button type="button" role="radio" className={`cbt-answer-choice${selected === choice ? " is-chosen" : ""}`} aria-checked={selected === choice} aria-label={`${number}번 문항 ${"①②③④⑤⑥⑦⑧⑨⑩"[choice]}번 보기`} disabled={disabled} tabIndex={choice === focus ? 0 : -1} onFocus={() => setFocus(choice)} onClick={() => onSelect(choice)} key={choice}>{"①②③④⑤⑥⑦⑧⑨⑩"[choice]}</button>)}
  </div>;
}

function SettingGroup<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly (readonly [T, string])[]; onChange: (value: T) => void }) {
  return <><p>{label}</p><div role="radiogroup" aria-label={label} onKeyDown={(event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const current = options.findIndex(([option]) => option === value);
    const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : (current + (event.key === "ArrowRight" ? 1 : options.length - 1)) % options.length;
    onChange(options[next][0]);
    event.currentTarget.querySelectorAll<HTMLButtonElement>("button")[next]?.focus();
  }}>{options.map(([option, text]) => <button type="button" role="radio" aria-checked={value === option} tabIndex={value === option ? 0 : -1} onClick={() => onChange(option)} key={option}>{text}</button>)}</div></>;
}

export function ExamViewSettings({ fontSize, choiceLayout, position, onFontSize, onChoiceLayout, onPosition }: { fontSize: "base" | "large" | "xlarge"; choiceLayout: "one" | "two" | "focus"; position: "a" | "b"; onFontSize: (value: "base" | "large" | "xlarge") => void; onChoiceLayout: (value: "one" | "two" | "focus") => void; onPosition: (value: "a" | "b") => void }) {
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => { const media = window.matchMedia("(max-width: 900px)"); const update = () => setMobile(media.matches); update(); media.addEventListener("change", update); return () => media.removeEventListener("change", update); }, []);
  function close() { setOpen(false); button.current?.focus(); }
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLButtonElement>('button[tabindex="0"]')?.focus();
    const outside = (event: PointerEvent) => { if (!panel.current?.contains(event.target as Node) && !button.current?.contains(event.target as Node)) { setOpen(false); button.current?.focus(); } };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); button.current?.focus(); }
      if (event.key === "Tab" && mobile) {
        const controls = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>('button:not([tabindex="-1"])') || []);
        const first = controls[0], last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", keyboard, true);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", keyboard, true); };
  }, [open, mobile]);
  return <div className="cbt-settings-anchor">
    <button ref={button} type="button" className="cbt-view-button" aria-label="보기 설정" aria-haspopup="dialog" aria-expanded={open} aria-controls="cbt-view-settings" onClick={() => setOpen(!open)}>⚙ <span>보기 설정</span></button>
    {open && <><div className="cbt-settings-backdrop" onClick={close} aria-hidden="true" /><div ref={panel} className="cbt-view-settings" id="cbt-view-settings" role="dialog" aria-modal={mobile || undefined} aria-label="보기 설정">
      <div className="cbt-settings-heading"><h2>보기 설정</h2><button type="button" onClick={close} aria-label="보기 설정 닫기">×</button></div>
      <SettingGroup label="글자 크기" value={fontSize} options={[["base", "기본"], ["large", "큼"], ["xlarge", "아주 큼"]]} onChange={onFontSize} />
      <SettingGroup label="화면 배치" value={mobile && choiceLayout === "two" ? "one" : choiceLayout} options={mobile ? [["one", "1단"], ["focus", "한 문제씩"]] : [["one", "1단"], ["two", "2단"], ["focus", "한 문제씩"]]} onChange={onChoiceLayout} />
      <SettingGroup label="답안지 위치" value={position} options={[["a", mobile ? "하단 시트" : "우측 답안지"], ["b", "하단 번호 스트립"]]} onChange={onPosition} />
      <button type="button" className="cbt-settings-reset" onClick={() => { onFontSize("base"); onChoiceLayout("one"); onPosition("a"); }}>기본값으로 되돌리기</button>
    </div></>}
  </div>;
}

export function MockExamGuide({ name, onStart }: { name: string; onStart: () => void }) {
  const [step, setStep] = useState(0);
  const titles = ["수험자 정보 확인", "안내사항", "유의사항", "화면 사용법"];
  return <div className="cbt-guide">
    <ol className="cbt-guide-steps" aria-label="시험 전 안내 진행">{titles.map((title, index) => <li className={index === step ? "is-current" : index < step ? "is-done" : ""} aria-current={index === step ? "step" : undefined} key={title}><b>{index < step ? "✓" : index + 1}</b><span>{title}</span></li>)}</ol>
    <div className="cbt-guide-content" aria-live="polite"><span className="eyebrow">{step + 1}/4</span><h3>{titles[step]}</h3>
      {step === 0 && <><p>표시 이름을 확인해 주세요.</p><div className="cbt-guide-identity"><span>수험자</span><strong>{name}</strong></div><p>응시 번호는 시험을 시작한 뒤 화면 상단에 표시됩니다.</p></>}
      {step === 1 && <ul><li>시험 시작을 확정하면 제한시간이 흐릅니다.</li><li>선택한 답안은 자동으로 저장됩니다.</li><li>제출 전에 미응답 문항과 다시 볼 문항을 점검할 수 있습니다.</li></ul>}
      {step === 2 && <><p className="cbt-guide-notice">{CBT_RIGHTS_NOTICE}</p><ul><li>개인 학습용 연습 화면입니다.</li><li>시간이 종료되면 답안을 수정할 수 없으며, 결과 저장은 확인 후 진행됩니다.</li></ul></>}
      {step === 3 && <><div className="cbt-guide-sample" aria-label="화면 사용법 예시"><div><b>1</b> 남은 시간 · 보기 설정 · 제출</div><section><b>2</b> 문제 카드와 보기 선택</section><aside><b>3</b> 답안지 · 번호 이동과 답 선택</aside><footer><b>4</b> 이전 · 다음</footer></div><p>문제 카드와 답안지 양쪽에서 답을 선택할 수 있습니다. 모바일에서는 답안지를 하단 시트로 엽니다.</p></>}
    </div>
    <div className="cbt-guide-actions"><button type="button" className="button button-ghost" onClick={onStart}>건너뛰고 시험 시작</button><div><button type="button" className="button button-secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>이전</button><button type="button" className="button button-primary" onClick={() => step === 3 ? onStart() : setStep(step + 1)}>{step === 3 ? "시험 시작" : "다음"}</button></div></div>
  </div>;
}
