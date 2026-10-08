"use client";

import {useEffect,useRef,useState,type ReactNode} from "react";
import type {Question} from "@/lib/question-bank";
import {QuestionBody} from "./question-body";
import {QuestionChoiceContent} from "./question-choice-content";
import {ExamViewSettings,toggleAnswerSelection} from "./cbt-exam-ui";

// Preview answers stay in memory: no learner attempts, scores or paid AI calls.
export function QuestionExamReview({questions,title,busy,onEdit,editor}:{questions:Question[];title:string;busy:boolean;onEdit:(question:Question)=>void;editor?:ReactNode}) {
 const [index,setIndex]=useState(0);
 const [answers,setAnswers]=useState<Record<string,number>>({});
 const [fontSize,setFontSize]=useState<"base"|"large"|"xlarge">("base");
 const [choiceLayout,setChoiceLayout]=useState<"one"|"two"|"focus">("one");
 const [position,setPosition]=useState<"a"|"b">("a");
 const [sheetOpen,setSheetOpen]=useState(false);
 const [sheetPage,setSheetPage]=useState(0);
 const [search,setSearch]=useState("");
 const [searchNotice,setSearchNotice]=useState("");
 const sheet=useRef<HTMLElement>(null),opener=useRef<HTMLButtonElement>(null),editButton=useRef<HTMLButtonElement>(null);
 const wasEditing=useRef(false);
 const locked=busy||Boolean(editor);
 const current=Math.min(index,Math.max(0,questions.length-1));
 const question=questions[current];
 useEffect(()=>{if(wasEditing.current&&!editor)editButton.current?.focus();wasEditing.current=Boolean(editor);},[editor]);
 useEffect(()=>{
  if(!sheetOpen)return;
  const overflow=document.body.style.overflow;document.body.style.overflow="hidden";
  sheet.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  const keyboard=(event:KeyboardEvent)=>{
   if(event.key==="Escape"){event.preventDefault();setSheetOpen(false);}
   if(event.key!=="Tab")return;
   const controls=Array.from(sheet.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")||[]);
   const first=controls[0],last=controls.at(-1);
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  };
  document.addEventListener("keydown",keyboard);
  return()=>{document.body.style.overflow=overflow;document.removeEventListener("keydown",keyboard);opener.current?.focus();};
 },[sheetOpen]);
 function move(next:number){if(locked||next<0||next>=questions.length)return;setIndex(next);setSheetPage(Math.floor(next/60));setSheetOpen(false);setSearchNotice("");}
 function choose(choice:number){if(!locked&&question)setAnswers(value=>toggleAnswerSelection(value,question.id,choice));}
 function find(){
  if(locked)return;
  const needle=search.trim().toLocaleLowerCase();if(!needle)return;
  const exact=questions.findIndex(q=>q.id.toLocaleLowerCase()===needle||String(q.no)===needle);
  const matches=questions.map((q,i)=>q.stem.toLocaleLowerCase().includes(needle)?i:-1).filter(i=>i>=0);
  const next=exact>=0?exact:matches.find(i=>i>current)??matches[0]??-1;
  if(next<0)setSearchNotice("이 회차에서 일치하는 문항을 찾지 못했습니다.");else{move(next);setSearchNotice(`${questions[next].no}번 문항으로 이동했습니다.`);}
 }
 if(!question)return <p className="admin-empty">이 회차에 표시할 문항이 없습니다.</p>;
 const selected=answers[question.id];
 const correct=selected!==undefined&&(question.acceptedAnswers||[question.answer]).includes(selected);
 const answered=selected!==undefined;
 const numbers=(start:number,end:number)=><nav aria-label="문항 번호 이동">{questions.slice(start,end).map((q,offset)=>{
  const n=start+offset;return <button type="button" key={q.id} aria-label={`${q.no}번 문항으로 이동`} aria-current={n===current?"step":undefined} className={`${n===current?"is-current":""}${answers[q.id]!==undefined?" is-answered":""}`} disabled={locked} onClick={()=>move(n)}>{q.no}</button>;
 })}</nav>;
 return <section className={`exam-page exam-redesign admin-exam-review font-${fontSize} layout-${choiceLayout}`} aria-label="시험 화면에서 문항 검토">
  <header className="exam-topbar cbt-live-topbar"><div className="cbt-live-identity"><strong>{title}</strong><span>관리자 검토 · 답안과 점수는 저장되지 않습니다.</span></div><ExamViewSettings fontSize={fontSize} choiceLayout={choiceLayout} position={position} onFontSize={setFontSize} onChoiceLayout={setChoiceLayout} onPosition={setPosition}/></header>
  <form className="admin-exam-search" onSubmit={event=>{event.preventDefault();find();}}><label>이 회차에서 문항 찾기<input value={search} disabled={locked} placeholder="문항 번호, 본문 또는 ID" onChange={event=>setSearch(event.target.value)}/></label><button type="submit" className="button button-ghost" disabled={locked||!search.trim()}>문항으로 이동</button></form>
  {searchNotice&&<p role="status" className="admin-help">{searchNotice}</p>}
  <div className={`cbt-live-layout is-${position}${choiceLayout==="focus"?" is-focus":""}`}>
   <div className="cbt-live-main">
    <article className={`exam-content cbt-live-question font-${fontSize} layout-${choiceLayout}`}>
     <div className="exam-question-head"><p className="cbt-question-number">문제 {question.no} <span>/ {questions.length}문항 · {current+1}번째</span></p><button ref={editButton} type="button" className="button button-primary" aria-label="현재 문항 수정" disabled={locked} onClick={()=>{if(!locked)onEdit(question);}}>문항 수정</button></div>
     {editor||<><QuestionBody question={question}/><div className="choice-list">{question.choices.map((choice,i)=><button type="button" key={i} className={`choice-button${selected===i?" is-selected":""}${answered&&(question.acceptedAnswers||[question.answer]).includes(i)?" is-correct":""}${selected===i&&!correct?" is-wrong":""}`} aria-pressed={selected===i} disabled={locked} onClick={()=>choose(i)}><b className="choice-number">{i+1}</b><QuestionChoiceContent choice={choice} sourceImage={question.displayMode==="source_image"}/>{answered&&(question.acceptedAnswers||[question.answer]).includes(i)&&<em>정답</em>}{selected===i&&!correct&&<em>오답</em>}</button>)}</div>{answered&&<div className={`instant-feedback ${correct?"is-correct":"is-wrong"}`} role="status"><strong>{correct?"정답입니다.":"오답입니다."}</strong><p>{question.explanation||"등록된 해설이 없습니다."}</p></div>}</>}
     <div className="exam-nav"><button type="button" className="button button-ghost" disabled={locked||current===0} onClick={()=>move(current-1)}>← 이전</button><button type="button" className="button button-primary" disabled={locked||current+1>=questions.length} onClick={()=>move(current+1)}>다음 →</button></div>
    </article>
    {position==="b"&&<section className="cbt-number-strip"><div><h2>문항 이동</h2><span>{current+1} / {questions.length}</span></div>{numbers(Math.max(0,current-4),Math.min(questions.length,current+6))}<div className="cbt-number-strip-footer"><button ref={opener} type="button" disabled={locked} onClick={()=>setSheetOpen(true)}>전체 문항 번호</button></div></section>}
    {position==="a"&&<button ref={opener} type="button" className="cbt-mobile-answer-trigger" disabled={locked} onClick={()=>setSheetOpen(true)}>문항 번호 열기 · {current+1}/{questions.length}</button>}
   </div>
   {sheetOpen&&<button type="button" className="cbt-answer-backdrop" aria-label="문항 번호 닫기" onClick={()=>setSheetOpen(false)}/>}
   <aside ref={sheet} className={`cbt-answer-sheet${sheetOpen?" is-open":""}`} aria-label="문항 번호" role={sheetOpen?"dialog":undefined} aria-modal={sheetOpen||undefined}>
    <div className="cbt-answer-head"><div><h2>문항 번호</h2><p>{questions.length}문항 · 번호를 눌러 이동</p></div><button type="button" className="cbt-answer-close" aria-label="문항 번호 닫기" onClick={()=>setSheetOpen(false)}>×</button></div>
    <div className="cbt-answer-pages"><button type="button" disabled={locked||sheetPage===0} onClick={()=>{if(!locked)setSheetPage(p=>p-1);}}>이전 60개</button><span>{sheetPage*60+1}–{Math.min((sheetPage+1)*60,questions.length)}</span><button type="button" disabled={locked||(sheetPage+1)*60>=questions.length} onClick={()=>{if(!locked)setSheetPage(p=>p+1);}}>다음 60개</button></div>
    <div className="cbt-answer-scroll admin-exam-numbers">{numbers(sheetPage*60,(sheetPage+1)*60)}</div>
   </aside>
  </div>
 </section>;
}
