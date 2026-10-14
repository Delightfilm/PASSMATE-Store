import {parseAggregatePacket} from './traffic-aggregate-contract.mjs';
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
