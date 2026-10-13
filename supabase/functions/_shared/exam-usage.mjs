import {validateAnalyticsRequest} from './analytics-contract.mjs';
export function validateExamUsageRequest(input,now) {
  if(!input||Array.isArray(input)||Object.keys(input).some(key=>!['startDate','endDate','groupBy'].includes(key))||!['qualification','exam'].includes(input.groupBy))throw Error('invalid_exam_usage_request');
  validateAnalyticsRequest({report:'overview',startDate:input.startDate,endDate:input.endDate},now,'Asia/Seoul');
  return {startDate:input.startDate,endDate:input.endDate,groupBy:input.groupBy};
}
export function normalizeExamUsage(input) {
  const counts=value=>{const result={};for(const key of ['starts','completions','users']){const count=value?.[key];if(!Number.isSafeInteger(count)||count<0)throw Error('invalid_exam_usage_response');result[key]=count;}if(result.completions>result.starts||result.users>result.starts)throw Error('invalid_exam_usage_response');return result;};
  if(!input||!Array.isArray(input.rows)||input.rows.length>500)throw Error('invalid_exam_usage_response');
  const rows=input.rows.map(row=>{const metrics=counts(row);if(typeof row.qualification!=='string'||typeof row.examLabel!=='string'||typeof row.examKey!=='string')throw Error('invalid_exam_usage_response');return {qualification:row.qualification,examKey:row.examKey,examLabel:row.examLabel,...metrics,completionRate:metrics.starts?metrics.completions/metrics.starts*100:0};});
  return {rows,totals:counts(input.totals),truncated:input.truncated===true};
}
export function sortExamUsage(rows,key) {
  if(!['starts','completions','users','completionRate'].includes(key))throw Error('invalid_exam_usage_sort');
  return [...rows].sort((a,b)=>b[key]-a[key]||b.starts-a.starts||a.qualification.localeCompare(b.qualification,'ko')||a.examKey.localeCompare(b.examKey));
}
export function examUsageCsv(rows,scope) {
  const cell=value=>{let text=String(value);if(/^[\s]*[=+\-@]/.test(text)||/^[\t\r\n]/.test(text))text="'"+text;return `"${text.replace(/"/g,'""')}"`;};
  const notes=scope?[
    ['집계 출처','회원 응시 기록 · 비회원 및 회원 식별자가 없는 기록 제외'],
    ['기간',scope.startDate,scope.endDate,'Asia/Seoul · 시작 시점 기준 · 현재 완료 상태'],
    ['묶음',scope.groupBy==='exam'?'종목 · 회차별':'종목별'],
    ['범위',scope.truncated?'응시 수 기준 상위 500개 항목 안에서 정렬':'선택 기간의 전체 항목']
  ]:[];
  return '\uFEFF'+[...notes,['순위','종목','회차','응시 수','완료 수','응시 회원 수','완료율(%)'],...rows.map((row,index)=>[index+1,row.qualification,row.examLabel,row.starts,row.completions,row.users,row.completionRate.toFixed(1)])].map(row=>row.map(cell).join(',')).join('\r\n');
}
export function createExamUsageHandler({resolveAdmin,query,now}) {
  const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'private, no-store'};
  const json=(status,value)=>new Response(JSON.stringify(value),{status,headers});
  return async request=>{
    if(request.method==='OPTIONS')return new Response('ok',{headers});
    if(request.method!=='POST')return json(405,{error:'method_not_allowed'});
    try {
      const auth=await resolveAdmin(request);if(auth!==true)return json(auth===403?403:401,{error:'admin_required'});
      let input;try{input=validateExamUsageRequest(await request.json(),now());}catch{return json(400,{error:'invalid_exam_usage_request'});}
      const data=normalizeExamUsage(await query(input));
      return json(200,{data,meta:{source:'member_attempts',timezone:'Asia/Seoul',fetchedAt:now().toISOString(),...input}});
    }catch{return json(503,{error:'exam_usage_unavailable'});}
  };
}
