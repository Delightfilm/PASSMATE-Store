import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {Script} from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const mod=await import('../lib/admin-analytics-view.mjs').catch(()=>({}));
function api(name){assert.equal(typeof mod[name],'function',`${name} must implement the displayed data contract`);return mod[name];}
test('inclusive calendar periods work across month and leap boundaries',()=>{const period=api('derivePeriod');assert.deepEqual(period(7,'2026-03-01'),{startDate:'2026-02-23',endDate:'2026-03-01'});assert.deepEqual(period(30,'2024-03-01'),{startDate:'2024-02-01',endDate:'2024-03-01'});assert.throws(()=>period(7,'2026-02-30'));});
test('engagement uses sessions as denominator and does not invent time for zero sessions',()=>{const format=api('formatEngagement');assert.equal(format(180,2),'1분 30초');assert.equal(format(0,0),'—');assert.equal(format(NaN,1),'—');});
test('an older request resolving after a new filter cannot replace the current response',async()=>{const create=api('createReportLoader');const pending=[];const loader=create((request,signal)=>new Promise(resolve=>pending.push({request,signal,resolve})));const received=[];const a=loader.load({report:'overview'},value=>received.push(value));const b=loader.load({report:'pages'},value=>received.push(value));assert.equal(pending[0].signal.aborted,true);pending[1].resolve({status:'ok',report:'pages'});await b;pending[0].resolve({status:'ok',report:'overview'});await a;assert.deepEqual(received,[{status:'ok',report:'pages'}]);loader.dispose();});
test('CSV protects formulas and escapes commas, quotes and newlines',()=>{const csv=api('buildAnalyticsCsv')({status:'ok',report:'acquisition',data:{rows:[{dimensions:{sessionSourceMedium:'=IMPORTXML("x")'},metrics:{sessions:2}},{dimensions:{sessionSourceMedium:'naver, organic'},metrics:{sessions:3}},{dimensions:{sessionSourceMedium:'\t+cmd'},metrics:{sessions:1}}],totals:{}},meta:{}});assert.ok(csv.includes("'=IMPORTXML"));assert.ok(csv.includes('"naver, organic"'));assert.ok(!csv.includes('\r\n\t+cmd'));});
test('connection/noData/error copy is distinct from successful zero or stale results',()=>{const state=api('reportStateMessage');assert.ok(state({status:'notConfigured'}).includes('연결'));assert.ok(state({status:'noData'}).includes('수집'));assert.ok(state({status:'error',errorCode:'permission'}).includes('권한'));assert.equal(state({status:'ok'}),'');assert.ok(state({status:'stale'}).includes('이전'));});
test('real analytics table renders aggregate metrics and safely escapes source text',()=>{
  const root=path.resolve(import.meta.dirname,'..'),file=path.join(root,'components/admin-analytics.tsx');
  assert.ok(fs.existsSync(file),'actual analytics table component must exist');
  const cache=new Map();
  function load(file){for(const suffix of ['', '.ts','.tsx','.mjs','.json'])if(fs.existsSync(file+suffix)){file+=suffix;break;}if(/\.(json|mjs)$/.test(file))return createRequire(import.meta.url)(file);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;const require=name=>name.startsWith('@/')?load(path.join(root,name.slice(2))):name.startsWith('.')?load(path.resolve(path.dirname(file),name)):createRequire(file)(name);new Script(`(function(require,module,exports){${code}\n})`,{filename:file}).runInThisContext()(require,module,module.exports);return module.exports;}
  const {AnalyticsTable}=load(file);
  const html=renderToStaticMarkup(React.createElement(AnalyticsTable,{rows:[{dimensions:{sessionSourceMedium:'<script>bad</script>'},metrics:{sessions:2,userEngagementDuration:180,exam_start:1}}],report:'acquisition'}));
  assert.ok(html.includes('<table'));assert.ok(html.includes('1분 30초'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>bad'));
});
