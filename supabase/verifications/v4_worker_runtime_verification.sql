-- PASSMATE V4 Worker runtime verification.

do $$
declare
  v_instance uuid := gen_random_uuid();
  v_ok boolean;
  v_mode text;
begin
  select public.report_worker_node(
    'verify-worker-v4',
    v_instance,
    'production',
    '0.4.0',
    null
  ) into v_ok;

  if v_ok is distinct from true then
    raise exception 'worker heartbeat RPC did not return true';
  end if;

  select mode
  into v_mode
  from public.worker_nodes
  where worker_id = 'verify-worker-v4'
    and instance_id = v_instance;

  if v_mode <> 'production' then
    raise exception 'worker runtime row mismatch';
  end if;

  delete from public.worker_nodes
  where worker_id = 'verify-worker-v4';
end;
$$;
