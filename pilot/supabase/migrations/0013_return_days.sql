-- Return days are separate from school-day overrides and never shift term weeks.
begin;
create table public.pilot_return_days (
 class_id uuid not null references public.pilot_classes(id),
 day date not null check(day between date '2000-01-01' and date '2100-12-31'),
 label text not null check(char_length(btrim(label)) between 1 and 60),
 enabled boolean not null,
 primary key(class_id,day)
);
create table public.pilot_return_checks (
 class_id uuid not null,
 day date not null,
 student_id uuid not null,
 task_key text not null check(task_key in ('morning_cleaning','summer_homework_submitted')),
 completed boolean not null,
 completed_at timestamptz,
 updated_at timestamptz not null default now(),
 primary key(class_id,day,student_id,task_key),
 foreign key(class_id,day) references public.pilot_return_days(class_id,day),
 foreign key(class_id,student_id) references public.pilot_students(class_id,id),
 check(completed=(completed_at is not null))
);
alter table public.pilot_return_days enable row level security;
alter table public.pilot_return_checks enable row level security;
revoke all on public.pilot_return_days,public.pilot_return_checks from public,anon,authenticated;
grant select on public.pilot_return_days,public.pilot_return_checks to authenticated;
create policy return_day_owner on public.pilot_return_days for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id and 'routines'=any(c.enabled_modules)));
create policy return_check_owner on public.pilot_return_checks for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id and 'routines'=any(c.enabled_modules)));
create function pilot_private.lock_return_class(target_class uuid) returns void
language plpgsql security definer set search_path='' as $$
declare teacher uuid:=pilot_private.require_teacher();
begin
 perform 1 from public.pilot_classes where id=target_class and owner_id=teacher and deleted_at is null and 'routines'=any(enabled_modules) for update;
 if not found then raise exception 'Return day access denied' using errcode='42501'; end if;
end;
$$;
create function public.save_pilot_return_day(target_class uuid,target_day date,day_label text,is_enabled boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform pilot_private.lock_return_class(target_class);
 if is_enabled is null then raise exception 'Return day state required' using errcode='23514'; end if;
 if is_enabled and exists(select 1 from public.pilot_terms where class_id=target_class and active and pilot_private.is_school_day(id,target_day))
 then raise exception 'School day uses regular routines' using errcode='23514'; end if;
 if not exists(select 1 from public.pilot_return_days where class_id=target_class and day=target_day)
  and (select count(*) from public.pilot_return_days where class_id=target_class)>=60
 then raise exception 'Return day limit reached' using errcode='23514'; end if;
 insert into public.pilot_return_days(class_id,day,label,enabled) values(target_class,target_day,btrim(day_label),is_enabled)
 on conflict(class_id,day) do update set label=excluded.label,enabled=excluded.enabled;
end;
$$;
create function public.set_pilot_return_check(target_class uuid,target_student uuid,target_day date,routine_key text,is_completed boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform pilot_private.lock_return_class(target_class);
 if not exists(select 1 from public.pilot_return_days where class_id=target_class and day=target_day and enabled)
  or exists(select 1 from public.pilot_terms where class_id=target_class and active and pilot_private.is_school_day(id,target_day))
 then raise exception 'Active non-school return day required' using errcode='23514'; end if;
 if not exists(select 1 from public.pilot_students where class_id=target_class and id=target_student and deleted_at is null)
 then raise exception 'Return student access denied' using errcode='42501'; end if;
 if exists(select 1 from public.pilot_attendance where class_id=target_class and student_id=target_student and day=target_day and absent)
 then raise exception 'Student is absent' using errcode='23514'; end if;
 insert into public.pilot_return_checks(class_id,student_id,day,task_key,completed,completed_at)
 values(target_class,target_student,target_day,routine_key,is_completed,case when is_completed then now() else null end)
 on conflict(class_id,day,student_id,task_key) do update set completed=excluded.completed,completed_at=case when excluded.completed then coalesce(pilot_return_checks.completed_at,excluded.completed_at) else null end,updated_at=now();
end;
$$;
revoke all on function pilot_private.lock_return_class(uuid) from public,anon,authenticated;
revoke all on function public.save_pilot_return_day(uuid,date,text,boolean),public.set_pilot_return_check(uuid,uuid,date,text,boolean) from public,anon,authenticated;
grant execute on function public.save_pilot_return_day(uuid,date,text,boolean),public.set_pilot_return_check(uuid,uuid,date,text,boolean) to authenticated;
commit;
