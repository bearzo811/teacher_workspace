-- Daily settlement engine only. No extension or cron is enabled by this file.
begin;
create function pilot_private.overdue_now() returns timestamptz language sql stable set search_path='' as $$select now()$$;
create table public.pilot_passport_check_history (
 id bigint generated always as identity primary key,class_id uuid not null,student_id uuid not null,passport_id uuid not null,
 week integer not null,completed boolean not null,happened_at timestamptz not null default now(),
 foreign key(class_id,student_id) references public.pilot_students(class_id,id),
 foreign key(class_id,passport_id) references public.pilot_passports(class_id,id)
);
create index pilot_passport_history_lookup on public.pilot_passport_check_history(class_id,student_id,passport_id,week,happened_at desc,id desc);
insert into public.pilot_passport_check_history(class_id,student_id,passport_id,week,completed)
 select class_id,student_id,passport_id,week,completed from public.pilot_passport_checks;
create function pilot_private.record_passport_history() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' or new.completed is distinct from old.completed then
  insert into public.pilot_passport_check_history(class_id,student_id,passport_id,week,completed,happened_at)
  values(new.class_id,new.student_id,new.passport_id,new.week,new.completed,pilot_private.overdue_now());
 end if;
 return new;
end;$$;
create trigger pilot_passport_history_after after insert or update on public.pilot_passport_checks for each row execute function pilot_private.record_passport_history();
create table public.pilot_passport_overdue_settings (
 class_id uuid primary key references public.pilot_classes(id),enabled boolean not null,enabled_on date,
 actor_id uuid not null references public.pilot_teachers(id),updated_at timestamptz not null default now(),
 check(not enabled or enabled_on is not null)
);
create table public.pilot_passport_overdue_runs (
 class_id uuid not null references public.pilot_classes(id),day date not null,
 status text not null check(status in ('success','failed')),entry_count integer not null default 0 check(entry_count>=0),
 attempts integer not null default 1 check(attempts>0),error_code text,finished_at timestamptz not null default now(),
 primary key(class_id,day)
);
create table public.pilot_passport_overdue_entries (
 class_id uuid not null,student_id uuid not null,passport_id uuid not null,week integer not null check(week between 1 and 25),day date not null,
 ledger_id uuid not null unique,rule_version integer not null,
 primary key(class_id,student_id,passport_id,week,day),
 foreign key(class_id,student_id,ledger_id) references public.pilot_reward_ledger(class_id,student_id,id),
 foreign key(class_id,passport_id) references public.pilot_passports(class_id,id),
 foreign key(class_id,rule_version) references public.pilot_reward_rule_history(class_id,version)
);
alter table public.pilot_passport_check_history enable row level security;
alter table public.pilot_passport_overdue_settings enable row level security;
alter table public.pilot_passport_overdue_runs enable row level security;
alter table public.pilot_passport_overdue_entries enable row level security;
revoke all on public.pilot_passport_check_history,public.pilot_passport_overdue_settings,public.pilot_passport_overdue_runs,public.pilot_passport_overdue_entries from public,anon,authenticated;
grant select on public.pilot_passport_overdue_settings,public.pilot_passport_overdue_runs,public.pilot_passport_overdue_entries to authenticated;
create policy overdue_settings_owner on public.pilot_passport_overdue_settings for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id and 'rewards'=any(c.enabled_modules)));
create policy overdue_runs_owner on public.pilot_passport_overdue_runs for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id and 'rewards'=any(c.enabled_modules)));
create policy overdue_entries_owner on public.pilot_passport_overdue_entries for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id and 'rewards'=any(c.enabled_modules)));
create function public.configure_pilot_passport_overdue(target_class uuid,is_enabled boolean) returns void
language plpgsql security definer set search_path='' as $$
declare teacher uuid:=pilot_private.require_teacher();
begin
 perform 1 from public.pilot_classes where id=target_class and owner_id=teacher and deleted_at is null and 'rewards'=any(enabled_modules) and (is_enabled is not true or 'passport'=any(enabled_modules)) for update;
 if not found then raise exception 'Passport overdue access denied' using errcode='42501'; end if;
 if is_enabled is null or (is_enabled and not exists(select 1 from public.pilot_reward_rules where class_id=target_class)) then raise exception 'Confirmed rules required' using errcode='23514'; end if;
 insert into public.pilot_passport_overdue_settings(class_id,enabled,enabled_on,actor_id,updated_at)
 values(target_class,is_enabled,case when is_enabled then timezone('Asia/Taipei',pilot_private.overdue_now())::date else null end,teacher,pilot_private.overdue_now())
 on conflict(class_id) do update set enabled=excluded.enabled,enabled_on=case when excluded.enabled and not pilot_passport_overdue_settings.enabled then excluded.enabled_on else pilot_passport_overdue_settings.enabled_on end,actor_id=teacher,updated_at=excluded.updated_at;
end;$$;
-- Not an authenticated RPC. Only the private worker may invoke this function.
create function pilot_private.settle_passport_overdue_class(target_class uuid) returns integer
language plpgsql security definer set search_path='' as $$
declare classroom public.pilot_classes%rowtype; settings public.pilot_passport_overdue_settings%rowtype; term public.pilot_terms%rowtype;
 rules public.pilot_reward_rules%rowtype; penalty_day date:=timezone('Asia/Taipei',pilot_private.overdue_now())::date-1;
 cutoff timestamptz; current_week integer; amount integer; source record; entry_id uuid; count_entries integer:=0;
begin
 select * into classroom from public.pilot_classes where id=target_class and deleted_at is null and 'rewards'=any(enabled_modules) and 'passport'=any(enabled_modules) for update;
 if not found then return 0; end if;
 if not exists(select 1 from public.pilot_teachers where id=classroom.owner_id and active) then return 0; end if;
 select * into settings from public.pilot_passport_overdue_settings where class_id=target_class and enabled;
 if not found or penalty_day<settings.enabled_on then return 0; end if;
 if exists(select 1 from public.pilot_passport_overdue_runs where class_id=target_class and day=penalty_day and status='success') then return 0; end if;
 select * into term from public.pilot_terms where class_id=target_class and active;
 if found and pilot_private.is_school_day(term.id,penalty_day) then
  current_week:=((penalty_day-term.start_date+(extract(isodow from term.start_date)::integer-1))/7)+1;
  select * into rules from public.pilot_reward_rules where class_id=target_class;
  if not found then raise exception 'Confirmed rules missing' using errcode='23514'; end if;
  amount:=(rules.rules->>'passport_overdue_daily_coins')::integer;
  cutoff:=(penalty_day+1)::timestamp at time zone 'Asia/Taipei';
  if amount<0 then
   for source in
    select s.id as student_id,p.id as passport_id,p.name,w.week from public.pilot_students s
    join public.pilot_passports p on p.class_id=s.class_id and p.term_id=term.id and not p.archived
    cross join lateral generate_series(p.first_week,least(p.last_week,current_week-1)) as w(week)
    where s.class_id=target_class and s.deleted_at is null
     and not exists(select 1 from public.pilot_attendance a where a.class_id=target_class and a.student_id=s.id and a.day=penalty_day and a.absent)
     and not coalesce((select h.completed from public.pilot_passport_check_history h where h.class_id=target_class and h.student_id=s.id and h.passport_id=p.id and h.week=w.week and h.happened_at<cutoff order by h.happened_at desc,h.id desc limit 1),false)
     and not exists(select 1 from public.pilot_passport_overdue_entries e where e.class_id=target_class and e.student_id=s.id and e.passport_id=p.id and e.week=w.week and e.day=penalty_day)
    order by s.id,p.id,w.week
   loop
    insert into public.pilot_reward_ledger(class_id,student_id,request_id,coin_delta,xp_delta,reason,actor_id)
    values(target_class,source.student_id,gen_random_uuid(),amount,0,'護照逾期 '||penalty_day::text||' '||source.name||' W'||source.week::text,settings.actor_id) returning id into entry_id;
    insert into public.pilot_reward_balances(class_id,student_id,coin_net,xp_total) values(target_class,source.student_id,0,0) on conflict(class_id,student_id) do nothing;
    update public.pilot_reward_balances set coin_net=coin_net+amount where class_id=target_class and student_id=source.student_id;
    insert into public.pilot_passport_overdue_entries(class_id,student_id,passport_id,week,day,ledger_id,rule_version)
    values(target_class,source.student_id,source.passport_id,source.week,penalty_day,entry_id,rules.version);
    count_entries:=count_entries+1;
   end loop;
  end if;
 end if;
 insert into public.pilot_passport_overdue_runs(class_id,day,status,entry_count,finished_at) values(target_class,penalty_day,'success',count_entries,pilot_private.overdue_now())
 on conflict(class_id,day) do update set status='success',entry_count=excluded.entry_count,attempts=pilot_passport_overdue_runs.attempts+1,error_code=null,finished_at=excluded.finished_at;
 return count_entries;
end;$$;
create function pilot_private.run_passport_overdue() returns integer
language plpgsql security definer set search_path='' as $$
declare target record; processed integer:=0;
begin
 for target in select s.class_id from public.pilot_passport_overdue_settings s join public.pilot_classes c on c.id=s.class_id join public.pilot_teachers t on t.id=c.owner_id and t.active
  where s.enabled and c.deleted_at is null and 'rewards'=any(c.enabled_modules) and 'passport'=any(c.enabled_modules)
   and not exists(select 1 from public.pilot_passport_overdue_runs r where r.class_id=s.class_id and r.day=timezone('Asia/Taipei',pilot_private.overdue_now())::date-1 and r.status='success')
   and s.enabled_on<=timezone('Asia/Taipei',pilot_private.overdue_now())::date-1
  order by s.class_id
 loop
  begin
   perform pilot_private.settle_passport_overdue_class(target.class_id); processed:=processed+1;
  exception when others then
   insert into public.pilot_passport_overdue_runs(class_id,day,status,error_code,finished_at)
   values(target.class_id,timezone('Asia/Taipei',pilot_private.overdue_now())::date-1,'failed',SQLSTATE,pilot_private.overdue_now())
   on conflict(class_id,day) do update set status='failed',attempts=pilot_passport_overdue_runs.attempts+1,error_code=excluded.error_code,finished_at=excluded.finished_at;
  end;
 end loop;
 return processed;
end;$$;
revoke all on function pilot_private.overdue_now(),pilot_private.record_passport_history(),pilot_private.settle_passport_overdue_class(uuid),pilot_private.run_passport_overdue() from public,anon,authenticated;
revoke all on function public.configure_pilot_passport_overdue(uuid,boolean) from public,anon,authenticated;
grant execute on function public.configure_pilot_passport_overdue(uuid,boolean) to authenticated;
commit;
