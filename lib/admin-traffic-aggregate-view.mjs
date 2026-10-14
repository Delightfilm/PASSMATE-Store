import {TRAFFIC_SOURCES} from '../supabase/functions/_shared/traffic-aggregate-contract.mjs';
export function aggregateToday(now){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function emptyAggregateReport(status='error',errorCode='query'){
 return {status,data:null,...(status==='error'?{errorCode}:{}),meta:{source:'firstParty',timezone:'Asia/Seoul',measurementStartedAt:null,fetchedAt:null,partialToday:false,rowLimit:100,thresholded:false,maintenanceHealthy:false}};
}
function validMetrics(m){return m&&Object.keys(m).length===3&&['pageViews','visitStarts','activeMs'].every(k=>Number.isSafeInteger(m[k])&&m[k]>=0)&&m.visitStarts<=m.pageViews;}
export function normalizeAggregateReport(raw,request,now){
 const error=emptyAggregateReport();
 if(!raw||typeof raw.enabled!=='boolean'||!validMetrics(raw.totals)||!Array.isArray(raw.rows)||raw.rows.length>100||raw.rows.some(r=>!r||Object.keys(r).length!==2||!validMetrics(r.metrics)||typeof r.key!=='string'||(request.dimension==='date'?!/^\d{4}-\d{2}-\d{2}$/.test(r.key):request.dimension==='source'?![...TRAFFIC_SOURCES,'small'].includes(r.key):!(/^(home|cbt|small)$/.test(r.key)||/^[qe]:[\p{L}\p{N}-]{1,200}$/u.test(r.key))))||new Set(raw.rows.map(r=>r.key)).size!==raw.rows.length)return error;
 const started=raw.measurementStartedAt;
 if(started!==null&&(typeof started!=='string'||!Number.isFinite(Date.parse(started))))return error;
 const meta={...error.meta,measurementStartedAt:started,fetchedAt:now.toISOString(),partialToday:request.endDate===aggregateToday(now),thresholded:raw.thresholded===true,maintenanceHealthy:raw.maintenanceHealthy===true};
 if(!raw.enabled)return {...emptyAggregateReport('notConfigured'),meta};
 if(!started||request.endDate<aggregateToday(new Date(started)))return {...emptyAggregateReport('noData'),meta};
 return {status:'ok',data:{totals:{...raw.totals},rows:structuredClone(raw.rows)},meta};
}
export function formatAggregateTime(activeMs,pageViews){
 if(!Number.isFinite(activeMs)||!Number.isFinite(pageViews)||pageViews<=0||activeMs<0)return '—';
 const seconds=Math.round(activeMs/pageViews/1000);return seconds<60?`${seconds}초`:`${Math.floor(seconds/60)}분 ${seconds%60}초`;
}
export function aggregateRowLabel(key){return ({home:'메인',cbt:'전체 문제은행',small:'소량 항목',naver:'네이버',google:'구글',daum:'다음',bing:'빙',social:'소셜',other:'기타 외부',unknown:'직접 / 알 수 없음'})[key]||key.replace(/^q:/,'').replace(/^e:/,'문제풀이 · ');}
export function buildAggregateCsv(response,request){
 if(response?.status!=='ok'||!response.data)return '';
 const cell=v=>{let s=String(v??'');if(/^[\s]*[=+\-@]/.test(s)||/^[\t\r\n]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
 const metricRow=(label,m)=>[label,m.pageViews,m.visitStarts,m.activeMs,formatAggregateTime(m.activeMs,m.pageViews)];
 const rows=[['출처',response.meta.source],['시간대',response.meta.timezone],['기간',request.startDate,request.endDate],['차원',request.dimension],['측정 시작',response.meta.measurementStartedAt],['조회 시각',response.meta.fetchedAt],['오늘 갱신 중',response.meta.partialToday],['표 행 제한',response.meta.rowLimit],['소량 항목 묶음',response.meta.thresholded],['보관 정리 정상',response.meta.maintenanceHealthy],['정의','방문 시작은 순방문자가 아님; 조회당 활성 시간=활성 밀리초/조회수; 서버 수신일 집계'],['항목','조회수','방문 시작 수','총 활성 밀리초','조회당 활성 시간'],metricRow('전체 합계',response.data.totals),...response.data.rows.map(r=>metricRow(aggregateRowLabel(r.key),r.metrics))];
 return '\uFEFF'+rows.map(r=>r.map(cell).join(',')).join('\r\n');
}
export function createAggregateReportLoader(fetchReport){let sequence=0,controller=null;return {async load(request,onValue){const id=++sequence;controller?.abort();controller=new AbortController();const signal=controller.signal;try{const value=await fetchReport(request,signal);if(id===sequence&&!signal.aborted)onValue(value);}catch(error){if(id===sequence&&!signal.aborted)throw error;}},cancel(){sequence++;controller?.abort();}};}
