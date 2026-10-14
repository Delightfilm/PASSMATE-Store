import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTrafficQaMigration} from './prepare-traffic-aggregate-qa.mjs';
test('QA mapper confines DDL to the new aggregate objects and keeps role PUBLIC',()=>{
 const sql='create table public.traffic_aggregate_daily(a int); revoke all on public.traffic_aggregate_daily from PUBLIC; set search_path = public, pg_temp;';
 const out=buildTrafficQaMigration(sql);assert.ok(out.includes('traffic_aggregate_qa.traffic_aggregate_daily'));assert.ok(out.includes('from PUBLIC'));assert.ok(out.includes('search_path = traffic_aggregate_qa, pg_temp'));
 assert.throws(()=>buildTrafficQaMigration('select * from public.profiles;'));
 assert.throws(()=>buildTrafficQaMigration('select * from auth.users;'));
});
