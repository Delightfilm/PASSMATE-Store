import {parseAggregatePacket,validateAggregateRequest} from './traffic-aggregate-contract.mjs';
import {aggregateToday,emptyAggregateReport,normalizeAggregateReport} from '../../../lib/admin-traffic-aggregate-view.mjs';
export const emptyTrafficResponse=status=>new Response(null,{status,headers:{'cache-control':'no-store'}});
export async function readTrafficPacket(request){
 if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))return {status:415};
 if(Number(request.headers.get('content-length'))>8192)return {status:413};
 const reader=request.body?.getReader();if(!reader)return {status:400};
 const chunks=[];let size=0;
 try{
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();return {status:413};}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  const packet=parseAggregatePacket(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),size);
  return packet?{packet}:{status:400};
 }catch{return {status:400};}finally{reader.releaseLock();}
}
function sameToken(a,b){if(typeof a!=='string'||typeof b!=='string'||!a.length||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
export function createTrafficIngestHandler({getConfig,ingest,sha256}){
 let active=0;
 return async request=>{
  if(request.method!=='POST')return emptyTrafficResponse(405);
  const cfg=getConfig();if(!cfg?.enabled||!cfg.ingestToken)return emptyTrafficResponse(503);
  if(!sameToken(request.headers.get('x-passmate-aggregate-token'),cfg.ingestToken))return emptyTrafficResponse(403);
  if(active>=2)return emptyTrafficResponse(429);active++;
  try{const read=await readTrafficPacket(request);if(read.status)return emptyTrafficResponse(read.status);await ingest(await sha256(read.packet.nonce),read.packet);return emptyTrafficResponse(204);}catch{return emptyTrafficResponse(503);}finally{active--;}
 };
}
export function createAdminTrafficAggregateHandler({resolveAdmin,getConfig,readReport,now=()=>new Date()}){
 const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'private, no-store'};
 const json=(status,value)=>new Response(JSON.stringify(value),{status,headers});
 return async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers});if(req.method!=='POST')return json(405,{error:'method_not_allowed'});
  let access;try{access=await resolveAdmin(req);}catch{return json(401,{error:'invalid_session'});}
  if(access!==true)return json(access===403?403:401,{error:access===403?'admin_required':'invalid_session'});
  let request;try{request=validateAggregateRequest(await req.json(),aggregateToday(now()));}catch{return json(400,{error:'invalid_request'});}
  if(!request)return json(400,{error:'invalid_request'});
  const config=getConfig();if(!config?.enabled)return json(200,emptyAggregateReport('notConfigured'));
  try{return json(200,normalizeAggregateReport(await readReport(request),request,now()));}catch{return json(200,emptyAggregateReport('error','query'));}
 };
}
