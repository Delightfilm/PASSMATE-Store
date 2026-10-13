export function derivePeriod(days,today) {
  const date=new Date(`${today}T00:00:00Z`);
  if(![7,30,90].includes(days)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==today)throw Error('invalid_period');
  return {startDate:new Date(date.getTime()-(days-1)*86400000).toISOString().slice(0,10),endDate:today};
}
export function formatEngagement(seconds,sessions) {
  if(!Number.isFinite(seconds)||!Number.isFinite(sessions)||sessions<=0)return '—';
  const value=Math.max(0,Math.round(seconds/sessions));return `${Math.floor(value/60)}분 ${value%60}초`;
}
export function createReportLoader(fetchReport) {
  let controller=null,sequence=0;
  return {
    async load(request,onValue) {
      const id=++sequence;controller?.abort();const current=new AbortController();controller=current;
      try{const value=await fetchReport(request,current.signal);if(id===sequence&&!current.signal.aborted)onValue(value);}catch(error){if(id===sequence&&!current.signal.aborted)throw error;}
    },
    dispose(){sequence++;controller?.abort();},
  };
}
export function reportStateMessage(response) {
  if(response.status==='notConfigured')return 'GA4 연결이 필요합니다. 측정 ID와 관리자 보고서 연결을 설정하면 실제 방문 통계가 표시됩니다.';
  if(response.status==='noData')return '아직 수집된 데이터가 없습니다. 측정 시작 후 보고서에 반영되기까지 시간이 걸릴 수 있습니다.';
  if(response.status==='stale')return '최근 조회에 실패해 이전 집계를 표시합니다. 마지막 조회 시각을 확인하세요.';
  if(response.status==='error')return ({permission:'Google 보고서를 읽을 권한이 없습니다. 연결 계정의 속성 권한을 확인하세요.',quota:'조회 한도에 도달했습니다. 잠시 후 다시 조회하세요.',configuration:'보고서 연결 설정을 확인하세요. 종목별 집계는 GA4 종목 정의 등록도 필요합니다.',incompatible:'이 보고서의 지표와 필터 조합을 사용할 수 없습니다. 다른 필터로 조회하세요.',network:'보고서를 불러오지 못했습니다. 연결 상태를 확인하고 다시 조회하세요.'})[response.errorCode||'network'];
  return '';
}
export function buildAnalyticsCsv(response) {
  if(!response?.data)return '';
  const rows=response.data.rows;
  const dimensions=[...new Set(rows.flatMap(row=>Object.keys(row.dimensions)))],metrics=[...new Set(rows.flatMap(row=>Object.keys(row.metrics)))],columns=[...dimensions,...metrics];
  const cell=value=>{let text=String(value??'');if(/^[\s]*[=+\-@]/.test(text)||/^[\t\r\n]/.test(text))text="'"+text;return `"${text.replace(/"/g,'""')}"`;};
  return '\uFEFF'+[columns.map(cell).join(','),...rows.map(row=>columns.map(key=>cell(row.dimensions[key]??row.metrics[key]??'')).join(','))].join('\r\n');
}
