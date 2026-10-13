import type {AnalyticsRequest,AnalyticsResponse,AnalyticsServerConfig,ReportKind} from './analytics-contract.mjs';
export function emptyAnalyticsResponse(report:ReportKind,config?:AnalyticsServerConfig|null):AnalyticsResponse;
export function reportMeta(request:AnalyticsRequest,config:AnalyticsServerConfig,now:Date):AnalyticsResponse['meta'];
export function createAdminAnalyticsHandler(deps:{resolveAdmin:(req:Request)=>Promise<401|403|true>;getConfig:()=>AnalyticsServerConfig|null;fetchReport:(request:AnalyticsRequest)=>Promise<AnalyticsResponse>;readCache:(key:string)=>Promise<AnalyticsResponse|null>;writeCache:(key:string,value:AnalyticsResponse,ttlSeconds:number)=>Promise<void>;now:()=>Date}):(req:Request)=>Promise<Response>;
