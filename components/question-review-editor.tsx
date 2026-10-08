"use client";
import {useEffect,useRef,useState} from "react";
import type {Question} from "@/lib/question-bank";
import {choiceLabel,validatePatch,type QuestionContent} from "@/supabase/functions/question-bank-admin/question-review";
import {QuestionImageEditor} from "./question-image-editor";
import {QuestionBody} from "./question-body";
import {QuestionChoiceContent} from "./question-choice-content";
export type ReviewData={question:Pick<Question,"id"|"certId"|"no"|"images"|"acceptedAnswers"|"displayMode"> & QuestionContent;version:number;sourceHash:string};

export function ReviewEditor({data,busy,onSave,onReload,hasReport=true,onMediaBusy,onClose,error,notice,reportMemo,embedded=false}:{data:ReviewData;busy:boolean;hasReport?:boolean;embedded?:boolean;onMediaBusy:(busy:boolean)=>void;onSave:(patch:QuestionContent,reason:string,resolve:boolean)=>Promise<void>;onReload:()=>void;onClose?:()=>void;error?:string;notice?:string;reportMemo?:string}) {
 const mediaLock=useRef(false);const [mediaBusy,setMediaBusy]=useState(false);const locked=busy||mediaBusy;
 const initial=useRef(data.question).current;
 const dialogRef=useRef<HTMLDialogElement>(null);
 const returnFocus=useRef(typeof document!=="undefined"?document.activeElement:null);
 useEffect(()=>{
  if(embedded)return;
  const dialog=dialogRef.current;if(!dialog)return;
  const overflow=document.body.style.overflow;
  document.body.style.overflow="hidden";
  if(!dialog.open)dialog.showModal();
  return()=>{
   dialog.close();document.body.style.overflow=overflow;
   queueMicrotask(()=>{
    const opener=returnFocus.current;
    const canReturn=opener instanceof HTMLElement&&opener!==document.body&&opener!==document.documentElement&&opener.isConnected&&!opener.matches(":disabled");
    const target=canReturn?opener:document.querySelector<HTMLElement>("[data-question-editor-return]");
    target?.focus();
   });
  };
 },[embedded]);
 function beginWork(){if(mediaLock.current||busy)return false;mediaLock.current=true;setMediaBusy(true);onMediaBusy(true);return true;}
 function endWork(){mediaLock.current=false;setMediaBusy(false);onMediaBusy(false);}
 const [stem,setStem]=useState(data.question.stem);const [images,setImages]=useState([...data.question.images]);
 const [choices,setChoices]=useState(data.question.choices.map((choice,i)=>({...choice,key:String(i),images:[...(choice.images||[])]})));
 const [accepted,setAccepted]=useState(data.question.acceptedAnswers||[data.question.answer]);const [explanation,setExplanation]=useState(data.question.explanation);
 const [reason,setReason]=useState("");const [validation,setValidation]=useState("");
 const [editTarget,setEditTarget]=useState<string|null>(null);
 const contentChoices=choices.map((c,i)=>({label:choiceLabel(i),text:c.text,images:c.images}));
 const originalChoices=initial.choices.map((c,i)=>({label:choiceLabel(i),text:c.text,images:c.images||[]}));
 const changedDisplay=stem!==initial.stem||JSON.stringify(images)!==JSON.stringify(initial.images)||JSON.stringify(contentChoices)!==JSON.stringify(originalChoices);
 const preview={...data.question,stem,images,displayMode:initial.displayMode==="source_image"&&changedDisplay?"corrected_source" as const:initial.displayMode};
 function edit(target:string|null){if(!busy&&!mediaLock.current)setEditTarget(target);}
 function remove(index:number){if(busy||mediaLock.current||choices.length<=2)return;setChoices(items=>items.filter((_,i)=>i!==index));setAccepted(items=>items.filter(i=>i!==index).map(i=>i>index?i-1:i));setEditTarget(null);}
 function addChoice(){if(busy||mediaLock.current||choices.length>=10)return;const key=crypto.randomUUID();setChoices(items=>[...items,{key,label:choiceLabel(items.length),text:"",images:[]}]);setEditTarget(key);}
 function submit(resolve:boolean){if(busy||mediaLock.current)return;const answers=[...accepted].sort((a,b)=>a-b);const patch:QuestionContent={schemaVersion:2,stem,images,choices:choices.map((c,i)=>({label:choiceLabel(i),text:c.text,images:c.images})),answer:answers[0],acceptedAnswers:answers,explanation};
   try{validatePatch(patch);if(!reason.trim()||reason.length>2000)throw new Error();}catch{setValidation("문제·보기(2~10개)·정답 체크·수정 사유를 확인해 주세요.");return;}
   if(resolve&&!window.confirm("수정을 저장하고 이 신고를 검수 완료로 처리할까요?"))return;setValidation("");void onSave(patch,reason,resolve);
 }
 const media=(value:string[],onChange:(value:string[])=>void,label:string)=><details className="question-editor-media"><summary>{label} {value.length?`(${value.length}장)`:"추가"}</summary><QuestionImageEditor images={value} onChange={onChange} questionRef={data.question.id} qualificationCode={data.question.certId} disabled={locked} beginWork={beginWork} endWork={endWork}/></details>;
 const content=<>
  <header className="question-editor-workspace-head"><div><h2>문항 편집</h2><span>{data.question.certId} · {data.question.no}번</span></div><button type="button" autoFocus className="button button-ghost" disabled={locked} aria-label="문항 편집 닫기" onClick={()=>{if(!busy&&!mediaLock.current)onClose?.();}}>닫기</button></header>
  <form className="question-manual-form exam-redesign" onSubmit={e=>{e.preventDefault();submit(false);}}>
  {reportMemo&&<details className="question-editor-report" open><summary>신고 내용</summary><p>{reportMemo}</p></details>}
  <p className="question-editor-guide">풀이 화면을 보면서 필요한 부분만 수정하세요. 정답은 보기 옆에서 체크합니다.</p>
  <fieldset className="question-review-fields" disabled={locked}>
   <article className="exam-content cbt-live-question question-editor-preview">
    <div className="question-editor-heading"><p className="question-number">문제 {data.question.no}</p><button type="button" className="button button-ghost" disabled={locked} aria-label={editTarget==="stem"?"본문 수정 닫기":"문제 본문 수정"} onClick={()=>edit(editTarget==="stem"?null:"stem")}>{editTarget==="stem"?"수정 닫기":"본문 수정"}</button></div>
    {editTarget==="stem"?<label className="question-inline-field">문제 본문<textarea aria-label="문제 본문" autoFocus maxLength={20000} rows={4} value={stem} onChange={e=>setStem(e.target.value)}/></label>:<QuestionBody question={preview}/>}
    {media(images,setImages,"문제 사진 편집")}
    <p className="question-editor-answer-hint">복수 정답 가능 · 체크한 보기 중 하나를 고르면 정답 처리됩니다.</p>
    <div className="choice-list">{choices.map((choice,index)=><div className={`choice-button question-inline-choice${accepted.includes(index)?" is-correct":""}`} key={choice.key} data-choice-key={choice.key}>
     <b className="choice-number">{index+1}</b><div className="question-inline-choice-main">
      {editTarget===choice.key?<label className="question-inline-field">{choiceLabel(index)} 보기<textarea autoFocus aria-label={`${choiceLabel(index)} 보기 텍스트`} maxLength={10000} rows={3} value={choice.text} onChange={e=>setChoices(items=>items.map(c=>c.key===choice.key?{...c,text:e.target.value}:c))}/></label>:<QuestionChoiceContent choice={{...choice,label:choiceLabel(index)}} sourceImage={preview.displayMode==="source_image"}/>}
      {media(choice.images,value=>setChoices(items=>items.map(c=>c.key===choice.key?{...c,images:value}:c)),`${choiceLabel(index)} 사진 편집`)}
      <button type="button" className="button button-ghost question-choice-delete" hidden={editTarget!==choice.key} disabled={locked||choices.length<=2} aria-label={`${choiceLabel(index)} 보기 삭제`} onClick={()=>remove(index)}>이 보기 삭제</button>
     </div><div className="question-inline-choice-actions"><label className="question-inline-answer"><input type="checkbox" aria-label={`${choiceLabel(index)} 정답`} checked={accepted.includes(index)} onChange={e=>setAccepted(items=>e.target.checked?[...items,index]:items.filter(i=>i!==index))}/>정답</label><button type="button" className="button button-ghost" disabled={locked} aria-label={editTarget===choice.key?`${choiceLabel(index)} 수정 닫기`:`${choiceLabel(index)} 보기 수정`} onClick={()=>edit(editTarget===choice.key?null:choice.key)}>{editTarget===choice.key?"수정 닫기":"수정"}</button></div>
    </div>)}</div>
    <button type="button" className="button button-ghost question-editor-add" disabled={locked||choices.length>=10} onClick={addChoice}>보기 추가</button>
    <section className="question-editor-explanation"><div className="question-editor-heading"><h3>해설</h3><button type="button" className="button button-ghost" disabled={locked} aria-label={editTarget==="explanation"?"해설 수정 닫기":"해설 수정"} onClick={()=>edit(editTarget==="explanation"?null:"explanation")}>{editTarget==="explanation"?"수정 닫기":"수정"}</button></div>{editTarget==="explanation"?<label className="question-inline-field">해설<textarea autoFocus maxLength={20000} rows={4} value={explanation} onChange={e=>setExplanation(e.target.value)}/></label>:<p>{explanation||"등록된 해설이 없습니다."}</p>}</section>
   </article>
   <label className="question-editor-reason">수정 사유 (로그에 저장)<textarea required maxLength={2000} rows={2} placeholder="무엇을 수정했는지 적어주세요." value={reason} onChange={e=>setReason(e.target.value)}/></label>
   <details className="question-editor-details"><summary>문항 정보·최신 내용 다시 불러오기</summary><p>{data.question.certId} · {data.question.no}번 · 수정 버전 {data.version}. 문항 ID와 원본은 유지되며 이전 점수는 다시 계산하지 않습니다.</p><button type="button" className="button button-ghost" disabled={locked} onClick={()=>{if(window.confirm("입력을 버리고 최신 문항을 불러올까요?"))onReload();}}>최신 문항 다시 불러오기</button></details>
  </fieldset>
  <div className="question-editor-savebar"><span role={!locked&&(validation||error)?"alert":"status"} className={!locked&&(validation||error)?"question-review-error":undefined}>{busy?"저장 중…":mediaBusy?"사진 처리 중…":validation||error||notice||"저장 전에는 운영 문항이 바뀌지 않습니다."}</span><div className="admin-card-actions"><button type="submit" className="button button-primary" disabled={locked}>수정 저장</button>{hasReport&&<button type="button" className="button button-primary" disabled={locked} onClick={()=>submit(true)}>저장 후 검수 완료</button>}</div></div>
 </form></>;
 return embedded?<section className="question-editor-workspace is-embedded" aria-label="현재 문항 편집">{content}</section>:<dialog ref={dialogRef} className="question-editor-workspace" aria-label="문항 집중 편집" onCancel={e=>{e.preventDefault();if(!busy&&!mediaLock.current)onClose?.();}}>{content}</dialog>;
}
