export type TrafficProxyConfig={enabled:boolean;supabaseUrl:string;apiKey:string;ingestToken:string;allowedOrigins:string[]};
export function createTrafficAggregateProxy(deps:{getConfig:()=>TrafficProxyConfig;publicQualifications:readonly {slug:string}[];forward?:typeof fetch;now?:()=>number}):(request:Request)=>Promise<Response>;
