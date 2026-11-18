-- Passport completion coins only; daily overdue settlement is not enabled here.
begin;
create function pilot_private.passport_reward_coins(week_start date,week_end date,completed_on date,rules jsonb) returns integer
language plpgsql immutable set search_path='' as $$
begin
 if week_start is null or week_end is null or completed_on is null or week_start>week_end or not pilot_private.valid_reward_rules(rules) then return null; end if;
 if completed_on<week_start then return (rules->>'passport_monday_coins')::integer; end if;
 if completed_on>week_end then return 0; end if;
 return case extract(isodow from completed_on)::integer
  when 1 then (rules->>'passport_monday_coins')::integer when 2 then (rules->>'passport_tuesday_coins')::integer
  when 3 then (rules->>'passport_wednesday_coins')::integer when 4 then (rules->>'passport_thursday_coins')::integer
  when 5 then (rules->>'passport_friday_coins')::integer else 0 end;
end;
$$;
create table public.pilot_passport_reward_settings (
 class_id uuid primary key references public.pilot_classes(id),
 enabled boolean not null,
 first_enabled_at timestamptz,
 actor_id uuid not null references public.pilot_teachers(id),
 updated_at timestamptz not null default now(),
 check(not enabled or first_enabled_at is not null)
);
create table public.pilot_passport_reward_effects (
 class_id uuid not null,
 student_id uuid not null,
 passport_id uuid not null,
 week integer not null,
 active boolean not null,
 coins integer not null check(coins between 0 and 10000),
 rule_version integer not null,
 week_start date not null,
 week_end date not null check(week_end>=week_start),
 completed_on date not null,
 primary key(class_id,student_id,passport_id,week),
 foreign key(class_id,student_id) references public.pilot_students(class_id,id),
 foreign key(class_id,passport_id) references public.pilot_passports(class_id,id),
 foreign key(class_id,rule_version) references public.pilot_reward_rule_history(class_id,version),
 foreign key(passport_id,student_id,week) references public.pilot_passport_checks(passport_id,student_id,week)
);
create table public.pilot_passport_reward_entries (
 ledger_id uuid primary key,
 class_id uuid not null,
 student_id uuid not null,
 passport_id uuid not null,
 week integer not null,
 foreign key(class_id,student_id,ledger_id) references public.pilot_reward_ledger(class_id,student_id,id),
 foreign key(class_id,student_id,passport_id,week) references public.pilot_passport_reward_effects(class_id,student_id,passport_id,week)
);
alter table public.pilot_passport_reward_settings enable row level security;
alter table public.pilot_passport_reward_effects enable row level security;
alter table public.pilot_passport_reward_entries enable row level security;
revoke all on public.pilot_passport_reward_settings,public.pilot_passport_reward_effects,public.pilot_passport_reward_entries from public,anon,authenticated;
grant select on public.pilot_passport_reward_settings,public.pilot_passport_reward_effects,public.pilot_passport_reward_entries to authenticated;
create policy passport_reward_settings_owner on public.pilot_passport_reward_settings for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id and 'rewards'=any(c.enabled_modules)));
create policy passport_reward_effect_owner on public.pilot_passport_reward_effects for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id and 'rewards'=any(c.enabled_modules)));
create policy passport_reward_entry_owner on public.pilot_passport_reward_entries for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id and 'rewards'=any(c.enabled_modules)));
create function public.configure_pilot_passport_rewards(target_class uuid,is_enabled boolean) returns void
language plpgsql security definer set search_path='' as $$
declare teacher uuid:=pilot_private.require_teacher();
begin
 perform 1 from public.pilot_classes where id=target_class and owner_id=teacher and deleted_at is null and 'rewards'=any(enabled_modules) and (is_enabled is not true or 'passport'=any(enabled_modules)) for update;
 if not found then raise exception 'Passport reward access denied' using errcode='42501'; end if;
 if is_enabled is null or (is_enabled and not exists(select 1 from public.pilot_reward_rules where class_id=target_class)) then raise exception 'Confirmed rules required' using errcode='23514'; end if;
 insert into public.pilot_passport_reward_settings(class_id,enabled,first_enabled_at,actor_id) values(target_class,is_enabled,case when is_enabled then now() else null end,teacher)
 on conflict(class_id) do update set enabled=excluded.enabled,first_enabled_at=coalesce(pilot_passport_reward_settings.first_enabled_at,excluded.first_enabled_at),actor_id=teacher,updated_at=now();
end;
$$;
create function pilot_private.apply_passport_reward() returns trigger
language plpgsql security definer set search_path='' as $$
declare teacher uuid; effect public.pilot_passport_reward_effects%rowtype; passport public.pilot_passports%rowtype; term public.pilot_terms%rowtype; rules jsonb; version integer; enabled boolean; launch timestamptz; monday date; first_day date; last_day date; reward_day date; amount integer; coins_delta integer; entry_id uuid;
begin
 if TG_OP='UPDATE' and new.completed=old.completed then return new; end if;
 if not new.completed and TG_OP='INSERT' then return new; end if;
 teacher:=pilot_private.require_teacher();
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
  insert into public.pilot_reward_ledger(class_id,student_id,request_id,coin_delta,xp_delta,reason,actor_id)
  values(new.class_id,new.student_id,gen_random_uuid(),coins_delta,0,passport.name || ' W' || new.week::text || case when new.completed then ' 完成獎勵' else ' 取消回沖' end,teacher) returning id into entry_id;
  insert into public.pilot_reward_balances(class_id,student_id,coin_net,xp_total) values(new.class_id,new.student_id,0,0) on conflict(class_id,student_id) do nothing;
  update public.pilot_reward_balances set coin_net=coin_net+coins_delta where class_id=new.class_id and student_id=new.student_id;
  insert into public.pilot_passport_reward_entries(ledger_id,class_id,student_id,passport_id,week) values(entry_id,new.class_id,new.student_id,new.passport_id,new.week);
 end if;
 update public.pilot_passport_reward_effects set active=new.completed,coins=case when new.completed then amount else coins end,completed_on=case when new.completed then reward_day else completed_on end
 where class_id=new.class_id and student_id=new.student_id and passport_id=new.passport_id and week=new.week;
 return new;
end;
$$;
create trigger pilot_passport_reward_after after insert or update on public.pilot_passport_checks for each row execute function pilot_private.apply_passport_reward();
-- Recheck current term length after a term is shortened. Historical cancellation
-- remains possible so a previous award can always be reversed.
create or replace function public.set_pilot_passport_check(target_class uuid,target_passport uuid,target_student uuid,target_week integer,is_completed boolean) returns void
language plpgsql security definer set search_path='' as $$
declare term uuid; max_week integer;
begin
 select term_id into term from public.pilot_passports where id=target_passport and class_id=target_class;
 perform pilot_private.lock_passport_term(target_class,term);
 if target_week is null or is_completed is null or not exists(select 1 from public.pilot_passports where id=target_passport and class_id=target_class and not archived and target_week between first_week and last_week)
  or not exists(select 1 from public.pilot_students where id=target_student and class_id=target_class and deleted_at is null)
 then raise exception 'Passport check access denied' using errcode='42501'; end if;
 select ((end_date-start_date+(extract(isodow from start_date)::integer-1))/7)+1 into max_week from public.pilot_terms where id=term and class_id=target_class;
 if is_completed and target_week>max_week then raise exception 'Week outside term' using errcode='23514'; end if;
 insert into public.pilot_passport_checks(class_id,passport_id,student_id,week,completed,completed_at)
 values(target_class,target_passport,target_student,target_week,is_completed,case when is_completed then now() else null end)
 on conflict(passport_id,student_id,week) do update set completed=excluded.completed,completed_at=case when excluded.completed then coalesce(pilot_passport_checks.completed_at,excluded.completed_at) else null end,updated_at=now();
end;
$$;
revoke all on function pilot_private.passport_reward_coins(date,date,date,jsonb),pilot_private.apply_passport_reward() from public,anon,authenticated;
revoke all on function public.configure_pilot_passport_rewards(uuid,boolean) from public,anon,authenticated;
grant execute on function public.configure_pilot_passport_rewards(uuid,boolean) to authenticated;
commit;
