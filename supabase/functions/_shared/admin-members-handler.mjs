import {parseMemberRequest,normalizeMemberReport} from '../../../lib/admin-members.mjs';
export function createAdminMembersHandler({resolveAdmin,query,now=()=>new Date()}){
  const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'private, no-store'};
  const json=(status,value)=>new Response(JSON.stringify(value),{status,headers});
  return async req=>{
    if(req.method==='OPTIONS')return new Response('ok',{headers});
    if(req.method!=='POST')return json(405,{error:'method_not_allowed'});
    let access;try{access=await resolveAdmin(req);}catch{return json(401,{error:'invalid_session'});}
    if(access!==true)return json(access===403?403:401,{error:access===403?'admin_required':'invalid_session'});
    // Read a bounded stream; Content-Length alone cannot be trusted.
    const reader=req.body?.getReader();if(!reader)return json(400,{error:'invalid_request'});
    let input;
    try{
      const chunks=[];let size=0;
      while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();return json(413,{error:'request_too_large'});}chunks.push(value);}
      const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
      input=parseMemberRequest(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),now());
    }catch{return json(400,{error:'invalid_request'});}finally{reader.releaseLock();}
    if(!input)return json(400,{error:'invalid_request'});
    try{return json(200,normalizeMemberReport(await query(input),input,now()));}
    catch{return json(503,{error:'member_report_unavailable'});}
  };
}
