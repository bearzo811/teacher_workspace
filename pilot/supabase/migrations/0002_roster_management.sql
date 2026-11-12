-- New pilot only. Existing rows are preserved; student removal is recoverable.
begin;
-- Owners may inspect their archived roster for recovery, never another class.
drop policy student_owner on public.pilot_students;
create policy student_owner on public.pilot_students for select to authenticated using (
  exists (select 1 from public.pilot_classes c where c.id = class_id)
);

create function public.rename_pilot_class(target_class uuid, class_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare teacher uuid := pilot_private.require_teacher();
begin
  update public.pilot_classes set name = btrim(class_name)
    where id = target_class and owner_id = teacher and deleted_at is null;
  if not found then raise exception 'Class access denied' using errcode='42501'; end if;
end;
$$;

create function pilot_private.lock_student_class(target_student uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare teacher uuid := pilot_private.require_teacher(); result uuid;
begin
  select c.id into result from public.pilot_students s join public.pilot_classes c on c.id=s.class_id
    where s.id=target_student and c.owner_id=teacher and c.deleted_at is null for update of c;
  if not found then raise exception 'Student access denied' using errcode='42501'; end if;
  return result;
end;
$$;

create function public.update_pilot_student(target_student uuid, student_seat integer, student_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare classroom uuid := pilot_private.lock_student_class(target_student);
begin
  update public.pilot_students set seat=student_seat, name=btrim(student_name)
    where id=target_student and class_id=classroom and deleted_at is null;
  if not found then raise exception 'Student not active' using errcode='42501'; end if;
end;
$$;

create function public.archive_pilot_student(target_student uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare classroom uuid := pilot_private.lock_student_class(target_student);
begin
  update public.pilot_students set deleted_at=now()
    where id=target_student and class_id=classroom and deleted_at is null;
end;
$$;

create function public.restore_pilot_student(target_student uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare classroom uuid := pilot_private.lock_student_class(target_student);
begin
  if exists (select 1 from public.pilot_students where id=target_student and deleted_at is null) then return; end if;
  if (select count(*) from public.pilot_students where class_id=classroom and deleted_at is null) >= 15
    then raise exception 'Student limit reached' using errcode='23514'; end if;
  update public.pilot_students set deleted_at=null where id=target_student and class_id=classroom;
  -- The existing active-seat unique index prevents restoring into an occupied seat.
end;
$$;
revoke all on function pilot_private.lock_student_class(uuid) from public, anon, authenticated;
revoke all on function public.rename_pilot_class(uuid,text), public.update_pilot_student(uuid,integer,text), public.archive_pilot_student(uuid), public.restore_pilot_student(uuid) from public, anon, authenticated;
grant execute on function public.rename_pilot_class(uuid,text), public.update_pilot_student(uuid,integer,text), public.archive_pilot_student(uuid), public.restore_pilot_student(uuid) to authenticated;
commit;
