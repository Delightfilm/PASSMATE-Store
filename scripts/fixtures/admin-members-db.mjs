import {createRequire} from 'node:module';
import fs from 'node:fs';
export const adminId='11111111-1111-4111-8111-111111111111';
export const memberId='22222222-2222-4222-8222-222222222222';
// Optional QA tool only. Not an application dependency and never uses a remote DB.
export async function memberFixtureDatabase(){
  const require=createRequire(new URL('../../tmp/admin-members-sql/package.json',import.meta.url));
  const {PGlite}=require('@electric-sql/pglite');
  const db=new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema private;
    create table auth.users(id uuid primary key,email text,created_at timestamptz,last_sign_in_at timestamptz,email_confirmed_at timestamptz,raw_app_meta_data jsonb,raw_user_meta_data jsonb,deleted_at timestamptz,is_anonymous boolean);
    create table public.profiles(id uuid primary key,display_name text,role text);
    create table public.question_bank_attempts(user_id uuid,submitted_at timestamptz,score numeric);
    create table public.question_bank_wrong_notes(user_id uuid,wrong_count integer default 1);
    create table public.question_bank_bookmarks(user_id uuid);
    create table public.question_bank_user_question_state(user_id uuid,question_ref text,wrong_count integer,bookmarked boolean,mastered boolean,memo text);
    create function private.is_designated_admin_user(id uuid) returns boolean language sql as $$select id='${adminId}'::uuid$$;
    insert into auth.users values('${adminId}','owner@example.invalid',now()-interval '20 days',now(),now(),' {"providers":["kakao"]}','{}',null,false);
    insert into profiles values('${adminId}','관리자 QA','admin');
    insert into auth.users values('${memberId}','target_%@example.invalid',now(),null,null,'{"providers":["google","email"]}','{"name":"긴이름과화면줄바꿈확인을위한가상회원","private":"DO_NOT_EXPOSE"}',null,false);
    insert into profiles values('${memberId}','가상 회원','customer');
    insert into auth.users
      select md5('member-'||i)::uuid,'qa'||i||'@example.invalid',
        (((now() at time zone 'Asia/Seoul')::date-(i%5))::timestamp+interval '12 hours') at time zone 'Asia/Seoul',now()-i*interval '1 hour',now(),
        case when i%2=0 then '{"providers":["google"]}'::jsonb else '{"providers":["email"]}'::jsonb end,'{}',null,false
      from generate_series(1,25) i;
    insert into profiles select id,'테스트 회원 '||row_number() over(order by id),'customer' from auth.users where id not in ('${adminId}','${memberId}');
    insert into auth.users select md5('anonymous')::uuid,null,now(),null,null,'{}','{}',null,true;
    insert into auth.users select md5('deleted')::uuid,'deleted@example.invalid',now(),null,null,'{}','{}',now(),false;
    insert into question_bank_attempts values('${memberId}',now(),70),('${memberId}',now(),90),('${memberId}',null,0);
    insert into question_bank_wrong_notes(user_id) values('${memberId}'),('${memberId}');
    insert into question_bank_bookmarks values('${memberId}');
    insert into question_bank_user_question_state values
      ('${memberId}','nas:wrong',2,true,false,''),
      ('${memberId}','nas:mastered',1,false,true,''),
      ('${memberId}','nas:bookmark',0,true,false,''),
      ('${memberId}','nas:memo',0,false,false,'memo only');
  `);
  const root=new URL('../../supabase/migrations/',import.meta.url);
  const name=fs.readdirSync(root).find(p=>p.endsWith('_admin_member_reporting.sql'));
  await db.exec(fs.readFileSync(new URL(name,root),'utf8'));
  return db;
}
export async function fixtureMemberReport(db,input,actor=adminId){
  const result=await db.query('select public.admin_member_report($1,$2,$3,$4,$5,$6,$7,$8,$9) as report',[
    actor,input.view,input.startDate,input.endDate,input.query||'',input.provider||'all',input.page||1,input.periodOnly||false,input.memberId||null,
  ]);
  return result.rows[0].report;
}
