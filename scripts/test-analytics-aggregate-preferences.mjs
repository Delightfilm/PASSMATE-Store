import test from 'node:test';import assert from 'node:assert/strict';import {webcrypto} from 'node:crypto';
import {loadAnalyticsTs} from './helpers/load-analytics-ts.mjs';
const basicKey='passmate.analytics.basic.v1',gaKey='passmate.analytics.consent.v1';
function setup(initial={},gpc=false){
 const values=new Map(Object.entries(initial)),writes=[],requests=[],timers=[],events=new Map();let time=0;
 const storage={getItem:k=>values.get(k)??null,setItem(k,v){writes.push([k,v]);values.set(k,v);}};
 const window={localStorage:storage,location:{pathname:'/',search:''},dispatchEvent(e){for(const cb of events.get(e.type)||[])cb(e);},addEventListener(type,cb){events.set(type,[...(events.get(type)||[]),cb]);},removeEventListener(type,cb){events.set(type,(events.get(type)||[]).filter(x=>x!==cb));},setInterval(cb){timers.push(cb);return timers.length;},clearInterval(){},setTimeout:()=>1,clearTimeout(){}};
 const document={visibilityState:'visible',referrer:'https://search.naver.com/?q=private',hasFocus:()=>true,addEventListener:window.addEventListener,removeEventListener:window.removeEventListener};
 const globals={window,document,navigator:{globalPrivacyControl:gpc},performance:{now:()=>time},crypto:webcrypto,process:{env:{NEXT_PUBLIC_FIRST_PARTY_ANALYTICS_ENABLED:'true'}},fetch:async(url,options)=>{requests.push({url,...options});return {status:204};}};
 const mod=loadAnalyticsTs('lib/traffic-aggregate.ts',globals,{'./cbt-home-catalog':{publicQualifications:[{slug:'전기기능사'}]}});
 return {mod,values,writes,requests,window,advance(ms){time+=ms;for(const cb of timers)cb();},async settle(){for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));}};
}
test('newcomer basic measurement sends no credentials, referrer or persistent visitor state',async()=>{
 const s=setup();const stop=s.mod.startTrafficAggregate();s.advance(5000);s.advance(5000);s.advance(5000);s.advance(5000);await s.settle();assert.ok(s.requests.length);assert.equal(s.writes.length,0);
 const req=s.requests[0];assert.equal(req.credentials,'omit');assert.equal(req.referrerPolicy,'no-referrer');assert.equal(req.keepalive,true);assert.deepEqual(Object.keys(req.headers),['Content-Type']);assert.equal(JSON.stringify(req).includes('private'),false);stop();
 assert.equal(req.url,'/api/analytics/aggregate/','trailingSlash canonical endpoint avoids a redirect that redirect:error must reject');
});
test('legacy refusal, GPC, corrupt preferences and storage failures prevent collection',async()=>{
 for(const [initial,gpc] of [[{[gaKey]:'denied'},false],[{[gaKey]:'granted'},true],[{[basicKey]:'invalid'},false]]){const s=setup(initial,gpc);const stop=s.mod.startTrafficAggregate();s.advance(20000);await s.settle();assert.equal(s.requests.length,0);assert.equal(s.mod.readTrafficPreferences().basic,false);stop();}
 const s=setup();Object.defineProperty(s.window,'localStorage',{get(){throw Error('blocked');}});assert.equal(s.mod.readTrafficPreferences().basic,false);
});
test('explicit modes update only choices, basic never restores GA4 grant, and cross-tab off clears pending',async()=>{
 const s=setup({[gaKey]:'granted'});const stop=s.mod.startTrafficAggregate();s.mod.applyTrafficPreference('basic');assert.equal(s.values.get(gaKey),'denied');assert.equal(s.values.get(basicKey),'on');
 s.mod.applyTrafficPreference('detail');assert.equal(s.values.get(gaKey),'granted');s.values.set(basicKey,'off');s.window.dispatchEvent({type:'storage',key:basicKey});s.advance(20000);await s.settle();assert.equal(s.requests.length,0);
 s.mod.applyTrafficPreference('off');assert.equal(s.values.get(gaKey),'denied');assert.ok(s.writes.every(([k])=>[basicKey,gaKey].includes(k)));stop();
});
test('GA4 public events and learning entry points honor GPC and basic-only selection even with historical grant',async()=>{
 for(const preferences of [{[gaKey]:'granted',[basicKey]:'off'},{[gaKey]:'granted'}]){
  const storage={getItem:k=>preferences[k]??null,setItem(){throw Error('unexpected automatic preference write');}};
  const window={localStorage:storage,location:{pathname:'/',search:''}};
  const mod=loadAnalyticsTs('lib/analytics.ts',{window,navigator:{globalPrivacyControl:true},document:{referrer:''},process:{env:{NEXT_PUBLIC_ANALYTICS_ENABLED:'true',NEXT_PUBLIC_ANALYTICS_NOTICE_READY:'true',NEXT_PUBLIC_GA4_MEASUREMENT_ID:'G-TEST'}}},{'./cbt-home-catalog':{publicQualifications:[]}});
  assert.equal(typeof mod.effectiveGa4Allowed,'function');assert.equal(mod.effectiveGa4Allowed(),false);
  assert.equal(mod.trackAnalyticsEvent('sign_up',{method:'email'}),false);assert.equal(await mod.recordLearningTransition({kind:'start',localAttemptKey:'secret'}),false);mod.flushLearningEvents();
 }
});
test('a partial settings write failure blocks historical GA4 until a successful explicit settings write',()=>{
 const storage={getItem:k=>k===gaKey?'granted':null};
 const mod=loadAnalyticsTs('lib/analytics.ts',{window:{localStorage:storage},navigator:{},process:{env:{NEXT_PUBLIC_ANALYTICS_ENABLED:'true',NEXT_PUBLIC_ANALYTICS_NOTICE_READY:'true',NEXT_PUBLIC_GA4_MEASUREMENT_ID:'G-TEST'}}},{'./cbt-home-catalog':{publicQualifications:[]}});
 assert.equal(mod.effectiveGa4Allowed(),true);assert.equal(typeof mod.setAnalyticsStorageFailure,'function');mod.setAnalyticsStorageFailure(true);assert.equal(mod.effectiveGa4Allowed(),false);mod.setAnalyticsStorageFailure(false);assert.equal(mod.effectiveGa4Allowed(),true);
});
