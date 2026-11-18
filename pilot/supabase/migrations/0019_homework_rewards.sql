-- Completion coins only. No missing-work settlement or background jobs.
begin;
create table public.pilot_homework_reward_settings (
 class_id uuid primary key references public.pilot_classes(id),enabled boolean not null,
 first_enabled_at timestamptz,actor_id uuid not null references public.pilot_teachers(id),updated_at timestamptz not null default now(),
 check(not enabled or first_enabled_at is not null)
);
create table public.pilot_homework_reward_effects (
 class_id uuid not null,student_id uuid not null,assignment_id uuid not null,
 active boolean not null,coins integer not null check(coins between 0 and 10000),
 rule_version integer not null,due_day date not null,completed_on date not null,
 primary key(class_id,student_id,assignment_id),
 foreign key(class_id,student_id) references public.pilot_students(class_id,id),
 foreign key(class_id,assignment_id) references public.pilot_assignments(class_id,id),
 foreign key(class_id,rule_version) references public.pilot_reward_rule_history(class_id,version),
 foreign key(assignment_id,student_id) references public.pilot_homework_checks(assignment_id,student_id)
);
create table public.pilot_homework_reward_entries (
 ledger_id uuid primary key,class_id uuid not null,student_id uuid not null,assignment_id uuid not null,
 foreign key(class_id,student_id,ledger_id) references public.pilot_reward_ledger(class_id,student_id,id),
 foreign key(class_id,student_id,assignment_id) references public.pilot_homework_reward_effects(class_id,student_id,assignment_id)
);
alter table public.pilot_homework_reward_settings enable row level security;
alter table public.pilot_homework_reward_effects enable row level security;
alter table public.pilot_homework_reward_entries enable row level security;
revoke all on public.pilot_homework_reward_settings,public.pilot_homework_reward_effects,public.pilot_homework_reward_entries from public,anon,authenticated;
grant select on public.pilot_homework_reward_settings,public.pilot_homework_reward_effects,public.pilot_homework_reward_entries to authenticated;
create policy homework_reward_settings_owner on public.pilot_homework_reward_settings for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id and 'rewards'=any(c.enabled_modules)));
create policy homework_reward_effect_owner on public.pilot_homework_reward_effects for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id and 'rewards'=any(c.enabled_modules)));
create policy homework_reward_entry_owner on public.pilot_homework_reward_entries for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id and 'rewards'=any(c.enabled_modules)));
create function public.configure_pilot_homework_rewards(target_class uuid,is_enabled boolean) returns void
language plpgsql security definer set search_path='' as $$
declare teacher uuid:=pilot_private.require_teacher();
begin
 perform 1 from public.pilot_classes where id=target_class and owner_id=teacher and deleted_at is null and 'rewards'=any(enabled_modules) and (is_enabled is not true or 'homework'=any(enabled_modules)) for update;
 if not found then raise exception 'Homework reward access denied' using errcode='42501'; end if;
 if is_enabled is null or (is_enabled and not exists(select 1 from public.pilot_reward_rules where class_id=target_class)) then raise exception 'Confirmed rules required' using errcode='23514'; end if;
 insert into public.pilot_homework_reward_settings(class_id,enabled,first_enabled_at,actor_id) values(target_class,is_enabled,case when is_enabled then now() else null end,teacher)
 on conflict(class_id) do update set enabled=excluded.enabled,first_enabled_at=coalesce(pilot_homework_reward_settings.first_enabled_at,excluded.first_enabled_at),actor_id=teacher,updated_at=now();
end;
$$;
create function pilot_private.apply_homework_reward() returns trigger
language plpgsql security definer set search_path='' as $$
declare teacher uuid; effect public.pilot_homework_reward_effects%rowtype; assignment public.pilot_assignments%rowtype;
 rules jsonb; version integer; enabled boolean; launch timestamptz; reward_day date; amount integer; delta integer; entry_id uuid; done boolean:=new.status='completed';
begin
 if TG_OP='UPDATE' and (new.status='completed')=(old.status='completed') then return new; end if;
 if not done and TG_OP='INSERT' then return new; end if;
 teacher:=pilot_private.require_teacher();
 perform 1 from public.pilot_classes where id=new.class_id and owner_id=teacher and deleted_at is null for update;
 if not found then raise exception 'Homework reward class access denied' using errcode='42501'; end if;
 select * into assignment from public.pilot_assignments where id=new.assignment_id and class_id=new.class_id;
 select * into effect from public.pilot_homework_reward_effects where class_id=new.class_id and student_id=new.student_id and assignment_id=new.assignment_id for update;
 if done then
  select s.enabled and 'rewards'=any(c.enabled_modules),s.first_enabled_at into enabled,launch from public.pilot_homework_reward_settings s join public.pilot_classes c on c.id=s.class_id where s.class_id=new.class_id;
  if enabled is distinct from true or new.updated_at<launch then return new; end if;
  if effect.active then return new; end if;
  reward_day:=pilot_private.reward_today();
  if effect.class_id is null then
   select r.rules,r.version into rules,version from public.pilot_reward_rules r where class_id=new.class_id;
   if not found then return new; end if;
   insert into public.pilot_homework_reward_effects(class_id,student_id,assignment_id,active,coins,rule_version,due_day,completed_on)
   values(new.class_id,new.student_id,new.assignment_id,false,0,version,assignment.due_day,reward_day) returning * into effect;
  else
   select r.rules into rules from public.pilot_reward_rule_history r where class_id=new.class_id and r.version=effect.rule_version;
  end if;
  amount:=case when reward_day<=effect.due_day then (rules->>'homework_on_time_coins')::integer else (rules->>'homework_late_coins')::integer end;
  if amount is null then raise exception 'Invalid homework reward rules' using errcode='23514'; end if;
  delta:=amount;
 else
  if effect.active is distinct from true then return new; end if;
  delta:=-effect.coins;
 end if;
 if delta<>0 then
  insert into public.pilot_reward_ledger(class_id,student_id,request_id,coin_delta,xp_delta,reason,actor_id)
  values(new.class_id,new.student_id,gen_random_uuid(),delta,0,'作業 ' || left(assignment.content,160) || case when done then ' 完成獎勵' else ' 取消回沖' end,teacher) returning id into entry_id;
  insert into public.pilot_reward_balances(class_id,student_id,coin_net,xp_total) values(new.class_id,new.student_id,0,0) on conflict(class_id,student_id) do nothing;
  update public.pilot_reward_balances set coin_net=coin_net+delta where class_id=new.class_id and student_id=new.student_id;
  insert into public.pilot_homework_reward_entries(ledger_id,class_id,student_id,assignment_id) values(entry_id,new.class_id,new.student_id,new.assignment_id);
 end if;
 update public.pilot_homework_reward_effects set active=done,coins=case when done then amount else coins end,completed_on=case when done then reward_day else completed_on end
 where class_id=new.class_id and student_id=new.student_id and assignment_id=new.assignment_id;
 return new;
end;
$$;
create trigger pilot_homework_reward_after after insert or update on public.pilot_homework_checks for each row execute function pilot_private.apply_homework_reward();
revoke all on function pilot_private.apply_homework_reward() from public,anon,authenticated;
revoke all on function public.configure_pilot_homework_rewards(uuid,boolean) from public,anon,authenticated;
grant execute on function public.configure_pilot_homework_rewards(uuid,boolean) to authenticated;
commit;
