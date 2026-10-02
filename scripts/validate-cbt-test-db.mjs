// In-memory PostgreSQL only. Does not read Supabase URLs, tokens or production data.
// npm install --prefix /tmp/cbt-qa --no-audit --no-fund @electric-sql/pglite
// CBT_QA_PACKAGE_JSON=/tmp/cbt-qa/package.json node scripts/validate-cbt-test-db.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(resolve(process.env.CBT_QA_PACKAGE_JSON || "/tmp/cbt-qa/package.json"));
const { PGlite } = await import(require.resolve("@electric-sql/pglite"));
const { pgcrypto } = await import(require.resolve("@electric-sql/pglite/contrib/pgcrypto"));
const db = new PGlite({ extensions: { pgcrypto } });
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema extensions;
    create extension pgcrypto with schema extensions;
    create table auth.users(id uuid primary key);
    create table public.profiles(id uuid primary key references auth.users, display_name text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select current_user::text $$;
    grant usage on schema public, auth to authenticated, anon;
  `);
  await db.exec(readFileSync(resolve("supabase/migrations/20260930003531_cbt_mate_question_bank_runtime.sql"), "utf8"));
  await db.exec("alter table public.question_bank_attempts add column client_id text; SET app.cbt_test_database='true';");
  await db.exec(readFileSync(resolve("docs/cbt-test-migration.DRAFT.sql"), "utf8"));
  const one = async (sql, args = []) => (await db.query(sql, args)).rows[0];
  const cert = (await one("insert into question_bank_certs(code,name) values('test-metal','금속도장기능사') returning id")).id;
  const batch = (await one("insert into question_bank_import_batches(file_name,qualification_code) values('FAKE','test-metal') returning id")).id;
  const subjects = [];
  for (const [index, name] of ["금속도장재료", "금속도장", "색채"].entries()) subjects.push((await one("insert into question_bank_subjects(cert_id,external_id,part_number,name) values($1,$2,$3,$4) returning id", [cert, `test-${index}`, index + 1, name])).id);
  const rounds = [];
  for (let round = 0; round < 19; round++) rounds.push((await one("insert into question_bank_exams(cert_id,external_id,year,round,title) values($1,$2,2026,$3,'FAKE') returning id", [cert, `test-${round}`, `${round + 1}회`])).id);
  for (const [index, subject] of subjects.entries()) {
    const count = index === 0 ? 380 : 379;
    for (let start = 0; start < count; start += 20) await db.query(`insert into question_bank_questions(exam_id,cert_id,subject_id,no,stem,choices,answer,status,source_hash,source_question_uid,import_batch_id)
      select $1,$2,$3,n,'예시 문제','[{"label":"①","text":"예시"},{"label":"②","text":"예시"},{"label":"③","text":"예시"},{"label":"④","text":"예시"}]',0,'published','FAKE',$4 || n,$5 from generate_series(1,$6::int) n`, [rounds[Math.floor(start / 20)], cert, subject, `test-${index}-${start}-`, batch, Math.min(20, count - start)]);
  }
  const users = [];
  for (let i = 0; i < 100; i++) {
    const id = (await one("insert into auth.users values(gen_random_uuid()) returning id")).id;
    users.push(id); await db.query("insert into profiles values($1,$2)", [id, `테스트 수험자 ${i}`]);
  }
  await db.exec("SET ROLE service_role;");
  const identity = (await one("select public.cbt_prepare_identity($1) as result", [users[0]])).result;
  assert.match(identity.practiceNumber, /^\d{8}-\d{5}$/);
  assert.equal(identity.displayName, "테스트 수험자 0");
  assert.deepEqual((await one("select public.cbt_prepare_identity($1) as result", [users[0]])).result, identity);
  const numbers = [];
  for (const user of users) numbers.push((await one("select public.cbt_prepare_identity($1) as result", [user])).result.practiceNumber);
  assert.equal(new Set(numbers).size, 100);
  const starts = [];
  for (let i = 0; i < 100; i++) {
    const attempt = (await one("select public.cbt_start($1,$2,'mock','[]',60,'submit') as result", [users[0], cert])).result;
    starts.push(attempt);
    assert.equal(attempt.question_ids.length, 60); assert.equal(new Set(attempt.question_ids).size, 60);
    assert.equal(attempt.config.practiceNumber, identity.practiceNumber);
    assert.equal(attempt.config.displayNameSnapshot, identity.displayName);
    assert.equal(Date.parse(attempt.end_at) - Date.parse(attempt.started_at), 3600000);
    const selected = (await db.query("select id,subject_id from question_bank_questions where id=any($1::uuid[])", [attempt.question_ids])).rows;
    assert.deepEqual(attempt.question_ids.map(id => selected.find(q => q.id === id).subject_id), subjects.flatMap(id => Array(20).fill(id)));
    assert.deepEqual((await one("select question_ids,config from question_bank_attempts where client_id=$1", [attempt.client_id])).question_ids, attempt.question_ids);
  }
  assert.equal(new Set(starts.map(a => a.config.seed)).size, 100);
  const attempt = starts[0], q = attempt.question_ids[0];
  const selected = (await one("select cbt_answer($1,$2,$3,2,null) as result", [users[0], attempt.client_id, q])).result;
  assert.equal(selected.answers[q], 2);
  const reviewed = (await one("select cbt_answer($1,$2,$3,null,true) as result", [users[0], attempt.client_id, q])).result;
  assert.equal(reviewed.answers[q], 2); assert.deepEqual(reviewed.config.reviewIds, [q]);
  assert.deepEqual(reviewed.question_ids, attempt.question_ids);
  assert.equal(reviewed.end_at, attempt.end_at);
  await assert.rejects(one("select cbt_answer($1,$2,$3,1,null)", [users[1], attempt.client_id, q]));
  const result = (await one("select cbt_submit($1,$2) as result", [users[0], attempt.client_id])).result;
  const repeated = (await one("select cbt_submit($1,$2) as result", [users[0], attempt.client_id])).result;
  assert.equal(result.alreadySubmitted, false); assert.equal(repeated.alreadySubmitted, true);
  assert.deepEqual({ ...repeated, alreadySubmitted: false }, result);
  assert.equal((await one("select count(*)::int as n from question_bank_attempts where client_id=$1", [attempt.client_id])).n, 1);
  await assert.rejects(one("select cbt_answer($1,$2,$3,0,null)", [users[0], attempt.client_id, q]));
  await db.exec("RESET ROLE;");
  const expired = starts[1];
  await db.query("update question_bank_attempts set end_at=clock_timestamp()-interval '1 second' where client_id=$1", [expired.client_id]);
  const before = await one("select * from question_bank_attempts where client_id=$1", [expired.client_id]);
  await db.query("select * from question_bank_attempts where client_id=$1", [expired.client_id]);
  assert.deepEqual(await one("select * from question_bank_attempts where client_id=$1", [expired.client_id]), before);
  assert.equal(before.status, "in_progress"); assert.equal(before.submitted_at, null);
  await db.exec("SET ROLE service_role;");
  await assert.rejects(one("select cbt_answer($1,$2,$3,1,null)", [users[0], expired.client_id, expired.question_ids[0]]));
  const savedExpired = (await one("select cbt_submit($1,$2) as result", [users[0], expired.client_id])).result;
  assert.equal(savedExpired.alreadySubmitted, false);
  await db.exec("RESET ROLE; SET ROLE authenticated;");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [users[0]]);
  assert.equal((await one("select count(*)::int as n from question_bank_attempts")).n, 100, "RLS must expose only own attempts");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [users[1]]);
  assert.equal((await one("select count(*)::int as n from question_bank_attempts")).n, 0, "RLS must hide another user's attempts");
  await assert.rejects(db.exec("update public.question_bank_attempts set status='submitted'"));
  await assert.rejects(one("select cbt_start($1,$2,'mock','[]',60,'submit')", [users[0], cert]));
  await db.exec("RESET ROLE;");
  await db.exec(readFileSync(resolve("docs/cbt-test-qa.sql"), "utf8"));
  await db.query("delete from question_bank_questions where subject_id=$1", [subjects[2]]);
  const countBefore = (await one("select count(*)::int as n from question_bank_attempts")).n;
  await db.exec("SET ROLE service_role;");
  await assert.rejects(one("select cbt_start($1,$2,'mock','[]',60,'submit')", [users[0], cert]));
  assert.equal((await one("select count(*)::int as n from question_bank_attempts")).n, countBefore);
  console.log("PASS: isolated PostgreSQL; 100 starts 20/20/20 + unique/ordered/restored IDs; 100 unique daily HMAC numbers; snapshot/endAt; owned answers/reviews; first submit retained; expiry SELECT unchanged; client UPDATE/RPC denied; insufficient pool creates no attempt.");
  console.log("PENDING: hosted Supabase RLS/Auth integration and actual concurrent sessions/tabs; PGlite serializes one connection.");
} catch (error) { console.error("FAIL:", error.message); process.exitCode = 1; }
finally { await db.close(); }
