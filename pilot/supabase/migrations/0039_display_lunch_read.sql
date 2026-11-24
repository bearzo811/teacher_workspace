-- Own-class lunch duty and routine snapshot for a valid paired device. Read-only.
begin;
create function public.get_pilot_display_lunch(device_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare classroom uuid:=pilot_private.require_display(device_token); room public.pilot_classes%rowtype; term public.pilot_terms%rowtype;
 today date:=pilot_private.display_today(); school boolean:=false; jobs jsonb:='[]'::jsonb; checks jsonb:='[]'::jsonb;
begin
 select * into room from public.pilot_classes where id=classroom;
 select * into term from public.pilot_terms where class_id=classroom and active;
 if term.id is not null then school:=pilot_private.is_school_day(term.id,today); end if;
 if school and 'duty'=any(room.enabled_modules) then
  select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'student_id',case when s.deleted_at is null then s.id else null end,'job_name',a.job_name,'group',a.group_key) order by a.group_key,a.job_name,a.slot),'[]'::jsonb) into jobs from public.pilot_duty_assignments a join public.pilot_duty_plans p on p.id=a.plan_id and p.class_id=a.class_id join public.pilot_students s on s.id=a.student_id and s.class_id=a.class_id
  where a.class_id=classroom and p.term_id=term.id and a.day=today and p.revision=(select max(p2.revision) from public.pilot_duty_plans p2 where p2.class_id=classroom and p2.term_id=term.id and p2.effective_from<=today);
 end if;
 if school and 'routines'=any(room.enabled_modules) then
  select coalesce(jsonb_agg(jsonb_build_object('student_id',h.student_id,'task_key',h.task_key,'completed',h.completed)),'[]'::jsonb) into checks from public.pilot_routine_checks h join public.pilot_students s on s.id=h.student_id and s.class_id=h.class_id where h.class_id=classroom and h.term_id=term.id and h.day=today and h.task_key in ('lunch_brushing','noon_cleaning') and s.deleted_at is null;
 end if;
 return jsonb_build_object('day',today,'school_day',school,'duty_enabled','duty'=any(room.enabled_modules),'routines_enabled','routines'=any(room.enabled_modules),'jobs',jobs,'checks',checks,
 'students',case when room.enabled_modules && array['duty','routines'] then coalesce((select jsonb_agg(jsonb_build_object('id',id,'seat',seat,'name',name) order by seat,id) from public.pilot_students where class_id=classroom and deleted_at is null),'[]'::jsonb) else '[]'::jsonb end,
 'attendance',case when room.enabled_modules && array['duty','routines'] then coalesce((select jsonb_agg(jsonb_build_object('student_id',a.student_id,'absent',a.absent)) from public.pilot_attendance a join public.pilot_students s on s.id=a.student_id and s.class_id=a.class_id where a.class_id=classroom and a.day=today and s.deleted_at is null),'[]'::jsonb) else '[]'::jsonb end);
end;$$;
revoke all on function public.get_pilot_display_lunch(text) from public,anon,authenticated;
grant execute on function public.get_pilot_display_lunch(text) to anon,authenticated;
commit;
