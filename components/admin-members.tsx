"use client";

import {useEffect,useMemo,useRef,useState} from 'react';
import {getSupabaseBrowserClient} from '@/lib/supabase-browser';
import {getPublicSupabaseConfig} from '@/lib/public-supabase-config';
import {memberPeriod,type Member,type MemberSummary,type MemberList,type MemberDetail,type MemberResponse} from '@/lib/admin-members.mjs';
import type {AnalyticsResponse} from '@/supabase/functions/_shared/analytics-contract.mjs';
import type {AggregateResponse} from '@/lib/admin-traffic-aggregate-view.mjs';

const number=(value:number|null|undefined)=>typeof value==='number'?value.toLocaleString('ko-KR'):'—';
const date=(value:string|null)=>value?new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'기록 없음';
const providerName=(value:string)=>({email:'이메일',google:'Google',kakao:'카카오'})[value]||'기타';

function useAdminReport<T>(name:string,input:object,revision=0){
  const key=JSON.stringify(input);
  const [state,setState]=useState<{key:string;data:T|null;error:string;busy:boolean}>({key:'',data:null,error:'',busy:true});
  useEffect(()=>{
    const controller=new AbortController();let active=true;
    const timeout=setTimeout(()=>controller.abort(),15000);
    setState({key,data:null,error:'',busy:true});
    void (async()=>{
      try{
        const {data}=await getSupabaseBrowserClient().auth.getSession();
        if(!data.session)throw Error('session');
        const config=getPublicSupabaseConfig();
        const response=await fetch(`${config.url}/functions/v1/${name}`,{method:'POST',cache:'no-store',credentials:'omit',headers:{Authorization:`Bearer ${data.session.access_token}`,apikey:config.key,'Content-Type':'application/json'},body:key,signal:controller.signal});
        if(!response.ok)throw Error(response.status===401||response.status===403?'permission':response.status===404?'configuration':'network');
        const result=await response.json() as T;
        if(active)setState({key,data:result,error:'',busy:false});
      }catch(error){
        if(active){const code=error instanceof Error?error.message:'';setState({key,data:null,busy:false,error:code==='permission'||code==='session'?'관리자 로그인과 권한을 확인해 주세요.':code==='configuration'?'회원 조회 서버 연결이 필요합니다. 배포 설정을 확인한 뒤 다시 조회해 주세요.':'데이터를 불러오지 못했습니다. 다시 조회해 주세요.'});}
      }finally{clearTimeout(timeout);}
    })();
    return()=>{active=false;clearTimeout(timeout);controller.abort();};
  },[name,key,revision]);
  return state.key===key?state:{key,data:null,error:'',busy:true};
}

export function AudienceMetric({label,value,note,busy=false}:{label:string;value?:number|null;note:string;busy?:boolean}){
  return <div className="audience-metric"><span>{label}</span><strong>{busy?<span className="audience-skeleton" aria-label="불러오는 중"/>:number(value)}</strong><small>{note}</small></div>;
}

export function SignupTrend({rows}:{rows:MemberSummary['trend']}){
  if(!rows.length)return null;
  const max=Math.ceil(Math.max(2,...rows.map(row=>row.count))/2)*2;
  const width=640/rows.length;
  return <figure className="audience-trend"><figcaption>일별 회원가입</figcaption>
    <div className="audience-plot"><div className="audience-axis" aria-hidden="true"><span>{number(max)}</span><span>{number(max/2)}</span><span>0</span></div><div>
      <svg viewBox="0 0 640 160" preserveAspectRatio="none" role="img" aria-label="한국 시간 기준 일별 가입 수. 아래 수치 보기에서 날짜별 값을 확인할 수 있습니다.">
        {[0,.5,1].map(ratio=><line key={ratio} x1="0" x2="640" y1={152-ratio*144} y2={152-ratio*144}/>)}
        {rows.map((row,index)=><rect key={row.date} x={index*width+2} y={152-row.count/max*144} width={Math.max(2,width-4)} height={row.count/max*144} rx="2"><title>{`${row.date}: ${row.count}명 가입`}</title></rect>)}
      </svg><div className="audience-axis-dates"><span>{rows[0].date.slice(5).replace('-','.')}</span><span>{rows.at(-1)!.date.slice(5).replace('-','.')}</span></div>
    </div></div>
    <details><summary>날짜별 수치 보기</summary><div className="audience-trend-values">{rows.map(row=><div key={row.date}><span>{row.date}</span><strong>{number(row.count)}명</strong></div>)}</div></details>
  </figure>;
}

export function AdminAudienceOverview({onMembers,onTraffic,revision=0}:{onMembers:()=>void;onTraffic:()=>void;revision?:number}){
  const [days,setDays]=useState(7),[retry,setRetry]=useState(0);
  const period=memberPeriod(days);
  const members=useAdminReport<MemberResponse<MemberSummary>>('admin-members',{view:'summary',...period},revision+retry);
  const traffic=useAdminReport<AggregateResponse>('admin-traffic-aggregate',{dimension:'date',...period},revision+retry);
  const ga=useAdminReport<AnalyticsResponse>('admin-analytics',{report:'overview',...period},revision+retry);
  const totals=members.data?.data.totals;
  const trafficOk=traffic.data?.status==='ok';
  const gaOk=ga.data?.status==='ok'||ga.data?.status==='stale';
  const problems=[members.error,traffic.error,ga.error,
    traffic.data&&!trafficOk?'방문 집계가 없거나 연결되지 않았습니다. 방문 분석에서 상태를 확인하세요.':'',
    ga.data&&!gaOk?'GA4 동의자 분석이 연결되지 않았거나 수집된 데이터가 없습니다.':'',
    ga.data?.status==='stale'?'GA4 최근 조회에 실패해 이전 집계를 표시합니다.':''].filter(Boolean);
  return <section className="admin-audience" aria-labelledby="audience-title">
    <header className="audience-heading"><div><h2 id="audience-title">방문과 회원</h2><p>사이트 이용 현황과 가입 흐름을 한눈에 확인하세요.</p></div>
      <div className="audience-controls"><label>기간<select value={days} onChange={e=>setDays(Number(e.target.value))}><option value="7">최근 7일</option><option value="30">최근 30일</option></select></label><button type="button" onClick={()=>setRetry(value=>value+1)}>다시 조회</button></div>
    </header>
    <div className="audience-metrics" aria-busy={members.busy||traffic.busy||ga.busy}>
      <AudienceMetric label="순방문자" value={gaOk?ga.data?.data?.totals.totalUsers:null} busy={ga.busy} note="GA4 · 상세 분석 동의자 기준"/>
      <AudienceMetric label="방문 시작 수" value={trafficOk?traffic.data?.data?.totals.visitStarts:null} busy={traffic.busy} note="자체 집계 · 재방문 포함"/>
      <AudienceMetric label="페이지 조회수" value={trafficOk?traffic.data?.data?.totals.pageViews:null} busy={traffic.busy} note="자체 집계 · 반복 조회 포함"/>
      <AudienceMetric label="전체 회원" value={totals?.totalMembers} busy={members.busy} note="현재 회원 · 관리자 포함"/>
      <AudienceMetric label="오늘 가입" value={totals?.joinedToday} busy={members.busy} note="한국 시간 00시 이후"/>
      <AudienceMetric label="최근 7일 가입" value={totals?.joined7Days} busy={members.busy} note="오늘을 포함한 7일"/>
      <AudienceMetric label="선택 기간 가입" value={totals?.joinedInPeriod} busy={members.busy} note={`${period.startDate} ~ ${period.endDate}`}/>
    </div>
    {problems.length>0&&<div className="audience-message" role="status">{[...new Set(problems)].map(problem=><p key={problem}>{problem}</p>)}</div>}
    {members.data&&<SignupTrend rows={members.data.data.trend}/>}
    <div className="audience-foot"><p>순방문자는 전체 방문자의 일부입니다. 탈퇴·삭제된 계정과 익명 계정은 회원 집계에서 제외합니다.</p><div><button type="button" onClick={onTraffic}>방문 분석</button><button type="button" className="audience-primary" onClick={onMembers}>회원 관리</button></div></div>
    <p className="audience-note">{members.data?`회원 조회 ${date(members.data.meta.fetchedAt)} · `:''}{ga.data?.meta.fetchedAt?`GA4 조회 ${date(ga.data.meta.fetchedAt)} · `:''}가입 추이는 현재 남아 있는 계정 기준이며, 과거 탈퇴까지 포함한 누적 가입 수가 아닙니다.</p>
  </section>;
}

export function MemberRows({rows,onSelect}:{rows:Member[];onSelect:(id:string)=>void}){
  return <ul className="audience-member-list">{rows.map(member=><li key={member.id}>
    <div className="audience-member-name"><strong>{member.displayName}</strong><span>{member.email||'이메일 없음'}</span></div>
    <div className="audience-member-date"><span>가입 {date(member.createdAt)}</span><span>최근 로그인 {date(member.lastSignInAt)}</span></div>
    <div className="audience-member-state"><span>{member.providers.map(providerName).join(' · ')}</span><span>{member.emailConfirmed?'이메일 인증됨':'이메일 미인증'}</span></div>
    <button type="button" onClick={()=>onSelect(member.id)} aria-label={`${member.displayName} 회원 상세 보기`}>상세 보기</button>
  </li>)}</ul>;
}

function MemberDetails({id,period,onClose,revision}:{id:string;period:{startDate:string;endDate:string};onClose:()=>void;revision:number}){
  const [retry,setRetry]=useState(0);
  const report=useAdminReport<MemberResponse<MemberDetail>>('admin-members',{view:'detail',...period,memberId:id},revision+retry);
  const focus=useRef<HTMLElement>(null);
  useEffect(()=>{focus.current?.focus();},[id]);
  const detail=report.data?.data;
  return <section className="audience-detail" ref={focus} tabIndex={-1} aria-labelledby="member-detail-title" aria-busy={report.busy}>
    <header className="audience-heading"><h3 id="member-detail-title">회원 상세</h3><button type="button" onClick={onClose}>상세 닫기</button></header>
    {report.busy&&<p role="status">회원 정보를 불러오는 중입니다.</p>}
    {report.error&&<div role="alert"><p>{report.error}</p><button type="button" onClick={()=>setRetry(value=>value+1)}>다시 조회</button></div>}
    {detail&&!detail.member&&<p role="status">회원이 없거나 삭제된 계정입니다.</p>}
    {detail?.member&&<><dl className="audience-member-info">
      {[['이름',detail.member.displayName],['이메일',detail.member.email||'이메일 없음'],['가입일',date(detail.member.createdAt)],['최근 로그인',date(detail.member.lastSignInAt)],['로그인 방식',detail.member.providers.map(providerName).join(' · ')],['이메일 인증',detail.member.emailConfirmed?'인증됨':'미인증']].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl>{detail.learning&&<><h4>저장된 학습 요약</h4><div className="audience-learning">
      {[['시작한 시험',detail.learning.starts],['완료한 시험',detail.learning.completed],['오답 기록 문항',detail.learning.wrongNotes],['북마크',detail.learning.bookmarks]].map(([label,value])=><div key={label}><span>{label}</span><strong>{number(Number(value))}</strong></div>)}
      <div><span>완료 시험 평균 점수</span><strong>{detail.learning.averageScore===null?'—':`${detail.learning.averageScore}점`}</strong></div>
    </div><p className="audience-note">계정에 저장된 전체 기간의 요약입니다. 오답 기록은 복습을 완료한 문항도 포함합니다. 비로그인·기기 안에만 저장된 기록은 포함하지 않습니다.</p></>}</>}
  </section>;
}

export function AdminMembers({revision=0}:{revision?:number}){
  const [days,setDays]=useState(30),[query,setQuery]=useState(''),[provider,setProvider]=useState('all'),[periodOnly,setPeriodOnly]=useState(false);
  const [filters,setFilters]=useState({query:'',provider:'all',periodOnly:false}),[page,setPage]=useState(1),[retry,setRetry]=useState(0),[selected,setSelected]=useState<string|null>(null);
  const period=memberPeriod(days);
  const input=useMemo(()=>({view:'members',...period,...filters,page}),[period.startDate,period.endDate,filters,page]);
  const report=useAdminReport<MemberResponse<MemberList>>('admin-members',input,revision+retry);
  const list=report.data?.data;
  const lastTrigger=useRef<HTMLButtonElement|null>(null);
  const closeDetail=()=>{setSelected(null);lastTrigger.current?.focus();};
  return <section className="admin-audience" aria-labelledby="members-title">
    <header className="audience-heading"><div><h2 id="members-title">회원 관리</h2><p>가입 정보와 계정에 저장된 학습 현황을 조회합니다.</p></div><button type="button" onClick={()=>setRetry(value=>value+1)}>다시 조회</button></header>
    <form className="audience-filters" onSubmit={event=>{event.preventDefault();setFilters({query:query.trim(),provider,periodOnly});setPage(1);setSelected(null);setRetry(value=>value+1);}}>
      <label className="audience-search">회원 검색<input type="search" placeholder="이름 또는 이메일" maxLength={100} value={query} onChange={event=>setQuery(event.target.value)}/></label>
      <label>로그인 방식<select value={provider} onChange={event=>setProvider(event.target.value)}><option value="all">전체</option><option value="email">이메일</option><option value="google">Google</option><option value="kakao">카카오</option></select></label>
      <label>가입 기간<select value={days} onChange={event=>{setDays(Number(event.target.value));setPage(1);setSelected(null);}}><option value="7">최근 7일</option><option value="30">최근 30일</option></select></label>
      <label className="audience-check"><input type="checkbox" checked={periodOnly} onChange={event=>setPeriodOnly(event.target.checked)}/>선택 기간 가입자만</label>
      <button className="audience-primary" type="submit">검색</button>
    </form>
    <div aria-busy={report.busy}>
      {report.busy&&<p className="audience-message" role="status">회원 목록을 불러오는 중입니다.</p>}
      {report.error&&<div className="audience-message" role="alert"><p>{report.error}</p><button type="button" onClick={()=>setRetry(value=>value+1)}>다시 조회</button></div>}
      {list&&<><p className="audience-list-count" role="status">검색 결과 <strong>{number(list.total)}명</strong><span>{filters.periodOnly?`${period.startDate} ~ ${period.endDate} 가입`:'전체 가입 기간'} · 한국 시간 기준</span></p>
        {list.rows.length?<div onClickCapture={event=>{const button=(event.target as HTMLElement).closest('button');if(button)lastTrigger.current=button;}}><MemberRows rows={list.rows} onSelect={setSelected}/></div>:<p className="audience-message">조건에 맞는 회원이 없습니다. 검색어와 필터를 확인해 주세요.</p>}
        <nav className="audience-pagination" aria-label="회원 목록 페이지"><button type="button" disabled={page<=1} onClick={()=>{setPage(value=>value-1);setSelected(null);}}>이전</button><span>{page} / {Math.max(1,Math.ceil(list.total/20))} 페이지</span><button type="button" disabled={page*20>=list.total} onClick={()=>{setPage(value=>value+1);setSelected(null);}}>다음</button></nav>
      </>}
    </div>
    {selected&&<MemberDetails id={selected} period={period} onClose={closeDetail} revision={revision+retry}/>}
    <p className="audience-note">현재 회원만 표시하며 관리자 계정을 포함합니다. 삭제·익명 계정은 제외합니다. 회원 정보는 운영 목적으로만 확인해 주세요.</p>
  </section>;
}
