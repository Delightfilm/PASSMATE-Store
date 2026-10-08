"use client";
import {useEffect,useMemo,useRef,useState,type ReactNode} from "react";
import {loadContentCatalog,loadContentBundle,type ContentCatalog} from "@/lib/question-bank-content";
import {loadQuestionCorrections} from "@/lib/question-bank-corrections";
import {loadPublishedDataset,type Dataset,type Question} from "@/lib/question-bank";
import {QuestionExamReview} from "./question-exam-review";
import {examSelectionLabel} from "@/lib/question-bank-groups";

export function QuestionBankPicker({busy,onSelect,editor,updates={}}:{busy:boolean;onSelect:(question:Question)=>void;editor?:ReactNode;updates?:Record<string,Question>}) {
 const [catalog,setCatalog]=useState<ContentCatalog>(); const [code,setCode]=useState("");
 const [data,setData]=useState<Dataset>(); const [exam,setExam]=useState("");
 const [loading,setLoading]=useState(false); const [error,setError]=useState("");
 const request=useRef(0);const locked=busy||Boolean(editor);
 const updatesAtLoad=useRef<Record<string,Question>>({});
 useEffect(()=>{let live=true;void loadContentCatalog().then(value=>{if(live)setCatalog(value);}).catch(()=>{if(live)setError("종목 목록을 불러오지 못했습니다.");});return()=>{live=false;request.current++;};},[]);
 async function load(selected:string) {
   if(locked)return;
   updatesAtLoad.current=updates;
   const id=++request.current;setCode(selected);setData(undefined);setExam("");setError("");
   if(!selected||(selected!=="__legacy__"&&!catalog)){setLoading(false);return;}setLoading(true);
   try {const value=await loadQuestionCorrections(selected==="__legacy__"?await loadPublishedDataset():await loadContentBundle(catalog!,selected));if(id===request.current){setData(value);setExam(value.exams[0]?.id||"");}}
   catch {if(id===request.current)setError("문항을 불러오지 못했습니다. 종목을 다시 선택해 주세요.");}
   finally {if(id===request.current)setLoading(false);}
 }
 // Only overlay saves made since this load; a fresh server read wins over
 // older session patches (sourceHash intentionally does not change on edits).
 const questions=useMemo(()=>(data?.questions||[]).filter(q=>q.examId===exam).map(q=>updates[q.id]!==updatesAtLoad.current[q.id]&&updates[q.id]?.sourceHash===q.sourceHash?updates[q.id]:q),[data,exam,updates]);
 const selectedExam=data?.exams.find(e=>e.id===exam);
 const title=selectedExam?`${selectedExam.title} · ${selectedExam.year}년 ${examSelectionLabel(selectedExam,data!.certs)}`:exam;
 return <section className="admin-panel admin-question-browser"><div className="admin-panel-head"><div><h2>시험 화면에서 문항 수정</h2><p>종목·회차를 선택하고 실제 풀이 화면에서 문항을 확인하세요. 신고 접수는 계속 유지됩니다.</p></div></div>
  <div className="admin-exam-selectors"><label>종목 선택<select value={code} disabled={locked} onChange={e=>void load(e.target.value)}><option value="">종목을 선택해 주세요</option><option value="__legacy__">기존 DB 등록 문항 (전체 종목)</option>{catalog?.qualifications.map(q=><option key={q.code} value={q.code}>{q.title} ({q.code})</option>)}</select></label>
  <label>회차 선택<select value={exam} disabled={locked||!data} onChange={e=>{if(!locked)setExam(e.target.value);}}><option value="">회차를 선택해 주세요</option>{data?.exams.map(e=><option key={e.id} value={e.id}>{e.year}년 {examSelectionLabel(e,data.certs)} · {e.title}</option>)}</select></label></div>
  {loading&&<p role="status">선택한 종목의 문항을 불러오는 중…</p>}{error&&<p role="alert">{error}</p>}
  {data&&exam&&<QuestionExamReview key={`${code}:${exam}`} questions={questions} title={title} busy={busy} onEdit={onSelect} editor={editor}/>}
  {data&&!data.exams.length&&<p className="admin-empty">등록된 회차가 없습니다.</p>}
 </section>;
}
