import type {AnalyticsRequest,AnalyticsResponse} from '../supabase/functions/_shared/analytics-contract.mjs';
export function derivePeriod(days:7|30|90,today:string):{startDate:string;endDate:string};
export function formatEngagement(seconds:number,sessions:number):string;
export function buildAnalyticsCsv(response:AnalyticsResponse):string;
export function reportStateMessage(response:Pick<AnalyticsResponse,'status'> & Partial<AnalyticsResponse>):string;
export function createReportLoader(fetchReport:(request:AnalyticsRequest,signal:AbortSignal)=>Promise<AnalyticsResponse>):{load(request:AnalyticsRequest,onValue:(response:AnalyticsResponse)=>void):Promise<void>;dispose():void};
