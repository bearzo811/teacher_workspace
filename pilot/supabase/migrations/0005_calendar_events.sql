-- New pilot only. Events belong to a class, not the currently selected month/term.
begin;
create table public.pilot_calendar_events (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.pilot_classes(id),
  title text not null check (char_length(btrim(title)) between 1 and 80),
  day date not null check (day between date '2000-01-01' and date '2100-12-31'),
  note text not null default '' check (char_length(note)<=500),
  countdown boolean not null default true,
  archived boolean not null default false
);
create index pilot_event_date on public.pilot_calendar_events(class_id,day,id);
alter table public.pilot_calendar_events enable row level security;
revoke all on public.pilot_calendar_events from public,anon,authenticated;
grant select on public.pilot_calendar_events to authenticated;
create policy calendar_event_owner on public.pilot_calendar_events for select to authenticated using (
  exists (select 1 from public.pilot_classes c where c.id=class_id)
);
create function public.save_pilot_event(target_class uuid, target_event uuid, event_title text, event_day date, event_note text, show_countdown boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare teacher uuid := pilot_private.require_teacher(); result uuid;
begin
  perform 1 from public.pilot_classes where id=target_class and owner_id=teacher and deleted_at is null for update;
  if not found then raise exception 'Class access denied' using errcode='42501'; end if;
  if target_event is null then
    if (select count(*) from public.pilot_calendar_events where class_id=target_class) >= 500
      then raise exception 'Event limit reached' using errcode='23514'; end if;
    insert into public.pilot_calendar_events(class_id,title,day,note,countdown)
      values(target_class,btrim(event_title),event_day,btrim(event_note),show_countdown) returning id into result;
  else
    update public.pilot_calendar_events set title=btrim(event_title),day=event_day,note=btrim(event_note),countdown=show_countdown
      where id=target_event and class_id=target_class and not archived returning id into result;
    if not found then raise exception 'Event access denied' using errcode='42501'; end if;
  end if;
  return result;
end;
$$;
create function public.archive_pilot_event(target_event uuid, remove_event boolean) returns void
language plpgsql security definer set search_path='' as $$
declare teacher uuid := pilot_private.require_teacher(); classroom uuid;
begin
  select c.id into classroom from public.pilot_calendar_events e join public.pilot_classes c on c.id=e.class_id
    where e.id=target_event and c.owner_id=teacher and c.deleted_at is null for update of c;
  if not found then raise exception 'Event access denied' using errcode='42501'; end if;
  if remove_event is null then raise exception 'Archive state required' using errcode='23514'; end if;
  update public.pilot_calendar_events set archived=remove_event where id=target_event and class_id=classroom;
end;
$$;
revoke all on function public.save_pilot_event(uuid,uuid,text,date,text,boolean),public.archive_pilot_event(uuid,boolean) from public,anon,authenticated;
grant execute on function public.save_pilot_event(uuid,uuid,text,date,text,boolean),public.archive_pilot_event(uuid,boolean) to authenticated;
commit;
