-- Paired-device passport/reading matrices. Read-only.
begin;
create function public.get_pilot_display_learning(device_token text,selected_student uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare classroom uuid:=pilot_private.require_display(device_token); room public.pilot_classes%rowtype; term public.pilot_terms%rowtype; today date:=pilot_private.display_today();
 plans jsonb:='[]'::jsonb; passport_checks jsonb:='[]'::jsonb; reading_checks jsonb:='[]'::jsonb; months jsonb:='[]'::jsonb;
begin
 select * into room from public.pilot_classes where id=classroom;
 if selected_student is not null and not exists(select 1 from public.pilot_students where class_id=classroom and id=selected_student and deleted_at is null) then raise exception 'Display student access denied' using errcode='42501'; end if;
 select * into term from public.pilot_terms where class_id=classroom and active;
 if term.id is not null and 'passport'=any(room.enabled_modules) then
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'first_week',first_week,'last_week',last_week) order by name,id),'[]'::jsonb) into plans from public.pilot_passports where class_id=classroom and term_id=term.id and not archived;
  select coalesce(jsonb_agg(jsonb_build_object('passport_id',h.passport_id,'student_id',h.student_id,'week',h.week,'completed',h.completed)),'[]'::jsonb) into passport_checks from public.pilot_passport_checks h join public.pilot_passports p on p.id=h.passport_id and p.class_id=h.class_id join public.pilot_students s on s.id=h.student_id and s.class_id=h.class_id
   where h.class_id=classroom and p.term_id=term.id and not p.archived and s.deleted_at is null and (selected_student is null or h.student_id=selected_student);
 end if;
 if term.id is not null and 'reading'=any(room.enabled_modules) then
  select coalesce(jsonb_agg(m::date order by m),'[]'::jsonb) into months from generate_series(date_trunc('month',term.start_date::timestamp),date_trunc('month',term.end_date::timestamp),interval '1 month') m where extract(month from m) not in (7,8);
  select coalesce(jsonb_agg(jsonb_build_object('student_id',h.student_id,'kind',h.kind,'month',h.month,'status',h.status)),'[]'::jsonb) into reading_checks from public.pilot_reading_checks h join public.pilot_students s on s.id=h.student_id and s.class_id=h.class_id
   where h.class_id=classroom and h.term_id=term.id and s.deleted_at is null and (selected_student is null or h.student_id=selected_student);
 end if;
 return jsonb_build_object('day',today,'term',case when term.id is null then null else jsonb_build_object('id',term.id,'name',term.name,'start_date',term.start_date,'end_date',term.end_date,'active',true) end,
 'passport_enabled','passport'=any(room.enabled_modules),'reading_enabled','reading'=any(room.enabled_modules),
 'students',case when room.enabled_modules && array['passport','reading'] then coalesce((select jsonb_agg(jsonb_build_object('id',id,'seat',seat,'name',name) order by seat) from public.pilot_students where class_id=classroom and deleted_at is null),'[]'::jsonb) else '[]'::jsonb end,
 'plans',plans,'passport_checks',passport_checks,'months',months,'reading_checks',reading_checks);
end;$$;
revoke all on function public.get_pilot_display_learning(text,uuid) from public,anon,authenticated;
grant execute on function public.get_pilot_display_learning(text,uuid) to anon,authenticated;
commit;
