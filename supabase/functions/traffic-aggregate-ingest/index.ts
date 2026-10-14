import {createClient} from 'npm:@supabase/supabase-js@2.116.0';
import {createTrafficIngestHandler} from '../_shared/traffic-aggregate-handlers.mjs';
const handler=createTrafficIngestHandler({
 getConfig:()=>({enabled:Deno.env.get('PASSMATE_FIRST_PARTY_INGEST_ENABLED')==='true',ingestToken:Deno.env.get('PASSMATE_AGGREGATE_INGEST_TOKEN')||''}),
 async sha256(nonce:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(nonce)))].map(b=>b.toString(16).padStart(2,'0')).join('');},
 async ingest(digest:string,packet:unknown){
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await db.rpc('ingest_traffic_aggregates',{p_digest:digest,p_packet:packet});if(error)throw Error('aggregate_unavailable');return data===true;
 },
});
Deno.serve(handler);
