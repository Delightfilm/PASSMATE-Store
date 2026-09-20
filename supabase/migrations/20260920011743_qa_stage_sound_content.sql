do $$
begin
  if (
    select count(*)
    from public.products
    where code in ('PM-SS3-CORE', 'PM-SS3-PASS')
  ) <> 2 then
    raise exception 'Stage Sound CORE/PASS products must exist before content QA';
  end if;

  update public.products
  set
    subtitle = '핵심요약 + 공식·숫자 치트시트 + 시험직전 체크리스트',
    description = '공식 자료 확보와 콘텐츠 QA를 거쳐 제작할 무대예술전문인 자격시험 무대음향 3급 핵심요약 패키지의 비공개 초안입니다.',
    badge = 'DRAFT · QA 중',
    features = '["CORE 핵심요약","SHEET 공식·숫자 치트시트","CHECK 시험직전 체크리스트"]'::jsonb,
    is_active = false,
    updated_at = now()
  where code = 'PM-SS3-CORE';

  update public.products
  set
    subtitle = '상세 합격교재 + 핵심요약 + 공식·숫자 치트시트 + 시험직전 체크리스트',
    description = '공식 자료 확보와 콘텐츠 QA를 거쳐 제작할 무대예술전문인 자격시험 무대음향 3급 합격팩의 비공개 초안입니다.',
    badge = 'DRAFT · QA 중',
    features = '["PASS PACK 상세 합격교재","CORE 핵심요약","SHEET 공식·숫자 치트시트","CHECK 시험직전 체크리스트"]'::jsonb,
    is_active = false,
    updated_at = now()
  where code = 'PM-SS3-PASS';
end
$$;
