begin;
create table public.pilot_passports (
 id uuid primary key default gen_random_uuid(),
 class_id uuid not null references public.pilot_classes(id),
 term_id uuid not null,
 name text not null check(char_length(btrim(name)) between 1 and 60),
 first_week integer not null check(first_week between 1 and 25),
 last_week integer not null check(last_week between first_week and 25),
 archived boolean not null default false,
 unique(class_id,id),
 foreign key(class_id,term_id) references public.pilot_terms(class_id,id)
);
create unique index pilot_passport_name on public.pilot_passports(class_id,term_id,lower(btrim(name))) where not archived;
create table public.pilot_passport_checks (
 class_id uuid not null references public.pilot_classes(id),
 passport_id uuid not null,
 student_id uuid not null,
 week integer not null check(week between 1 and 25),
 completed boolean not null,
 completed_at timestamptz,
 updated_at timestamptz not null default now(),
 primary key(passport_id,student_id,week),
 foreign key(class_id,passport_id) references public.pilot_passports(class_id,id),
 foreign key(class_id,student_id) references public.pilot_students(class_id,id),
 check(completed=(completed_at is not null))
);
alter table public.pilot_passports enable row level security;
alter table public.pilot_passport_checks enable row level security;
revoke all on public.pilot_passports,public.pilot_passport_checks from public,anon,authenticated;
grant select on public.pilot_passports,public.pilot_passport_checks to authenticated;
create policy passport_owner on public.pilot_passports for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id and 'passport'=any(c.enabled_modules)));
create policy passport_check_owner on public.pilot_passport_checks for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id and 'passport'=any(c.enabled_modules)));
create function pilot_private.lock_passport_term(target_class uuid,target_term uuid) returns void
language plpgsql security definer set search_path='' as $$
declare teacher uuid:=pilot_private.require_teacher();
begin
 perform 1 from public.pilot_classes where id=target_class and owner_id=teacher and deleted_at is null and 'passport'=any(enabled_modules) for update;
 if not found or not exists(select 1 from public.pilot_terms where id=target_term and class_id=target_class and active)
 then raise exception 'Passport access denied' using errcode='42501'; end if;
end;
$$;
create function public.create_pilot_passport(target_class uuid,target_term uuid,passport_name text,start_week integer,end_week integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid; max_week integer;
begin
 perform pilot_private.lock_passport_term(target_class,target_term);
 select ((end_date-start_date+(extract(isodow from start_date)::integer-1))/7)+1 into max_week from public.pilot_terms where id=target_term;
 if end_week>max_week then raise exception 'Week outside term' using errcode='23514'; end if;
 if(select count(*) from public.pilot_passports where class_id=target_class and term_id=target_term)>=20 then raise exception 'Passport limit reached' using errcode='23514'; end if;
 insert into public.pilot_passports(class_id,term_id,name,first_week,last_week) values(target_class,target_term,btrim(passport_name),start_week,end_week) returning id into result;
 return result;
end;
$$;
create function public.archive_pilot_passport(target_class uuid,target_passport uuid,stop_using boolean) returns void
language plpgsql security definer set search_path='' as $$
declare term uuid;
begin
 select term_id into term from public.pilot_passports where id=target_passport and class_id=target_class;
 perform pilot_private.lock_passport_term(target_class,term);
 if stop_using is null then raise exception 'Archive state required' using errcode='23514'; end if;
 update public.pilot_passports set archived=stop_using where id=target_passport and class_id=target_class;
end;
$$;
create function public.set_pilot_passport_check(target_class uuid,target_passport uuid,target_student uuid,target_week integer,is_completed boolean) returns void
language plpgsql security definer set search_path='' as $$
declare term uuid;
begin
 select term_id into term from public.pilot_passports where id=target_passport and class_id=target_class;
 perform pilot_private.lock_passport_term(target_class,term);
 if target_week is null or is_completed is null or not exists(select 1 from public.pilot_passports where id=target_passport and class_id=target_class and not archived and target_week between first_week and last_week)
  or not exists(select 1 from public.pilot_students where id=target_student and class_id=target_class and deleted_at is null)
 then raise exception 'Passport check access denied' using errcode='42501'; end if;
 insert into public.pilot_passport_checks(class_id,passport_id,student_id,week,completed,completed_at)
 values(target_class,target_passport,target_student,target_week,is_completed,case when is_completed then now() else null end)
 on conflict(passport_id,student_id,week) do update set completed=excluded.completed,completed_at=case when excluded.completed then coalesce(pilot_passport_checks.completed_at,excluded.completed_at) else null end,updated_at=now();
end;
$$;
revoke all on function pilot_private.lock_passport_term(uuid,uuid) from public,anon,authenticated;
revoke all on function public.create_pilot_passport(uuid,uuid,text,integer,integer),public.archive_pilot_passport(uuid,uuid,boolean),public.set_pilot_passport_check(uuid,uuid,uuid,integer,boolean) from public,anon,authenticated;
grant execute on function public.create_pilot_passport(uuid,uuid,text,integer,integer),public.archive_pilot_passport(uuid,uuid,boolean),public.set_pilot_passport_check(uuid,uuid,uuid,integer,boolean) to authenticated;
commit;
