import type {AggregateRequest,AggregateMetrics,AggregateRow} from '../supabase/functions/_shared/traffic-aggregate-contract.mjs';
export type AggregateResponse={status:'ok'|'noData'|'error'|'notConfigured';data:null|{totals:AggregateMetrics;rows:AggregateRow[]};meta:{source:'firstParty';timezone:'Asia/Seoul';measurementStartedAt:string|null;fetchedAt:string|null;partialToday:boolean;rowLimit:100;thresholded:boolean;maintenanceHealthy:boolean};errorCode?:'permission'|'configuration'|'network'|'query'};
export function aggregateToday(now:Date):string;
export function emptyAggregateReport(status?:AggregateResponse['status'],errorCode?:AggregateResponse['errorCode']):AggregateResponse;
export function normalizeAggregateReport(raw:unknown,request:AggregateRequest,now:Date):AggregateResponse;
export function formatAggregateTime(activeMs:number,pageViews:number):string;
export function aggregateRowLabel(key:string):string;
export function buildAggregateCsv(response:AggregateResponse,request:AggregateRequest):string;
export function createAggregateReportLoader(fetchReport:(request:AggregateRequest,signal:AbortSignal)=>Promise<AggregateResponse>):{load:(request:AggregateRequest,onValue:(value:AggregateResponse)=>void)=>Promise<void>;cancel:()=>void};
