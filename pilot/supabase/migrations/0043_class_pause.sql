-- Reversible class suspension. No account deletion or physical data cleanup.
begin;
create table pilot_private.class_lifecycle_events(
 id uuid primary key default gen_random_uuid(),class_id uuid not null references public.pilot_classes(id),
 actor_id uuid not null references public.pilot_teachers(id),request_id uuid not null,
 action text not null check(action in ('pause','resume')),expected_paused_at timestamptz,
 note text not null check(char_length(btrim(note)) between 1 and 200),created_at timestamptz not null default now(),
 unique(actor_id,request_id)
);
revoke all on pilot_private.class_lifecycle_events from public,anon,authenticated;

create function public.list_pilot_paused_classes() returns jsonb
language plpgsql security definer set search_path='' as $$
declare teacher uuid:=pilot_private.require_teacher();
begin
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'paused_at',deleted_at) order by deleted_at desc,id)
 from public.pilot_classes where owner_id=teacher and deleted_at is not null),'[]'::jsonb);
end;$$;

create function public.change_pilot_class_state(target_class uuid,class_action text,expected_paused_at timestamptz,request_key uuid,action_note text) returns void
language plpgsql security definer set search_path='' as $$
declare teacher uuid:=pilot_private.require_teacher(); classroom public.pilot_classes%rowtype; prior pilot_private.class_lifecycle_events%rowtype; setting_table text; shop public.pilot_shop_settings%rowtype;
begin
 if class_action is null or class_action not in ('pause','resume') or request_key is null or action_note is null or char_length(btrim(action_note)) not between 1 and 200 then raise exception 'Invalid class state request' using errcode='23514'; end if;
 -- Same teacher lock as class creation: recovery cannot race a new active class.
 perform pg_advisory_xact_lock(hashtextextended(teacher::text,0));
 select * into classroom from public.pilot_classes where id=target_class and owner_id=teacher for update;
 if not found then raise exception 'Class state access denied' using errcode='42501'; end if;
 select * into prior from pilot_private.class_lifecycle_events where actor_id=teacher and request_id=request_key;
 if found then
  if prior.class_id<>target_class or prior.action<>class_action or prior.expected_paused_at is distinct from expected_paused_at or prior.note<>btrim(action_note) then raise exception 'Class state request conflict' using errcode='23514'; end if;
  return;
 end if;
 if classroom.deleted_at is distinct from expected_paused_at then raise exception 'Class state changed; reload' using errcode='40001'; end if;
 if class_action='pause' then
  if classroom.deleted_at is not null then raise exception 'Class already paused' using errcode='23514'; end if;
  -- Revoke rather than just hide: old whiteboard tokens never recover on resume.
  update public.pilot_display_devices set revoked_at=coalesce(revoked_at,now()),code_hash=null where class_id=target_class and revoked_at is null;
  foreach setting_table in array array['pilot_routine_reward_settings','pilot_reading_reward_settings','pilot_passport_reward_settings','pilot_homework_reward_settings','pilot_passport_overdue_settings'] loop
   execute format('update public.%I set enabled=false,actor_id=$2,updated_at=now() where class_id=$1 and enabled',setting_table) using target_class,teacher;
  end loop;
  select * into shop from public.pilot_shop_settings where class_id=target_class;
  if found and shop.is_open then
   insert into public.pilot_shop_setting_history(class_id,version,is_open,actor_id) values(target_class,shop.version+1,false,teacher);
   update public.pilot_shop_settings set is_open=false,version=shop.version+1,actor_id=teacher,updated_at=now() where class_id=target_class;
  end if;
  update public.pilot_classes set deleted_at=now() where id=target_class;
 else
  if classroom.deleted_at is null then raise exception 'Class is not paused' using errcode='23514'; end if;
  if exists(select 1 from public.pilot_classes where owner_id=teacher and deleted_at is null and id<>target_class) then raise exception 'Another class is active' using errcode='23514'; end if;
  update public.pilot_classes set deleted_at=null where id=target_class;
 end if;
 insert into pilot_private.class_lifecycle_events(class_id,actor_id,request_id,action,expected_paused_at,note) values(target_class,teacher,request_key,class_action,expected_paused_at,btrim(action_note));
end;$$;
revoke all on function public.list_pilot_paused_classes(),public.change_pilot_class_state(uuid,text,timestamptz,uuid,text) from public,anon,authenticated;
grant execute on function public.list_pilot_paused_classes(),public.change_pilot_class_state(uuid,text,timestamptz,uuid,text) to authenticated;
commit;
