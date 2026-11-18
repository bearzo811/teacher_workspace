-- Rule drafts are confirmed per class. No automatic awards are enabled here.
begin;
create function pilot_private.valid_reward_rules(rules jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare keys text[]:=array['homework_on_time_coins','homework_late_coins','homework_missed_coins','passport_monday_coins','passport_tuesday_coins','passport_wednesday_coins','passport_thursday_coins','passport_friday_coins','passport_overdue_daily_coins','reading_newspaper_coins','reading_reflection_coins','routine_coins','routine_xp','level_base_xp','substitute_coins']; k text; value numeric;
begin
 if rules is null or jsonb_typeof(rules)<>'object' then return false; end if;
 if (select count(*) from jsonb_object_keys(rules))<>cardinality(keys) then return false; end if;
 foreach k in array keys loop
  if not(rules?k) or jsonb_typeof(rules->k)<>'number' then return false; end if;
  value:=(rules->>k)::numeric;
  if trunc(value)<>value or abs(value)>10000 then return false; end if;
  if k in ('homework_missed_coins','passport_overdue_daily_coins') then
   if value>0 then return false; end if;
  elsif k='level_base_xp' then
   if value<1 then return false; end if;
  elsif value<0 then return false;
  end if;
 end loop;
 return (rules->>'passport_monday_coins')::numeric >= (rules->>'passport_tuesday_coins')::numeric
 and (rules->>'passport_tuesday_coins')::numeric >= (rules->>'passport_wednesday_coins')::numeric
 and (rules->>'passport_wednesday_coins')::numeric >= (rules->>'passport_thursday_coins')::numeric
 and (rules->>'passport_thursday_coins')::numeric >= (rules->>'passport_friday_coins')::numeric;
end;
$$;
create table public.pilot_reward_rules (
 class_id uuid primary key references public.pilot_classes(id),
 version integer not null check(version between 1 and 1000),
 rules jsonb not null check(pilot_private.valid_reward_rules(rules)),
 confirmed_at timestamptz not null default now(),
 actor_id uuid not null references public.pilot_teachers(id)
);
create table public.pilot_reward_rule_history (
 class_id uuid not null references public.pilot_classes(id),
 version integer not null check(version between 1 and 1000),
 rules jsonb not null check(pilot_private.valid_reward_rules(rules)),
 confirmed_at timestamptz not null default now(),
 actor_id uuid not null references public.pilot_teachers(id),
 primary key(class_id,version)
);
alter table public.pilot_reward_rules enable row level security;
alter table public.pilot_reward_rule_history enable row level security;
revoke all on public.pilot_reward_rules,public.pilot_reward_rule_history from public,anon,authenticated;
grant select on public.pilot_reward_rules,public.pilot_reward_rule_history to authenticated;
create policy reward_rules_owner on public.pilot_reward_rules for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id and 'rewards'=any(c.enabled_modules)));
create policy reward_rule_history_owner on public.pilot_reward_rule_history for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id and 'rewards'=any(c.enabled_modules)));
create function public.save_pilot_reward_rules(target_class uuid,target_rules jsonb,expected_version integer) returns integer
language plpgsql security definer set search_path='' as $$
declare teacher uuid:=pilot_private.require_teacher(); current_row public.pilot_reward_rules%rowtype; next_version integer;
begin
 perform 1 from public.pilot_classes where id=target_class and owner_id=teacher and deleted_at is null and 'rewards'=any(enabled_modules) for update;
 if not found then raise exception 'Reward rules access denied' using errcode='42501'; end if;
 if not pilot_private.valid_reward_rules(target_rules) or expected_version is null or expected_version<0 then raise exception 'Invalid reward rules' using errcode='23514'; end if;
 select * into current_row from public.pilot_reward_rules where class_id=target_class;
 if found and current_row.rules=target_rules then return current_row.version; end if;
 if coalesce(current_row.version,0)<>expected_version then raise exception 'Reward rules version changed' using errcode='23514'; end if;
 next_version:=coalesce(current_row.version,0)+1;
 insert into public.pilot_reward_rule_history(class_id,version,rules,actor_id) values(target_class,next_version,target_rules,teacher);
 insert into public.pilot_reward_rules(class_id,version,rules,actor_id) values(target_class,next_version,target_rules,teacher)
 on conflict(class_id) do update set version=excluded.version,rules=excluded.rules,actor_id=excluded.actor_id,confirmed_at=now();
 return next_version;
end;
$$;
revoke all on function pilot_private.valid_reward_rules(jsonb) from public,anon,authenticated;
revoke all on function public.save_pilot_reward_rules(uuid,jsonb,integer) from public,anon,authenticated;
grant execute on function public.save_pilot_reward_rules(uuid,jsonb,integer) to authenticated;
commit;
