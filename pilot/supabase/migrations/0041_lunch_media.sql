-- One current video per class; paired devices may only clear the version they played.
begin;
create table public.pilot_lunch_media(
 class_id uuid primary key references public.pilot_classes(id),video_id text check(video_id is null or video_id~'^[A-Za-z0-9_-]{11}$'),
 title text not null default '' check(char_length(title)<=120),version integer not null check(version>0),updated_at timestamptz not null default now()
);
create table public.pilot_lunch_media_events(
 id uuid primary key default gen_random_uuid(),class_id uuid not null references public.pilot_classes(id),version integer not null,
 video_id text,title text not null,action text not null check(action in ('set','stop','ended')),request_id uuid,
 actor_id uuid references public.pilot_teachers(id),device_id uuid,created_at timestamptz not null default now(),
 unique(class_id,version),unique(class_id,request_id),foreign key(class_id,device_id) references public.pilot_display_devices(class_id,id),
 check((actor_id is not null and device_id is null and action in ('set','stop') and request_id is not null) or (actor_id is null and device_id is not null and action='ended' and request_id is null))
);
alter table public.pilot_lunch_media enable row level security;
alter table public.pilot_lunch_media_events enable row level security;
revoke all on public.pilot_lunch_media,public.pilot_lunch_media_events from public,anon,authenticated;
grant select on public.pilot_lunch_media,public.pilot_lunch_media_events to authenticated;
create policy lunch_media_owner on public.pilot_lunch_media for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id));
create policy lunch_media_event_owner on public.pilot_lunch_media_events for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id));
create function public.set_pilot_lunch_media(target_class uuid,target_video text,target_title text,expected_version integer,request_key uuid) returns integer
language plpgsql security definer set search_path='' as $$
declare teacher uuid:=pilot_private.require_teacher();room public.pilot_classes%rowtype;prior public.pilot_lunch_media_events%rowtype;current_version integer;next_version integer;
begin
 select * into room from public.pilot_classes where id=target_class and owner_id=teacher and deleted_at is null for update;
 if not found then raise exception 'Lunch media access denied' using errcode='42501'; end if;
 if request_key is null or target_title is null or char_length(target_title)>120 or expected_version is null or expected_version<0 or (target_video is not null and target_video!~'^[A-Za-z0-9_-]{11}$') or (target_video is null and target_title<>'') then raise exception 'Invalid lunch media' using errcode='23514'; end if;
 select * into prior from public.pilot_lunch_media_events where class_id=target_class and request_id=request_key;
 if found then
  if prior.video_id is distinct from target_video or prior.title<>target_title or prior.version<>expected_version+1 then raise exception 'Media request conflict' using errcode='23514'; end if;
  return prior.version;
 end if;
 if target_video is not null and not(room.enabled_modules && array['duty','routines']) then raise exception 'Lunch module required' using errcode='23514'; end if;
 select version into current_version from public.pilot_lunch_media where class_id=target_class;
 if coalesce(current_version,0)<>expected_version then raise exception 'Media changed; reload' using errcode='40001'; end if;
 next_version:=expected_version+1;
 insert into public.pilot_lunch_media(class_id,video_id,title,version) values(target_class,target_video,target_title,next_version)
 on conflict(class_id) do update set video_id=excluded.video_id,title=excluded.title,version=excluded.version,updated_at=now();
 insert into public.pilot_lunch_media_events(class_id,version,video_id,title,action,request_id,actor_id) values(target_class,next_version,target_video,target_title,case when target_video is null then 'stop' else 'set' end,request_key,teacher);
 return next_version;
end;$$;
create function public.get_pilot_display_media(device_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare classroom uuid:=pilot_private.require_display(device_token);result jsonb;
begin
 select jsonb_build_object('video_id',video_id,'title',title,'version',version) into result from public.pilot_lunch_media where class_id=classroom;
 if not exists(select 1 from public.pilot_classes where id=classroom and enabled_modules && array['duty','routines']) then
  return jsonb_build_object('video_id',null,'title','','version',coalesce((result->>'version')::integer,0));
 end if;
 return coalesce(result,jsonb_build_object('video_id',null,'title','','version',0));
end;$$;
create function public.finish_pilot_display_media(device_token text,expected_version integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare classroom uuid:=pilot_private.require_display(device_token);current_media public.pilot_lunch_media%rowtype;device uuid;
begin
 perform 1 from public.pilot_classes where id=classroom and deleted_at is null for update;
 perform pilot_private.require_display(device_token);
 select * into current_media from public.pilot_lunch_media where class_id=classroom for update;
 if not found or current_media.video_id is null or expected_version is null or current_media.version<>expected_version then return false; end if;
 select id into device from public.pilot_display_devices where class_id=classroom and token_hash=encode(sha256(convert_to(device_token,'UTF8')),'hex');
 update public.pilot_lunch_media set video_id=null,title='',version=version+1,updated_at=now() where class_id=classroom;
 insert into public.pilot_lunch_media_events(class_id,version,video_id,title,action,device_id) values(classroom,current_media.version+1,null,'','ended',device);
 return true;
end;$$;
revoke all on function public.set_pilot_lunch_media(uuid,text,text,integer,uuid) from public,anon,authenticated;
revoke all on function public.get_pilot_display_media(text) from public,anon,authenticated;
revoke all on function public.finish_pilot_display_media(text,integer) from public,anon,authenticated;
grant execute on function public.set_pilot_lunch_media(uuid,text,text,integer,uuid) to authenticated;
grant execute on function public.get_pilot_display_media(text) to anon,authenticated;
grant execute on function public.finish_pilot_display_media(text,integer) to anon,authenticated;
commit;
