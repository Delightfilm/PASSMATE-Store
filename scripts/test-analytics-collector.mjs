import test from 'node:test';
import assert from 'node:assert/strict';
const module = await import('../lib/analytics-collector.mjs').catch(()=>({}));
const url='https://www.mypassmate.com';
function setup(enabled=true) {
  assert.equal(typeof module.createAnalyticsCollector,'function','collector must enforce consent before tag load');
  const events=[],loads=[],disabled=[],stored=new Map(); let resolveTag;
  const collector=module.createAnalyticsCollector({loadTag:()=>{loads.push(1);return new Promise(resolve=>{resolveTag=resolve;});},send:command=>events.push(command),setDisabled:value=>disabled.push(value),storage:{getItem:key=>stored.get(key)??null,setItem:(key,value)=>stored.set(key,value)}},{enabled,measurementId:'G-TEST123',publicQualifications:[{slug:'전기기능사',title:'전기기능사'}]});
  return {collector,events,loads,disabled,stored,resolve:async()=>{resolveTag?.();await Promise.resolve();await Promise.resolve();}};
}
test('no tag or transmission before consent, on rejection or while feature disabled', async()=> {
  for(const enabled of [true,false]){const s=setup(enabled);s.collector.visit(url+'/','https://naver.com/');assert.equal(s.loads.length,0);s.collector.setConsent('denied');assert.equal(s.events.length,0);if(!enabled){s.collector.setConsent('granted');assert.equal(s.loads.length,0);}}
});
test('withdrawal during asynchronous load prevents all initialization and replay', async()=> {
  const s=setup();s.collector.visit(url+'/','');s.collector.setConsent('granted');assert.equal(s.loads.length,1);s.collector.setConsent('denied');await s.resolve();assert.equal(s.events.length,0);assert.equal(s.disabled.at(-1),true);
});
test('private navigation while tag is loading prevents late load initialization', async()=> {
  const s=setup();s.collector.visit(url+'/','');s.collector.setConsent('granted');s.collector.visit(url+'/account/oauth-callback/?token=secret','');await s.resolve();assert.equal(s.events.length,0);
});
test('returning to public page before tag load finishes measures only the current safe page', async()=> {
  const s=setup();s.collector.visit(url+'/','');s.collector.setConsent('granted');s.collector.visit(url+'/admin/','');s.collector.visit(url+'/cbt/전기기능사/','');await s.resolve();
  const views=s.events.filter(x=>x[0]==='event'&&x[1]==='page_view');assert.equal(views.length,1);assert.equal(views[0][2].page_title,'전기기능사');
});
test('manual pageviews count committed navigation once and never expose query or ID', async()=> {
  const s=setup();s.collector.visit(url+'/?code=secret&utm_source=naver','https://search.naver.com/?q=private');s.collector.setConsent('granted');await s.resolve();
  s.collector.visit(url+'/?code=another','');
  s.collector.visit(url+'/cbt/전기기능사/exam/attempt-private/','');
  const views=s.events.filter(x=>x[0]==='event'&&x[1]==='page_view');assert.equal(views.length,2);
  assert.equal(views[0][2].page_location,url+'/');assert.equal(views[0][2].page_referrer,'https://search.naver.com/');
  assert.equal(JSON.stringify(s.events).includes('secret'),false);assert.equal(JSON.stringify(s.events).includes('attempt-private'),false);
  s.collector.visit(url+'/admin/','');const before=s.events.length;assert.equal(s.collector.track('exam_start',{qualification_slug:'전기기능사'}),false);assert.equal(s.events.length,before);assert.equal(s.disabled.at(-1),true);
});
test('events require catalog identity and local dedupe key is never transmitted', async()=> {
  const s=setup();s.collector.visit(url+'/cbt/전기기능사/','');s.collector.setConsent('granted');await s.resolve();
  assert.equal(s.collector.track('exam_start',{qualification_slug:'private-user'},'id'),false);
  assert.equal(s.collector.track('exam_start',{qualification_slug:'전기기능사'},'private-attempt'),true);
  assert.equal(s.collector.track('exam_start',{qualification_slug:'전기기능사'},'private-attempt'),false);
  assert.equal(JSON.stringify(s.events).includes('private-attempt'),false);
  s.collector.setConsent('denied');assert.equal(s.collector.track('exam_complete',{qualification_slug:'전기기능사'}),false);
});
test('denied browser storage and tag failures never break site controls', async()=> {
  assert.equal(typeof module.createAnalyticsCollector,'function');
  const events=[];const c=module.createAnalyticsCollector({loadTag:async()=>{throw new Error('blocked');},send:x=>events.push(x),setDisabled:()=>{},storage:{getItem(){throw Error('denied');},setItem(){throw Error('denied');}}},{enabled:true,measurementId:'G-TEST123',publicQualifications:[]});
  c.visit(url+'/','');assert.doesNotThrow(()=>c.setConsent('granted'));await Promise.resolve();await Promise.resolve();assert.equal(events.length,0);assert.doesNotThrow(()=>c.dispose());
});
test('each attempt navigation has a pageview while transmitted paths never contain its identity',async()=>{
  const s=setup();s.collector.visit(url+'/cbt/전기기능사/exam/A/','');s.collector.setConsent('granted');await s.resolve();s.collector.visit(url+'/cbt/전기기능사/exam/B/','');
  const views=s.events.filter(x=>x[0]==='event'&&x[1]==='page_view');assert.equal(views.length,2);assert.equal(views[0][2].page_location,views[1][2].page_location);assert.equal(JSON.stringify(s.events).includes('/exam/B/'),false);
});
test('navigation updates target config scope used by automatic engagement',async()=>{
  const s=setup();s.collector.visit(url+'/','');s.collector.setConsent('granted');await s.resolve();s.collector.visit(url+'/cbt/전기기능사/','');
  const config=s.events.filter(x=>x[0]==='config').at(-1)[2],global=s.events.filter(x=>x[0]==='set').at(-1)[1];
  // Documented config scope has priority over global set; assert effective context.
  assert.equal(config.page_title??global.page_title,'전기기능사');assert.equal(config.page_location??global.page_location,url+'/cbt/'+encodeURIComponent('전기기능사')+'/');assert.equal(config.send_page_view,false);
});
test('qualification view waits for readiness and a genuine return is a new view',async()=>{
  const s=setup();s.collector.visit(url+'/cbt/전기기능사/','');s.collector.setConsent('granted');s.collector.track('qualification_view',{qualification_slug:'전기기능사'},'/cbt/전기기능사/');await s.resolve();s.collector.visit(url+'/','');s.collector.visit(url+'/cbt/전기기능사/','');s.collector.track('qualification_view',{qualification_slug:'전기기능사'},'/cbt/전기기능사/');assert.equal(s.events.filter(x=>x[0]==='event'&&x[1]==='qualification_view').length,2);
});
