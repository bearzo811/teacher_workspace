-- Pairing foundation only; no student data or student mutations exposed yet.
begin;
create table public.pilot_display_devices(
 id uuid primary key default gen_random_uuid(),class_id uuid not null references public.pilot_classes(id),
 name text not null check(char_length(btrim(name)) between 1 and 60),
 code_hash text unique,code_expires_at timestamptz not null,
 token_hash text unique,paired_at timestamptz,expires_at timestamptz,revoked_at timestamptz,
 created_at timestamptz not null default now(),created_by uuid not null references public.pilot_teachers(id),
 check((token_hash is null)=(paired_at is null)),check((paired_at is null)=(expires_at is null))
);
create index pilot_display_class on public.pilot_display_devices(class_id,created_at desc);
alter table public.pilot_display_devices enable row level security;
revoke all on public.pilot_display_devices from public,anon,authenticated;
grant select(id,class_id,name,code_expires_at,paired_at,expires_at,revoked_at,created_at,created_by) on public.pilot_display_devices to authenticated;
create policy display_owner on public.pilot_display_devices for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id));
create function public.create_pilot_display_pairing(target_class uuid,device_name text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare teacher uuid:=pilot_private.require_teacher(); code text; result uuid;
begin
 perform 1 from public.pilot_classes where id=target_class and owner_id=teacher and deleted_at is null for update;
 if not found then raise exception 'Display class access denied' using errcode='42501'; end if;
 if device_name is null or char_length(btrim(device_name)) not between 1 and 60 then raise exception 'Device name required' using errcode='23514'; end if;
 if (select count(*) from public.pilot_display_devices where class_id=target_class)>=200 then raise exception 'Device history limit reached' using errcode='23514'; end if;
 if (select count(*) from public.pilot_display_devices where class_id=target_class and revoked_at is null and (expires_at>now() or (token_hash is null and code_expires_at>now())))>=5 then raise exception 'Active device limit reached' using errcode='23514'; end if;
 code:=replace(gen_random_uuid()::text,'-','');
 insert into public.pilot_display_devices(class_id,name,code_hash,code_expires_at,created_by)
 values(target_class,btrim(device_name),encode(sha256(convert_to(code,'UTF8')),'hex'),now()+interval '10 minutes',teacher) returning id into result;
 return jsonb_build_object('device_id',result,'code',code,'expires_at',now()+interval '10 minutes');
end;$$;
create function public.revoke_pilot_display(target_class uuid,target_device uuid) returns void
language plpgsql security definer set search_path='' as $$
declare teacher uuid:=pilot_private.require_teacher();
begin
 perform 1 from public.pilot_classes where id=target_class and owner_id=teacher and deleted_at is null for update;
 if not found then raise exception 'Display class access denied' using errcode='42501'; end if;
 update public.pilot_display_devices set revoked_at=coalesce(revoked_at,now()),code_hash=null where id=target_device and class_id=target_class;
 if not found then raise exception 'Display device access denied' using errcode='42501'; end if;
end;$$;
create function public.pair_pilot_display(pairing_code text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare candidate public.pilot_display_devices%rowtype; token text;
begin
 if pairing_code is null or pairing_code !~ '^[a-f0-9]{32}$' then raise exception 'Invalid pairing code' using errcode='42501'; end if;
 select * into candidate from public.pilot_display_devices where code_hash=encode(sha256(convert_to(pairing_code,'UTF8')),'hex');
 if not found then raise exception 'Invalid pairing code' using errcode='42501'; end if;
 -- Lock in the same class -> device order as teacher revocation.
 perform 1 from public.pilot_classes c join public.pilot_teachers t on t.id=c.owner_id where c.id=candidate.class_id and c.deleted_at is null and t.active for update of c;
 if not found then raise exception 'Invalid pairing code' using errcode='42501'; end if;
 select * into candidate from public.pilot_display_devices where id=candidate.id for update;
 if candidate.code_hash is null or candidate.code_expires_at<=now() or candidate.revoked_at is not null or candidate.token_hash is not null then raise exception 'Invalid pairing code' using errcode='42501'; end if;
 token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
 update public.pilot_display_devices set code_hash=null,token_hash=encode(sha256(convert_to(token,'UTF8')),'hex'),paired_at=now(),expires_at=now()+interval '90 days' where id=candidate.id;
 return jsonb_build_object('token',token,'expires_at',now()+interval '90 days');
end;$$;
create function pilot_private.require_display(device_token text) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 if device_token is null or device_token !~ '^[a-f0-9]{64}$' then raise exception 'Display access denied' using errcode='42501'; end if;
 select d.class_id into result from public.pilot_display_devices d join public.pilot_classes c on c.id=d.class_id join public.pilot_teachers t on t.id=c.owner_id
 where d.token_hash=encode(sha256(convert_to(device_token,'UTF8')),'hex') and d.revoked_at is null and d.expires_at>now() and c.deleted_at is null and t.active;
 if not found then raise exception 'Display access denied' using errcode='42501'; end if;
 return result;
end;$$;
create function public.get_pilot_display_context(device_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare classroom uuid:=pilot_private.require_display(device_token);
begin
 return (select jsonb_build_object('class_name',name) from public.pilot_classes where id=classroom);
end;$$;
revoke all on function pilot_private.require_display(text) from public,anon,authenticated;
revoke all on function public.create_pilot_display_pairing(uuid,text),public.revoke_pilot_display(uuid,uuid),public.pair_pilot_display(text),public.get_pilot_display_context(text) from public,anon,authenticated;
grant execute on function public.create_pilot_display_pairing(uuid,text),public.revoke_pilot_display(uuid,uuid) to authenticated;
grant execute on function public.pair_pilot_display(text),public.get_pilot_display_context(text) to anon,authenticated;
commit;
