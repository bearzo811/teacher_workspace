-- Attendance is independent of optional routines, terms, homework and school days.
begin;
create table public.pilot_attendance (
 class_id uuid not null references public.pilot_classes(id),
 student_id uuid not null,
 day date not null check(day between date '2000-01-01' and date '2100-12-31'),
 absent boolean not null,
 updated_at timestamptz not null default now(),
 primary key(student_id,day),
 foreign key(class_id,student_id) references public.pilot_students(class_id,id)
);
alter table public.pilot_attendance enable row level security;
revoke all on public.pilot_attendance from public,anon,authenticated;
grant select on public.pilot_attendance to authenticated;
create policy attendance_owner on public.pilot_attendance for select to authenticated using (
 exists(select 1 from public.pilot_classes c where c.id=class_id)
);
create function public.set_pilot_attendance(target_class uuid,target_student uuid,target_day date,is_absent boolean) returns void
language plpgsql security definer set search_path='' as $$
declare teacher uuid := pilot_private.require_teacher();
begin
 perform 1 from public.pilot_classes where id=target_class and owner_id=teacher and deleted_at is null for update;
 if not found or not exists(select 1 from public.pilot_students where id=target_student and class_id=target_class and deleted_at is null)
 then raise exception 'Attendance access denied' using errcode='42501'; end if;
 insert into public.pilot_attendance(class_id,student_id,day,absent) values(target_class,target_student,target_day,is_absent)
  on conflict(student_id,day) do update set absent=excluded.absent,updated_at=now();
end;
$$;
revoke all on function public.set_pilot_attendance(uuid,uuid,date,boolean) from public,anon,authenticated;
grant execute on function public.set_pilot_attendance(uuid,uuid,date,boolean) to authenticated;
commit;
