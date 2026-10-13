import {createSupabaseContext} from 'npm:@supabase/server@1.7.0';
import {createAdminAnalyticsHandler,reportMeta} from '../_shared/analytics-handler.mjs';
import {createGoogleAnalyticsClient,buildReportRequests,normalizeReports} from '../_shared/analytics-google.mjs';
import {makeCacheKey} from '../_shared/analytics-contract.mjs';
import type {AnalyticsRequest,AnalyticsResponse,AnalyticsServerConfig} from '../_shared/analytics-contract.mjs';

function getConfig():AnalyticsServerConfig|null {
  if(Deno.env.get('PASSMATE_ANALYTICS_REPORTS_ENABLED')!=='true')return null;
  try {
    const propertyId=Deno.env.get('GA4_PROPERTY_ID')||'',serviceAccount=JSON.parse(Deno.env.get('GA4_SERVICE_ACCOUNT_JSON')||'null');
    const timezone=Deno.env.get('GA4_PROPERTY_TIMEZONE')||'Asia/Seoul';
    new Intl.DateTimeFormat('en-CA',{timeZone:timezone});
    if(!/^\d+$/.test(propertyId)||!serviceAccount?.client_email?.endsWith('.gserviceaccount.com')||!serviceAccount?.private_key?.startsWith('-----BEGIN PRIVATE KEY-----'))return null;
    const start=Deno.env.get('GA4_MEASUREMENT_STARTED_AT');
    return {propertyId,serviceAccount,timezone,measurementStartedAt:start&&Number.isFinite(Date.parse(start))?new Date(start).toISOString():null,customDimensionsReady:Deno.env.get('GA4_CUSTOM_DIMENSIONS_READY')==='true',signupSupported:Deno.env.get('GA4_SIGNUP_SUPPORTED')==='true'};
  }catch{return null;}
}
let clientKey='',client:ReturnType<typeof createGoogleAnalyticsClient>|null=null;
const compatibility=new Map<string,number>(),pending=new Map<string,Promise<AnalyticsResponse>>();
let metadata:{expires:number;dimensions:Set<string>}|null=null;
async function fetchReport(request:AnalyticsRequest):Promise<AnalyticsResponse> {
  const config=getConfig();if(!config)throw Object.assign(Error('analytics_configuration'),{code:'configuration'});
  const key=makeCacheKey(`${config.propertyId}:${config.customDimensionsReady}:${config.signupSupported}`,request);
  if(pending.has(key))return pending.get(key)!;
  const task=(async()=>{
    const nextKey=`${config.propertyId}:${config.serviceAccount.client_email}:${config.serviceAccount.private_key}`;
    if(clientKey!==nextKey){clientKey=nextKey;client=createGoogleAnalyticsClient({...config,fetch,now:()=>new Date()});compatibility.clear();metadata=null;}
    const google=client!;
    if(request.report==='qualifications'&&!config.customDimensionsReady)throw Object.assign(Error('analytics_configuration'),{code:'configuration'});
    if(request.report!=='realtime'&&(!metadata||metadata.expires<Date.now())){
      const reply=await google.getMetadata() as {dimensions?:{apiName:string}[]};
      metadata={expires:Date.now()+86400000,dimensions:new Set((reply.dimensions||[]).map(x=>x.apiName))};
    }
    const specifications=buildReportRequests(request),replies:unknown[]=[];
    for(let offset=0;offset<specifications.length;offset+=2){
      const batch=await Promise.all(specifications.slice(offset,offset+2).map(async spec=>{
        if(spec.kind==='realtime')return google.runRealtimeReport(spec.body);
        const body=spec.body as {dimensions?:{name:string}[];metrics?:{name:string}[];dimensionFilter?:unknown};
        if(body.dimensions?.some(x=>x.name.startsWith('customEvent:')&&!metadata?.dimensions.has(x.name)))throw Object.assign(Error('analytics_configuration'),{code:'configuration'});
        const check={dimensions:body.dimensions,metrics:body.metrics,dimensionFilter:body.dimensionFilter},checkKey=JSON.stringify(check);
        if((compatibility.get(checkKey)||0)<Date.now()){
          const reply=await google.checkCompatibility(check) as {dimensionCompatibilities?:{compatibility:string}[];metricCompatibilities?:{compatibility:string}[]};
          if([...(reply.dimensionCompatibilities||[]),...(reply.metricCompatibilities||[])].some(x=>x.compatibility!=='COMPATIBLE'))throw Object.assign(Error('analytics_incompatible'),{code:'incompatible'});
          compatibility.set(checkKey,Date.now()+86400000);if(compatibility.size>200)compatibility.delete(compatibility.keys().next().value!);
        }
        return google.runReport(spec.body);
      }));replies.push(...batch);
    }
    const meta=reportMeta(request,config,new Date()),data=normalizeReports(request,replies,meta);
    const hasData=Object.values(data.totals).some(value=>value>0)||data.rows.length>0;
    return {status:!hasData&&!config.measurementStartedAt?'noData':'ok',report:request.report,data,meta};
  })();pending.set(key,task);
  try{return await task;}finally{pending.delete(key);}
}

Deno.serve(async(req:Request)=>{
  let database:Awaited<ReturnType<typeof createSupabaseContext>>['data']|null=null;
  const handler=createAdminAnalyticsHandler({getConfig,fetchReport,now:()=>new Date(),
    async resolveAdmin(request) {
      const {data:ctx,error}=await createSupabaseContext(request,{auth:'user'});
      if(error||!ctx?.userClaims?.id)return 401;
      const {data:profile,error:profileError}=await ctx.supabase.from('profiles').select('role').eq('id',ctx.userClaims.id).maybeSingle();
      if(profileError||profile?.role!=='admin')return 403;
      database=ctx;return true;
    },
    async readCache(key) {
      const {data,error}=await database!.supabaseAdmin.from('admin_analytics_report_cache').select('payload').eq('cache_key',key).maybeSingle();
      if(error)throw Error('cache_unavailable');return data?.payload as AnalyticsResponse|null;
    },
    async writeCache(key,value,ttlSeconds) {
      const db=database!.supabaseAdmin;
      const {error}=await db.from('admin_analytics_report_cache').upsert({cache_key:key,payload:value,fetched_at:value.meta.fetchedAt,expires_at:new Date(Date.now()+ttlSeconds*1000).toISOString()});
      if(error)throw Error('cache_unavailable');
      await db.from('admin_analytics_report_cache').delete().lt('expires_at',new Date(Date.now()-86400000).toISOString());
    },
  });
  return handler(req);
});
