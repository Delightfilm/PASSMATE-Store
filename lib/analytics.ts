"use client";

import {createAnalyticsCollector,type AnalyticsCollector} from './analytics-collector.mjs';
import {CONSENT_KEY} from './analytics-policy.mjs';
import {createLearningTracker,type LearningTransition} from './analytics-learning.mjs';
import {publicQualifications} from './cbt-home-catalog';
import {BASIC_CHOICE_KEY,resolveTrafficChoice} from './traffic-aggregate-policy.mjs';

export const analyticsAvailable = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true' && process.env.NEXT_PUBLIC_ANALYTICS_NOTICE_READY === 'true' && /^G-[A-Z0-9]+$/.test(process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID || '');
const measurementId = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID || '';
let collector:AnalyticsCollector|null=null;
let learning:ReturnType<typeof createLearningTracker>|null=null;
let learningVisible=false;
let preferenceStorageFailed=false;
export function setAnalyticsStorageFailure(value:boolean){preferenceStorageFailed=value;}
const learningMethods=new Map<string,LearningTransition['method']>();
type AnalyticsWindow = Window & { dataLayer?:IArguments[]; [key:`ga-disable-${string}`]:boolean };

export function effectiveGa4Allowed():boolean {
  if(typeof window==='undefined'||!analyticsAvailable||preferenceStorageFailed)return false;
  try{return resolveTrafficChoice({legacyConsent:window.localStorage.getItem(CONSENT_KEY),basicChoice:window.localStorage.getItem(BASIC_CHOICE_KEY),gpc:Boolean((navigator as Navigator&{globalPrivacyControl?:boolean}).globalPrivacyControl)}).ga4;}
  catch{return false;}
}

function getCollector() {
  if (typeof window==='undefined') return null;
  if (collector) return collector;
  const target=window as unknown as AnalyticsWindow;
  let storage:Storage|null=null;
  try { storage=window.localStorage; } catch { /* Private mode. */ }
  let tagPromise:Promise<void>|null=null;
  collector=createAnalyticsCollector({storage,
    onReady(){if(effectiveGa4Allowed())void learning?.flush().catch(()=>{});},
    setDisabled(value) { const disabled=value||!effectiveGa4Allowed();target[`ga-disable-${measurementId}`]=disabled; if(disabled && target.dataLayer) target.dataLayer.length=0; },
    send(command) {
      if(!effectiveGa4Allowed())return;
      // gtag's documented queue format is an arguments object.
      function gtag(..._args:unknown[]) { target.dataLayer??=[];target.dataLayer.push(arguments); }
      gtag(...command);
    },
    loadTag() {
      if(!effectiveGa4Allowed())return Promise.reject(new Error('analytics_disabled'));
      if (tagPromise) return tagPromise;
      target.dataLayer??=[];
      tagPromise=new Promise<void>((resolve,reject)=> {
        const script=document.createElement('script'); script.async=true;
        script.src=`https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
        const timeout=window.setTimeout(()=>{script.remove();tagPromise=null;reject(new Error('analytics_unavailable'));},10000);
        script.onload=()=>{window.clearTimeout(timeout);resolve();};
        script.onerror=()=>{window.clearTimeout(timeout);script.remove();tagPromise=null;reject(new Error('analytics_unavailable'));};
        document.head.appendChild(script);
      });
      return tagPromise;
    },
  },{enabled:analyticsAvailable,measurementId,publicQualifications});
  return collector;
}
export function visitAnalyticsPage() {
  if(!effectiveGa4Allowed()){suspendAnalytics();return;}
  if(!/\/exam\/[^/]+\/?$/.test(window.location.pathname)){learningVisible=false;learning?.clear();}
  getCollector()?.visit(`https://www.mypassmate.com${window.location.pathname}${window.location.search}`,document.referrer);
}
export function setAnalyticsConsent(value:'granted'|'denied') {
  if(value==='denied'){learning?.clear();learningMethods.clear();}
  getCollector()?.setConsent(value);
  window.dispatchEvent(new Event('passmate:analytics-consent'));
}
export function readAnalyticsConsent():'granted'|'denied'|null {
  try { const value=window.localStorage.getItem(CONSENT_KEY);return value==='granted'||value==='denied'?value:null; } catch { return null; }
}
export function trackAnalyticsEvent(name:string,params:unknown,dedupeKey?:string) {
  if(!effectiveGa4Allowed())return false;
  return getCollector()?.track(name,params,dedupeKey)??false;
}
export function suspendAnalytics() { learningVisible=false;learning?.clear();getCollector()?.visit('https://www.mypassmate.com/admin/',''); }
export function syncAnalyticsPreference(){
  if(!effectiveGa4Allowed()){learningMethods.clear();suspendAnalytics();return;}
  getCollector()?.setConsent('granted');visitAnalyticsPage();
}

function getLearningTracker() {
  if(learning)return learning;
  let storage:Storage|null=null;try{storage=window.localStorage;}catch{/* Optional. */}
  learning=createLearningTracker({storage,track:trackAnalyticsEvent,withLock:navigator.locks?((name,task)=>navigator.locks.request(name,task)):undefined,isPublicExam(key) {
    if(!learningVisible||!effectiveGa4Allowed())return false;
    try{return decodeURIComponent(window.location.pathname).endsWith(`/exam/${key}/`)||decodeURIComponent(window.location.pathname).endsWith(`/exam/${key}`);}catch{return false;}
  }});
  return learning;
}
export async function recordLearningTransition(input:LearningTransition):Promise<boolean> {
  if(!effectiveGa4Allowed())return false;
  if(input.kind==='start'&&input.method){learningMethods.set(input.localAttemptKey,input.method);if(learningMethods.size>1000)learningMethods.delete(learningMethods.keys().next().value!);}
  learningVisible=false;
  try{return await getLearningTracker().record(input.kind==='complete'?{...input,method:learningMethods.get(input.localAttemptKey)}:input);}catch{return false;}
}
export function flushLearningEvents() {
  if(!effectiveGa4Allowed())return;
  visitAnalyticsPage();learningVisible=true;void learning?.flush().catch(()=>{});
}
