import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAggregatePacket,validateAggregateRequest,splitAggregateBuffer,mergeMetrics} from '../supabase/functions/_shared/traffic-aggregate-contract.mjs';
import {trafficPageKey,classifyTrafficSource,verifyTrafficPageKeys,resolveTrafficChoice} from '../lib/traffic-aggregate-policy.mjs';
const metrics=(pageViews=1,visitStarts=1,activeMs=5000)=>({pageViews,visitStarts,activeMs});
const buffer=(m=metrics())=>({totals:m,sources:[{key:'naver',metrics:{...m}}],pages:[{key:'q:전기기능사',metrics:{...m}}]});
const packet=(m=metrics())=>({version:1,nonce:'12345678-1234-4123-8123-123456789012',...buffer(m)});
const catalog=[{slug:'전기기능사'}];
test('accepts bounded marginal counters and rejects additional identifying fields',()=>{
 assert.deepEqual(parseAggregatePacket(packet(),1024),packet());
 for(const p of [{...packet(),memberId:'hidden'},{...packet(),totals:{...metrics(),ip:'1'}},{...packet(),pages:[{key:'home',metrics:metrics(),url:'private'}]}]) assert.equal(parseAggregatePacket(p,1024),null);
});
test('validates byte length, safe integer bounds and matching marginal sums',()=>{
 for(const size of [-1,NaN,8193]) assert.equal(parseAggregatePacket(packet(),size),null);
 for(const m of [metrics(21,1,1),metrics(1,1,60001),metrics(-1,0,0),metrics(1,2,0),metrics(NaN,0,0),metrics(1.5,0,0)]) assert.equal(parseAggregatePacket(packet(m),1024),null);
 assert.ok(parseAggregatePacket(packet(metrics(20,20,60000)),8192));
 const p=packet();p.pages[0].metrics.activeMs=1;assert.equal(parseAggregatePacket(p,1024),null);
 const duplicate=packet();duplicate.sources.push(duplicate.sources[0]);assert.equal(parseAggregatePacket(duplicate,1024),null);
});
test('public pathname keys exclude queries, attempt identifiers and private routes',()=>{
 for(const path of ['/cbt/전기기능사/exam/private-attempt/?token=secret','/admin/','/cbt/전기기능사?email=a','https://www.mypassmate.com/','/%zz','/cbt/미등록/']) assert.equal(trafficPageKey(path,catalog),null);
 assert.equal(trafficPageKey('/cbt/%EC%A0%84%EA%B8%B0%EA%B8%B0%EB%8A%A5%EC%82%AC/',catalog),'q:전기기능사');
 assert.equal(trafficPageKey('/cbt/전기기능사/exam/round1/',catalog),'e:전기기능사');
 assert.equal(trafficPageKey('/',catalog),'home');assert.equal(trafficPageKey('/cbt/',catalog),'cbt');
 assert.equal(verifyTrafficPageKeys(packet(),catalog),true);assert.equal(verifyTrafficPageKeys(packet(),[]),false);
});
test('referral classification uses domain boundaries without retaining raw URLs',()=>{
 const origin='https://www.mypassmate.com';
 for(const [url,want] of [['https://search.naver.com/?q=a','naver'],['https://naver.com.evil.test/?email=a','other'],['https://www.google.co.kr/search?q=a','google'],['https://www.mypassmate.com/cbt','unknown'],['','unknown'],['javascript:alert(1)','unknown'],['https://evilgoogle.com','other']]) assert.equal(classifyTrafficSource(url,origin),want);
});
test('existing refusal, GPC, invalid or unreadable storage never silently grant measurement',()=>{
 const choose=(legacyConsent=null,basicChoice=null,gpc=false,storageReadable=true)=>resolveTrafficChoice({legacyConsent,basicChoice,gpc,storageReadable});
 assert.deepEqual(choose(),{basic:true,ga4:false});assert.deepEqual(choose('granted'),{basic:true,ga4:true});
 for(const c of [choose('denied'),choose('granted','off'),choose('granted','on',true),choose(null,null,false,false),choose('invalid'),choose(null,'invalid')]) assert.deepEqual(c,{basic:false,ga4:false});
 assert.deepEqual(choose('denied','on'),{basic:true,ga4:false});
});
test('report dates exclude future, invalid dates, excessive ranges and cross filters',()=>{
 assert.deepEqual(validateAggregateRequest({startDate:'2026-10-01',endDate:'2026-10-14',dimension:'page'},'2026-10-14'),{startDate:'2026-10-01',endDate:'2026-10-14',dimension:'page'});
 for(const r of [{startDate:'2026-01-01',endDate:'2026-10-14',dimension:'page'},{startDate:'2026-10-01',endDate:'2026-10-15',dimension:'page'},{startDate:'2026-02-30',endDate:'2026-03-01',dimension:'source'},{startDate:'2026-10-01',endDate:'2026-10-14',dimension:'page',source:'naver'}]) assert.equal(validateAggregateRequest(r,'2026-10-14'),null);
});
test('splitting preserves each marginal sum and keeps every packet within limits',()=>{
 const original=buffer(metrics(40,3,120000)); const parts=splitAggregateBuffer(original);
 assert.ok(parts.length>=2);
 const sum={totals:metrics(0,0,0),sources:metrics(0,0,0),pages:metrics(0,0,0)};
 for(const part of parts){assert.ok(parseAggregatePacket({version:1,nonce:packet().nonce,...part},Buffer.byteLength(JSON.stringify(part))));sum.totals=mergeMetrics(sum.totals,part.totals);for(const row of part.sources)sum.sources=mergeMetrics(sum.sources,row.metrics);for(const row of part.pages)sum.pages=mergeMetrics(sum.pages,row.metrics);}
 for(const m of Object.values(sum))assert.deepEqual(m,original.totals);
});
