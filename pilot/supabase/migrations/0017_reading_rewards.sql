-- Teacher-only monthly reading completion coins; separate explicit class opt-in.
begin;
create table public.pilot_reading_reward_settings (
 class_id uuid primary key references public.pilot_classes(id),
 enabled boolean not null,
 first_enabled_at timestamptz,
 actor_id uuid not null references public.pilot_teachers(id),
 updated_at timestamptz not null default now(),
 check(not enabled or first_enabled_at is not null)
);
create table public.pilot_reading_reward_effects (
 class_id uuid not null,
 student_id uuid not null,
 term_id uuid not null,
 kind text not null check(kind in ('newspaper','reflection')),
 month date not null,
 active boolean not null,
 coins integer not null check(coins between 0 and 10000),
 rule_version integer not null,
 primary key(class_id,student_id,term_id,kind,month),
 foreign key(class_id,student_id) references public.pilot_students(class_id,id),
 foreign key(class_id,term_id) references public.pilot_terms(class_id,id),
 foreign key(class_id,rule_version) references public.pilot_reward_rule_history(class_id,version),
 foreign key(term_id,student_id,kind,month) references public.pilot_reading_checks(term_id,student_id,kind,month)
);
create table public.pilot_reading_reward_entries (
 ledger_id uuid primary key,
 class_id uuid not null,
 student_id uuid not null,
 term_id uuid not null,
 kind text not null,
 month date not null,
 foreign key(class_id,student_id,ledger_id) references public.pilot_reward_ledger(class_id,student_id,id),
 foreign key(class_id,student_id,term_id,kind,month) references public.pilot_reading_reward_effects(class_id,student_id,term_id,kind,month)
);
alter table public.pilot_reading_reward_settings enable row level security;
alter table public.pilot_reading_reward_effects enable row level security;
alter table public.pilot_reading_reward_entries enable row level security;
revoke all on public.pilot_reading_reward_settings,public.pilot_reading_reward_effects,public.pilot_reading_reward_entries from public,anon,authenticated;
grant select on public.pilot_reading_reward_settings,public.pilot_reading_reward_effects,public.pilot_reading_reward_entries to authenticated;
create policy reading_reward_settings_owner on public.pilot_reading_reward_settings for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id and 'rewards'=any(c.enabled_modules)));
create policy reading_reward_effect_owner on public.pilot_reading_reward_effects for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id and 'rewards'=any(c.enabled_modules)));
create policy reading_reward_entry_owner on public.pilot_reading_reward_entries for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id and 'rewards'=any(c.enabled_modules)));
create function public.configure_pilot_reading_rewards(target_class uuid,is_enabled boolean) returns void
language plpgsql security definer set search_path='' as $$
declare teacher uuid:=pilot_private.require_teacher();
begin
 perform 1 from public.pilot_classes where id=target_class and owner_id=teacher and deleted_at is null and 'rewards'=any(enabled_modules) and (is_enabled is not true or 'reading'=any(enabled_modules)) for update;
 if not found then raise exception 'Reading reward access denied' using errcode='42501'; end if;
 if is_enabled is null or (is_enabled and not exists(select 1 from public.pilot_reward_rules where class_id=target_class)) then raise exception 'Confirmed rules required' using errcode='23514'; end if;
 insert into public.pilot_reading_reward_settings(class_id,enabled,first_enabled_at,actor_id) values(target_class,is_enabled,case when is_enabled then now() else null end,teacher)
 on conflict(class_id) do update set enabled=excluded.enabled,first_enabled_at=coalesce(pilot_reading_reward_settings.first_enabled_at,excluded.first_enabled_at),actor_id=teacher,updated_at=now();
end;
$$;
create function pilot_private.apply_reading_reward() returns trigger
language plpgsql security definer set search_path='' as $$
declare teacher uuid; completed boolean:=new.status='completed'; effect public.pilot_reading_reward_effects%rowtype; rules public.pilot_reward_rules%rowtype; enabled boolean; launch timestamptz; coins_delta integer; entry_id uuid;
begin
 if TG_OP='UPDATE' and completed=(old.status='completed') then return new; end if;
 if not completed and TG_OP='INSERT' then return new; end if;
 teacher:=pilot_private.require_teacher();
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
  insert into public.pilot_reward_ledger(class_id,student_id,request_id,coin_delta,xp_delta,reason,actor_id)
  values(new.class_id,new.student_id,gen_random_uuid(),coins_delta,0,
   case when new.kind='newspaper' then '讀報' else '閱讀心得' end || ' ' || to_char(new.month,'YYYY-MM') || case when completed then ' 完成' else ' 取消回沖' end,teacher) returning id into entry_id;
  insert into public.pilot_reward_balances(class_id,student_id,coin_net,xp_total) values(new.class_id,new.student_id,0,0) on conflict(class_id,student_id) do nothing;
  update public.pilot_reward_balances set coin_net=coin_net+coins_delta where class_id=new.class_id and student_id=new.student_id;
  insert into public.pilot_reading_reward_entries(ledger_id,class_id,student_id,term_id,kind,month) values(entry_id,new.class_id,new.student_id,new.term_id,new.kind,new.month);
 end if;
 update public.pilot_reading_reward_effects set active=completed where class_id=new.class_id and student_id=new.student_id and term_id=new.term_id and kind=new.kind and month=new.month;
 return new;
end;
$$;
create trigger pilot_reading_reward_after after insert or update on public.pilot_reading_checks for each row execute function pilot_private.apply_reading_reward();
revoke all on function pilot_private.apply_reading_reward() from public,anon,authenticated;
revoke all on function public.configure_pilot_reading_rewards(uuid,boolean) from public,anon,authenticated;
grant execute on function public.configure_pilot_reading_rewards(uuid,boolean) to authenticated;
commit;
