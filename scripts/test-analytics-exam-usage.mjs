import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('../supabase/functions/_shared/exam-usage.mjs').catch(()=>({}));
const now=new Date('2026-10-14T00:00:00Z');
const request={startDate:'2026-10-01',endDate:'2026-10-14',groupBy:'qualification'};
test('exam sheet accepts bounded calendar ranges and rejects identity injection',()=>{
  assert.equal(typeof api.validateExamUsageRequest,'function');
  assert.deepEqual(api.validateExamUsageRequest(request,now),request);
  for(const extra of [{userId:'someone'},{groupBy:'user'},{startDate:'2026-02-30'},{startDate:'2026-01-01'},{endDate:'2026-10-15'}])assert.throws(()=>api.validateExamUsageRequest({...request,...extra},now));
});
test('exam sheet preserves exact aggregates, no personal IDs, and cohort completion rate',()=>{
  assert.equal(typeof api.normalizeExamUsage,'function');
  const result=api.normalizeExamUsage({rows:[{qualification:'전기기능사',examKey:'mixed',examLabel:'여러 회차 · 맞춤',starts:4,completions:1,users:2,user_id:'private'}],totals:{starts:4,completions:1,users:2},truncated:false});
  assert.equal(result.rows[0].completionRate,25);assert.equal(result.totals.users,2);assert.ok(!JSON.stringify(result).includes('private'));
  assert.throws(()=>api.normalizeExamUsage({rows:[{starts:NaN}],totals:{}}));
});
test('exam sheet sorts with deterministic ties and exports safe Korean CSV',()=>{
  assert.equal(typeof api.sortExamUsage,'function');assert.equal(typeof api.examUsageCsv,'function');
  const rows=[{qualification:'지게차',examLabel:'2024',starts:2,completions:1,users:2,completionRate:50},{qualification:'=cmd',examLabel:'a,b',starts:5,completions:1,users:1,completionRate:20}];
  assert.equal(api.sortExamUsage(rows,'starts')[0].starts,5);assert.equal(api.sortExamUsage(rows,'completionRate')[0].starts,2);
  const csv=api.examUsageCsv(rows);assert.ok(csv.includes("'=cmd"));assert.ok(csv.includes('"a,b"'));assert.ok(csv.includes('응시 회원 수'));
});

test('exam CSV retains report scope and top-500 disclosure',()=>{
  const csv=api.examUsageCsv([],{...request,truncated:true});
  for(const text of ['2026-10-01','2026-10-14','Asia/Seoul','회원 응시 기록','종목별','상위 500'])assert.ok(csv.includes(text));
});
test('exam API refuses nonadmins before reading records and does not fake error totals',async()=>{
  assert.equal(typeof api.createExamUsageHandler,'function');let reads=0;
  const call=()=>new Request('https://example.com',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request)});
  const forbidden=api.createExamUsageHandler({resolveAdmin:async()=>403,query:async()=>{reads++;},now:()=>now});
  assert.equal((await forbidden(call())).status,403);assert.equal(reads,0);
  const failed=api.createExamUsageHandler({resolveAdmin:async()=>true,query:async()=>{throw Error('secret database details');},now:()=>now});
  const response=await failed(call());assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'exam_usage_unavailable'});
});
test('exam API returns aggregate-only data with private no-store caching',async()=>{
  const handler=api.createExamUsageHandler({resolveAdmin:async()=>true,query:async(value)=>{assert.deepEqual(value,request);return {rows:[],totals:{starts:0,completions:0,users:0},truncated:false};},now:()=>now});
  const response=await handler(new Request('https://example.com',{method:'POST',body:JSON.stringify(request)}));
  assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'private, no-store');
  assert.equal((await response.json()).meta.source,'member_attempts');
});
