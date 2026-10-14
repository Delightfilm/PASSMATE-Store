import test from 'node:test';import assert from 'node:assert/strict';
import {createAdminTrafficAggregateHandler} from '../supabase/functions/_shared/traffic-aggregate-handlers.mjs';
const request=()=>new Request('https://example.test',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({startDate:'2026-10-01',endDate:'2026-10-14',dimension:'page'})});
const now=()=>new Date('2026-10-14T09:00:00Z');
test('unauthenticated and ordinary members cannot read report or even query configuration',async()=>{
 for(const role of [401,403]){let calls=0;const handler=createAdminTrafficAggregateHandler({resolveAdmin:async()=>role,getConfig:()=>{calls++;return {enabled:true};},readReport:async()=>{calls++;},now});const r=await handler(request());assert.equal(r.status,role);assert.equal(calls,0);}
});
test('disabled and query failure are distinct from successful zero and keep responses private',async()=>{
 for(const [enabled,want] of [[false,'notConfigured'],[true,'error']]){const handler=createAdminTrafficAggregateHandler({resolveAdmin:async()=>true,getConfig:()=>({enabled}),readReport:async()=>{throw Error('secret credential');},now});const r=await handler(request());const body=await r.json();assert.equal(body.status,want);assert.equal(body.data,null);assert.ok(r.headers.get('cache-control').includes('no-store'));assert.equal(JSON.stringify(body).includes('secret'),false);}
});
