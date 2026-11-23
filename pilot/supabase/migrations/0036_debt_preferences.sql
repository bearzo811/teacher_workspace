-- Per-student display order only. Never changes grades, debt gates, or rewards.
begin;
create table public.pilot_debt_preferences(
 class_id uuid not null,student_id uuid not null,term_id uuid not null,
 ordered_keys text[] not null default '{}',show_more boolean not null default true,version integer not null default 1 check(version>0),
 updated_at timestamptz not null default now(),primary key(student_id,term_id),
 foreign key(class_id,student_id) references public.pilot_students(class_id,id),
 foreign key(class_id,term_id) references public.pilot_terms(class_id,id),
 check(cardinality(ordered_keys)<=2000)
);
alter table public.pilot_debt_preferences enable row level security;
revoke all on public.pilot_debt_preferences from public,anon,authenticated;
grant select on public.pilot_debt_preferences to authenticated;
create policy debt_preferences_owner on public.pilot_debt_preferences for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id and enabled_modules && array['homework','passport','reading']));
create function public.save_pilot_debt_preference(target_class uuid,target_student uuid,target_term uuid,priority_keys text[],display_more boolean,expected_version integer) returns void
language plpgsql security definer set search_path='' as $$
declare teacher uuid:=pilot_private.require_teacher(); key text; plan uuid; week integer; current_version integer; term public.pilot_terms%rowtype; modules text[];
begin
 select enabled_modules into modules from public.pilot_classes where id=target_class and owner_id=teacher and deleted_at is null and enabled_modules && array['homework','passport','reading'] for update;
 if not found or not exists(select 1 from public.pilot_students where class_id=target_class and id=target_student and deleted_at is null) then raise exception 'Debt preference access denied' using errcode='42501'; end if;
 select * into term from public.pilot_terms where class_id=target_class and id=target_term and active;
 if not found then raise exception 'Active term required' using errcode='23514'; end if;
 if priority_keys is null or display_more is null or expected_version is null or cardinality(priority_keys)>2000 or array_ndims(priority_keys)>1 or cardinality(priority_keys)<>(select count(distinct x) from unnest(priority_keys) x) then raise exception 'Invalid debt order' using errcode='23514'; end if;
 foreach key in array priority_keys loop
  if key ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then
   if not ('homework'=any(modules)) or not exists(select 1 from public.pilot_assignments where class_id=target_class and term_id=target_term and id=key::uuid and not archived) then raise exception 'Debt assignment access denied' using errcode='42501'; end if;
  elsif key ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}:[0-9]{1,2}$' then
   plan:=split_part(key,':',1)::uuid;week:=split_part(key,':',2)::integer;
   if not ('passport'=any(modules)) or not exists(select 1 from public.pilot_passports where class_id=target_class and term_id=target_term and id=plan and not archived and week between first_week and last_week) then raise exception 'Debt passport access denied' using errcode='42501'; end if;
  elsif key ~ '^(newspaper|reflection):[0-9]{4}-[0-9]{2}-01$' then
   if not ('reading'=any(modules)) or split_part(key,':',2)::date>term.end_date or (split_part(key,':',2)::date+interval '1 month')::date<=term.start_date or extract(month from split_part(key,':',2)::date) in (7,8) then raise exception 'Debt reading access denied' using errcode='42501'; end if;
  else raise exception 'Invalid debt key' using errcode='23514'; end if;
 end loop;
 select version into current_version from public.pilot_debt_preferences where class_id=target_class and student_id=target_student and term_id=target_term;
 if coalesce(current_version,0)<>expected_version then raise exception 'Debt preference changed; reload' using errcode='40001'; end if;
 insert into public.pilot_debt_preferences(class_id,student_id,term_id,ordered_keys,show_more,version)
 values(target_class,target_student,target_term,priority_keys,display_more,coalesce(current_version,0)+1)
 on conflict(student_id,term_id) do update set ordered_keys=excluded.ordered_keys,show_more=excluded.show_more,version=excluded.version,updated_at=now();
end;$$;
revoke all on function public.save_pilot_debt_preference(uuid,uuid,uuid,text[],boolean,integer) from public,anon,authenticated;
grant execute on function public.save_pilot_debt_preference(uuid,uuid,uuid,text[],boolean,integer) to authenticated;
create or replace function public.get_pilot_display_debts(device_token text) returns jsonb
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
 'preferences',case when room.enabled_modules && array['homework','passport','reading'] then coalesce((select jsonb_agg(jsonb_build_object('student_id',student_id,'term_id',term_id,'ordered_keys',ordered_keys,'show_more',show_more,'version',version)) from public.pilot_debt_preferences where class_id=classroom and term_id=term.id),'[]'::jsonb) else '[]'::jsonb end,
 'students',case when room.enabled_modules && array['homework','passport','reading'] then coalesce((select jsonb_agg(jsonb_build_object('id',id,'seat',seat,'name',name) order by seat) from public.pilot_students where class_id=classroom and deleted_at is null),'[]'::jsonb) else '[]'::jsonb end);
end;$$;
commit;
