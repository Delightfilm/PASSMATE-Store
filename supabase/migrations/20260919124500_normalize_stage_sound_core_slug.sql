update public.products
set slug = 'stage-sound-level-3'
where code = 'PM-SS3-CORE'
  and slug = 'stage-sound-level-3-core';

do $$
begin
  if not exists (
    select 1
    from public.products
    where code = 'PM-SS3-CORE'
      and slug = 'stage-sound-level-3'
  ) then
    raise exception 'PM-SS3-CORE slug normalization failed';
  end if;
end
$$;
