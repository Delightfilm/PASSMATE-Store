// Disposable native PostgreSQL; loopback only. No hosted URLs/keys are read.
// QA-only packages: npm install --prefix /tmp/cbt-qa pg embedded-postgres
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import assert from "node:assert/strict";

const require = createRequire(resolve(process.env.CBT_QA_PACKAGE_JSON || "/tmp/cbt-qa/package.json"));
const { default: EmbeddedPostgres } = await import(require.resolve("embedded-postgres"));
const reserve = createServer();
await new Promise((resolve,reject) => { reserve.once("error",reject); reserve.listen(0,"127.0.0.1",resolve); });
const port = reserve.address().port;
await new Promise(resolve => reserve.close(resolve));
const directory = mkdtempSync(join(tmpdir(),"cbt-qa-native-"));
const password = randomBytes(24).toString("hex");
const errors = [];
const postgres = new EmbeddedPostgres({ databaseDir: join(directory,"db"), user: "postgres", password, port, persistent: false, authMethod: "scram-sha-256", postgresFlags: ["-h","127.0.0.1"], onLog() {}, onError: error => errors.push(String(error)) });
let db, failed = false;
try {
  await postgres.initialise(); await postgres.start();
  db = postgres.getPgClient("postgres","127.0.0.1"); await db.connect();
  console.log("Native PostgreSQL:",(await db.query("select version()")).rows[0].version.split(' on ')[0]);
  await db.query(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema extensions;
    create extension pgcrypto with schema extensions;
    create table auth.users(id uuid primary key);
    create table public.profiles(id uuid primary key references auth.users, display_name text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select current_user::text $$;
    grant usage on schema public,auth to authenticated,anon;
  `);
  await db.query(readFileSync(resolve("supabase/migrations/20260930003531_cbt_mate_question_bank_runtime.sql"),"utf8"));
  await db.query("alter table question_bank_attempts add column client_id text; SET app.cbt_test_database='true'");
  await db.query(readFileSync(resolve("docs/cbt-test-migration.DRAFT.sql"),"utf8"));
  const one = async (sql,args=[]) => (await db.query(sql,args)).rows[0];
  const cert = (await one("insert into question_bank_certs(code,name) values('qa-metal','금속도장기능사') returning id")).id;
  const exam = (await one("insert into question_bank_exams(cert_id,external_id,year,round,title) values($1,'QA',2026,'QA','가상 검증용') returning id",[cert])).id;
  const batch = (await one("insert into question_bank_import_batches(file_name,qualification_code) values('QA FAKE','qa-metal') returning id")).id;
  for (const [index,name] of ['금속도장재료','금속도장','색채'].entries()) {
    const subject = (await one("insert into question_bank_subjects(cert_id,external_id,part_number,name) values($1,$2,$3,$4) returning id",[cert,`QA-${index}`,index+1,name])).id;
    await db.query(`insert into question_bank_questions(exam_id,cert_id,subject_id,no,stem,choices,answer,status,source_hash,source_question_uid,import_batch_id)
      select $1,$2,$3,n,'가상 검증 문제','[{"label":"①","text":"예시"},{"label":"②","text":"예시"},{"label":"③","text":"예시"},{"label":"④","text":"예시"}]',0,'published','QA',$4||n,$5 from generate_series(1,20) n`,[exam,cert,subject,`QA-${index}-`,batch]);
  }
  const user = (await one("insert into auth.users values(gen_random_uuid()) returning id")).id;
  await db.query("insert into profiles values($1,'CBT QA local two connections')",[user]);
  await db.query("insert into cbt_private.test_environment values('local-test'); update question_bank_mock_configs set status='published' where cert_name='금속도장기능사'");
  const result = await new Promise((resolve,reject) => {
    const child = spawn(process.execPath,["scripts/validate-cbt-two-connections.mjs"],{cwd:process.cwd(),stdio:["ignore","pipe","pipe"],env:{...process.env,CBT_QA_CONFIRM_TEST_DB:"YES",CBT_QA_PROJECT_REF:"local-test",CBT_QA_USER_ID:user,CBT_QA_DATABASE_URL:`postgresql://postgres:${password}@127.0.0.1:${port}/postgres`}});
    let output="";child.stdout.on("data",data=>{output+=data;process.stdout.write(data);});child.stderr.on("data",data=>process.stderr.write(data));
    child.on("error",reject);child.on("close",code=>resolve({code,output}));
  });
  assert.equal(result.code,0,"Two-connection verification failed.");
  assert.match(result.output,/PASS: two real connections/);
  assert.equal((await one("select count(*)::int n from question_bank_attempts")).n,0,"Only this disposable QA database should be empty after cleanup.");
  console.log("PASS: disposable native DB verification complete; hosted Supabase Auth/REST still pending.");
} catch(error) {
  console.error("Local PostgreSQL QA failed:",error.message,errors.slice(-1).join(""));failed=true;
} finally {
  if(db) await db.end().catch(()=>{});
  await postgres.stop().catch(()=>{});
  rmSync(directory,{recursive:true,force:true});
}
// Preserve a failing exit status even when the embedded runtime has exit hooks.
if (failed) process.exit(1);
