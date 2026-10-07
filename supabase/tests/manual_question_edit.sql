begin;
do $$
declare
 actor uuid; ref text:='ed17ed17ed17ed17ed17'; result jsonb; count_before bigint;
 source jsonb:='{"stem":"검증 전용 문제","choices":[{"label":"①","text":"가","images":[]},{"label":"②","text":"나","images":[]},{"label":"③","text":"다","images":[]},{"label":"④","text":"라","images":[]}],"answer":0,"explanation":"","images":[]}';
 patch jsonb:='{"schemaVersion":2,"stem":"검증 전용 수정","choices":[{"label":"①","text":"가","images":[]},{"label":"②","text":"나","images":[]},{"label":"③","text":"다","images":[]},{"label":"④","text":"라","images":[]},{"label":"⑤","text":"마","images":[]}],"answer":1,"acceptedAnswers":[1,4],"explanation":"검증","images":[]}';
begin
 select id into actor from public.profiles where role='admin' and private.is_designated_admin_user(id) limit 1;
 if actor is null then raise exception 'designated_admin_missing'; end if;
 if exists(select 1 from public.question_bank_question_corrections where question_ref=ref) then raise exception 'test_ref_collision'; end if;
 select count(*) into count_before from public.question_bank_review_events;
 result:=public.save_question_bank_edit(actor,ref,'qa-editor','qa-source',patch,source,0,'rollback-only editor QA');
 if result->>'version'<>'1' then raise exception 'version_failed'; end if;
 if not exists(select 1 from public.question_bank_question_corrections where question_ref=ref and content->'acceptedAnswers'='[1,4]'::jsonb and jsonb_array_length(content->'choices')=5) then raise exception 'multi_answer_failed'; end if;
 if (select count(*) from public.question_bank_review_events)<>count_before+1 then raise exception 'audit_missing'; end if;
 result:=public.save_question_bank_edit(actor,ref,'qa-editor','qa-source',patch,source,1,'idempotent QA');
 if result->>'changed'<>'false' or result->>'version'<>'1' then raise exception 'idempotency_failed'; end if;
 begin
  perform public.save_question_bank_edit(actor,ref,'qa-editor','qa-source',patch,source,0,'stale QA');
  raise exception 'stale_write_allowed';
 exception when others then if sqlerrm<>'question_version_conflict' then raise; end if; end;
 begin
  perform public.save_question_bank_edit(null,ref,'qa-editor','qa-source',patch,source,1,'auth QA');
  raise exception 'unauthorized_write_allowed';
 exception when insufficient_privilege then null; end;
 begin
  perform public.save_question_bank_edit(actor,ref,'qa-editor','qa-source',jsonb_set(patch,'{acceptedAnswers}','[]'),source,1,'invalid QA');
  raise exception 'empty_answers_allowed';
 exception when others then if sqlerrm<>'invalid_question_patch' then raise; end if; end;
 begin
  perform public.save_question_bank_edit(actor,ref,'qa-editor','qa-source',jsonb_set(patch,'{images}','["http://192.168.0.48/private"]'),source,1,'image QA');
  raise exception 'private_image_allowed';
 exception when others then if sqlerrm<>'invalid_question_image' then raise; end if; end;
 insert into public.question_bank_issue_reports(id,question_ref,qualification_code,kind,memo) values('qa-editor-rollback-only',ref,'qa-editor','other','rollback-only fixture');
 result:=public.save_question_bank_edit(actor,ref,'qa-editor','qa-source',jsonb_set(patch,'{stem}','"신고 수정 검증"'),source,1,'review QA','qa-editor-rollback-only',true);
 if result->>'version'<>'2' or result->>'resolved'<>'true' or not exists(select 1 from public.question_bank_issue_reports where id='qa-editor-rollback-only' and status='resolved' and resolved_by=actor) then raise exception 'atomic_resolve_failed'; end if;
 if (select count(*) from public.question_bank_review_events)<>count_before+3 then raise exception 'atomic_audit_failed'; end if;
 if has_function_privilege('anon','public.save_question_bank_edit(uuid,text,text,text,jsonb,jsonb,integer,text,text,boolean)','execute') or has_function_privilege('authenticated','public.save_question_bank_edit(uuid,text,text,text,jsonb,jsonb,integer,text,text,boolean)','execute') then raise exception 'public_rpc_exposed'; end if;
end;
$$;
rollback;
select 'PASS: rollback-only manual save, variable choices, accepted answers, audit, conflict, authorization, invalid payload/image, atomic report resolution, service-only privileges' result;
