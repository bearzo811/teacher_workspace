-- Teacher-owned business export. No auth/session/device credentials and no restore capability.
begin;
create table public.pilot_class_exports(
 id uuid primary key,class_id uuid not null references public.pilot_classes(id),actor_id uuid not null references public.pilot_teachers(id),
 sha256 text not null check(sha256~'^[a-f0-9]{64}$'),bytes integer not null check(bytes between 1 and 3145728),
 counts jsonb not null,created_at timestamptz not null default now()
);
create index pilot_class_exports_recent on public.pilot_class_exports(class_id,created_at desc,id);
alter table public.pilot_class_exports enable row level security;
revoke all on public.pilot_class_exports from public,anon,authenticated;
grant select on public.pilot_class_exports to authenticated;
create policy class_export_owner on public.pilot_class_exports for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id));
create function public.export_pilot_class(target_class uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare teacher uuid:=pilot_private.require_teacher();table_name text;parts text[]:=array[]::text[];snapshot jsonb;payload text;digest text;counts jsonb;export_id uuid:=gen_random_uuid();byte_count integer;
 -- Explicit allowlist. Adding a table requires reviewing its fields and restore implications.
 tables text[]:=array[
 'pilot_students','pilot_terms','pilot_day_overrides','pilot_calendar_events','pilot_workbooks','pilot_contact_days','pilot_assignments','pilot_homework_checks',
 'pilot_attendance','pilot_routine_checks','pilot_passports','pilot_passport_checks','pilot_reading_checks','pilot_return_days','pilot_return_checks',
 'pilot_reward_balances','pilot_reward_ledger','pilot_reward_rules','pilot_reward_rule_history','pilot_routine_reward_settings','pilot_routine_reward_effects','pilot_routine_reward_entries',
 'pilot_reading_reward_settings','pilot_reading_reward_effects','pilot_reading_reward_entries','pilot_passport_reward_settings','pilot_passport_reward_effects','pilot_passport_reward_entries',
 'pilot_homework_reward_settings','pilot_homework_reward_effects','pilot_homework_reward_entries','pilot_passport_check_history','pilot_passport_overdue_settings','pilot_passport_overdue_runs','pilot_passport_overdue_entries',
 'pilot_shop_items','pilot_student_rewards','pilot_reward_history','pilot_shop_settings','pilot_shop_setting_history','pilot_purchase_receipts',
 'pilot_display_submissions','pilot_display_routine_receipts','pilot_display_learning_receipts','pilot_debt_preferences','pilot_display_settings','pilot_duty_plans','pilot_duty_assignments',
 'pilot_duty_covers','pilot_duty_cover_jobs','pilot_duty_cover_events','pilot_lunch_media','pilot_lunch_media_events'];
begin
 perform 1 from public.pilot_classes where id=target_class and owner_id=teacher and deleted_at is null for update;
 if not found then raise exception 'Class export access denied' using errcode='42501'; end if;
 if exists(select 1 from public.pilot_class_exports where class_id=target_class and created_at>now()-interval '30 seconds') then raise exception 'Wait 30 seconds before another export' using errcode='23514'; end if;
 foreach table_name in array tables loop
  parts:=array_append(parts,format('select %L as name,coalesce((select jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text) from public.%I t where %s),''[]''::jsonb) as data',table_name,table_name,case when table_name='pilot_day_overrides' then 't.term_id in (select id from public.pilot_terms where class_id=$1)' else 't.class_id=$1' end));
 end loop;
 -- All business rows are read by one SQL statement, hence one MVCC snapshot.
 execute 'select jsonb_build_object(''format'',''teacher-pilot-class-export/1'',''schema_revision'',41,''export_id'',$2,''generated_at'',now(),''class'',(select to_jsonb(c)-''owner_id'' from public.pilot_classes c where c.id=$1),''tables'',(select jsonb_object_agg(name,data) from ('||array_to_string(parts,' union all ')||') rows),''excluded'',jsonb_build_array(''teacher identities'',''auth and session data'',''display device credentials'',''private worker configuration'',''export metadata''))' into snapshot using target_class,export_id;
 payload:=snapshot::text;byte_count:=octet_length(payload);
 if byte_count>3145728 then raise exception 'Class export exceeds 3 MB; no truncated export created' using errcode='23514'; end if;
 select jsonb_object_agg(key,jsonb_array_length(value)) into counts from jsonb_each(snapshot->'tables');
 if (select sum(value::integer) from jsonb_each_text(counts))>50000 then raise exception 'Class export row limit exceeded' using errcode='23514'; end if;
 digest:=encode(sha256(convert_to(payload,'UTF8')),'hex');
 insert into public.pilot_class_exports(id,class_id,actor_id,sha256,bytes,counts) values(export_id,target_class,teacher,digest,byte_count,counts);
 return jsonb_build_object('id',export_id,'payload',payload,'sha256',digest,'bytes',byte_count,'counts',counts);
end;$$;
revoke all on function public.export_pilot_class(uuid) from public,anon,authenticated;
grant execute on function public.export_pilot_class(uuid) to authenticated;
commit;
