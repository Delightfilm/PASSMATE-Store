"use client";
import {useRef,useState} from "react";
import type {Question} from "@/lib/question-bank";
import {choiceLabel,validatePatch,type QuestionContent} from "@/supabase/functions/question-bank-admin/question-review";
import {QuestionImageEditor} from "./question-image-editor";
export type ReviewData={question:Pick<Question,"id"|"certId"|"no"|"images"|"acceptedAnswers"|"displayMode"> & QuestionContent;version:number;sourceHash:string};

export function ReviewEditor({data,busy,onSave,onReload,hasReport=true,onMediaBusy}:{data:ReviewData;busy:boolean;hasReport?:boolean;onMediaBusy:(busy:boolean)=>void;onSave:(patch:QuestionContent,reason:string,resolve:boolean)=>Promise<void>;onReload:()=>void}) {
 const mediaLock=useRef(false);const [mediaBusy,setMediaBusy]=useState(false);const locked=busy||mediaBusy;
 function beginWork(){if(mediaLock.current||busy)return false;mediaLock.current=true;setMediaBusy(true);onMediaBusy(true);return true;}
 function endWork(){mediaLock.current=false;setMediaBusy(false);onMediaBusy(false);}
 const [stem,setStem]=useState(data.question.stem);const [images,setImages]=useState([...data.question.images]);
 const [choices,setChoices]=useState(data.question.choices.map((choice,i)=>({...choice,key:String(i),images:[...(choice.images||[])]})));
 const [accepted,setAccepted]=useState(data.question.acceptedAnswers||[data.question.answer]);const [explanation,setExplanation]=useState(data.question.explanation);
 const [reason,setReason]=useState("");const [validation,setValidation]=useState("");
 function remove(index:number){setChoices(items=>items.filter((_,i)=>i!==index));setAccepted(items=>items.filter(i=>i!==index).map(i=>i>index?i-1:i));}
 function submit(resolve:boolean){if(busy||mediaLock.current)return;const answers=[...accepted].sort((a,b)=>a-b);const patch:QuestionContent={schemaVersion:2,stem,images,choices:choices.map((c,i)=>({label:choiceLabel(i),text:c.text,images:c.images})),answer:answers[0],acceptedAnswers:answers,explanation};
   try{validatePatch(patch);if(!reason.trim()||reason.length>2000)throw new Error();}catch{setValidation("문제·보기(2~10개)·정답 체크·수정 사유를 확인해 주세요.");return;}
   if(resolve&&!window.confirm("수정을 저장하고 이 신고를 검수 완료로 처리할까요?"))return;setValidation("");void onSave(patch,reason,resolve);
 }
 return <form className="question-manual-form" onSubmit={e=>{e.preventDefault();submit(false);}}><p className="admin-help">{data.question.certId} · {data.question.no}번 · 수정 버전 {data.version}. 문항 ID와 원본은 유지되며 이전 점수는 다시 계산하지 않습니다.</p>
  <fieldset className="question-review-fields" disabled={locked}><label>문제 본문<textarea required maxLength={20000} rows={6} value={stem} onChange={e=>setStem(e.target.value)} /></label><div><h4>문제 사진</h4><QuestionImageEditor images={images} onChange={setImages} questionRef={data.question.id} qualificationCode={data.question.certId} disabled={locked} beginWork={beginWork} endWork={endWork}/></div>
  {choices.map((choice,index)=><div className="question-choice-editor" key={choice.key}><label>{choiceLabel(index)} 보기<textarea aria-label={`${choiceLabel(index)} 보기 텍스트`} required={!choice.images.length} maxLength={10000} rows={3} value={choice.text} onChange={e=>setChoices(items=>items.map(c=>c.key===choice.key?{...c,text:e.target.value}:c))} /></label><QuestionImageEditor images={choice.images} onChange={value=>setChoices(items=>items.map(c=>c.key===choice.key?{...c,images:value}:c))} questionRef={data.question.id} qualificationCode={data.question.certId} disabled={locked} beginWork={beginWork} endWork={endWork}/><button type="button" className="button button-ghost" disabled={locked||choices.length<=2} onClick={()=>remove(index)}>{choiceLabel(index)} 보기 삭제</button></div>)}
  <button type="button" className="button button-ghost" disabled={locked||choices.length>=10} onClick={()=>setChoices(items=>[...items,{key:crypto.randomUUID(),label:choiceLabel(items.length),text:"",images:[]}])}>보기 추가</button>
  <fieldset className="question-answer-checkboxes"><legend>정답 선택 (복수 정답 가능)</legend><p className="admin-help">체크한 보기 중 어느 하나를 고르면 정답으로 처리됩니다.</p>{choices.map((choice,index)=><label key={choice.key}><input type="checkbox" checked={accepted.includes(index)} onChange={e=>setAccepted(items=>e.target.checked?[...items,index]:items.filter(i=>i!==index))} />{choiceLabel(index)} 정답</label>)}</fieldset>
  <label>해설<textarea maxLength={20000} rows={4} value={explanation} onChange={e=>setExplanation(e.target.value)} /></label><label>수정 사유 (로그에 저장)<textarea required maxLength={2000} rows={2} value={reason} onChange={e=>setReason(e.target.value)} /></label></fieldset>
  {validation&&<p className="question-review-error" role="alert">{validation}</p>}<div className="admin-card-actions"><button type="submit" className="button button-primary" disabled={locked}>{busy?"저장 중…":mediaBusy?"사진 처리 중…":"수정 저장"}</button>{hasReport&&<button type="button" className="button button-primary" disabled={locked} onClick={()=>submit(true)}>저장 후 검수 완료</button>}<button type="button" className="button button-ghost" disabled={locked} onClick={()=>{if(window.confirm("입력을 버리고 최신 문항을 불러올까요?"))onReload();}}>최신 문항 다시 불러오기</button></div>
 </form>;
}
