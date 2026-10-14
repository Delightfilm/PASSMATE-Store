import {readTrafficPacket,emptyTrafficResponse} from '../supabase/functions/_shared/traffic-aggregate-handlers.mjs';
import {verifyTrafficPageKeys} from './traffic-aggregate-policy.mjs';
export function createTrafficAggregateProxy({getConfig,publicQualifications,forward=fetch}){
 let active=0;
 return async request=>{
  if(request.method!=='POST')return emptyTrafficResponse(405);
  const cfg=getConfig();if(!cfg?.enabled||!cfg.supabaseUrl||!cfg.apiKey||!cfg.ingestToken)return emptyTrafficResponse(503);
  const origin=request.headers.get('origin');
  if(!origin||!cfg.allowedOrigins.includes(origin)||new URL(request.url).origin!==origin||request.headers.get('sec-fetch-site')==='cross-site')return emptyTrafficResponse(403);
  if(active>=2)return emptyTrafficResponse(429);active++;
  try{
   const read=await readTrafficPacket(request);if(read.status)return emptyTrafficResponse(read.status);
   if(!verifyTrafficPageKeys(read.packet,publicQualifications))return emptyTrafficResponse(400);
   const response=await forward(`${cfg.supabaseUrl.replace(/\/$/,'')}/functions/v1/traffic-aggregate-ingest`,{method:'POST',headers:{'Content-Type':'application/json',apikey:cfg.apiKey,'x-passmate-aggregate-token':cfg.ingestToken},body:JSON.stringify(read.packet),credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',signal:AbortSignal.timeout(5000)});
   return emptyTrafficResponse(response.status===204?204:[400,403,413,415,429].includes(response.status)?response.status:503);
  }catch{return emptyTrafficResponse(503);}finally{active--;}
 };
}
