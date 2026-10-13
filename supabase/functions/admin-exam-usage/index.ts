import {createSupabaseContext} from 'npm:@supabase/server@1.7.0';
import {createExamUsageHandler} from '../_shared/exam-usage.mjs';
Deno.serve(async(request:Request)=>{
  let database:Awaited<ReturnType<typeof createSupabaseContext>>['data']|null=null;
  const handler=createExamUsageHandler({now:()=>new Date(),
    async resolveAdmin(req){
      const {data:ctx,error}=await createSupabaseContext(req,{auth:'user'});
      if(error||!ctx?.userClaims?.id)return 401;
      const {data:profile,error:profileError}=await ctx.supabase.from('profiles').select('role').eq('id',ctx.userClaims.id).maybeSingle();
      if(profileError||profile?.role!=='admin')return 403;database=ctx;return true;
    },
    async query(input){
      const {data,error}=await database!.supabaseAdmin.rpc('admin_exam_usage',{p_start:input.startDate,p_end:input.endDate,p_group:input.groupBy});
      if(error)throw Error('exam_usage_unavailable');return data;
    },
  });return handler(request);
});
