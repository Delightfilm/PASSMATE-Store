import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

function load(file, dependencies = {}) {
  const code = ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(name => {
    if (name in dependencies) return dependencies[name];
    throw new Error("Unexpected dependency: " + name);
  }, module, module.exports);
  return module.exports;
}
const { summarizeStudy } = load("../lib/account-insights.ts");
const { accountDisplayName } = load("../lib/account-display-name.ts");
const empty = { attempts: [], bookmarks: [], wrongNotes: {} };
assert.equal(summarizeStudy(empty).accuracy, null);
assert.equal(summarizeStudy(empty).completionRate, null);
const attempts = [0,100,undefined,NaN,200].map((score,i) => ({ id:String(i), status:"submitted", score, questionIds:["q"], startedAt:`2026-10-0${i+1}T00:00:00Z` }));
const store = { ...empty, attempts:[...attempts,{id:"ongoing",status:"in_progress",score:100,startedAt:"2026-10-09T00:00:00Z"}], wrongNotes:{a:{wrongCount:2,mastered:false},b:{wrongCount:1,mastered:true},c:{wrongCount:0,mastered:false}} };
const summary = summarizeStudy(store);
assert.equal(summary.accuracy,50,"Missing/invalid/unsubmitted scores must not dilute the average; zero is a real score");
assert.equal(summary.completionRate,83);
assert.equal(summary.completed,5);
assert.equal(summary.wrong,1);
assert.equal(summary.mastered,1);
assert.equal(summary.trend.length,2);
assert.equal(summary.recent[0].id,"ongoing");
const before = JSON.stringify(store); summarizeStudy(store); assert.equal(JSON.stringify(store),before,"Statistics must not mutate study history");
assert.equal(accountDisplayName({user_metadata:{full_name:"김주환"}}," 내 이름 "),"내 이름");
assert.equal(accountDisplayName({user_metadata:{full_name:"김주환"}},null),"김주환");
assert.equal(accountDisplayName({user_metadata:{name:123,nickname:"닉네임"}}),"닉네임");
assert.equal(accountDisplayName({user_metadata:{email:"private@example.invalid"}}),"");
assert.equal(accountDisplayName(null),"");

const queries=[];
let fail=false;
const client={from(table){const log={table};queries.push(log);return {select(columns){log.columns=columns;return this;},eq(key,value){log.scope=[key,value];return this;},order(key){log.order=key;return this;},range(start,end){log.range=[start,end];return this;},async abortSignal(){return fail?{error:{message:"failed"},data:null}:{error:null,data:table==="question_bank_attempts"?(log.range[0]===0?Array.from({length:1000},(_,i)=>({id:"a"+i,config:{},question_ids:[],answers:{},started_at:"2026-10-01",end_at:null,status:"submitted",score:75})):log.range[0]===1000?[{id:"last",config:{},question_ids:[],answers:{},started_at:"2026-10-01",end_at:null,status:"submitted",score:50}]:[]):[]};}};}};
const originalFrom = client.from.bind(client);
client.from = table => { const query = originalFrom(table); query.returns = () => query; return query; };
const { readAccountStudy } = load("../lib/account-study.ts", { "@/lib/question-bank": { normalizeLocalStore: value=>value } });
const result=await readAccountStudy(client,"my-user",new AbortController().signal);
assert.equal(result.attempts.length,1001,"Default API row limit must not silently truncate personal statistics");
assert.ok(queries.every(q=>q.scope[0]==="user_id"&&q.scope[1]==="my-user"));
assert.ok(queries.every(q=>q.order&&q.range[1]-q.range[0]===999));
fail=true;await assert.rejects(()=>readAccountStudy(client,"my-user",new AbortController().signal));
await assert.rejects(()=>readAccountStudy(client,"",new AbortController().signal));
console.log("Account insights OK: denominators, zero/missing scores, immutability, display names, user scope, pagination, failure handling");
