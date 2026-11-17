begin;
create table public.pilot_reading_checks (
 class_id uuid not null references public.pilot_classes(id),
 term_id uuid not null,
 student_id uuid not null,
 kind text not null check(kind in ('newspaper','reflection')),
 month date not null check(extract(day from month)=1 and extract(month from month) not in (7,8) and month between date '2000-01-01' and date '2100-12-01'),
 status text not null check(status in ('not_started','missing_parent','completed')),
 completed_at timestamptz,
 updated_at timestamptz not null default now(),
 primary key(term_id,student_id,kind,month),
 foreign key(class_id,term_id) references public.pilot_terms(class_id,id),
 foreign key(class_id,student_id) references public.pilot_students(class_id,id),
 check((status='completed')=(completed_at is not null))
);
create index pilot_reading_term on public.pilot_reading_checks(class_id,term_id);
alter table public.pilot_reading_checks enable row level security;
revoke all on public.pilot_reading_checks from public,anon,authenticated;
grant select on public.pilot_reading_checks to authenticated;
create policy reading_owner on public.pilot_reading_checks for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id and 'reading'=any(c.enabled_modules)));
create function public.set_pilot_reading_check(target_class uuid,target_term uuid,target_student uuid,reading_kind text,target_month date,reading_status text) returns void
language plpgsql security definer set search_path='' as $$
declare teacher uuid:=pilot_private.require_teacher();
begin
 perform 1 from public.pilot_classes where id=target_class and owner_id=teacher and deleted_at is null and 'reading'=any(enabled_modules) for update;
 if not found then raise exception 'Reading class access denied' using errcode='42501'; end if;
 if target_month is null or not exists(select 1 from public.pilot_terms where id=target_term and class_id=target_class and active and target_month<=end_date and (target_month+interval '1 month')::date>start_date)
 then raise exception 'Reading term access denied' using errcode='42501'; end if;
 if not exists(select 1 from public.pilot_students where id=target_student and class_id=target_class and deleted_at is null)
 then raise exception 'Reading student access denied' using errcode='42501'; end if;
 insert into public.pilot_reading_checks(class_id,term_id,student_id,kind,month,status,completed_at)
 values(target_class,target_term,target_student,reading_kind,target_month,reading_status,case when reading_status='completed' then now() else null end)
 on conflict(term_id,student_id,kind,month) do update set status=excluded.status,completed_at=case when excluded.status='completed' then coalesce(pilot_reading_checks.completed_at,excluded.completed_at) else null end,updated_at=now();
end;
$$;
revoke all on function public.set_pilot_reading_check(uuid,uuid,uuid,text,date,text) from public,anon,authenticated;
grant execute on function public.set_pilot_reading_check(uuid,uuid,uuid,text,date,text) to authenticated;
commit;
