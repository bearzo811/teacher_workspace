-- Teacher checks only; no anonymous or display-device writes.
begin;
alter table public.pilot_students add constraint pilot_student_class_id unique(class_id,id);
create table public.pilot_homework_checks (
 class_id uuid not null references public.pilot_classes(id),
 assignment_id uuid not null,
 student_id uuid not null,
 status text not null check(status in ('missing','pending','correction','completed')),
 updated_at timestamptz not null default now(),
 primary key(assignment_id,student_id),
 foreign key(class_id,assignment_id) references public.pilot_assignments(class_id,id),
 foreign key(class_id,student_id) references public.pilot_students(class_id,id)
);
alter table public.pilot_homework_checks enable row level security;
revoke all on public.pilot_homework_checks from public,anon,authenticated;
grant select on public.pilot_homework_checks to authenticated;
create policy homework_check_owner on public.pilot_homework_checks for select to authenticated using (
 exists(select 1 from public.pilot_classes c where c.id=class_id and 'homework'=any(c.enabled_modules))
);
create function public.set_pilot_homework_check(target_class uuid,target_assignment uuid,target_student uuid,homework_status text) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform pilot_private.lock_homework_class(target_class);
 if not exists(select 1 from public.pilot_assignments where id=target_assignment and class_id=target_class and not archived)
   or not exists(select 1 from public.pilot_students where id=target_student and class_id=target_class and deleted_at is null)
 then raise exception 'Homework check access denied' using errcode='42501'; end if;
 insert into public.pilot_homework_checks(class_id,assignment_id,student_id,status)
   values(target_class,target_assignment,target_student,homework_status)
   on conflict(assignment_id,student_id) do update set status=excluded.status,updated_at=now();
end;
$$;
revoke all on function public.set_pilot_homework_check(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.set_pilot_homework_check(uuid,uuid,uuid,text) to authenticated;
commit;
