import {createSupabaseContext} from 'npm:@supabase/server@1.7.0';
import {createAdminMembersHandler} from '../_shared/admin-members-handler.mjs';
import type {MemberRequest} from '../../../lib/admin-members.d.mts';
type MemberReportArgs={p_admin_user_id:string;p_view:string;p_start:string;p_end:string;p_query:string;p_provider:string;p_page:number;p_period_only:boolean;p_member_id:string|null};
type Database={public:{Tables:{profiles:{Row:{id:string;role:string};Insert:{id:string;role?:string};Update:{role?:string};Relationships:[]}};Views:Record<string,never>;Functions:{admin_member_report:{Args:MemberReportArgs;Returns:unknown}};Enums:Record<string,never>;CompositeTypes:Record<string,never>}};
Deno.serve(async(request:Request)=>{
  let database:Awaited<ReturnType<typeof createSupabaseContext<Database>>>['data']|null=null;
  let actorId='';
  return createAdminMembersHandler({
    async resolveAdmin(req:Request){
      const {data:ctx,error}=await createSupabaseContext<Database>(req,{auth:'user'});
      if(error||!ctx?.userClaims?.id)return 401;
      const {data:profile,error:profileError}=await ctx.supabase.from('profiles').select('role').eq('id',ctx.userClaims.id).maybeSingle();
      if(profileError||profile?.role!=='admin')return 403;
      database=ctx;actorId=ctx.userClaims.id;return true;
    },
    async query(input:MemberRequest){
      const {data,error}=await database!.supabaseAdmin.rpc('admin_member_report',{
        p_admin_user_id:actorId,p_view:input.view,p_start:input.startDate,p_end:input.endDate,
        p_query:input.query||'',p_provider:input.provider||'all',p_page:input.page||1,p_period_only:input.periodOnly||false,p_member_id:input.memberId||null,
      });
      if(error)throw Error('member_report_unavailable');return data;
    },
  })(request);
});
