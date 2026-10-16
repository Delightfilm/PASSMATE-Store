import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {Script} from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const mod=await import('../lib/admin-members.mjs').catch(()=>({}));
const server=await import('../supabase/functions/_shared/admin-members-handler.mjs').catch(()=>({}));
const now=new Date('2026-10-16T15:30:00Z');
const request={view:'summary',startDate:'2026-10-01',endDate:'2026-10-17'};
const api=name=>{assert.equal(typeof mod[name],'function',`${name} is required`);return mod[name];};
test('KST date boundaries and inclusive periods cross UTC and month boundaries',()=>{
  assert.deepEqual(api('memberPeriod')(7,now),{startDate:'2026-10-11',endDate:'2026-10-17'});
  assert.deepEqual(api('memberPeriod')(7,new Date('2024-03-01T00:00:00Z')),{startDate:'2024-02-24',endDate:'2024-03-01'});
});
test('member request rejects invalid calendar dates, broad periods, injected keys and invalid IDs',()=>{
  const parse=api('parseMemberRequest');
  assert.equal(parse({...request,startDate:'2026-02-30'},now),null);
  assert.equal(parse({...request,startDate:'2026-01-01'},now),null);
  assert.equal(parse({...request,endDate:'2026-10-18'},now),null);
  assert.equal(parse({...request,role:'admin'},now),null);
  assert.equal(parse({...request,view:'detail',memberId:'not-a-uuid'},now),null);
  assert.equal(parse({...request,view:'members',page:0},now),null);
  assert.equal(parse({...request,query:'x'.repeat(101)},now),null);
  assert.equal(parse({...request,provider:'evil'},now),null);
  assert.deepEqual(parse({...request,view:'members',query:'  kim_%  ',page:2},now),{...request,view:'members',query:'kim_%',provider:'all',page:2,periodOnly:false});
});
test('server denies guests/non-admins before running any member query; errors are not zero',async()=>{
  assert.equal(typeof server.createAdminMembersHandler,'function');
  for(const access of [401,403]){
    let calls=0;const handler=server.createAdminMembersHandler({resolveAdmin:async()=>access,query:async()=>{calls++;},now:()=>now});
    const response=await handler(new Request('https://test.invalid',{method:'POST',body:JSON.stringify(request)}));
    assert.equal(response.status,access);assert.equal(calls,0);assert.match(response.headers.get('cache-control'),/no-store/);
  }
  const handler=server.createAdminMembersHandler({resolveAdmin:async()=>true,query:async()=>{throw Error('private database detail');},now:()=>now});
  const response=await handler(new Request('https://test.invalid',{method:'POST',body:JSON.stringify(request)}));
  assert.equal(response.status,503);assert.equal((await response.json()).error,'member_report_unavailable');
});
test('server validates bodies and methods before query and rejects over-size input',async()=>{
  let calls=0;const handler=server.createAdminMembersHandler({resolveAdmin:async()=>true,query:async()=>{calls++;},now:()=>now});
  assert.equal((await handler(new Request('https://test.invalid'))).status,405);
  assert.equal((await handler(new Request('https://test.invalid',{method:'POST',body:'{'}))).status,400);
  assert.equal((await handler(new Request('https://test.invalid',{method:'POST',body:JSON.stringify({...request,query:'x'.repeat(5000)})}))).status,413);
  assert.equal(calls,0);
});
test('authorized response uses validated filters and strips metadata before returning JSON',async()=>{
  const handler=server.createAdminMembersHandler({resolveAdmin:async()=>true,query:async input=>{
    assert.equal(input.query,'kim');assert.equal(input.page,1);
    return {total:0,page:1,rows:[],internal:'not-for-browser'};
  },now:()=>now});
  const response=await handler(new Request('https://test.invalid',{method:'POST',body:JSON.stringify({...request,view:'members',query:' kim '})}));
  assert.equal(response.status,200);const body=await response.json();assert.equal(body.data.total,0);assert.ok(!JSON.stringify(body).includes('not-for-browser'));
});
test('member responses expose only the allowlisted identity fields',()=>{
  const normalize=api('normalizeMemberReport');
  const raw={rows:[{id:'11111111-1111-4111-8111-111111111111',displayName:'<script>',email:'qa@example.invalid',createdAt:now.toISOString(),lastSignInAt:null,emailConfirmed:false,providers:['email'],encrypted_password:'never',user_metadata:{secret:'never'}}],total:1,page:1};
  const result=normalize(raw,{...request,view:'members'},now);
  assert.equal(result.data.rows[0].displayName,'<script>');
  assert.ok(!JSON.stringify(result).includes('never'));
  assert.throws(()=>normalize({...raw,total:-1},{...request,view:'members'},now));
  assert.throws(()=>normalize({...raw,rows:[{...raw.rows[0],createdAt:'bad'}]},{...request,view:'members'},now));
});
test('summary preserves true zero and fills every requested day',()=>{
  const normalize=api('normalizeMemberReport');
  const totals={totalMembers:3,joinedToday:0,joined7Days:1,joinedInPeriod:1,confirmedMembers:2};
  const result=normalize({totals,trend:[{date:'2026-10-16',count:1}]},request,now);
  assert.equal(result.data.trend.length,17);assert.equal(result.data.trend.at(-1).count,0);assert.equal(result.data.totals.joinedToday,0);
  assert.throws(()=>normalize({totals:{...totals,joinedInPeriod:2},trend:[{date:'2026-10-16',count:1}]},request,now));
});
test('Unicode names use the same 200-character limit as PostgreSQL, not UTF-16 length',()=>{
  const raw={rows:[{id:'11111111-1111-4111-8111-111111111111',displayName:'😀'.repeat(200),email:null,createdAt:now.toISOString(),lastSignInAt:null,emailConfirmed:false,providers:['email']}],total:1,page:1};
  assert.equal(api('normalizeMemberReport')(raw,{...request,view:'members'},now).data.rows[0].displayName,'😀'.repeat(200));
  assert.throws(()=>api('normalizeMemberReport')({...raw,rows:[{...raw.rows[0],displayName:'😀'.repeat(201)}]},{...request,view:'members'},now));
});
test('SQL is server-only read reporting with no changes to member rows or signup triggers',()=>{
  const file=fs.readdirSync(new URL('../supabase/migrations/',import.meta.url)).find(p=>p.endsWith('_admin_member_reporting.sql'));
  assert.ok(file);const sql=fs.readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8');
  assert.match(sql,/grant execute[\s\S]+to service_role/i);
  assert.match(sql,/from public,\s*anon,\s*authenticated/i);
  assert.match(sql,/security definer/i);
  assert.match(sql,/set search_path\s*=\s*''/i);
  assert.match(sql,/private.is_designated_admin_user\(p_admin_user_id\)/);
  assert.match(sql,/Asia\/Seoul/);
  assert.match(sql,/deleted_at is null/);
  assert.match(sql,/is_anonymous/);
  assert.ok(!/\b(insert into|update auth|delete from|create trigger|grant select)\b/i.test(sql));
});

function loadComponent(){
  const root=path.resolve(import.meta.dirname,'..'),cache=new Map();
  function load(file){
    for(const suffix of ['','.ts','.tsx','.mjs','.json'])if(fs.existsSync(file+suffix)){file+=suffix;break;}
    if(/\.(json|mjs)$/.test(file))return createRequire(import.meta.url)(file);
    if(cache.has(file))return cache.get(file).exports;
    const module={exports:{}};cache.set(file,module);
    const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
    const require=name=>name.startsWith('@/')?load(path.join(root,name.slice(2))):name.startsWith('.')?load(path.resolve(path.dirname(file),name)):createRequire(file)(name);
    new Script(`(function(require,module,exports){${code}\n})`,{filename:file}).runInThisContext()(require,module,module.exports);
    return module.exports;
  }
  return load(path.join(root,'components/admin-members.tsx'));
}
test('real member rows escape untrusted names and keep descriptive detail buttons',()=>{
  const {MemberRows}=loadComponent();
  const html=renderToStaticMarkup(React.createElement(MemberRows,{rows:[{id:'11111111-1111-4111-8111-111111111111',displayName:'<script>bad</script>',email:'qa@example.invalid',createdAt:now.toISOString(),lastSignInAt:null,providers:['google','email'],emailConfirmed:false}],onSelect:()=>{}}));
  assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>bad'));assert.ok(html.includes('상세 보기'));assert.ok(html.includes('이메일 미인증'));assert.ok(html.includes('Google · 이메일'));
});
test('metrics distinguish unavailable values, loading and true zero',()=>{
  const {AudienceMetric}=loadComponent();
  const html=value=>renderToStaticMarkup(React.createElement(AudienceMetric,{label:'회원',note:'현재 회원',...value}));
  assert.ok(html({}).includes('—'));assert.ok(html({value:0}).includes('<strong>0</strong>'));assert.ok(html({busy:true}).includes('불러오는 중'));
});
test('signup chart exposes the same actual daily values in a text alternative',()=>{
  const {SignupTrend}=loadComponent();const html=renderToStaticMarkup(React.createElement(SignupTrend,{rows:[{date:'2026-10-16',count:0},{date:'2026-10-17',count:3}]}));
  assert.ok(html.includes('날짜별 수치 보기'));assert.ok(html.includes('2026-10-17: 3명 가입'));assert.ok(html.includes('>0명<'));assert.ok(html.includes('>3명<'));
});
