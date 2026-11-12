-- ONLY for the independent pilot project yqogdgvkeghyuibydqhw.
-- Replaces the invitation draft, which was never executed.
begin;
create schema pilot_private;
revoke all on schema pilot_private from public, anon, authenticated;

create table public.pilot_teachers (
  id uuid primary key references auth.users(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.pilot_classes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.pilot_teachers(id),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index pilot_one_active_class on public.pilot_classes(owner_id) where deleted_at is null;
create table public.pilot_students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.pilot_classes(id),
  seat integer not null check (seat between 1 and 99),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index pilot_student_seat on public.pilot_students(class_id, seat) where deleted_at is null;

alter table public.pilot_teachers enable row level security;
alter table public.pilot_classes enable row level security;
alter table public.pilot_students enable row level security;
revoke all on public.pilot_teachers, public.pilot_classes, public.pilot_students from public, anon, authenticated;
grant select on public.pilot_teachers, public.pilot_classes, public.pilot_students to authenticated;
create policy teacher_self on public.pilot_teachers for select to authenticated using (
  id = (select auth.uid()) and (select auth.jwt())->'app_metadata'->>'provider' = 'google'
);
create policy class_owner on public.pilot_classes for select to authenticated using (
  owner_id = (select auth.uid()) and (select auth.jwt())->'app_metadata'->>'provider' = 'google'
  and deleted_at is null and exists (
    select 1 from public.pilot_teachers t where t.id = (select auth.uid()) and t.active
  )
);
create policy student_owner on public.pilot_students for select to authenticated using (
  deleted_at is null and exists (select 1 from public.pilot_classes c where c.id = class_id)
);

create function public.register_pilot_teacher() returns boolean
language plpgsql security definer set search_path = '' as $$
declare user_id uuid := auth.uid();
begin
  if user_id is null or auth.jwt()->'app_metadata'->>'provider' is distinct from 'google' then return false; end if;
  if not exists (select 1 from auth.users u where u.id = user_id and u.email_confirmed_at is not null
    and exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'google')) then return false; end if;
  insert into public.pilot_teachers(id) values(user_id) on conflict(id) do nothing;
  return (select active from public.pilot_teachers where id = user_id);
end;
$$;

create function pilot_private.require_teacher() returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or auth.jwt()->'app_metadata'->>'provider' is distinct from 'google'
    or not exists (select 1 from public.pilot_teachers where id = auth.uid() and active)
    then raise exception 'Teacher access denied' using errcode = '42501'; end if;
  return auth.uid();
end;
$$;

create function public.create_pilot_class(class_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare owner uuid := pilot_private.require_teacher(); result uuid;
begin
  -- Serialize simultaneous submissions by the same teacher; unique index is the final guard.
  perform pg_advisory_xact_lock(hashtextextended(owner::text, 0));
  insert into public.pilot_classes(owner_id, name) values(owner, btrim(class_name)) returning id into result;
  return result;
end;
$$;

create function public.add_pilot_student(target_class uuid, student_seat integer, student_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare teacher uuid := pilot_private.require_teacher(); result uuid;
begin
  perform 1 from public.pilot_classes where id = target_class and owner_id = teacher and deleted_at is null for update;
  if not found then raise exception 'Class access denied' using errcode = '42501'; end if;
  -- The class row lock prevents two concurrent inserts from exceeding the cap.
  if (select count(*) from public.pilot_students where class_id = target_class and deleted_at is null) >= 15
    then raise exception 'Student limit reached' using errcode = '23514'; end if;
  insert into public.pilot_students(class_id, seat, name) values(target_class, student_seat, btrim(student_name)) returning id into result;
  return result;
end;
$$;
revoke all on function pilot_private.require_teacher() from public, anon, authenticated;
revoke all on function public.register_pilot_teacher(), public.create_pilot_class(text), public.add_pilot_student(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.register_pilot_teacher(), public.create_pilot_class(text), public.add_pilot_student(uuid, integer, text) to authenticated;
commit;
