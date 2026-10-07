"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {loadContentCatalog,loadContentBundle,type ContentCatalog} from "@/lib/question-bank-content";
import {loadQuestionCorrections} from "@/lib/question-bank-corrections";
import {loadPublishedDataset,type Dataset,type Question} from "@/lib/question-bank";

export function QuestionBankPicker({busy,onSelect}:{busy:boolean;onSelect:(question:Question)=>void}) {
 const [catalog,setCatalog]=useState<ContentCatalog>(); const [code,setCode]=useState("");
 const [data,setData]=useState<Dataset>(); const [exam,setExam]=useState(""); const [search,setSearch]=useState("");
 const [page,setPage]=useState(0); const [loading,setLoading]=useState(false); const [error,setError]=useState("");
 const request=useRef(0);
 useEffect(()=>{let live=true;void loadContentCatalog().then(value=>{if(live)setCatalog(value);}).catch(()=>{if(live)setError("종목 목록을 불러오지 못했습니다.");});return()=>{live=false;request.current++;};},[]);
 async function load(selected:string) {
   const id=++request.current;setCode(selected);setData(undefined);setExam("");setPage(0);setError("");
   if(!selected||(selected!=="__legacy__"&&!catalog)){setLoading(false);return;}setLoading(true);
   try {const value=await loadQuestionCorrections(selected==="__legacy__"?await loadPublishedDataset():await loadContentBundle(catalog!,selected));if(id===request.current)setData(value);}
   catch {if(id===request.current)setError("문항을 불러오지 못했습니다. 종목을 다시 선택해 주세요.");}
   finally {if(id===request.current)setLoading(false);}
 }
 const results=useMemo(()=>{const needle=search.trim().toLocaleLowerCase();return(data?.questions||[]).filter(q=>(!exam||q.examId===exam)&&(!needle||q.stem.toLocaleLowerCase().includes(needle)||String(q.no)===needle||q.id===needle));},[data,exam,search]);
 const pages=Math.max(1,Math.ceil(results.length/20));
 return <section className="admin-panel"><div className="admin-panel-head"><div><span className="eyebrow">MANUAL EDIT</span><h2>전체 문항 직접 수정</h2><p>자동 점검 없이 원하는 종목·회차·문항을 직접 찾아 수정합니다. 신고 접수는 계속 유지됩니다.</p></div></div>
  <div className="admin-form-grid"><label>종목 선택<select value={code} disabled={busy} onChange={e=>void load(e.target.value)}><option value="">종목을 선택해 주세요</option><option value="__legacy__">기존 DB 등록 문항 (전체 종목)</option>{catalog?.qualifications.map(q=><option key={q.code} value={q.code}>{q.title} ({q.code})</option>)}</select></label>
  <label>회차 선택<select value={exam} disabled={busy||!data} onChange={e=>{setExam(e.target.value);setPage(0);}}><option value="">전체 회차</option>{data?.exams.map(e=><option key={e.id} value={e.id}>{e.title||`${e.year}년 ${e.round}`}</option>)}</select></label>
  <label>문제 검색<input value={search} placeholder="본문 일부, 문항 번호 또는 ID" disabled={busy} onChange={e=>{setSearch(e.target.value);setPage(0);}} /></label></div>
  {loading&&<p role="status">선택한 종목의 문항을 불러오는 중…</p>}{error&&<p role="alert">{error}</p>}
  {data&&<><p className="admin-help">{results.length.toLocaleString()}문항 · {page+1}/{pages}페이지</p>{results.slice(page*20,page*20+20).map(q=><div className="record-row question-review-row" key={q.id}><span>{q.no}번 · {q.stem.slice(0,140)}<small>{data.exams.find(e=>e.id===q.examId)?.title||q.examId} · {q.choices.length}개 보기</small></span><button className="button button-primary" disabled={busy} onClick={()=>onSelect(q)}>직접 수정</button></div>)}<div className="admin-card-actions"><button className="button button-ghost" disabled={busy||page===0} onClick={()=>setPage(p=>p-1)}>이전 문항</button><button className="button button-ghost" disabled={busy||page+1>=pages} onClick={()=>setPage(p=>p+1)}>다음 문항</button></div></>}
 </section>;
}
