-- Independent pilot only. Stop using a workbook without deleting its history.
begin;
create table public.pilot_workbooks (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.pilot_classes(id),
  subject text not null check(char_length(btrim(subject)) between 1 and 40),
  name text not null check(char_length(btrim(name)) between 1 and 40),
  archived boolean not null default false,
  unique(class_id,id)
);
create unique index pilot_active_workbook_name on public.pilot_workbooks(class_id,lower(btrim(subject)),lower(btrim(name))) where not archived;
alter table public.pilot_workbooks enable row level security;
revoke all on public.pilot_workbooks from public,anon,authenticated;
grant select on public.pilot_workbooks to authenticated;
create policy workbook_owner on public.pilot_workbooks for select to authenticated using (
  exists(select 1 from public.pilot_classes c where c.id=class_id and 'homework'=any(c.enabled_modules))
);
create function pilot_private.lock_homework_class(target_class uuid) returns void
language plpgsql security definer set search_path='' as $$
declare teacher uuid := pilot_private.require_teacher();
begin
  perform 1 from public.pilot_classes where id=target_class and owner_id=teacher and deleted_at is null
    and 'homework'=any(enabled_modules) for update;
  if not found then raise exception 'Homework class access denied' using errcode='42501'; end if;
end;
$$;
create function public.save_pilot_workbook(target_class uuid,target_workbook uuid,workbook_subject text,workbook_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
  perform pilot_private.lock_homework_class(target_class);
  if target_workbook is null then
    if (select count(*) from public.pilot_workbooks where class_id=target_class)>=100
      then raise exception 'Workbook limit reached' using errcode='23514'; end if;
    insert into public.pilot_workbooks(class_id,subject,name) values(target_class,btrim(workbook_subject),btrim(workbook_name)) returning id into result;
  else
    update public.pilot_workbooks set subject=btrim(workbook_subject),name=btrim(workbook_name)
      where id=target_workbook and class_id=target_class and not archived returning id into result;
    if not found then raise exception 'Workbook access denied' using errcode='42501'; end if;
  end if;
  return result;
end;
$$;
create function public.archive_pilot_workbook(target_class uuid,target_workbook uuid,stop_using boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform pilot_private.lock_homework_class(target_class);
  if stop_using is null then raise exception 'Archive state required' using errcode='23514'; end if;
  update public.pilot_workbooks set archived=stop_using where id=target_workbook and class_id=target_class;
  if not found then raise exception 'Workbook access denied' using errcode='42501'; end if;
end;
$$;
revoke all on function pilot_private.lock_homework_class(uuid) from public,anon,authenticated;
revoke all on function public.save_pilot_workbook(uuid,uuid,text,text),public.archive_pilot_workbook(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.save_pilot_workbook(uuid,uuid,text,text),public.archive_pilot_workbook(uuid,uuid,boolean) to authenticated;
commit;
