"use client";
import {useEffect,useMemo,useState} from 'react';
import {getPublicSupabaseConfig} from '@/lib/public-supabase-config';
import {getSupabaseBrowserClient} from '@/lib/supabase-browser';
import {derivePeriod} from '@/lib/admin-analytics-view.mjs';
import {propertyToday} from '@/supabase/functions/_shared/analytics-contract.mjs';
import {validateExamUsageRequest,normalizeExamUsage,sortExamUsage,examUsageCsv} from '@/supabase/functions/_shared/exam-usage.mjs';
import type {ExamUsageRequest,ExamUsageData,ExamUsageRow} from '@/supabase/functions/_shared/exam-usage.mjs';

export function ExamUsageTable({rows,groupBy}:{rows:ExamUsageRow[];groupBy:ExamUsageRequest['groupBy']}) {
  return <div className="analytics-table-scroll analytics-exam-table"><table><caption className="sr-only">많이 응시한 시험 순위</caption><thead><tr><th scope="col">순위</th><th scope="col">종목</th>{groupBy==='exam'&&<th scope="col">회차</th>}<th scope="col">응시 수</th><th scope="col">완료 수</th><th scope="col">응시 회원 수</th><th scope="col">완료율</th></tr></thead><tbody>{rows.map((row,index)=><tr key={`${row.qualification}:${row.examKey}`}><td>{index+1}</td><th scope="row">{row.qualification}</th>{groupBy==='exam'&&<td>{row.examLabel}</td>}<td>{row.starts.toLocaleString('ko-KR')}</td><td>{row.completions.toLocaleString('ko-KR')}</td><td>{row.users.toLocaleString('ko-KR')}</td><td>{row.completionRate.toFixed(1)}%</td></tr>)}</tbody></table></div>;
}
export function AdminExamUsage() {
  const today=propertyToday(new Date(),'Asia/Seoul');
  const [days,setDays]=useState<7|30|90|0>(30),[custom,setCustom]=useState(derivePeriod(30,today));
  const [groupBy,setGroupBy]=useState<ExamUsageRequest['groupBy']>('qualification'),[sort,setSort]=useState<'starts'|'completions'|'users'|'completionRate'>('starts');
  const [data,setData]=useState<ExamUsageData|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[refresh,setRefresh]=useState(0),[fetchedAt,setFetchedAt]=useState('');
  const request=useMemo<ExamUsageRequest>(()=>({...days?derivePeriod(days,today):custom,groupBy}),[days,today,custom,groupBy]);
  useEffect(()=>{
    const controller=new AbortController();setData(null);setFetchedAt('');setError('');
    try{validateExamUsageRequest(request,new Date());}catch{setBusy(false);setError('기간은 오늘까지 최대 90일로 선택하세요.');return;}
    setBusy(true);
    void (async()=>{
      try{
        const session=(await getSupabaseBrowserClient().auth.getSession()).data.session;
        if(controller.signal.aborted)return;if(!session)throw Error('로그인이 필요합니다.');
        const config=getPublicSupabaseConfig();
        const response=await fetch(`${config.url}/functions/v1/admin-exam-usage`,{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,apikey:config.key,'Content-Type':'application/json'},body:JSON.stringify(request),signal:controller.signal});
        if(!response.ok)throw Error(response.status===401||response.status===403?'관리자 권한을 확인하세요.':'응시 기록을 불러오지 못했습니다. 다시 조회해 주세요.');
        const reply=await response.json(),next=normalizeExamUsage(reply.data);
        if(!controller.signal.aborted){setData(next);setFetchedAt(reply.meta?.fetchedAt||'');}
      }catch(reason){if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:'응시 기록을 불러오지 못했습니다.');}
      finally{if(!controller.signal.aborted)setBusy(false);}
    })();return ()=>controller.abort();
  },[request,refresh]);
  const rows=useMemo(()=>sortExamUsage(data?.rows||[],sort),[data,sort]);
  function download(){const url=URL.createObjectURL(new Blob([examUsageCsv(rows,{...request,truncated:data?.truncated===true})],{type:'text/csv;charset=utf-8;'})),link=document.createElement('a');link.href=url;link.download=`passmate-popular-exams-${request.startDate}-${request.endDate}.csv`;link.click();URL.revokeObjectURL(url);}
  return <section className="store-admin-view analytics-panel" aria-label="인기 시험">
    <div className="analytics-heading"><div><h2>어떤 시험을 많이 응시했나요?</h2><p>회원이 저장한 실제 응시 기록을 종목과 회차별로 비교하세요.</p></div><button className="button button-ghost" onClick={()=>setRefresh(value=>value+1)} disabled={busy}>다시 조회</button></div>
    <div className="analytics-toolbar"><label>기간<select value={days} onChange={event=>setDays(Number(event.target.value) as typeof days)}><option value={7}>최근 7일</option><option value={30}>최근 30일</option><option value={90}>최근 90일</option><option value={0}>직접 선택</option></select></label>{days===0&&<><label>시작일<input type="date" max={today} value={custom.startDate} onChange={event=>setCustom({...custom,startDate:event.target.value})}/></label><label>종료일<input type="date" max={today} value={custom.endDate} onChange={event=>setCustom({...custom,endDate:event.target.value})}/></label></>}<label>묶음<select value={groupBy} onChange={event=>setGroupBy(event.target.value as typeof groupBy)}><option value="qualification">종목별</option><option value="exam">종목 · 회차별</option></select></label><label>정렬<select value={sort} onChange={event=>setSort(event.target.value as typeof sort)}><option value="starts">응시 많은 순</option><option value="completions">완료 많은 순</option><option value="users">응시 회원 많은 순</option><option value="completionRate">완료율 높은 순</option></select></label><button className="button button-ghost" disabled={!rows.length||busy} onClick={download}>CSV 내려받기</button></div>
    <p className="analytics-note">한국 시간 기준으로 선택한 기간에 시작한 응시와 현재 완료 상태를 집계합니다. 같은 회원의 재응시는 별도 응시로 세며, 비회원 기록과 탈퇴 등으로 회원 식별자가 없는 기록은 포함하지 않습니다.</p>
    {busy&&<p role="status">응시 기록을 불러오는 중입니다.</p>}{error&&<p role="alert">{error}</p>}
    {data&&<><div className="analytics-metrics">{[['총 응시',data.totals.starts],['완료한 응시',data.totals.completions],['응시 회원',data.totals.users]].map(([label,value])=><div className="analytics-metric" key={label}><span>{label}</span><strong>{Number(value).toLocaleString('ko-KR')}</strong></div>)}</div>{data.truncated&&<p role="status">응시 수 기준 상위 500개 항목 안에서 정렬합니다. 위 합계는 선택한 기간의 전체 기록입니다.</p>}{rows.length?<ExamUsageTable rows={rows} groupBy={groupBy}/>:<p className="analytics-empty">선택한 기간에 저장된 회원 응시 기록이 없습니다.</p>}<p className="analytics-note">조회 시각: {fetchedAt?new Date(fetchedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}):'—'} · 회차 이름이 등록되지 않은 기록은 원래 회차 코드로 표시합니다.</p></>}
  </section>;
}
