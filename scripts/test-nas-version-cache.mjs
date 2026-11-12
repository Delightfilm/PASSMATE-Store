import assert from 'node:assert/strict';
import {loadAnalyticsTs} from './helpers/load-analytics-ts.mjs';

const requests=[];
const {loadContentBundle}=loadAnalyticsTs('lib/question-bank-content.ts',{
 TextDecoder,
 process:{env:{NEXT_PUBLIC_QUESTION_BANK_CONTENT_URL:'https://content.example.test'}},
 fetch:async(url,options)=>{
  requests.push({url:String(url),cache:options.cache});
  return Response.json({schemaVersion:'passmate.question-bank.bundle.v1',releaseId:'release',qualification:{code:'aa'},subjects:[],exams:[],questions:[]});
 },
});
const catalog=sha256=>({schemaVersion:'passmate.question-bank.catalog.v1',releaseId:'release',totals:{questions:0,qualifications:1},qualifications:[{code:'aa',title:'종목',bundle:'bundles/aa.json.gz',sha256,questions:0,exams:0,images:0}]});
const first='a'.repeat(64),updated='b'.repeat(64);
await loadContentBundle(catalog(first),'aa');
assert.equal(requests[0].url,`https://content.example.test/bundles/aa.json.gz?v=${first}`,'The catalog digest must version the HTTP cache key');
assert.equal(requests[0].cache,'default','Versioned public data should respect response freshness instead of forcing origin revalidation');
await loadContentBundle(catalog(first),'aa');
assert.equal(requests.length,1,'Keep the existing in-memory coalescing/cache');
await loadContentBundle(catalog(updated),'aa');
assert.equal(requests.length,2);
assert.equal(requests[1].url,`https://content.example.test/bundles/aa.json.gz?v=${updated}`,'A changed digest must fetch a distinct cache entry');
await loadContentBundle(catalog('legacy-digest'),'aa');
assert.equal(requests[2].url,'https://content.example.test/bundles/aa.json.gz');
assert.equal(requests[2].cache,'no-cache','Unknown legacy digest must retain conservative delivery');
// A response stored under an old digest must not prevent recovery after rollback.
const httpCache=new Map(),recoveryRequests=[];
let activeRelease='B',status=200;
const recoveryAdapter=loadAnalyticsTs('lib/question-bank-content.ts',{
 TextDecoder,process:{env:{NEXT_PUBLIC_QUESTION_BANK_CONTENT_URL:'https://content.example.test'}},
 fetch:async(url,options)=>{
  const key=String(url);recoveryRequests.push({url:key,cache:options.cache});
  if(options.cache==='default' && httpCache.has(key))return new Response(httpCache.get(key).body,{status:httpCache.get(key).status});
  const body=JSON.stringify({schemaVersion:'passmate.question-bank.bundle.v1',releaseId:activeRelease,qualification:{code:'aa'},subjects:[],exams:[],questions:[]});
  if(options.cache==='default')httpCache.set(key,{body,status});
  return new Response(body,{status});
 },
});
const oldCatalog={...catalog(first),releaseId:'A'};
await assert.rejects(recoveryAdapter.loadContentBundle(oldCatalog,'aa'),/invalid/);
assert.equal(recoveryRequests.length,2,'One invalid cache recovery only, even when origin is also invalid');
assert.equal(recoveryRequests[1].cache,'no-store');
assert.equal(new URL(recoveryRequests[1].url).searchParams.get('v'),first);
assert.ok(new URL(recoveryRequests[1].url).searchParams.has('_retry'));
activeRelease='A';
await recoveryAdapter.loadContentBundle(oldCatalog,'aa');
assert.equal(recoveryRequests.length,4,'Failed application entry is evicted and rollback bypasses poisoned HTTP entry');
assert.notEqual(recoveryRequests[3].url,recoveryRequests[1].url,'Each recovery has a distinct public cache key');
const httpErrorAdapter=loadAnalyticsTs('lib/question-bank-content.ts',{
 TextDecoder,process:{env:{NEXT_PUBLIC_QUESTION_BANK_CONTENT_URL:'https://content.example.test'}},
 fetch:async(url,options)=>{
  recoveryRequests.push({url:String(url),cache:options.cache});
  if(options.cache!=='no-store')return new Response('missing',{status});
  return Response.json({schemaVersion:'passmate.question-bank.bundle.v1',releaseId:'release',qualification:{code:'aa'},subjects:[],exams:[],questions:[]});
 },
});
status=404;let before=recoveryRequests.length;
await httpErrorAdapter.loadContentBundle(catalog('c'.repeat(64)),'aa');
assert.equal(recoveryRequests.length-before,2,'Cached missing-file response gets one fresh-key recovery');
for(const blocked of [401,403,429]){
 status=blocked;before=recoveryRequests.length;
 await assert.rejects(httpErrorAdapter.loadContentBundle(catalog(String(blocked).repeat(64).slice(0,64)),'aa'),new RegExp(String(blocked)));
 assert.equal(recoveryRequests.length-before,1,'Do not retry authentication or access/rate-limit errors');
}
console.log('NAS version cache PASS: digest URL, normal HTTP freshness, changed revision, LRU reuse and legacy fallback');
