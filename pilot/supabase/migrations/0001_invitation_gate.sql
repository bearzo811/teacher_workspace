-- ONLY for Supabase project yqogdgvkeghyuibydqhw. No legacy tables are migrated.
begin;
create schema pilot_private;
revoke all on schema pilot_private from public, anon, authenticated;

create table pilot_private.invitations (
  email text primary key check (email = lower(btrim(email)) and position('@' in email) > 1),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  accepted_user_id uuid unique references auth.users(id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  check ((accepted_user_id is null) = (accepted_at is null))
);
alter table pilot_private.invitations enable row level security;
revoke all on pilot_private.invitations from public, anon, authenticated;

create function public.accept_pilot_invitation() returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  user_id uuid := auth.uid();
  user_email text;
  invitation pilot_private.invitations%rowtype;
begin
  if user_id is null or auth.jwt()->'app_metadata'->>'provider' is distinct from 'google' then
    return false;
  end if;
  -- Never accept an email supplied by the browser or user-editable metadata.
  select lower(u.email) into user_email from auth.users u
  where u.id = user_id and u.email_confirmed_at is not null
    and exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'google');
  if user_email is null then return false; end if;
  select * into invitation from pilot_private.invitations
    where email = user_email for update;
  if not found or invitation.revoked_at is not null then return false; end if;
  if invitation.accepted_user_id is not null then
    return invitation.accepted_user_id = user_id;
  end if;
  if invitation.expires_at <= now() then return false; end if;
  update pilot_private.invitations set accepted_user_id = user_id, accepted_at = now()
    where email = user_email;
  return true;
end;
$$;
revoke all on function public.accept_pilot_invitation() from public, anon, authenticated;
grant execute on function public.accept_pilot_invitation() to authenticated;
commit;
