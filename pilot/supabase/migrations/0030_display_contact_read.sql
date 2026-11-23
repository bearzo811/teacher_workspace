-- Read-only contact book and today's due work for paired whiteboards.
begin;
create function pilot_private.display_today() returns date language sql stable set search_path='' as $$select timezone('Asia/Taipei',now())::date$$;
create function public.get_pilot_display_contact(device_token text,selected_student uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare classroom uuid:=pilot_private.require_display(device_token); room public.pilot_classes%rowtype; term public.pilot_terms%rowtype;
 today date:=pilot_private.display_today(); school boolean:=false; return_label text; contact public.pilot_contact_days%rowtype;
 assigned jsonb:='[]'::jsonb; due jsonb:='[]'::jsonb; checks jsonb:='[]'::jsonb; routines jsonb:='[]'::jsonb; returns jsonb:='[]'::jsonb;
begin
 select * into room from public.pilot_classes where id=classroom;
 if selected_student is not null and not exists(select 1 from public.pilot_students where class_id=classroom and id=selected_student and deleted_at is null) then raise exception 'Display student access denied' using errcode='42501'; end if;
 select * into term from public.pilot_terms where class_id=classroom and active;
 if term.id is not null then school:=pilot_private.is_school_day(term.id,today); end if;
 if 'routines'=any(room.enabled_modules) and not school then select label into return_label from public.pilot_return_days where class_id=classroom and day=today and enabled; end if;
 if 'homework'=any(room.enabled_modules) and term.id is not null then
  select * into contact from public.pilot_contact_days where class_id=classroom and term_id=term.id and day=today;
  select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'name',b.name,'content',a.content,'due_day',a.due_day) order by a.id),'[]'::jsonb) into assigned
   from public.pilot_assignments a join public.pilot_workbooks b on b.class_id=a.class_id and b.id=a.workbook_id
   where a.class_id=classroom and a.term_id=term.id and a.contact_day=today and not a.archived;
  if (select count(*) from public.pilot_assignments where class_id=classroom and term_id=term.id and due_day=today and not archived)>1000 then raise exception 'Display daily assignment limit reached' using errcode='23514'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'name',b.name,'content',a.content,'contact_day',a.contact_day) order by a.id),'[]'::jsonb) into due
   from public.pilot_assignments a join public.pilot_workbooks b on b.class_id=a.class_id and b.id=a.workbook_id
   where a.class_id=classroom and a.term_id=term.id and a.due_day=today and not a.archived;
  select coalesce(jsonb_agg(jsonb_build_object('assignment_id',h.assignment_id,'student_id',h.student_id,'status',h.status)),'[]'::jsonb) into checks
   from public.pilot_homework_checks h join public.pilot_assignments a on a.id=h.assignment_id and a.class_id=h.class_id join public.pilot_students s on s.id=h.student_id and s.class_id=h.class_id
   where h.class_id=classroom and a.term_id=term.id and a.due_day=today and not a.archived and s.deleted_at is null;
 end if;
 if 'routines'=any(room.enabled_modules) then
  select coalesce(jsonb_agg(jsonb_build_object('student_id',student_id,'task_key',task_key,'completed',completed)),'[]'::jsonb) into routines from public.pilot_routine_checks where class_id=classroom and term_id=term.id and day=today;
  select coalesce(jsonb_agg(jsonb_build_object('student_id',student_id,'task_key',task_key,'completed',completed)),'[]'::jsonb) into returns from public.pilot_return_checks where class_id=classroom and day=today and return_label is not null;
 end if;
 return jsonb_build_object('day',today,'class_name',room.name,'homework_enabled','homework'=any(room.enabled_modules),'routines_enabled','routines'=any(room.enabled_modules),
 'school_day',school,'return_label',return_label,'week',case when today between term.start_date and term.end_date then ((today-term.start_date+(extract(isodow from term.start_date)::integer-1))/7)+1 else null end,
 'contact_exists',contact.class_id is not null,'notes',coalesce(contact.notes,''),'assigned',assigned,'due',due,'homework_checks',checks,'routine_checks',routines,'return_checks',returns,
 'students',coalesce((select jsonb_agg(jsonb_build_object('id',id,'seat',seat,'name',name) order by seat) from public.pilot_students where class_id=classroom and deleted_at is null),'[]'::jsonb),
 'attendance',coalesce((select jsonb_agg(jsonb_build_object('student_id',student_id,'absent',absent)) from public.pilot_attendance where class_id=classroom and day=today),'[]'::jsonb));
end;$$;
revoke all on function pilot_private.display_today(),public.get_pilot_display_contact(text,uuid) from public,anon,authenticated;
grant execute on function public.get_pilot_display_contact(text,uuid) to anon,authenticated;
commit;
