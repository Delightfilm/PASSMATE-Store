"use client";
import {createTrafficAggregateCollector,type TrafficAggregateCollector} from './traffic-aggregate-collector.mjs';
import {BASIC_CHOICE_KEY,resolveTrafficChoice} from './traffic-aggregate-policy.mjs';
import {CONSENT_KEY} from './analytics-policy.mjs';
import {publicQualifications} from './cbt-home-catalog';
import {setAnalyticsStorageFailure} from './analytics';
export const firstPartyAnalyticsAvailable=process.env.NEXT_PUBLIC_FIRST_PARTY_ANALYTICS_ENABLED==='true';
let collector:TrafficAggregateCollector|null=null;
let storageFailed=false;
const requests=new Set<AbortController>();
export function readTrafficPreferences(){
 try{return resolveTrafficChoice({legacyConsent:window.localStorage.getItem(CONSENT_KEY),basicChoice:window.localStorage.getItem(BASIC_CHOICE_KEY),gpc:Boolean((navigator as Navigator&{globalPrivacyControl?:boolean}).globalPrivacyControl),storageReadable:!storageFailed});}
 catch{return {basic:false,ga4:false};}
}
function updateChoice(){
 const choice=readTrafficPreferences();collector?.setChoice(choice);
 if(!choice.basic){for(const request of requests)request.abort();requests.clear();}
 else collector?.navigate(window.location.pathname,document.referrer);
}
export function applyTrafficPreference(mode:'off'|'basic'|'detail'){
 try{window.localStorage.setItem(BASIC_CHOICE_KEY,mode==='off'?'off':'on');window.localStorage.setItem(CONSENT_KEY,mode==='detail'?'granted':'denied');storageFailed=false;}
 catch{storageFailed=true;}
 setAnalyticsStorageFailure(storageFailed);
 updateChoice();window.dispatchEvent(new Event('passmate:traffic-preference'));window.dispatchEvent(new Event('passmate:analytics-consent'));
}
export function visitTrafficAggregate(pathname:string){collector?.navigate(pathname,document.referrer);}
export function startTrafficAggregate(){
 if(!firstPartyAnalyticsAvailable||typeof window==='undefined')return ()=>{};
 collector?.dispose();
 const current=createTrafficAggregateCollector({now:()=>performance.now(),randomNonce:()=>crypto.randomUUID(),async send(packet){
  if(!readTrafficPreferences().basic)return false;
  const controller=new AbortController();requests.add(controller);
  const timeout=window.setTimeout(()=>controller.abort(),5000);
  try{const response=await fetch('/api/analytics/aggregate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(packet),credentials:'omit',referrerPolicy:'no-referrer',keepalive:true,redirect:'error',signal:controller.signal});return response.status===204;}
  catch{return false;}finally{window.clearTimeout(timeout);requests.delete(controller);}
 }},{enabled:true,publicQualifications,choice:readTrafficPreferences()});collector=current;
 const activity=()=>{current.setActivity({visible:document.visibilityState==='visible',focused:document.hasFocus()});if(document.visibilityState!=='visible'||!document.hasFocus())void current.flush();};
 const leave=()=>{current.setActivity({visible:false,focused:false});void current.flush();};
 const storage=(event:StorageEvent)=>{if(event.key===BASIC_CHOICE_KEY||event.key===CONSENT_KEY||event.key===null)updateChoice();};
 current.navigate(window.location.pathname,document.referrer);activity();
 const clock=window.setInterval(()=>current.tick(),5000),flush=window.setInterval(()=>{if(document.visibilityState==='visible')void current.flush();},20000);
 document.addEventListener('visibilitychange',activity);window.addEventListener('focus',activity);window.addEventListener('blur',activity);window.addEventListener('pagehide',leave);window.addEventListener('pageshow',activity);window.addEventListener('storage',storage);window.addEventListener('passmate:traffic-preference',updateChoice);window.addEventListener('passmate:analytics-consent',updateChoice);
 return ()=>{current.dispose();if(collector===current)collector=null;for(const r of requests)r.abort();requests.clear();window.clearInterval(clock);window.clearInterval(flush);document.removeEventListener('visibilitychange',activity);window.removeEventListener('focus',activity);window.removeEventListener('blur',activity);window.removeEventListener('pagehide',leave);window.removeEventListener('pageshow',activity);window.removeEventListener('storage',storage);window.removeEventListener('passmate:traffic-preference',updateChoice);window.removeEventListener('passmate:analytics-consent',updateChoice);};
}
