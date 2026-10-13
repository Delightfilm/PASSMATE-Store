import type {AnalyticsRequest,AnalyticsResponse,ReportData} from './analytics-contract.mjs';
export function createGoogleAnalyticsClient(config:{propertyId:string;serviceAccount:{client_email:string;private_key:string};fetch:typeof fetch;now:()=>Date}):{runReport(body:unknown):Promise<unknown>;runRealtimeReport(body:unknown):Promise<unknown>;getMetadata():Promise<unknown>;checkCompatibility(body:unknown):Promise<unknown>};
export function buildReportRequests(request:AnalyticsRequest):{kind:'standard'|'realtime';body:Record<string,unknown>}[];
export function normalizeReports(request:AnalyticsRequest,replies:unknown[],meta:AnalyticsResponse['meta']):ReportData;
