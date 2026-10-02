// Explicitly designated TEST DB only. Never installs/applies migrations.
// pg is a QA-only dependency: npm install --prefix /tmp/cbt-qa pg
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { setTimeout as pause } from "node:timers/promises";

const ref = process.env.CBT_QA_PROJECT_REF;
const user = process.env.CBT_QA_USER_ID;
const rawUrl = process.env.CBT_QA_DATABASE_URL;
assert.equal(process.env.CBT_QA_CONFIRM_TEST_DB, "YES", "Set the explicit test DB confirmation.");
assert.ok(ref && ref !== "fmecqeadghrdisirucqm" && /^[a-z0-9-]+$/.test(ref), "A separate test project ref is required.");
assert.ok(rawUrl && !rawUrl.includes("fmecqeadghrdisirucqm"), "Production URLs are prohibited.");
assert.match(user || "", /^[0-9a-f-]{36}$/i, "Provide a dedicated test account UUID.");
const url = new URL(rawUrl);
const local = ref === "local-test" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
assert.ok(local || url.hostname === `db.${ref}.supabase.co` || (url.hostname.endsWith(".pooler.supabase.com") && decodeURIComponent(url.username) === `postgres.${ref}`), "URL host/user must match the independently verified test project ref.");
url.searchParams.delete("sslmode");
const require = createRequire(resolve(process.env.CBT_QA_PACKAGE_JSON || "/tmp/cbt-qa/package.json"));
const { Client } = require("pg");
const a = new Client({ connectionString: url.href, ssl: local ? false : { rejectUnauthorized: true }, application_name: "cbt-qa-A", connectionTimeoutMillis: 10000 });
const b = new Client({ connectionString: url.href, ssl: local ? false : { rejectUnauthorized: true }, application_name: "cbt-qa-B", connectionTimeoutMillis: 10000 });
const managed = [], legacy = `attempt-qa-${randomUUID()}`;
const ownedQuestionIds = new Set();
let verified = false, dailyDay;
const one = async (client, sql, args = []) => (await client.query(sql, args)).rows[0];
async function denied(sql, args, code = "42501") {
  await a.query("SAVEPOINT denied_check");
  try { await assert.rejects(a.query(sql,args), error => error.code === code); }
  finally { await a.query("ROLLBACK TO SAVEPOINT denied_check; RELEASE SAVEPOINT denied_check"); }
}
try {
  await Promise.all([a.connect(), b.connect()]);
  await Promise.all([a.query("SET statement_timeout='15s'; SET lock_timeout='10s'"),b.query("SET statement_timeout='15s'; SET lock_timeout='10s'")]);
  assert.ok(await one(a,"select 1 from cbt_private.test_environment where project_ref=$1",[ref]), "Test DB marker is missing/mismatched.");
  assert.equal((await one(a,"select rolbypassrls or rolsuper as allowed from pg_roles where rolname=current_user")).allowed,true,"Use a test DB administrator connection for role tests/cleanup.");
  assert.ok(await one(a,"select id from profiles where id=$1 and display_name like 'CBT QA %'",[user]),"Use a dedicated profile named CBT QA …");
  for (const table of ["question_bank_attempts","question_bank_wrong_notes"]) assert.equal((await one(a,`select count(*)::int n from public.${table} where user_id=$1`,[user])).n,0,"Test account must have no existing attempts/notes.");
  assert.equal((await one(a,"select count(*)::int n from cbt_private.daily_numbers where user_id=$1",[user])).n,0,"Use a fresh QA identity.");
  const cert = await one(a,"select c.id from question_bank_certs c join question_bank_mock_configs m on m.cert_name=c.name where c.name='금속도장기능사' and m.status='published'");
  assert.ok(cert,"Publish only the verified test configuration first.");
  verified = true;
  await a.query("SET ROLE service_role");
  const start = async () => {
    const row = (await one(a,"select cbt_start($1,$2,'mock','[]',60,'submit') result",[user,cert.id])).result;
    managed.push(row.client_id); row.question_ids.forEach(id => ownedQuestionIds.add(id));
    return row;
  };
  const attempt = await start(); dailyDay = attempt.config.practiceNumber.slice(0,8);
  await a.query("RESET ROLE");
  const q = attempt.question_ids[0];
  const correct = (await one(a,"select answer from question_bank_questions where id=$1",[q])).answer;
  await a.query("insert into question_bank_wrong_notes(user_id,question_id,wrong_count,memo,mastered) values($1,$2,3,'QA memo',false)",[user,q]);
  await a.query("SET ROLE service_role");
  await one(a,"select cbt_answer($1,$2,$3,$4,null)",[user,attempt.client_id,q,correct]);
  await a.query("RESET ROLE; BEGIN; SET LOCAL ROLE authenticated");
  await a.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",[user,JSON.stringify({sub:user,role:"authenticated"})]);
  assert.equal((await a.query("update question_bank_attempts set score=99 where client_id=$1 returning id",[attempt.client_id])).rowCount,0);
  assert.equal((await a.query("delete from question_bank_attempts where client_id=$1 returning id",[attempt.client_id])).rowCount,0);
  await denied("insert into question_bank_attempts(user_id,client_id,config,question_ids) values($1,$2,'{\"serverManaged\":true}','[]')",[user,`bad-${randomUUID()}`]);
  await a.query("insert into question_bank_attempts(user_id,client_id,config,question_ids) values($1,$2,'{}',$3)",[user,legacy,JSON.stringify([q])]);
  assert.equal((await a.query("update question_bank_attempts set answers=$1 where client_id=$2 returning id",[JSON.stringify({[q]:correct}),legacy])).rowCount,1);
  await denied("update question_bank_attempts set config='{\"serverManaged\":true}' where client_id=$1",[legacy]);
  for (const sql of ["select cbt_start($1,$2,'mock','[]',60,'submit')","select cbt_answer($1,$3,$4,0,null)","select cbt_submit($1,$3)"]) {
    // Each statement uses its own placeholders to avoid PostgreSQL unknown types.
    const args = sql.includes("cbt_start") ? [user,cert.id] : sql.includes("cbt_answer") ? [user,attempt.client_id,q] : [user,attempt.client_id];
    await denied(sql.replace('$3','$2').replace('$4','$3'),args);
  }
  await a.query("COMMIT; SET ROLE service_role");
  for (const sql of ["select cbt_answer($1,$2,$3,0,null)","select cbt_submit($1,$2)"]) {
    await assert.rejects(a.query(sql,sql.includes("answer")?[user,legacy,q]:[user,legacy]),error=>error.code==="PT403");
  }
  await a.query("RESET ROLE; BEGIN; SET LOCAL ROLE authenticated");
  await a.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",[user,JSON.stringify({sub:user,role:"authenticated"})]);
  assert.equal((await a.query("delete from question_bank_attempts where client_id=$1 returning id",[legacy])).rowCount,1);
  const other = randomUUID();
  await a.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",[other,JSON.stringify({sub:other,role:"authenticated"})]);
  assert.equal((await a.query("select id from question_bank_attempts where client_id=$1",[attempt.client_id])).rowCount,0);
  await denied("insert into question_bank_attempts(user_id,client_id,config,question_ids) values($1,$2,'{}','[]')",[user,`spoof-${randomUUID()}`]);
  await a.query("SET LOCAL ROLE anon");
  await denied("select cbt_submit($1,$2)",[user,attempt.client_id]);
  await a.query("COMMIT; SET ROLE service_role");
  await b.query("SET ROLE service_role");
  const pid = (await one(b,"select pg_backend_pid() pid")).pid;
  await a.query("BEGIN");
  await a.query("select id from question_bank_attempts where client_id=$1 for update",[attempt.client_id]);
  // Observe pg_stat_activity as the QA administrator, without releasing the lock.
  await a.query("RESET ROLE");
  await b.query("BEGIN");
  const second = one(b,"select cbt_submit($1,$2) result",[user,attempt.client_id]);
  void second.catch(() => undefined);
  // Prove B really waits on A's row lock before releasing A.
  let blocked = false;
  for (let i=0;i<100;i++) { await a.query("select pg_stat_clear_snapshot()"); if ((await one(a,"select wait_event_type from pg_stat_activity where pid=$1",[pid]))?.wait_event_type==="Lock") { blocked=true; break; } await pause(20); }
  assert.ok(blocked,"Connection B must be blocked by A's row lock.");
  await a.query("SET ROLE service_role");
  const first = (await one(a,"select cbt_submit($1,$2) result",[user,attempt.client_id])).result;
  await a.query("COMMIT");
  const repeated = (await second).result;
  await b.query("COMMIT");
  assert.equal(first.alreadySubmitted,false); assert.equal(repeated.alreadySubmitted,true);
  assert.deepEqual({...repeated,alreadySubmitted:false},first);
  assert.equal((await one(a,"select count(*)::int n from question_bank_attempts where user_id=$1 and client_id=$2",[user,attempt.client_id])).n,1);
  assert.deepEqual((await one(b,"select cbt_submit($1,$2) result",[user,attempt.client_id])).result,repeated);
  assert.deepEqual(await one(a,"select mastered,wrong_count,memo from question_bank_wrong_notes where user_id=$1 and question_id=$2",[user,q]),{mastered:true,wrong_count:3,memo:"QA memo"});
  assert.equal((await one(a,"select count(*)::int n from question_bank_wrong_notes where user_id=$1 and question_id<>$2 and wrong_count<>1",[user,q])).n,0);
  const expired = await start();
  await a.query("RESET ROLE");
  await a.query("update question_bank_attempts set end_at=clock_timestamp()-interval '1 second' where client_id=$1",[expired.client_id]);
  const before = await one(a,"select status,submitted_at,answers,score from question_bank_attempts where client_id=$1",[expired.client_id]);
  const after = await one(b,"select status,submitted_at,answers,score from question_bank_attempts where client_id=$1",[expired.client_id]);
  assert.deepEqual(after,before); assert.equal(after.status,"in_progress"); assert.equal(after.submitted_at,null);
  console.log("PASS: two real connections; B waited on A; one row/first result retained; notes updated once; legacy writes allowed; promotion/managed writes/direct RPC denied; missing flag rejected; expired SELECT unchanged.");
} catch (error) {
  // Do not print URLs, connection credentials or raw DB error details.
  console.error("FAIL: test DB QA did not complete.",error instanceof assert.AssertionError?error.message:"Check the test DB setup and permissions."); process.exitCode=1;
} finally {
  await Promise.allSettled([a.query("ROLLBACK; RESET ROLE"),b.query("ROLLBACK; RESET ROLE")]);
  if (verified) {
    try {
      await a.query("delete from question_bank_attempts where user_id=$1 and client_id=any($2::text[])",[user,[...managed,legacy]]);
      await a.query("delete from question_bank_wrong_notes where user_id=$1 and question_id=any($2::uuid[])",[user,[...ownedQuestionIds]]);
      if (dailyDay) await a.query("delete from cbt_private.daily_numbers where user_id=$1 and day=to_date($2,'YYYYMMDD')",[user,dailyDay]);
    } catch { console.error("QA fixture cleanup failed; remove only this run's dedicated test-account fixtures."); process.exitCode=1; }
  }
  await Promise.allSettled([a.end(),b.end()]);
}
