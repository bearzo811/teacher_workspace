-- Appearance only: changing visibility never grants/revokes an operation.
begin;
create table public.pilot_display_settings(
 class_id uuid primary key references public.pilot_classes(id),base_font integer not null default 22 check(base_font between 16 and 32),
 visible_sections text[] not null default array['contact','learning','lunch','students','debts','calendar'],
 version integer not null default 1 check(version>0),updated_at timestamptz not null default now(),
 check(visible_sections<@array['contact','learning','lunch','students','debts','calendar']::text[] and cardinality(visible_sections)<=6)
);
alter table public.pilot_display_settings enable row level security;
revoke all on public.pilot_display_settings from public,anon,authenticated;
grant select on public.pilot_display_settings to authenticated;
create policy display_settings_owner on public.pilot_display_settings for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id));
create function public.save_pilot_display_settings(target_class uuid,font_size integer,sections text[],expected_version integer) returns void
language plpgsql security definer set search_path='' as $$
declare teacher uuid:=pilot_private.require_teacher(); current_version integer;
begin
 perform 1 from public.pilot_classes where id=target_class and owner_id=teacher and deleted_at is null for update;
 if not found then raise exception 'Display settings access denied' using errcode='42501'; end if;
 if font_size is null or font_size not between 16 and 32 or sections is null or array_ndims(sections)>1 or cardinality(sections)>6 or not(sections<@array['contact','learning','lunch','students','debts','calendar']::text[]) or cardinality(sections)<>(select count(distinct x) from unnest(sections) x) or expected_version is null then raise exception 'Invalid display settings' using errcode='23514'; end if;
 select version into current_version from public.pilot_display_settings where class_id=target_class;
 if coalesce(current_version,0)<>expected_version then raise exception 'Display settings changed; reload' using errcode='40001'; end if;
 insert into public.pilot_display_settings(class_id,base_font,visible_sections,version) values(target_class,font_size,sections,coalesce(current_version,0)+1)
 on conflict(class_id) do update set base_font=excluded.base_font,visible_sections=excluded.visible_sections,version=excluded.version,updated_at=now();
end;$$;
create function public.get_pilot_display_settings(device_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare classroom uuid:=pilot_private.require_display(device_token); settings public.pilot_display_settings%rowtype;
begin
 select * into settings from public.pilot_display_settings where class_id=classroom;
 return jsonb_build_object('base_font',coalesce(settings.base_font,22),'visible_sections',coalesce(settings.visible_sections,array['contact','learning','lunch','students','debts','calendar']::text[]),'version',coalesce(settings.version,0));
end;$$;
revoke all on function public.save_pilot_display_settings(uuid,integer,text[],integer),public.get_pilot_display_settings(text) from public,anon,authenticated;
grant execute on function public.save_pilot_display_settings(uuid,integer,text[],integer) to authenticated;
grant execute on function public.get_pilot_display_settings(text) to anon,authenticated;
commit;
