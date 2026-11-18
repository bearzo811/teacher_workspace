-- Teacher-side routine rewards only. Each class must explicitly opt in.
begin;
create function pilot_private.reward_today() returns date language sql stable set search_path='' as $$select timezone('Asia/Taipei',now())::date$$;
create table public.pilot_routine_reward_settings (
 class_id uuid primary key references public.pilot_classes(id),
 enabled boolean not null,
 first_enabled_at timestamptz,
 updated_at timestamptz not null default now(),
 actor_id uuid not null references public.pilot_teachers(id),
 check(not enabled or first_enabled_at is not null)
);
create table public.pilot_routine_reward_effects (
 class_id uuid not null,
 student_id uuid not null,
 day date not null,
 task_key text not null,
 source_kind text not null check(source_kind in ('routine','return_day')),
 active boolean not null,
 coins integer not null check(coins between 0 and 10000),
 xp integer not null check(xp between 0 and 10000),
 rule_version integer not null,
 primary key(class_id,student_id,day,task_key),
 foreign key(class_id,student_id) references public.pilot_students(class_id,id),
 foreign key(class_id,rule_version) references public.pilot_reward_rule_history(class_id,version),
 check((source_kind='routine' and task_key in ('morning_cleaning','contact_book_copied','lunch_brushing','noon_cleaning')) or (source_kind='return_day' and task_key in ('morning_cleaning','summer_homework_submitted')))
);
alter table public.pilot_reward_ledger add unique(class_id,student_id,id);
create table public.pilot_routine_reward_entries (
 ledger_id uuid primary key,
 class_id uuid not null,
 student_id uuid not null,
 day date not null,
 task_key text not null,
 foreign key(class_id,student_id,ledger_id) references public.pilot_reward_ledger(class_id,student_id,id),
 foreign key(class_id,student_id,day,task_key) references public.pilot_routine_reward_effects(class_id,student_id,day,task_key)
);
alter table public.pilot_routine_reward_settings enable row level security;
alter table public.pilot_routine_reward_effects enable row level security;
alter table public.pilot_routine_reward_entries enable row level security;
revoke all on public.pilot_routine_reward_settings,public.pilot_routine_reward_effects,public.pilot_routine_reward_entries from public,anon,authenticated;
grant select on public.pilot_routine_reward_settings,public.pilot_routine_reward_effects,public.pilot_routine_reward_entries to authenticated;
create policy routine_reward_settings_owner on public.pilot_routine_reward_settings for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id and 'rewards'=any(c.enabled_modules)));
create policy routine_reward_effect_owner on public.pilot_routine_reward_effects for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id and 'rewards'=any(c.enabled_modules)));
create policy routine_reward_entry_owner on public.pilot_routine_reward_entries for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id and 'rewards'=any(c.enabled_modules)));
create function public.configure_pilot_routine_rewards(target_class uuid,is_enabled boolean) returns void
language plpgsql security definer set search_path='' as $$
declare teacher uuid:=pilot_private.require_teacher();
begin
 perform 1 from public.pilot_classes where id=target_class and owner_id=teacher and deleted_at is null and 'rewards'=any(enabled_modules) and (is_enabled is not true or 'routines'=any(enabled_modules)) for update;
 if not found then raise exception 'Routine reward access denied' using errcode='42501'; end if;
 if is_enabled is null or (is_enabled and not exists(select 1 from public.pilot_reward_rules where class_id=target_class)) then raise exception 'Confirmed rules required' using errcode='23514'; end if;
 insert into public.pilot_routine_reward_settings(class_id,enabled,first_enabled_at,actor_id) values(target_class,is_enabled,case when is_enabled then now() else null end,teacher)
 on conflict(class_id) do update set enabled=excluded.enabled,first_enabled_at=coalesce(pilot_routine_reward_settings.first_enabled_at,excluded.first_enabled_at),actor_id=teacher,updated_at=now();
end;
$$;
create function pilot_private.apply_routine_reward() returns trigger
language plpgsql security definer set search_path='' as $$
declare teacher uuid; kind text; effect public.pilot_routine_reward_effects%rowtype; rules public.pilot_reward_rules%rowtype; enabled boolean; coins_delta integer; xp_delta integer; current_xp bigint; entry_id uuid;
begin
 if TG_OP='UPDATE' and new.completed=old.completed then return new; end if;
 if not new.completed and TG_OP='INSERT' then return new; end if;
 teacher:=pilot_private.require_teacher();
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
  insert into public.pilot_reward_ledger(class_id,student_id,request_id,coin_delta,xp_delta,reason,actor_id)
  values(new.class_id,new.student_id,gen_random_uuid(),coins_delta,xp_delta,
   case when new.completed then '生活任務完成：' else '生活任務取消回沖：' end || new.day::text || ' ' || new.task_key,teacher) returning id into entry_id;
  insert into public.pilot_reward_balances(class_id,student_id,coin_net,xp_total) values(new.class_id,new.student_id,0,0) on conflict(class_id,student_id) do nothing;
  update public.pilot_reward_balances set coin_net=coin_net+coins_delta,xp_total=xp_total+xp_delta where class_id=new.class_id and student_id=new.student_id;
  insert into public.pilot_routine_reward_entries(ledger_id,class_id,student_id,day,task_key) values(entry_id,new.class_id,new.student_id,new.day,new.task_key);
 end if;
 update public.pilot_routine_reward_effects set active=new.completed where class_id=new.class_id and student_id=new.student_id and day=new.day and task_key=new.task_key;
 return new;
end;
$$;
create trigger pilot_routine_reward_after after insert or update on public.pilot_routine_checks for each row execute function pilot_private.apply_routine_reward();
create trigger pilot_return_reward_after after insert or update on public.pilot_return_checks for each row execute function pilot_private.apply_routine_reward();
revoke all on function pilot_private.reward_today(),pilot_private.apply_routine_reward() from public,anon,authenticated;
revoke all on function public.configure_pilot_routine_rewards(uuid,boolean) from public,anon,authenticated;
grant execute on function public.configure_pilot_routine_rewards(uuid,boolean) to authenticated;
commit;
