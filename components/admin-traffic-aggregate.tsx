"use client";
import {useEffect,useMemo,useState} from 'react';
import {getSupabaseBrowserClient} from '@/lib/supabase-browser';
import {getPublicSupabaseConfig} from '@/lib/public-supabase-config';
import {derivePeriod} from '@/lib/admin-analytics-view.mjs';
import {aggregateToday,emptyAggregateReport,formatAggregateTime,aggregateRowLabel,buildAggregateCsv,createAggregateReportLoader,type AggregateResponse} from '@/lib/admin-traffic-aggregate-view.mjs';
import {validateAggregateRequest,type AggregateRequest,type AggregateRow} from '@/supabase/functions/_shared/traffic-aggregate-contract.mjs';
const tabs=[{key:'date',label:'일별 추이'},{key:'source',label:'유입 경로'},{key:'page',label:'인기 공개 페이지'}] as const;
const number=(n:number)=>n.toLocaleString('ko-KR');
export function TrafficAggregateTable({rows}:{rows:AggregateRow[]}){
 if(!rows.length)return <p className="analytics-empty">선택한 기간에 수신된 집계가 없습니다.</p>;
 return <div className="analytics-table-scroll"><table><caption className="sr-only">자체 기본 집계, 상위 100개 항목</caption><thead><tr><th scope="col">항목</th><th scope="col">조회수</th><th scope="col">방문 시작 수</th><th scope="col">총 활성 시간</th><th scope="col">조회당 활성 시간</th></tr></thead><tbody>{rows.map(r=><tr key={r.key}><th scope="row">{aggregateRowLabel(r.key)}</th><td>{number(r.metrics.pageViews)}</td><td>{number(r.metrics.visitStarts)}</td><td>{formatAggregateTime(r.metrics.activeMs,1)}</td><td>{formatAggregateTime(r.metrics.activeMs,r.metrics.pageViews)}</td></tr>)}</tbody></table></div>;
}
function AggregateTrend({rows}:{rows:AggregateRow[]}){
 if(!rows.length)return null;const maximum=Math.max(1,...rows.map(r=>r.metrics.pageViews));
 return <figure className="analytics-trend"><figcaption>수신일별 페이지 조회수</figcaption><svg viewBox="0 0 720 180" role="img" aria-label="한국 날짜별 조회수. 아래 표에서 정확한 값을 확인하세요."><line x1="36" x2="700" y1="150" y2="150" stroke="var(--line)"/><polyline fill="none" stroke="var(--blue)" strokeWidth="2.5" points={rows.map((r,i)=>`${36+i/Math.max(1,rows.length-1)*664},${150-r.metrics.pageViews/maximum*125}`).join(' ')}/>{rows.length===1&&<circle cx="36" cy={150-rows[0].metrics.pageViews/maximum*125} r="4" fill="var(--blue)"/>}</svg></figure>;
}
export function AdminTrafficAggregate(){
 const today=aggregateToday(new Date()),[days,setDays]=useState<7|30|90|null>(30),[custom,setCustom]=useState(derivePeriod(30,today)),[dimension,setDimension]=useState<AggregateRequest['dimension']>('date'),[response,setResponse]=useState<AggregateResponse|null>(null),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0);
 const request=useMemo<AggregateRequest>(()=>({...days?derivePeriod(days,today):custom,dimension}),[days,today,custom,dimension]);
 const loader=useMemo(()=>createAggregateReportLoader(async(value,signal)=>{
  const session=(await getSupabaseBrowserClient().auth.getSession()).data.session;if(!session)return emptyAggregateReport('error','permission');
  const cfg=getPublicSupabaseConfig();const reply=await fetch(`${cfg.url}/functions/v1/admin-traffic-aggregate`,{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,apikey:cfg.key,'Content-Type':'application/json'},body:JSON.stringify(value),signal});
  if(!reply.ok)return emptyAggregateReport('error',reply.status===401||reply.status===403?'permission':reply.status===404?'configuration':'network');
  const data=await reply.json();if(!data?.meta||data.meta.source!=='firstParty'||!['ok','noData','notConfigured','error'].includes(data.status))return emptyAggregateReport('error','query');return data as AggregateResponse;
 }),[]);
 useEffect(()=>{
  let cancelled=false;setResponse(null);
  if(!validateAggregateRequest(request,today)){setResponse(emptyAggregateReport('error','query'));setBusy(false);return;}
  setBusy(true);void loader.load(request,setResponse).catch(()=>{if(!cancelled)setResponse(emptyAggregateReport('error','network'));}).finally(()=>{if(!cancelled)setBusy(false);});
  return ()=>{cancelled=true;loader.cancel();};
 },[loader,request,today,refresh]);
 const download=()=>{if(!response)return;const csv=buildAggregateCsv(response,request);if(!csv)return;const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`PASSMATE-자체집계-${request.startDate}-${request.endDate}-${dimension}.csv`;a.click();URL.revokeObjectURL(url);};
 const totals=response?.status==='ok'?response.data?.totals:null;
 const message=response?.status==='notConfigured'?'연결 전입니다. 자체 집계 수집과 보고서 연결 상태를 확인하세요.':response?.status==='noData'?'측정 전 기간입니다. 도입 전 기록은 복원하지 않습니다.':response?.status==='error'?response.errorCode==='permission'?'관리자 권한을 확인하세요.':'집계를 불러오지 못했습니다. 기간과 연결 상태를 확인하고 다시 조회하세요.':'';
 return <section className="admin-analytics" aria-labelledby="aggregate-title"><header className="analytics-heading"><div><h2 id="aggregate-title">방문 분석 · 자체 기본 집계</h2><p>식별자 없이 공개 학습 화면의 이용량을 집계합니다. GA4 수치와 합산하지 않습니다.</p></div></header>
 <div className="analytics-filters"><label>기간<select value={days??'custom'} onChange={e=>setDays(e.target.value==='custom'?null:Number(e.target.value) as 7|30|90)}><option value="7">최근 7일</option><option value="30">최근 30일</option><option value="90">최근 90일</option><option value="custom">직접 선택</option></select></label>{days===null&&<><label>시작일<input type="date" min={derivePeriod(90,today).startDate} max={today} value={custom.startDate} onChange={e=>setCustom({...custom,startDate:e.target.value})}/></label><label>종료일<input type="date" min={custom.startDate} max={today} value={custom.endDate} onChange={e=>setCustom({...custom,endDate:e.target.value})}/></label></>}<button type="button" disabled={busy} onClick={()=>setRefresh(v=>v+1)}>다시 조회</button></div>
 <nav className="analytics-tabs" aria-label="자체 집계 보고서">{tabs.map(t=><button key={t.key} type="button" aria-pressed={dimension===t.key} onClick={()=>setDimension(t.key)}>{t.label}</button>)}</nav>
 <div aria-busy={busy}>{busy&&<p role="status">집계를 불러오는 중입니다.</p>}{message&&<p className="analytics-status" role={response?.status==='error'?'alert':'status'}>{message}</p>}
 {totals&&response?.data&&<><div className="analytics-metrics"><div className="analytics-metric"><span>방문 시작 수</span><strong>{number(totals.visitStarts)}</strong><small>순방문자 수와 다름</small></div><div className="analytics-metric"><span>페이지 조회</span><strong>{number(totals.pageViews)}</strong><small>반복 조회 포함</small></div><div className="analytics-metric"><span>총 활성 화면 시간</span><strong>{formatAggregateTime(totals.activeMs,1)}</strong><small>보이는 화면 · 포커스 기준</small></div><div className="analytics-metric"><span>조회당 활성 시간</span><strong>{formatAggregateTime(totals.activeMs,totals.pageViews)}</strong><small>총 활성 시간 / 총 조회수</small></div></div>
 {dimension==='date'&&<AggregateTrend rows={response.data.rows}/>}<div className="analytics-table-heading"><h3>{tabs.find(t=>t.key===dimension)?.label}</h3><button type="button" disabled={busy} onClick={download}>CSV 내보내기</button></div><TrafficAggregateTable rows={response.data.rows}/></>}
 {response&&<p className="analytics-note">출처: PASSMATE 자체 집계 · 한국 수신일 기준 · 표 상위 100행{response.meta.fetchedAt&&` · 조회 ${new Date(response.meta.fetchedAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}`}{response.meta.measurementStartedAt&&` · 측정 시작 ${new Date(response.meta.measurementStartedAt).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'})}`}{response.meta.partialToday&&' · 오늘은 갱신 중'}{response.meta.thresholded&&' · 조회 5회 미만 항목은 소량 항목으로 묶음'}</p>}
 {response?.meta.measurementStartedAt&&!response.meta.maintenanceHealthy&&<p className="analytics-status" role="alert">보관 기간 정리 상태를 확인해야 합니다.</p>}
 </div><details className="analytics-help"><summary>지표의 범위</summary><p>새 탭·새로고침은 방문 시작으로 다시 셀 수 있습니다. 활성 시간은 사람이 집중한 시간을 보장하지 않습니다. 거절·브라우저 차단·종료·네트워크 장애로 일부 이용이 누락되며 봇 트래픽이 포함될 수 있습니다. 날짜·유입·페이지는 독립된 합계이며 개인별 이동 기록을 제공하지 않습니다. 수신일 이전에 관측한 시간이 수신일에 반영될 수 있습니다.</p><p>과거 날짜 중 측정 시작 전 구간은 측정 전입니다. 나라·도시·기기와 풀이 이벤트는 ‘GA4 동의자 분석’, 회원 응시는 ‘인기 시험’에서 각각 확인하세요.</p></details></section>;
}
