-- Independent pilot only. Homework status tracking is added in a later migration.
begin;
create table public.pilot_contact_days (
  class_id uuid not null references public.pilot_classes(id),
  term_id uuid not null,
  day date not null,
  notes text not null default '' check(char_length(notes)<=3000),
  primary key(class_id,term_id,day),
  foreign key(class_id,term_id) references public.pilot_terms(class_id,id)
);
create table public.pilot_assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.pilot_classes(id),
  term_id uuid not null,
  contact_day date not null,
  due_day date not null check(due_day>contact_day),
  workbook_id uuid not null,
  content text not null check(char_length(btrim(content)) between 1 and 200),
  blocks_break boolean not null default true,
  blocks_shop boolean not null default true,
  archived boolean not null default false,
  foreign key(class_id,term_id) references public.pilot_terms(class_id,id),
  foreign key(class_id,workbook_id) references public.pilot_workbooks(class_id,id),
  unique(class_id,id)
);
create index pilot_assignment_day on public.pilot_assignments(class_id,term_id,contact_day);
alter table public.pilot_contact_days enable row level security;
alter table public.pilot_assignments enable row level security;
revoke all on public.pilot_contact_days,public.pilot_assignments from public,anon,authenticated;
grant select on public.pilot_contact_days,public.pilot_assignments to authenticated;
create policy contact_owner on public.pilot_contact_days for select to authenticated using (
  exists(select 1 from public.pilot_classes c where c.id=class_id and 'homework'=any(c.enabled_modules))
);
create policy assignment_owner on public.pilot_assignments for select to authenticated using (
  exists(select 1 from public.pilot_classes c where c.id=class_id and 'homework'=any(c.enabled_modules))
);
create function pilot_private.is_school_day(target_term uuid,target_day date) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.pilot_terms t where t.id=target_term and target_day between t.start_date and t.end_date
   and coalesce((select d.is_school_day from public.pilot_day_overrides d where d.term_id=t.id and d.day=target_day),extract(isodow from target_day)<6));
$$;
create function pilot_private.contact_scope(target_class uuid,target_term uuid,target_day date) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform pilot_private.lock_homework_class(target_class);
 if not exists(select 1 from public.pilot_terms where id=target_term and class_id=target_class and active)
   or not pilot_private.is_school_day(target_term,target_day)
 then raise exception 'Active school day required' using errcode='23514'; end if;
end;
$$;
create function public.save_pilot_contact_notes(target_class uuid,target_term uuid,target_day date,contact_notes text) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform pilot_private.contact_scope(target_class,target_term,target_day);
 insert into public.pilot_contact_days(class_id,term_id,day,notes) values(target_class,target_term,target_day,btrim(contact_notes))
   on conflict(class_id,term_id,day) do update set notes=excluded.notes;
end;
$$;
create function public.save_pilot_assignment(target_class uuid,target_term uuid,target_day date,target_assignment uuid,target_workbook uuid,assignment_content text,restrict_break boolean,restrict_shop boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare next_day date; result uuid;
begin
 perform pilot_private.contact_scope(target_class,target_term,target_day);
 select min(d::date) into next_day from public.pilot_terms t,
   lateral generate_series((target_day+1)::timestamp,t.end_date::timestamp,interval '1 day') d
   where t.id=target_term and pilot_private.is_school_day(target_term,d::date);
 if next_day is null then raise exception 'No following school day in term' using errcode='23514'; end if;
 if not exists(select 1 from public.pilot_workbooks where id=target_workbook and class_id=target_class
   and (not archived or exists(select 1 from public.pilot_assignments where id=target_assignment and class_id=target_class and workbook_id=target_workbook)))
 then raise exception 'Workbook access denied' using errcode='42501'; end if;
 if target_assignment is null then
   if (select count(*) from public.pilot_assignments where class_id=target_class and term_id=target_term and contact_day=target_day)>=50
   then raise exception 'Daily assignment limit reached' using errcode='23514'; end if;
   insert into public.pilot_assignments(class_id,term_id,contact_day,due_day,workbook_id,content,blocks_break,blocks_shop)
     values(target_class,target_term,target_day,next_day,target_workbook,btrim(assignment_content),restrict_break,restrict_shop) returning id into result;
 else
   update public.pilot_assignments set workbook_id=target_workbook,content=btrim(assignment_content),due_day=next_day,blocks_break=restrict_break,blocks_shop=restrict_shop
     where id=target_assignment and class_id=target_class and term_id=target_term and contact_day=target_day and not archived returning id into result;
   if not found then raise exception 'Assignment access denied' using errcode='42501'; end if;
 end if;
 return result;
end;
$$;
create function public.archive_pilot_assignment(target_class uuid,target_assignment uuid,remove_assignment boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform pilot_private.lock_homework_class(target_class);
 if remove_assignment is null then raise exception 'Archive state required' using errcode='23514'; end if;
 update public.pilot_assignments set archived=remove_assignment where id=target_assignment and class_id=target_class;
 if not found then raise exception 'Assignment access denied' using errcode='42501'; end if;
end;
$$;
revoke all on function pilot_private.is_school_day(uuid,date),pilot_private.contact_scope(uuid,uuid,date) from public,anon,authenticated;
revoke all on function public.save_pilot_contact_notes(uuid,uuid,date,text),public.save_pilot_assignment(uuid,uuid,date,uuid,uuid,text,boolean,boolean),public.archive_pilot_assignment(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.save_pilot_contact_notes(uuid,uuid,date,text),public.save_pilot_assignment(uuid,uuid,date,uuid,uuid,text,boolean,boolean),public.archive_pilot_assignment(uuid,uuid,boolean) to authenticated;
commit;
