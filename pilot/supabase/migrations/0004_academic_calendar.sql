-- Independent pilot only. Dates never change the legacy site's calendar.
begin;
create table public.pilot_terms (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.pilot_classes(id),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  start_date date not null check (start_date between date '2000-01-01' and date '2100-12-31'),
  end_date date not null check (end_date between date '2000-01-01' and date '2100-12-31'),
  active boolean not null default false,
  check (end_date >= start_date and end_date - start_date <= 366),
  unique (class_id,id)
);
create unique index pilot_one_active_term on public.pilot_terms(class_id) where active;
create table public.pilot_day_overrides (
  term_id uuid not null references public.pilot_terms(id),
  day date not null,
  is_school_day boolean not null,
  note text not null default '' check (char_length(note) <= 120),
  primary key (term_id,day)
);
alter table public.pilot_terms enable row level security;
alter table public.pilot_day_overrides enable row level security;
revoke all on public.pilot_terms, public.pilot_day_overrides from public,anon,authenticated;
grant select on public.pilot_terms, public.pilot_day_overrides to authenticated;
create policy term_owner on public.pilot_terms for select to authenticated using (
  exists (select 1 from public.pilot_classes c where c.id=class_id)
);
create policy override_owner on public.pilot_day_overrides for select to authenticated using (
  exists (select 1 from public.pilot_terms t where t.id=term_id)
);
create function public.create_pilot_term(target_class uuid, term_name text, first_day date, last_day date) returns uuid
language plpgsql security definer set search_path='' as $$
declare teacher uuid := pilot_private.require_teacher(); result uuid;
begin
  perform 1 from public.pilot_classes where id=target_class and owner_id=teacher and deleted_at is null for update;
  if not found then raise exception 'Class access denied' using errcode='42501'; end if;
  if (select count(*) from public.pilot_terms where class_id=target_class) >= 30
    then raise exception 'Term limit reached' using errcode='23514'; end if;
  insert into public.pilot_terms(class_id,name,start_date,end_date,active)
    values(target_class,btrim(term_name),first_day,last_day,
      not exists (select 1 from public.pilot_terms where class_id=target_class)) returning id into result;
  return result;
end;
$$;
create function pilot_private.lock_term_class(target_term uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare teacher uuid := pilot_private.require_teacher(); result uuid;
begin
  select c.id into result from public.pilot_terms t join public.pilot_classes c on c.id=t.class_id
    where t.id=target_term and c.owner_id=teacher and c.deleted_at is null for update of c;
  if not found then raise exception 'Term access denied' using errcode='42501'; end if;
  return result;
end;
$$;
create function public.update_pilot_term(target_term uuid, term_name text, first_day date, last_day date) returns void
language plpgsql security definer set search_path='' as $$
declare classroom uuid := pilot_private.lock_term_class(target_term);
begin
  if exists (select 1 from public.pilot_day_overrides where term_id=target_term and (day<first_day or day>last_day))
    then raise exception 'Existing overrides outside term' using errcode='23514'; end if;
  update public.pilot_terms set name=btrim(term_name),start_date=first_day,end_date=last_day where id=target_term and class_id=classroom;
end;
$$;
create function public.activate_pilot_term(target_term uuid) returns void
language plpgsql security definer set search_path='' as $$
declare classroom uuid := pilot_private.lock_term_class(target_term);
begin
  update public.pilot_terms set active=false where class_id=classroom and active;
  update public.pilot_terms set active=true where id=target_term and class_id=classroom;
end;
$$;
create function public.set_pilot_day(target_term uuid, target_day date, school boolean, day_note text) returns void
language plpgsql security definer set search_path='' as $$
declare classroom uuid := pilot_private.lock_term_class(target_term);
begin
  if target_day is null or not exists (select 1 from public.pilot_terms where id=target_term and target_day between start_date and end_date)
    then raise exception 'Day outside term' using errcode='23514'; end if;
  if school is null then
    delete from public.pilot_day_overrides where term_id=target_term and day=target_day;
  else
    insert into public.pilot_day_overrides(term_id,day,is_school_day,note) values(target_term,target_day,school,btrim(day_note))
      on conflict(term_id,day) do update set is_school_day=excluded.is_school_day,note=excluded.note;
  end if;
end;
$$;
revoke all on function pilot_private.lock_term_class(uuid) from public,anon,authenticated;
revoke all on function public.create_pilot_term(uuid,text,date,date),public.update_pilot_term(uuid,text,date,date),public.activate_pilot_term(uuid),public.set_pilot_day(uuid,date,boolean,text) from public,anon,authenticated;
grant execute on function public.create_pilot_term(uuid,text,date,date),public.update_pilot_term(uuid,text,date,date),public.activate_pilot_term(uuid),public.set_pilot_day(uuid,date,boolean,text) to authenticated;
commit;
