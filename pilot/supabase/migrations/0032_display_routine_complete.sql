-- Paired-device daily/return tasks, using existing opt-in reward rules.
begin;
alter table public.pilot_reward_ledger add column actor_kind text not null default 'teacher' check(actor_kind in ('teacher','device','system'));
alter table public.pilot_reward_ledger add column device_id uuid;
alter table public.pilot_reward_ledger add foreign key(class_id,device_id) references public.pilot_display_devices(class_id,id);
create table pilot_private.display_operation_context(
 backend integer not null,transaction_id bigint not null,class_id uuid not null,student_id uuid not null,device_id uuid not null,
 day date not null,task_key text not null,source_table text not null,primary key(backend,transaction_id)
);
revoke all on pilot_private.display_operation_context from public,anon,authenticated;
create function pilot_private.operation_device() returns uuid language sql stable security definer set search_path='' as $$
 select device_id from pilot_private.display_operation_context where backend=pg_backend_pid() and transaction_id=txid_current()
$$;
create function pilot_private.routine_actor(target_class uuid,target_student uuid,target_day date,target_task text,target_source text) returns uuid
language plpgsql security definer set search_path='' as $$
declare context pilot_private.display_operation_context%rowtype; teacher uuid;
begin
 select * into context from pilot_private.display_operation_context where backend=pg_backend_pid() and transaction_id=txid_current();
 if not found then return pilot_private.require_teacher(); end if;
 if context.class_id<>target_class or context.student_id<>target_student or context.day<>target_day or context.task_key<>target_task or context.source_table<>target_source then raise exception 'Device operation scope mismatch' using errcode='42501'; end if;
 select c.owner_id into teacher from public.pilot_display_devices d join public.pilot_classes c on c.id=d.class_id join public.pilot_teachers t on t.id=c.owner_id
 where d.id=context.device_id and d.class_id=target_class and d.revoked_at is null and d.expires_at>now() and c.deleted_at is null and t.active;
 if not found then raise exception 'Device operation access denied' using errcode='42501'; end if;
 return teacher;
end;$$;
create or replace function pilot_private.apply_routine_reward() returns trigger
language plpgsql security definer set search_path='' as $$
declare teacher uuid; kind text; effect public.pilot_routine_reward_effects%rowtype; rules public.pilot_reward_rules%rowtype; enabled boolean; coins_delta integer; xp_delta integer; current_xp bigint; entry_id uuid;
begin
 if TG_OP='UPDATE' and new.completed=old.completed then return new; end if;
 if not new.completed and TG_OP='INSERT' then return new; end if;
 teacher:=pilot_private.routine_actor(new.class_id,new.student_id,new.day,new.task_key,TG_TABLE_NAME);
 perform 1 from public.pilot_classes where id=new.class_id and owner_id=teacher and deleted_at is null for update;
 if not found then raise exception 'Routine reward class access denied' using errcode='42501'; end if;
 kind:=case when TG_TABLE_NAME='pilot_return_checks' then 'return_day' else 'routine' end;
 select * into effect from public.pilot_routine_reward_effects where class_id=new.class_id and student_id=new.student_id and day=new.day and task_key=new.task_key for update;
 if new.completed then
  select s.enabled and 'rewards'=any(c.enabled_modules) into enabled from public.pilot_routine_reward_settings s join public.pilot_classes c on c.id=s.class_id where s.class_id=new.class_id;
  -- Do not award backdated/future entries or replay already-completed records.
  if enabled is distinct from true or new.day<>pilot_private.reward_today() then return new; end if;
  if effect.active then return new; end if;
  if effect.class_id is null then
   select * into rules from public.pilot_reward_rules where class_id=new.class_id;
   if not found then return new; end if;
   insert into public.pilot_routine_reward_effects(class_id,student_id,day,task_key,source_kind,active,coins,xp,rule_version)
   values(new.class_id,new.student_id,new.day,new.task_key,kind,false,(rules.rules->>'routine_coins')::integer,(rules.rules->>'routine_xp')::integer,rules.version) returning * into effect;
  end if;
  coins_delta:=effect.coins; xp_delta:=effect.xp;
 else
  if effect.active is distinct from true then return new; end if;
  select xp_total into current_xp from public.pilot_reward_balances where class_id=new.class_id and student_id=new.student_id;
  coins_delta:=-effect.coins; xp_delta:=-least(effect.xp,coalesce(current_xp,0));
 end if;
 if coins_delta<>0 or xp_delta<>0 then
  insert into public.pilot_reward_ledger(class_id,student_id,request_id,coin_delta,xp_delta,reason,actor_id,actor_kind,device_id)
  values(new.class_id,new.student_id,gen_random_uuid(),coins_delta,xp_delta,
   case when new.completed then '生活任務完成：' else '生活任務取消回沖：' end || new.day::text || ' ' || new.task_key,teacher,case when pilot_private.operation_device() is null then 'teacher' else 'device' end,pilot_private.operation_device()) returning id into entry_id;
  insert into public.pilot_reward_balances(class_id,student_id,coin_net,xp_total) values(new.class_id,new.student_id,0,0) on conflict(class_id,student_id) do nothing;
  update public.pilot_reward_balances set coin_net=coin_net+coins_delta,xp_total=xp_total+xp_delta where class_id=new.class_id and student_id=new.student_id;
  insert into public.pilot_routine_reward_entries(ledger_id,class_id,student_id,day,task_key) values(entry_id,new.class_id,new.student_id,new.day,new.task_key);
 end if;
 update public.pilot_routine_reward_effects set active=new.completed where class_id=new.class_id and student_id=new.student_id and day=new.day and task_key=new.task_key;
 return new;
end;
$$;

create table public.pilot_display_routine_receipts(
 id uuid primary key default gen_random_uuid(),class_id uuid not null,student_id uuid not null,device_id uuid not null,
 request_id uuid not null,day date not null,task_key text not null,source_kind text not null check(source_kind in ('routine','return_day')),
 changed boolean not null,created_at timestamptz not null default now(),unique(class_id,request_id),
 foreign key(class_id,student_id) references public.pilot_students(class_id,id),
 foreign key(class_id,device_id) references public.pilot_display_devices(class_id,id)
);
alter table public.pilot_display_routine_receipts enable row level security;
revoke all on public.pilot_display_routine_receipts from public,anon,authenticated;
grant select on public.pilot_display_routine_receipts to authenticated;
create policy display_routine_receipt_owner on public.pilot_display_routine_receipts for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id and 'routines'=any(c.enabled_modules)));
create function public.complete_pilot_display_routine(device_token text,target_student uuid,routine_key text,request_key uuid) returns void
language plpgsql security definer set search_path='' as $$
declare classroom uuid:=pilot_private.require_display(device_token); today date:=pilot_private.display_today(); term uuid; device uuid; source text; done boolean; previous public.pilot_display_routine_receipts%rowtype;
begin
 perform 1 from public.pilot_classes where id=classroom and deleted_at is null and 'routines'=any(enabled_modules) for update;
 if not found then raise exception 'Display routine access denied' using errcode='42501'; end if;
 perform pilot_private.require_display(device_token);
 if request_key is null or routine_key is null then raise exception 'Routine request required' using errcode='23514'; end if;
 if not exists(select 1 from public.pilot_students where class_id=classroom and id=target_student and deleted_at is null) then raise exception 'Display student access denied' using errcode='42501'; end if;
 select * into previous from public.pilot_display_routine_receipts where class_id=classroom and request_id=request_key;
 if found then
  if previous.student_id<>target_student or previous.task_key<>routine_key then raise exception 'Routine request conflict' using errcode='23514'; end if;
  return;
 end if;
 if exists(select 1 from public.pilot_attendance where class_id=classroom and student_id=target_student and day=today and absent) then raise exception 'Student is absent' using errcode='23514'; end if;
 select id into term from public.pilot_terms where class_id=classroom and active;
 if term is not null and pilot_private.is_school_day(term,today) then
  source:='routine';
  if routine_key not in ('morning_cleaning','contact_book_copied','lunch_brushing','noon_cleaning') then raise exception 'Invalid routine task' using errcode='23514'; end if;
  if routine_key='contact_book_copied' and (not exists(select 1 from public.pilot_classes where id=classroom and 'homework'=any(enabled_modules)) or not exists(select 1 from public.pilot_contact_days where class_id=classroom and term_id=term and day=today)) then raise exception 'Contact book required' using errcode='23514'; end if;
  select completed into done from public.pilot_routine_checks where class_id=classroom and term_id=term and student_id=target_student and day=today and task_key=routine_key;
 else
  source:='return_day';
  if routine_key not in ('morning_cleaning','summer_homework_submitted') or not exists(select 1 from public.pilot_return_days where class_id=classroom and day=today and enabled) then raise exception 'Active routine or return day required' using errcode='23514'; end if;
  select completed into done from public.pilot_return_checks where class_id=classroom and student_id=target_student and day=today and task_key=routine_key;
 end if;
 select id into device from public.pilot_display_devices where class_id=classroom and token_hash=encode(sha256(convert_to(device_token,'UTF8')),'hex');
 if done is distinct from true then
  insert into pilot_private.display_operation_context(backend,transaction_id,class_id,student_id,device_id,day,task_key,source_table)
  values(pg_backend_pid(),txid_current(),classroom,target_student,device,today,routine_key,case when source='routine' then 'pilot_routine_checks' else 'pilot_return_checks' end);
  if source='routine' then
   insert into public.pilot_routine_checks(class_id,term_id,student_id,day,task_key,completed,completed_at)
   values(classroom,term,target_student,today,routine_key,true,now())
   on conflict(term_id,student_id,day,task_key) do update set completed=true,completed_at=now(),updated_at=now();
  else
   insert into public.pilot_return_checks(class_id,student_id,day,task_key,completed,completed_at)
   values(classroom,target_student,today,routine_key,true,now())
   on conflict(class_id,day,student_id,task_key) do update set completed=true,completed_at=now(),updated_at=now();
  end if;
  delete from pilot_private.display_operation_context where backend=pg_backend_pid() and transaction_id=txid_current();
 end if;
 insert into public.pilot_display_routine_receipts(class_id,student_id,device_id,request_id,day,task_key,source_kind,changed)
 values(classroom,target_student,device,request_key,today,routine_key,source,done is distinct from true);
end;$$;
revoke all on function pilot_private.operation_device(),pilot_private.routine_actor(uuid,uuid,date,text,text),pilot_private.apply_routine_reward(),public.complete_pilot_display_routine(text,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.complete_pilot_display_routine(text,uuid,text,uuid) to anon,authenticated;
commit;
