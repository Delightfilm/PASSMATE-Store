import {validateAnalyticsRequest,makeCacheKey,propertyToday} from './analytics-contract.mjs';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'private, no-store'};
export function emptyAnalyticsResponse(report,config=null) {
  return {status:'notConfigured',report,data:null,meta:{fetchedAt:null,timezone:config?.timezone||'Asia/Seoul',measurementStartedAt:config?.measurementStartedAt||null,thresholded:false,dataLossFromOtherRow:false,customDimensionsReady:config?.customDimensionsReady||false,signupSupported:config?.signupSupported||false,partialToday:false,rowLimit:100,unfilteredRealtime:report==='realtime'}};
}
export function createAdminAnalyticsHandler(deps) {
  const inFlight=new Map();
  const json=(status,value)=>new Response(JSON.stringify(value),{status,headers});
  return async req=> {
    if(req.method==='OPTIONS')return new Response('ok',{headers});
    if(req.method!=='POST')return json(405,{error:'method_not_allowed'});
    let access;try{access=await deps.resolveAdmin(req);}catch{return json(401,{error:'invalid_session'});}
    if(access!==true)return json(access===403?403:401,{error:access===403?'admin_required':'invalid_session'});
    const config=deps.getConfig();let request;
    try{request=validateAnalyticsRequest(await req.json(),deps.now(),config?.timezone||'Asia/Seoul');}catch{return json(400,{error:'invalid_analytics_request'});}
    if(!config)return json(200,emptyAnalyticsResponse(request.report));
    const ttl=request.report==='realtime'?60:900;
    const key=makeCacheKey(`${config.propertyId}:${config.timezone}:${config.customDimensionsReady}:${config.signupSupported}`,request);
    let cached=null;try{cached=await deps.readCache(key);}catch{/* Cache availability must not break reports. */}
    const age=cached?.meta?.fetchedAt?(deps.now().getTime()-Date.parse(cached.meta.fetchedAt))/1000:Infinity;
    if(cached && age>=0 && age<ttl)return json(200,cached);
    if(!inFlight.has(key))inFlight.set(key,(async()=>{
      try{
        const response=await deps.fetchReport(request);
        if(response.status==='ok'||response.status==='noData'){try{await deps.writeCache(key,response,ttl);}catch{/* Return uncached report. */}}
        return response;
      }catch(error){
        const errorCode=['permission','quota','network','configuration','incompatible'].includes(error?.code)?error.code:'network';
        if(cached?.data)return {...cached,status:'stale',errorCode};
        return {...emptyAnalyticsResponse(request.report,config),status:'error',errorCode};
      }
    })());
    try{return json(200,await inFlight.get(key));}finally{inFlight.delete(key);}
  };
}

export function reportMeta(request,config,now) {
  return {...emptyAnalyticsResponse(request.report,config).meta,fetchedAt:now.toISOString(),partialToday:request.endDate===propertyToday(now,config.timezone)};
}
