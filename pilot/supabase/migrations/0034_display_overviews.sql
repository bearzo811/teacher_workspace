-- Paired read-only calendar, student points and debt overview.
begin;
create function public.get_pilot_display_points(device_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare classroom uuid:=pilot_private.require_display(device_token); base integer; enabled boolean;
begin
 select 'rewards'=any(enabled_modules) into enabled from public.pilot_classes where id=classroom;
 if not enabled then return jsonb_build_object('enabled',false,'students','[]'::jsonb); end if;
 select (rules->>'level_base_xp')::integer into base from public.pilot_reward_rules where class_id=classroom;
 return jsonb_build_object('enabled',true,'rules_confirmed',base is not null,'level_base_xp',coalesce(base,100),'shop_open',coalesce((select is_open from public.pilot_shop_settings where class_id=classroom),false),
 'students',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'seat',s.seat,'name',s.name,'coin_net',coalesce(b.coin_net,0),'xp_total',coalesce(b.xp_total,0)) order by s.seat) from public.pilot_students s left join public.pilot_reward_balances b on b.class_id=s.class_id and b.student_id=s.id where s.class_id=classroom and s.deleted_at is null),'[]'::jsonb));
end;$$;
create function public.get_pilot_display_calendar(device_token text,month_offset integer default 0) returns jsonb
language plpgsql security definer set search_path='' as $$
declare classroom uuid:=pilot_private.require_display(device_token); today date:=pilot_private.display_today(); first_day date; term public.pilot_terms%rowtype;
begin
 if month_offset is null or month_offset not between -12 and 12 then raise exception 'Invalid calendar offset' using errcode='23514'; end if;
 first_day:=(date_trunc('month',today::timestamp)+make_interval(months=>month_offset))::date;
 select * into term from public.pilot_terms where class_id=classroom and active;
 return jsonb_build_object('today',today,'month',first_day,'term',case when term.id is null then null else jsonb_build_object('id',term.id,'name',term.name,'start_date',term.start_date,'end_date',term.end_date,'active',true) end,
 'days',coalesce((select jsonb_agg(jsonb_build_object('day',day,'is_school_day',is_school_day,'note',note)) from public.pilot_day_overrides where term_id=term.id and day>=first_day and day<(first_day+interval '1 month')::date),'[]'::jsonb),
 'events',coalesce((select jsonb_agg(jsonb_build_object('id',id,'title',title,'day',day,'note',note) order by day,id) from public.pilot_calendar_events where class_id=classroom and not archived and day>=first_day and day<(first_day+interval '1 month')::date),'[]'::jsonb),
 'countdowns',coalesce((select jsonb_agg(to_jsonb(e) order by e.day,e.id) from (select id,title,day,note from public.pilot_calendar_events where class_id=classroom and not archived and countdown and day>=today order by day,id limit 50) e),'[]'::jsonb));
end;$$;
create function public.get_pilot_display_debts(device_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare classroom uuid:=pilot_private.require_display(device_token); room public.pilot_classes%rowtype; term public.pilot_terms%rowtype; today date:=pilot_private.display_today(); assignments jsonb:='[]'::jsonb; checks jsonb:='[]'::jsonb;
begin
 select * into room from public.pilot_classes where id=classroom;
 select * into term from public.pilot_terms where class_id=classroom and active;
 if term.id is not null and 'homework'=any(room.enabled_modules) then
  if (select count(*) from public.pilot_assignments where class_id=classroom and term_id=term.id and not archived and due_day<=today)>1000 then raise exception 'Display debt assignment limit reached' using errcode='23514'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'content',a.content,'contact_day',a.contact_day,'due_day',a.due_day,'workbook_id',a.workbook_id,'blocks_break',a.blocks_break,'blocks_shop',a.blocks_shop,'book_name',b.name) order by a.contact_day desc,a.id),'[]'::jsonb) into assignments from public.pilot_assignments a join public.pilot_workbooks b on b.class_id=a.class_id and b.id=a.workbook_id where a.class_id=classroom and a.term_id=term.id and not a.archived and a.due_day<=today;
  select coalesce(jsonb_agg(jsonb_build_object('assignment_id',h.assignment_id,'student_id',h.student_id,'status',h.status)),'[]'::jsonb) into checks from public.pilot_homework_checks h join public.pilot_assignments a on a.id=h.assignment_id and a.class_id=h.class_id join public.pilot_students s on s.id=h.student_id and s.class_id=h.class_id where h.class_id=classroom and a.term_id=term.id and not a.archived and a.due_day<=today and s.deleted_at is null;
 end if;
 return jsonb_build_object('day',today,'learning',public.get_pilot_display_learning(device_token,null),'assignments',assignments,'checks',checks,
 'students',case when room.enabled_modules && array['homework','passport','reading'] then coalesce((select jsonb_agg(jsonb_build_object('id',id,'seat',seat,'name',name) order by seat) from public.pilot_students where class_id=classroom and deleted_at is null),'[]'::jsonb) else '[]'::jsonb end);
end;$$;
revoke all on function public.get_pilot_display_points(text),public.get_pilot_display_calendar(text,integer),public.get_pilot_display_debts(text) from public,anon,authenticated;
grant execute on function public.get_pilot_display_points(text),public.get_pilot_display_calendar(text,integer),public.get_pilot_display_debts(text) to anon,authenticated;
commit;
