"use client";
import {useEffect,useLayoutEffect} from 'react';
import {usePathname} from 'next/navigation';
import {analyticsAvailable,visitAnalyticsPage,suspendAnalytics,setAnalyticsConsent} from '@/lib/analytics';
import {CONSENT_KEY} from '@/lib/analytics-policy.mjs';
import {AnalyticsConsent} from './analytics-consent';

export function AnalyticsProvider() {
  const pathname=usePathname();
  useLayoutEffect(()=> { if(analyticsAvailable) visitAnalyticsPage(); },[pathname]);
  useEffect(()=> {
    if(!analyticsAvailable) return;
    const leave=()=>suspendAnalytics();
    const resume=()=>visitAnalyticsPage();
    const storage=(event:StorageEvent)=>{if(event.key===CONSENT_KEY)setAnalyticsConsent(event.newValue==='granted'?'granted':'denied');};
    window.addEventListener('pagehide',leave);window.addEventListener('pageshow',resume);window.addEventListener('storage',storage);
    return ()=>{window.removeEventListener('pagehide',leave);window.removeEventListener('pageshow',resume);window.removeEventListener('storage',storage);};
  },[]);
  return analyticsAvailable?<AnalyticsConsent pathname={pathname}/>:null;
}
