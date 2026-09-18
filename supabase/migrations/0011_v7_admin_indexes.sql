-- PASSMATE V7/V5 covering indexes flagged by Supabase Performance Advisor.

create index if not exists idx_admin_action_events_actor_user_id
  on public.admin_action_events(actor_user_id);

create index if not exists idx_download_events_issuance_job_id
  on public.download_events(issuance_job_id);
