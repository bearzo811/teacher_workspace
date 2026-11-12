-- Independent pilot only. No existing data is deleted.
begin;
alter table public.pilot_classes add column enabled_modules text[] not null default '{}',
  add column modules_configured_at timestamptz;
alter table public.pilot_classes add constraint pilot_known_modules check (
  enabled_modules <@ array['homework','routines','duty','passport','reading','rewards']::text[]
  and array_position(enabled_modules,null) is null
);

create function public.configure_pilot_modules(target_class uuid, selected_modules text[]) returns void
language plpgsql security definer set search_path = '' as $$
declare teacher uuid := pilot_private.require_teacher();
begin
  if selected_modules is null then raise exception 'Modules required' using errcode='23514'; end if;
  update public.pilot_classes set enabled_modules=selected_modules, modules_configured_at=now()
    where id=target_class and owner_id=teacher and deleted_at is null;
  if not found then raise exception 'Class access denied' using errcode='42501'; end if;
end;
$$;

-- Atomic creation + selection: a failed selection must not leave a partial class.
create function public.create_pilot_class_with_modules(class_name text, selected_modules text[]) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
  result := public.create_pilot_class(class_name);
  perform public.configure_pilot_modules(result,selected_modules);
  return result;
end;
$$;
revoke all on function public.configure_pilot_modules(uuid,text[]), public.create_pilot_class_with_modules(text,text[]) from public, anon, authenticated;
grant execute on function public.configure_pilot_modules(uuid,text[]), public.create_pilot_class_with_modules(text,text[]) to authenticated;
commit;
