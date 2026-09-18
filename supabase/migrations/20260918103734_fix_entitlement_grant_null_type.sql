-- Correct the typed NULL in the order-scoped entitlement INSERT.
-- The original migration is also corrected for clean installs; this forward migration
-- repairs projects where preserve_entitlements_per_order was already applied.

create or replace function public.apply_payment_event(
  p_attempt_id uuid,
  p_provider text,
  p_provider_event_id text,
  p_event_type text,
  p_payload_sha256 text,
  p_provider_payment_id text default null,
  p_amount_krw integer default null,
  p_failure_code text default null,
  p_failure_detail text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.payment_attempts%rowtype;
  v_order public.orders%rowtype;
  v_event_inserted integer;
begin
  if p_event_type not in ('paid','failed','cancelled','refunded') then
    raise exception 'invalid payment event type'
      using errcode = 'check_violation';
  end if;

  if p_provider_event_id is null or length(p_provider_event_id) not between 1 and 160 then
    raise exception 'invalid provider event id'
      using errcode = 'check_violation';
  end if;

  if p_payload_sha256 is null or p_payload_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid payment payload fingerprint'
      using errcode = 'check_violation';
  end if;

  select *
  into v_attempt
  from public.payment_attempts
  where id = p_attempt_id
  for update;

  if not found then
    raise exception 'payment attempt not found'
      using errcode = 'no_data_found';
  end if;

  if v_attempt.provider <> p_provider then
    raise exception 'payment provider mismatch'
      using errcode = 'check_violation';
  end if;

  select *
  into v_order
  from public.orders
  where id = v_attempt.order_id
  for update;

  insert into public.payment_events (
    payment_attempt_id,
    order_id,
    provider,
    provider_event_id,
    event_type,
    provider_payment_id,
    amount_krw,
    payload_sha256,
    failure_code
  )
  values (
    v_attempt.id,
    v_attempt.order_id,
    p_provider,
    p_provider_event_id,
    p_event_type,
    p_provider_payment_id,
    p_amount_krw,
    p_payload_sha256,
    p_failure_code
  )
  on conflict (provider, provider_event_id) do nothing;

  get diagnostics v_event_inserted = row_count;
  if v_event_inserted = 0 then
    return 'duplicate';
  end if;

  if p_event_type = 'paid' then
    if v_attempt.status <> 'pending' or v_order.status <> 'payment_pending' then
      raise exception 'payment cannot be marked paid from current status'
        using errcode = 'check_violation';
    end if;

    if p_provider_payment_id is null or btrim(p_provider_payment_id) = '' then
      raise exception 'provider payment id required for paid event'
        using errcode = 'check_violation';
    end if;

    if p_amount_krw is null
       or p_amount_krw <> v_attempt.amount_krw
       or p_amount_krw <> v_order.total_amount_krw then
      raise exception 'verified payment amount mismatch'
        using errcode = 'check_violation';
    end if;

    update public.payment_attempts
    set
      status = 'paid',
      provider_payment_id = p_provider_payment_id,
      paid_at = now(),
      failure_code = null,
      failure_detail = null
    where id = v_attempt.id;

    update public.orders
    set status = 'paid'
    where id = v_order.id;

    if v_order.user_id is not null then
      insert into public.entitlements (
        user_id,
        product_id,
        product_version_id,
        source_order_id,
        status,
        granted_at,
        revoked_at
      )
      select distinct
        v_order.user_id,
        oi.product_id,
        oi.product_version_id,
        v_order.id,
        'active',
        now(),
        null::timestamptz
      from public.order_items oi
      where oi.order_id = v_order.id
      on conflict (
        user_id,
        source_order_id,
        product_id,
        product_version_id
      ) do nothing;
    end if;

    perform public.enqueue_order_issuance(v_order.id);
    return 'paid';

  elsif p_event_type = 'failed' then
    if v_attempt.status <> 'pending' or v_order.status <> 'payment_pending' then
      raise exception 'payment cannot fail from current status'
        using errcode = 'check_violation';
    end if;

    update public.payment_attempts
    set
      status = 'failed',
      failure_code = coalesce(p_failure_code, 'PAYMENT_FAILED'),
      failure_detail = left(p_failure_detail, 1000)
    where id = v_attempt.id;

    update public.orders
    set
      status = 'failed',
      failure_code = coalesce(p_failure_code, 'PAYMENT_FAILED'),
      failure_detail = left(p_failure_detail, 1000)
    where id = v_order.id;

    return 'failed';

  elsif p_event_type = 'cancelled' then
    if v_attempt.status <> 'pending' or v_order.status <> 'payment_pending' then
      raise exception 'payment cannot be cancelled from current status'
        using errcode = 'check_violation';
    end if;

    update public.payment_attempts
    set
      status = 'cancelled',
      cancelled_at = now()
    where id = v_attempt.id;

    update public.orders
    set status = 'cancelled'
    where id = v_order.id;

    return 'cancelled';

  else
    if v_attempt.status <> 'paid' or v_order.status <> 'paid' then
      raise exception 'payment cannot be refunded from current status'
        using errcode = 'check_violation';
    end if;

    if p_amount_krw is not null and p_amount_krw <> v_attempt.amount_krw then
      raise exception 'V3 supports full refund only'
        using errcode = 'check_violation';
    end if;

    update public.payment_attempts
    set
      status = 'refunded',
      refunded_at = now()
    where id = v_attempt.id;

    update public.orders
    set
      status = 'refunded',
      fulfillment_status = 'revoked'
    where id = v_order.id;

    return 'refunded';
  end if;
end;
$$;

revoke all on function public.apply_payment_event(
  uuid,text,text,text,text,text,integer,text,text
) from public, anon, authenticated;

grant execute on function public.apply_payment_event(
  uuid,text,text,text,text,text,integer,text,text
) to service_role;
