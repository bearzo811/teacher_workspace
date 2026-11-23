-- Device learning completion is one-way; teacher cancellation retains reversal semantics.
begin;
create or replace function pilot_private.apply_passport_reward() returns trigger
language plpgsql security definer set search_path='' as $$
declare teacher uuid; effect public.pilot_passport_reward_effects%rowtype; passport public.pilot_passports%rowtype; term public.pilot_terms%rowtype; rules jsonb; version integer; enabled boolean; launch timestamptz; monday date; first_day date; last_day date; reward_day date; amount integer; coins_delta integer; entry_id uuid;
begin
 if TG_OP='UPDATE' and new.completed=old.completed then return new; end if;
 if not new.completed and TG_OP='INSERT' then return new; end if;
 teacher:=pilot_private.routine_actor(new.class_id,new.student_id,pilot_private.display_today(),new.passport_id::text||':'||new.week::text,TG_TABLE_NAME);
 perform 1 from public.pilot_classes where id=new.class_id and owner_id=teacher and deleted_at is null for update;
 if not found then raise exception 'Passport reward class access denied' using errcode='42501'; end if;
 select * into passport from public.pilot_passports where id=new.passport_id and class_id=new.class_id;
 select * into effect from public.pilot_passport_reward_effects where class_id=new.class_id and student_id=new.student_id and passport_id=new.passport_id and week=new.week for update;
 if new.completed then
  select s.enabled and 'rewards'=any(c.enabled_modules),s.first_enabled_at into enabled,launch from public.pilot_passport_reward_settings s join public.pilot_classes c on c.id=s.class_id where s.class_id=new.class_id;
  if enabled is distinct from true or new.completed_at is null or new.completed_at<launch then return new; end if;
  if effect.active then return new; end if;
  reward_day:=pilot_private.reward_today();
  if effect.class_id is null then
   select * into term from public.pilot_terms where id=passport.term_id and class_id=new.class_id and active;
   if not found then return new; end if;
   monday:=term.start_date-(extract(isodow from term.start_date)::integer-1)+(new.week-1)*7;
   first_day:=greatest(term.start_date,monday); last_day:=least(term.end_date,monday+6);
   if first_day>last_day then return new; end if;
   select r.rules,r.version into rules,version from public.pilot_reward_rules r where class_id=new.class_id;
   if not found then return new; end if;
   insert into public.pilot_passport_reward_effects(class_id,student_id,passport_id,week,active,coins,rule_version,week_start,week_end,completed_on)
   values(new.class_id,new.student_id,new.passport_id,new.week,false,0,version,first_day,last_day,reward_day) returning * into effect;
  else
   select r.rules into rules from public.pilot_reward_rule_history r where class_id=new.class_id and r.version=effect.rule_version;
  end if;
  amount:=pilot_private.passport_reward_coins(effect.week_start,effect.week_end,reward_day,rules);
  if amount is null then raise exception 'Invalid passport reward window' using errcode='23514'; end if;
  coins_delta:=amount;
 else
  if effect.active is distinct from true then return new; end if;
  coins_delta:=-effect.coins;
 end if;
 if coins_delta<>0 then
  insert into public.pilot_reward_ledger(class_id,student_id,request_id,coin_delta,xp_delta,reason,actor_id,actor_kind,device_id)
  values(new.class_id,new.student_id,gen_random_uuid(),coins_delta,0,passport.name || ' W' || new.week::text || case when new.completed then ' 完成獎勵' else ' 取消回沖' end,teacher,case when pilot_private.operation_device() is null then 'teacher' else 'device' end,pilot_private.operation_device()) returning id into entry_id;
  insert into public.pilot_reward_balances(class_id,student_id,coin_net,xp_total) values(new.class_id,new.student_id,0,0) on conflict(class_id,student_id) do nothing;
  update public.pilot_reward_balances set coin_net=coin_net+coins_delta where class_id=new.class_id and student_id=new.student_id;
  insert into public.pilot_passport_reward_entries(ledger_id,class_id,student_id,passport_id,week) values(entry_id,new.class_id,new.student_id,new.passport_id,new.week);
 end if;
 update public.pilot_passport_reward_effects set active=new.completed,coins=case when new.completed then amount else coins end,completed_on=case when new.completed then reward_day else completed_on end
 where class_id=new.class_id and student_id=new.student_id and passport_id=new.passport_id and week=new.week;
 return new;
end;
$$;

create or replace function pilot_private.apply_reading_reward() returns trigger
language plpgsql security definer set search_path='' as $$
declare teacher uuid; completed boolean:=new.status='completed'; effect public.pilot_reading_reward_effects%rowtype; rules public.pilot_reward_rules%rowtype; enabled boolean; launch timestamptz; coins_delta integer; entry_id uuid;
begin
 if TG_OP='UPDATE' and completed=(old.status='completed') then return new; end if;
 if not completed and TG_OP='INSERT' then return new; end if;
 teacher:=pilot_private.routine_actor(new.class_id,new.student_id,pilot_private.display_today(),new.term_id::text||':'||new.kind||':'||new.month::text,TG_TABLE_NAME);
 perform 1 from public.pilot_classes where id=new.class_id and owner_id=teacher and deleted_at is null for update;
 if not found then raise exception 'Reading reward class access denied' using errcode='42501'; end if;
 select * into effect from public.pilot_reading_reward_effects where class_id=new.class_id and student_id=new.student_id and term_id=new.term_id and kind=new.kind and month=new.month for update;
 if completed then
  select s.enabled and 'rewards'=any(c.enabled_modules),s.first_enabled_at into enabled,launch from public.pilot_reading_reward_settings s join public.pilot_classes c on c.id=s.class_id where s.class_id=new.class_id;
  if enabled is distinct from true or new.completed_at is null or new.completed_at<launch then return new; end if;
  if effect.active then return new; end if;
  if effect.class_id is null then
   select * into rules from public.pilot_reward_rules where class_id=new.class_id;
   if not found then return new; end if;
   insert into public.pilot_reading_reward_effects(class_id,student_id,term_id,kind,month,active,coins,rule_version)
   values(new.class_id,new.student_id,new.term_id,new.kind,new.month,false,(rules.rules->>case when new.kind='newspaper' then 'reading_newspaper_coins' else 'reading_reflection_coins' end)::integer,rules.version) returning * into effect;
  end if;
  coins_delta:=effect.coins;
 else
  if effect.active is distinct from true then return new; end if;
  coins_delta:=-effect.coins;
 end if;
 if coins_delta<>0 then
  insert into public.pilot_reward_ledger(class_id,student_id,request_id,coin_delta,xp_delta,reason,actor_id,actor_kind,device_id)
  values(new.class_id,new.student_id,gen_random_uuid(),coins_delta,0,
   case when new.kind='newspaper' then '讀報' else '閱讀心得' end || ' ' || to_char(new.month,'YYYY-MM') || case when completed then ' 完成' else ' 取消回沖' end,teacher,case when pilot_private.operation_device() is null then 'teacher' else 'device' end,pilot_private.operation_device()) returning id into entry_id;
  insert into public.pilot_reward_balances(class_id,student_id,coin_net,xp_total) values(new.class_id,new.student_id,0,0) on conflict(class_id,student_id) do nothing;
  update public.pilot_reward_balances set coin_net=coin_net+coins_delta where class_id=new.class_id and student_id=new.student_id;
  insert into public.pilot_reading_reward_entries(ledger_id,class_id,student_id,term_id,kind,month) values(entry_id,new.class_id,new.student_id,new.term_id,new.kind,new.month);
 end if;
 update public.pilot_reading_reward_effects set active=completed where class_id=new.class_id and student_id=new.student_id and term_id=new.term_id and kind=new.kind and month=new.month;
 return new;
end;
$$;

create table public.pilot_display_learning_receipts(
 id uuid primary key default gen_random_uuid(),class_id uuid not null,student_id uuid not null,device_id uuid not null,
 request_id uuid not null,target_key text not null,source_kind text not null check(source_kind in ('passport','reading')),
 changed boolean not null,created_at timestamptz not null default now(),unique(class_id,request_id),
 foreign key(class_id,student_id) references public.pilot_students(class_id,id),
 foreign key(class_id,device_id) references public.pilot_display_devices(class_id,id)
);
alter table public.pilot_display_learning_receipts enable row level security;
revoke all on public.pilot_display_learning_receipts from public,anon,authenticated;
grant select on public.pilot_display_learning_receipts to authenticated;
create policy display_learning_receipt_owner on public.pilot_display_learning_receipts for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id and enabled_modules && array['passport','reading']));

create function public.complete_pilot_display_learning(device_token text,target_student uuid,source_kind text,target_plan uuid,target_week integer,reading_kind text,target_month date,request_key uuid) returns void
language plpgsql security definer set search_path='' as $$
declare classroom uuid:=pilot_private.require_display(device_token); today date:=pilot_private.display_today(); term public.pilot_terms%rowtype;
 device uuid; key text; done boolean; previous public.pilot_display_learning_receipts%rowtype;
begin
 perform 1 from public.pilot_classes where id=classroom and deleted_at is null and source_kind=any(enabled_modules) for update;
 if not found or source_kind is null or source_kind not in ('passport','reading') then raise exception 'Display learning access denied' using errcode='42501'; end if;
 perform pilot_private.require_display(device_token);
 if request_key is null then raise exception 'Learning request required' using errcode='23514'; end if;
 if not exists(select 1 from public.pilot_students where class_id=classroom and id=target_student and deleted_at is null) then raise exception 'Display student access denied' using errcode='42501'; end if;
 select * into term from public.pilot_terms where class_id=classroom and active;
 if term.id is null then raise exception 'Active learning term required' using errcode='23514'; end if;
 if source_kind='passport' then
  if target_plan is null or target_week is null or reading_kind is not null or target_month is not null then raise exception 'Invalid passport target' using errcode='23514'; end if;
  key:=target_plan::text||':'||target_week::text;
 else
  if target_plan is not null or target_week is not null or reading_kind is null or reading_kind not in ('newspaper','reflection') or target_month is null then raise exception 'Invalid reading target' using errcode='23514'; end if;
  key:=term.id::text||':'||reading_kind||':'||target_month::text;
 end if;
 select r.* into previous from public.pilot_display_learning_receipts r where r.class_id=classroom and r.request_id=request_key;
 if found then
  if previous.student_id<>target_student or previous.target_key<>key or previous.source_kind<>source_kind then raise exception 'Learning request conflict' using errcode='23514'; end if;
  return;
 end if;
 if today<term.start_date or today>term.end_date then raise exception 'Outside learning term' using errcode='23514'; end if;
 if exists(select 1 from public.pilot_attendance where class_id=classroom and student_id=target_student and day=today and absent) then raise exception 'Student is absent' using errcode='23514'; end if;
 if source_kind='passport' then
  if target_week>((term.end_date-term.start_date+(extract(isodow from term.start_date)::integer-1))/7)+1
   or not exists(select 1 from public.pilot_passports where class_id=classroom and id=target_plan and term_id=term.id and not archived and target_week between first_week and last_week)
  then raise exception 'Invalid passport target' using errcode='23514'; end if;
  select completed into done from public.pilot_passport_checks where class_id=classroom and passport_id=target_plan and student_id=target_student and week=target_week;
 else
  if extract(day from target_month)<>1 or extract(month from target_month) in (7,8) or target_month>date_trunc('month',today)::date or target_month>term.end_date or (target_month+interval '1 month')::date<=term.start_date
  then raise exception 'Invalid reading month' using errcode='23514'; end if;
  select status='completed' into done from public.pilot_reading_checks where class_id=classroom and term_id=term.id and student_id=target_student and kind=reading_kind and month=target_month;
 end if;
 select id into device from public.pilot_display_devices where class_id=classroom and token_hash=encode(sha256(convert_to(device_token,'UTF8')),'hex');
 if done is distinct from true then
  insert into pilot_private.display_operation_context(backend,transaction_id,class_id,student_id,device_id,day,task_key,source_table)
  values(pg_backend_pid(),txid_current(),classroom,target_student,device,today,key,case when source_kind='passport' then 'pilot_passport_checks' else 'pilot_reading_checks' end);
  if source_kind='passport' then
   insert into public.pilot_passport_checks(class_id,passport_id,student_id,week,completed,completed_at)
   values(classroom,target_plan,target_student,target_week,true,now())
   on conflict(passport_id,student_id,week) do update set completed=true,completed_at=now(),updated_at=now();
  else
   insert into public.pilot_reading_checks(class_id,term_id,student_id,kind,month,status,completed_at)
   values(classroom,term.id,target_student,reading_kind,target_month,'completed',now())
   on conflict(term_id,student_id,kind,month) do update set status='completed',completed_at=now(),updated_at=now();
  end if;
  delete from pilot_private.display_operation_context where backend=pg_backend_pid() and transaction_id=txid_current();
 end if;
 insert into public.pilot_display_learning_receipts(class_id,student_id,device_id,request_id,target_key,source_kind,changed)
 values(classroom,target_student,device,request_key,key,source_kind,done is distinct from true);
end;$$;
revoke all on function public.complete_pilot_display_learning(text,uuid,text,uuid,integer,text,date,uuid),pilot_private.apply_passport_reward(),pilot_private.apply_reading_reward() from public,anon,authenticated;
grant execute on function public.complete_pilot_display_learning(text,uuid,text,uuid,integer,text,date,uuid) to anon,authenticated;
commit;
