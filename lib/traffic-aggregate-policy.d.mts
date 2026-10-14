import type {AggregatePacket} from '../supabase/functions/_shared/traffic-aggregate-contract.mjs';
export const BASIC_CHOICE_KEY:string;
export type TrafficChoice={basic:boolean;ga4:boolean};
export type TrafficSource='naver'|'google'|'daum'|'bing'|'social'|'other'|'unknown';
export function trafficPageKey(pathname:string,qualifications:readonly {slug:string}[]):string|null;
export function verifyTrafficPageKeys(packet:AggregatePacket,qualifications:readonly {slug:string}[]):boolean;
export function classifyTrafficSource(referrer:string,siteOrigin:string):TrafficSource;
export function resolveTrafficChoice(input:{legacyConsent?:string|null;basicChoice?:string|null;gpc?:boolean;storageReadable?:boolean}):TrafficChoice;
