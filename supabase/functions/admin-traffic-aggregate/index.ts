import {createSupabaseContext} from 'npm:@supabase/server@1.7.0';
import {createAdminTrafficAggregateHandler} from '../_shared/traffic-aggregate-handlers.mjs';
import type {AggregateRequest} from '../_shared/traffic-aggregate-contract.mjs';
Deno.serve(async(req:Request)=>{
 let database:Awaited<ReturnType<typeof createSupabaseContext>>['data']|null=null;
 const handler=createAdminTrafficAggregateHandler({
  getConfig:()=>({enabled:Deno.env.get('PASSMATE_FIRST_PARTY_REPORTS_ENABLED')==='true'}),
  async resolveAdmin(request:Request){
   const {data:ctx,error}=await createSupabaseContext(request,{auth:'user'});if(error||!ctx?.userClaims?.id)return 401;
   const {data:profile,error:profileError}=await ctx.supabase.from('profiles').select('role').eq('id',ctx.userClaims.id).maybeSingle();if(profileError||profile?.role!=='admin')return 403;database=ctx;return true;
  },
  async readReport(request:AggregateRequest){const {data,error}=await database!.supabaseAdmin.rpc('read_traffic_aggregate_report',{p_start:request.startDate,p_end:request.endDate,p_dimension:request.dimension}).abortSignal(AbortSignal.timeout(5000));if(error)throw Error('aggregate_query_unavailable');return data;},
 });return handler(req);
});
