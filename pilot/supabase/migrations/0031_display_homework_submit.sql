-- Device self-submission only: missing -> pending. No grading or rewards.
begin;
create table public.pilot_display_submissions(
 id uuid primary key default gen_random_uuid(),class_id uuid not null,student_id uuid not null,assignment_id uuid not null,device_id uuid not null,
 request_id uuid not null,observed_status text not null check(observed_status in ('pending','correction','completed')),created_at timestamptz not null default now(),
 unique(class_id,request_id),
 foreign key(class_id,student_id) references public.pilot_students(class_id,id),
 foreign key(class_id,assignment_id) references public.pilot_assignments(class_id,id),
 foreign key(class_id,device_id) references public.pilot_display_devices(class_id,id)
);
alter table public.pilot_display_submissions enable row level security;
revoke all on public.pilot_display_submissions from public,anon,authenticated;
grant select on public.pilot_display_submissions to authenticated;
create policy display_submission_owner on public.pilot_display_submissions for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id and 'homework'=any(c.enabled_modules)));
create function public.submit_pilot_display_homework(device_token text,target_student uuid,target_assignment uuid,request_key uuid) returns text
language plpgsql security definer set search_path='' as $$
declare classroom uuid:=pilot_private.require_display(device_token); today date:=pilot_private.display_today(); assignment public.pilot_assignments%rowtype;
 previous public.pilot_display_submissions%rowtype; status text; device uuid;
begin
 perform 1 from public.pilot_classes where id=classroom and deleted_at is null and 'homework'=any(enabled_modules) for update;
 if not found then raise exception 'Display homework access denied' using errcode='42501'; end if;
 perform pilot_private.require_display(device_token);
 if request_key is null then raise exception 'Submission request required' using errcode='23514'; end if;
 if not exists(select 1 from public.pilot_students where id=target_student and class_id=classroom and deleted_at is null) then raise exception 'Display student access denied' using errcode='42501'; end if;
 select * into previous from public.pilot_display_submissions where class_id=classroom and request_id=request_key;
 if found then
  if previous.student_id<>target_student or previous.assignment_id<>target_assignment then raise exception 'Submission request conflict' using errcode='23514'; end if;
  return previous.observed_status;
 end if;
 select a.* into assignment from public.pilot_assignments a join public.pilot_terms t on t.id=a.term_id and t.class_id=a.class_id
 where a.id=target_assignment and a.class_id=classroom and not a.archived and t.active and a.due_day=today;
 if not found or not pilot_private.is_school_day(assignment.term_id,today) then raise exception 'Today due school-day assignment required' using errcode='23514'; end if;
 if exists(select 1 from public.pilot_attendance where class_id=classroom and student_id=target_student and day=today and absent) then raise exception 'Student is absent' using errcode='23514'; end if;
 select h.status into status from public.pilot_homework_checks h where h.class_id=classroom and h.assignment_id=target_assignment and h.student_id=target_student for update;
 if status is null or status='missing' then
  insert into public.pilot_homework_checks(class_id,assignment_id,student_id,status) values(classroom,target_assignment,target_student,'pending')
  on conflict(assignment_id,student_id) do update set status='pending',updated_at=now();
  status:='pending';
 end if;
 -- Existing pending/correction/completed is preserved; students cannot grade or undo.
 select id into device from public.pilot_display_devices where class_id=classroom and token_hash=encode(sha256(convert_to(device_token,'UTF8')),'hex');
 insert into public.pilot_display_submissions(class_id,student_id,assignment_id,device_id,request_id,observed_status)
 values(classroom,target_student,target_assignment,device,request_key,status);
 return status;
end;$$;
revoke all on function public.submit_pilot_display_homework(text,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.submit_pilot_display_homework(text,uuid,uuid,uuid) to anon,authenticated;
commit;
