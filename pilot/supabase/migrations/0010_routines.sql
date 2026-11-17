-- Teacher-only daily tasks; attendance remains a separate source of truth.
begin;
create table public.pilot_routine_checks (
 class_id uuid not null references public.pilot_classes(id),
 term_id uuid not null,
 student_id uuid not null,
 day date not null check(day between date '2000-01-01' and date '2100-12-31'),
 task_key text not null check(task_key in ('morning_cleaning','contact_book_copied','lunch_brushing','noon_cleaning')),
 completed boolean not null,
 completed_at timestamptz,
 updated_at timestamptz not null default now(),
 primary key(term_id,student_id,day,task_key),
 foreign key(class_id,term_id) references public.pilot_terms(class_id,id),
 foreign key(class_id,student_id) references public.pilot_students(class_id,id),
 check(completed=(completed_at is not null))
);
create index pilot_routines_day on public.pilot_routine_checks(class_id,term_id,day);
alter table public.pilot_routine_checks enable row level security;
revoke all on public.pilot_routine_checks from public,anon,authenticated;
grant select on public.pilot_routine_checks to authenticated;
create policy routine_owner on public.pilot_routine_checks for select to authenticated using (
 exists(select 1 from public.pilot_classes c where c.id=class_id and 'routines'=any(c.enabled_modules))
);
create function public.set_pilot_routine_check(target_class uuid,target_term uuid,target_student uuid,target_day date,routine_key text,is_completed boolean) returns void
language plpgsql security definer set search_path='' as $$
declare teacher uuid := pilot_private.require_teacher();
begin
 perform 1 from public.pilot_classes where id=target_class and owner_id=teacher and deleted_at is null and 'routines'=any(enabled_modules) for update;
 if not found then raise exception 'Routine class access denied' using errcode='42501'; end if;
 if routine_key is null or routine_key not in ('morning_cleaning','contact_book_copied','lunch_brushing','noon_cleaning') or is_completed is null
 then raise exception 'Invalid routine state' using errcode='23514'; end if;
 if target_day is null or not exists(select 1 from public.pilot_terms where id=target_term and class_id=target_class and active)
   or not pilot_private.is_school_day(target_term,target_day)
 then raise exception 'Active term school day required' using errcode='23514'; end if;
 if not exists(select 1 from public.pilot_students where id=target_student and class_id=target_class and deleted_at is null)
 then raise exception 'Routine student access denied' using errcode='42501'; end if;
 if exists(select 1 from public.pilot_attendance where class_id=target_class and student_id=target_student and day=target_day and absent)
 then raise exception 'Student is absent' using errcode='23514'; end if;
 if routine_key='contact_book_copied' and is_completed and (
  not exists(select 1 from public.pilot_classes where id=target_class and 'homework'=any(enabled_modules))
  or not exists(select 1 from public.pilot_contact_days where class_id=target_class and term_id=target_term and day=target_day)
 ) then raise exception 'Contact book required' using errcode='23514'; end if;
 insert into public.pilot_routine_checks(class_id,term_id,student_id,day,task_key,completed,completed_at)
 values(target_class,target_term,target_student,target_day,routine_key,is_completed,case when is_completed then now() else null end)
 on conflict(term_id,student_id,day,task_key) do update set completed=excluded.completed,
  completed_at=case when excluded.completed then coalesce(pilot_routine_checks.completed_at,excluded.completed_at) else null end,updated_at=now();
end;
$$;
revoke all on function public.set_pilot_routine_check(uuid,uuid,uuid,date,text,boolean) from public,anon,authenticated;
grant execute on function public.set_pilot_routine_check(uuid,uuid,uuid,date,text,boolean) to authenticated;
commit;
