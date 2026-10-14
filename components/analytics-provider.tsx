"use client";
import {useEffect,useLayoutEffect} from 'react';
import {usePathname} from 'next/navigation';
import {analyticsAvailable,visitAnalyticsPage,suspendAnalytics,syncAnalyticsPreference} from '@/lib/analytics';
import {CONSENT_KEY} from '@/lib/analytics-policy.mjs';
import {BASIC_CHOICE_KEY} from '@/lib/traffic-aggregate-policy.mjs';
import {startTrafficAggregate,visitTrafficAggregate} from '@/lib/traffic-aggregate';

export function AnalyticsProvider() {
  const pathname=usePathname();
  useLayoutEffect(()=> { visitTrafficAggregate(pathname);if(analyticsAvailable) visitAnalyticsPage(); },[pathname]);
  useEffect(()=>startTrafficAggregate(),[]);
  useEffect(()=> {
    if(!analyticsAvailable) return;
    const leave=()=>suspendAnalytics();
    const resume=()=>visitAnalyticsPage();
    const storage=(event:StorageEvent)=>{if(event.key===CONSENT_KEY||event.key===BASIC_CHOICE_KEY||event.key===null)syncAnalyticsPreference();};
    window.addEventListener('pagehide',leave);window.addEventListener('pageshow',resume);window.addEventListener('storage',storage);
    window.addEventListener('passmate:traffic-preference',syncAnalyticsPreference);window.addEventListener('passmate:analytics-consent',syncAnalyticsPreference);
    return ()=>{window.removeEventListener('pagehide',leave);window.removeEventListener('pageshow',resume);window.removeEventListener('storage',storage);window.removeEventListener('passmate:traffic-preference',syncAnalyticsPreference);window.removeEventListener('passmate:analytics-consent',syncAnalyticsPreference);};
  },[]);
  return null;
}
