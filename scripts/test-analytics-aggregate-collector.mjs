import test from 'node:test';import assert from 'node:assert/strict';
const mod=await import('../lib/traffic-aggregate-collector.mjs').catch(()=>({}));
function setup(extra={}){assert.equal(typeof mod.createTrafficAggregateCollector,'function');let time=0,n=0;const packets=[];const collector=mod.createTrafficAggregateCollector({now:()=>time,randomNonce:()=>`00000000-0000-4000-8000-${String(++n).padStart(12,'0')}`,send:async p=>{packets.push(structuredClone(p));return true;},...extra},{enabled:true,publicQualifications:[{slug:'전기기능사'}],choice:{basic:true,ga4:false}});return {collector,packets,advance:ms=>{time+=ms;},sum:field=>packets.reduce((v,p)=>v+p.totals[field],0)};}
test('counts public navigation once and excludes hidden, unfocused, private and timer sleep gaps',async()=>{
 const s=setup(),c=s.collector;c.setActivity({visible:true,focused:true});c.navigate('/','https://search.naver.com/?query=private');c.navigate('/','');s.advance(5000);c.tick();c.setActivity({visible:false,focused:false});s.advance(60000);c.tick();await c.flush();assert.equal(s.sum('activeMs'),5000);assert.equal(s.sum('pageViews'),1);assert.equal(s.sum('visitStarts'),1);
 c.setActivity({visible:true,focused:true});s.advance(11000);c.tick();await c.flush();assert.equal(s.sum('activeMs'),5000);
 c.navigate('/admin/','');s.advance(5000);c.tick();c.navigate('/','');c.navigate('/cbt/','');await c.flush();assert.equal(s.sum('pageViews'),3);assert.equal(s.sum('visitStarts'),1);assert.equal(JSON.stringify(s.packets).includes('query='),false);
});
test('focus and bfcache restoration retain pageviews, while thirty-minute inactivity restarts a visit',async()=>{
 const s=setup(),c=s.collector;c.navigate('/','');c.setActivity({visible:true,focused:true});s.advance(5000);c.tick();c.setActivity({visible:false,focused:false});s.advance(60000);c.setActivity({visible:true,focused:true});await c.flush();assert.equal(s.sum('pageViews'),1);
 c.setActivity({visible:false,focused:false});s.advance(1800001);c.setActivity({visible:true,focused:true});await c.flush();assert.equal(s.sum('pageViews'),1);assert.equal(s.sum('visitStarts'),1);
 c.navigate('/cbt/','');await c.flush();assert.equal(s.sum('pageViews'),2);assert.equal(s.sum('visitStarts'),2);
});
test('different exam attempts create separate views while sending only the generic qualification key',async()=>{
 const s=setup(),c=s.collector;c.navigate('/cbt/전기기능사/exam/attempt-a/','');c.navigate('/cbt/전기기능사/exam/attempt-a/','');c.navigate('/cbt/전기기능사/exam/attempt-b/','');await c.flush();assert.equal(s.sum('pageViews'),2);assert.equal(s.sum('visitStarts'),1);assert.ok(s.packets.every(p=>p.pages.every(r=>r.key==='e:전기기능사')));assert.equal(JSON.stringify(s.packets).includes('attempt-'),false);
});
test('visible computer sleep preserves a pending visit restart until the next actual public navigation',async()=>{
 const s=setup(),c=s.collector;c.navigate('/','');c.setActivity({visible:true,focused:true});s.advance(5000);c.tick();await c.flush();s.advance(1800001);c.tick();s.advance(5000);c.tick();c.navigate('/cbt/','');await c.flush();assert.equal(s.sum('pageViews'),2);assert.equal(s.sum('visitStarts'),2);assert.equal(s.sum('activeMs'),10000);
});
test('immutable retry retains nonce while later page increments get an independent packet',async()=>{
 let release;const first=new Promise(r=>release=r);let calls=0;const sent=[];const s=setup({send:async p=>{sent.push(structuredClone(p));return ++calls===1?first:true;}});const c=s.collector;c.navigate('/','');const pending=c.flush();c.navigate('/cbt/','');release(false);await pending;await c.flush();await c.flush();assert.deepEqual(sent[0],sent[1]);assert.notEqual(sent[1].nonce,sent[2].nonce);assert.equal(sent[2].pages[0].key,'cbt');
});
test('stop during pending send discards all future retry and accumulated data',async()=>{
 let release;let calls=0;const s=setup({send:async()=>{calls++;return new Promise(r=>release=r);}});const c=s.collector;c.navigate('/','');const pending=c.flush();c.navigate('/cbt/','');c.setChoice({basic:false,ga4:false});release(false);await pending;await c.flush();assert.equal(calls,1);
});
test('observed long reading is split without losing active time and stale buffers expire',async()=>{
 const s=setup(),c=s.collector;c.navigate('/','');c.setActivity({visible:true,focused:true});for(let i=0;i<24;i++){s.advance(5000);c.tick();}for(let i=0;i<5;i++)await c.flush();assert.equal(s.sum('activeMs'),120000);assert.ok(s.packets.every(p=>p.totals.activeMs<=60000));
 const stale=setup();stale.collector.navigate('/','');stale.advance(300001);await stale.collector.flush();assert.equal(stale.packets.length,0);
});
