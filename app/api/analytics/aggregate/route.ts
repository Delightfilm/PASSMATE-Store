import {createTrafficAggregateProxy} from '@/lib/traffic-aggregate-server.mjs';
import {publicQualifications} from '@/lib/cbt-home-catalog';
import {getPublicSupabaseConfig} from '@/lib/public-supabase-config';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const POST=createTrafficAggregateProxy({publicQualifications,getConfig(){
 const {url,key}=getPublicSupabaseConfig();
 return {enabled:process.env.PASSMATE_FIRST_PARTY_INGEST_ENABLED==='true'&&process.env.VERCEL_ENV==='production',supabaseUrl:url,apiKey:key,ingestToken:process.env.PASSMATE_AGGREGATE_INGEST_TOKEN||'',allowedOrigins:['https://www.mypassmate.com','https://mypassmate.com']};
}});
