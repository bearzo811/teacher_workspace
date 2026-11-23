-- Shared paired whiteboard: choose a student, read their rewards, request use only.
begin;
create function public.get_pilot_display_backpack(device_token text,selected_student uuid default null,target_page integer default 1) returns jsonb
language plpgsql security definer set search_path='' as $$
declare classroom uuid:=pilot_private.require_display(device_token); room public.pilot_classes%rowtype; rewards jsonb:='[]'::jsonb; total integer:=0;
begin
 if target_page is null or target_page not between 1 and 20 then raise exception 'Invalid backpack page' using errcode='23514'; end if;
 select * into room from public.pilot_classes where id=classroom;
 if not('rewards'=any(room.enabled_modules)) then return jsonb_build_object('enabled',false,'students','[]'::jsonb,'rewards','[]'::jsonb,'total',0); end if;
 if selected_student is not null then
  if not exists(select 1 from public.pilot_students where class_id=classroom and id=selected_student and deleted_at is null) then raise exception 'Display student access denied' using errcode='42501'; end if;
  select count(*) into total from public.pilot_student_rewards where class_id=classroom and student_id=selected_student;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id),'[]'::jsonb) into rewards from (
   select id,item_name,item_icon,kind,description,source,price_paid,status,version,created_at from public.pilot_student_rewards
   where class_id=classroom and student_id=selected_student order by created_at desc,id limit 50 offset (target_page-1)*50
  ) r;
 end if;
 return jsonb_build_object('enabled',true,'students',coalesce((select jsonb_agg(jsonb_build_object('id',id,'seat',seat,'name',name) order by seat) from public.pilot_students where class_id=classroom and deleted_at is null),'[]'::jsonb),'rewards',rewards,'total',total);
end;$$;
create function public.request_pilot_display_reward(device_token text,target_student uuid,target_reward uuid,request_key uuid,expected_version integer) returns void
language plpgsql security definer set search_path='' as $$
declare classroom uuid:=pilot_private.require_display(device_token); teacher uuid; device uuid; reward public.pilot_student_rewards%rowtype; previous public.pilot_reward_history%rowtype;
begin
 select owner_id into teacher from public.pilot_classes where id=classroom and deleted_at is null and 'rewards'=any(enabled_modules) for update;
 if not found then raise exception 'Display backpack access denied' using errcode='42501'; end if;
 perform pilot_private.require_display(device_token);
 if not exists(select 1 from public.pilot_students where class_id=classroom and id=target_student and deleted_at is null) then raise exception 'Display student access denied' using errcode='42501'; end if;
 if request_key is null or expected_version is null or expected_version not between 1 and 1000000 then raise exception 'Invalid reward request' using errcode='23514'; end if;
 select * into previous from public.pilot_reward_history where class_id=classroom and request_id=request_key;
 if found then
  if previous.student_id<>target_student or previous.reward_id<>target_reward or previous.action<>'request' or previous.actor_kind<>'device' then raise exception 'Reward request conflict' using errcode='23514'; end if;
  return;
 end if;
 if exists(select 1 from public.pilot_reward_ledger where class_id=classroom and request_id=request_key) then raise exception 'Reward request conflict' using errcode='23514'; end if;
 select * into reward from public.pilot_student_rewards where class_id=classroom and student_id=target_student and id=target_reward for update;
 if not found then raise exception 'Display reward access denied' using errcode='42501'; end if;
 if reward.version<>expected_version then raise exception 'Reward version changed' using errcode='23514'; end if;
 if reward.status<>'available' then raise exception 'Reward not available' using errcode='23514'; end if;
 select id into device from public.pilot_display_devices where class_id=classroom and token_hash=encode(sha256(convert_to(device_token,'UTF8')),'hex');
 update public.pilot_student_rewards set status='requested',version=version+1,requested_at=now(),updated_at=now() where id=reward.id and class_id=classroom;
 insert into public.pilot_reward_history(class_id,student_id,reward_id,request_id,action,note,actor_id,actor_kind,device_id,from_status,to_status,version)
 values(classroom,target_student,reward.id,request_key,'request','白板使用申請',teacher,'device',device,'available','requested',reward.version+1);
end;$$;
revoke all on function public.get_pilot_display_backpack(text,uuid,integer),public.request_pilot_display_reward(text,uuid,uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.get_pilot_display_backpack(text,uuid,integer),public.request_pilot_display_reward(text,uuid,uuid,uuid,integer) to anon,authenticated;
commit;
