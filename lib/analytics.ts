"use client";

import {createAnalyticsCollector,type AnalyticsCollector} from './analytics-collector.mjs';
import {CONSENT_KEY} from './analytics-policy.mjs';
import {publicQualifications} from './cbt-home-catalog';

export const analyticsAvailable = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED === 'true' && process.env.NEXT_PUBLIC_ANALYTICS_NOTICE_READY === 'true' && /^G-[A-Z0-9]+$/.test(process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID || '');
const measurementId = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID || '';
let collector:AnalyticsCollector|null=null;
type AnalyticsWindow = Window & { dataLayer?:IArguments[]; [key:`ga-disable-${string}`]:boolean };

function getCollector() {
  if (typeof window==='undefined') return null;
  if (collector) return collector;
  const target=window as AnalyticsWindow;
  let storage:Storage|null=null;
  try { storage=window.localStorage; } catch { /* Private mode. */ }
  let tagPromise:Promise<void>|null=null;
  collector=createAnalyticsCollector({storage,
    setDisabled(value) { target[`ga-disable-${measurementId}`]=value; if(value && target.dataLayer) target.dataLayer.length=0; },
    send(command) {
      // gtag's documented queue format is an arguments object.
      function gtag(..._args:unknown[]) { target.dataLayer??=[];target.dataLayer.push(arguments); }
      gtag(...command);
    },
    loadTag() {
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
  getCollector()?.visit(`https://www.mypassmate.com${window.location.pathname}${window.location.search}`,document.referrer);
}
export function setAnalyticsConsent(value:'granted'|'denied') {
  getCollector()?.setConsent(value);
  window.dispatchEvent(new Event('passmate:analytics-consent'));
}
export function readAnalyticsConsent():'granted'|'denied'|null {
  try { const value=window.localStorage.getItem(CONSENT_KEY);return value==='granted'||value==='denied'?value:null; } catch { return null; }
}
export function trackAnalyticsEvent(name:string,params:unknown,dedupeKey?:string) {
  return getCollector()?.track(name,params,dedupeKey)??false;
}
export function suspendAnalytics() { getCollector()?.visit('https://www.mypassmate.com/admin/',''); }
