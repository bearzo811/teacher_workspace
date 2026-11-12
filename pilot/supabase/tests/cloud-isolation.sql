-- Only for the isolated pilot project and the two explicitly named synthetic fixtures.
-- Requires both fixtures to exist and B to have exactly one synthetic student.
-- This checks live PostgreSQL policies with transaction-local JWT claims, not a forged HTTP login.
-- All temporary student writes are rolled back. No grants, auth users or real records are changed.
begin;
do $$
declare a uuid; b uuid; teacher_a uuid; teacher_b uuid;
begin
  if (select count(*) from public.pilot_classes where name='開發驗收測試班（虛構）' and deleted_at is null) <> 1
    or (select count(*) from public.pilot_classes where name='隔離驗收 B 班（虛構）' and deleted_at is null) <> 1
    then raise exception 'Expected synthetic class fixtures not found uniquely'; end if;
  select id, owner_id into a, teacher_a from public.pilot_classes where name='開發驗收測試班（虛構）' and deleted_at is null;
  select id, owner_id into b, teacher_b from public.pilot_classes where name='隔離驗收 B 班（虛構）' and deleted_at is null;
  if (select count(*) from public.pilot_students where class_id=b and deleted_at is null) <> 1
    then raise exception 'B fixture must have exactly one synthetic student'; end if;
  if a=b or (select owner_id from public.pilot_classes where id=a)=teacher_b
    then raise exception 'Expected two separate class owners'; end if;
  perform set_config('pilot_test.class_a',a::text,true);
  perform set_config('pilot_test.class_b',b::text,true);
  perform set_config('pilot_test.teacher_a',teacher_a::text,true);
  perform set_config('pilot_test.a_student_count',(select count(*)::text from public.pilot_students where class_id=a and deleted_at is null),true);
  perform set_config('request.jwt.claim.sub','',true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',teacher_b,'role','authenticated','app_metadata',jsonb_build_object('provider','google'))::text,true);
end;
$$;
set local role authenticated;
do $$
declare a uuid := current_setting('pilot_test.class_a')::uuid;
  b uuid := current_setting('pilot_test.class_b')::uuid;
  denied boolean; seat_number integer;
begin
  if (select count(*) from public.pilot_classes) <> 1
    or not exists (select 1 from public.pilot_classes where id=b)
    or exists (select 1 from public.pilot_classes where id=a)
    or exists (select 1 from public.pilot_students where class_id=a)
    or (select count(*) from public.pilot_students where class_id=b) <> 1
    then raise exception 'Cross-class read isolation failed'; end if;
  denied := false;
  begin perform public.add_pilot_student(a,99,'不應建立');
    exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'Cross-class RPC write was not denied'; end if;
  denied := false;
  begin insert into public.pilot_students(class_id,seat,name) values(b,99,'不應直接寫入');
    exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'Direct table write was not denied'; end if;
  denied := false;
  begin perform public.create_pilot_class('不應建立第二班');
    exception when unique_violation then denied := true; end;
  if not denied then raise exception 'Second active class was not denied'; end if;
  for seat_number in 20..33 loop
    perform public.add_pilot_student(b,seat_number,'回滾測試學生');
  end loop;
  if (select count(*) from public.pilot_students where class_id=b) <> 15
    then raise exception 'Student limit setup failed'; end if;
  denied := false;
  begin perform public.add_pilot_student(b,99,'第16人不應建立');
    exception when check_violation then denied := true; end;
  if not denied then raise exception '16th student was not denied'; end if;
end;
$$;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('pilot_test.teacher_a'),'role','authenticated','app_metadata',jsonb_build_object('provider','google'))::text,true);
do $$
declare a uuid := current_setting('pilot_test.class_a')::uuid;
  b uuid := current_setting('pilot_test.class_b')::uuid;
  denied boolean := false;
begin
  if (select count(*) from public.pilot_classes) <> 1
    or not exists (select 1 from public.pilot_classes where id=a)
    or exists (select 1 from public.pilot_classes where id=b)
    or exists (select 1 from public.pilot_students where class_id=b)
    or (select count(*) from public.pilot_students where class_id=a) <> current_setting('pilot_test.a_student_count')::integer
    then raise exception 'Reverse cross-class read isolation failed'; end if;
  begin perform public.add_pilot_student(b,98,'反向跨班不應建立');
    exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'Reverse cross-class write was not denied'; end if;
end;
$$;
set local role anon;
do $$
declare denied boolean := false;
begin
  begin perform 1 from public.pilot_classes;
    exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'Anonymous SELECT was not denied'; end if;
  denied := false;
  begin perform public.register_pilot_teacher();
    exception when insufficient_privilege then denied := true; end;
  if not denied then raise exception 'Anonymous registration RPC was not denied'; end if;
end;
$$;
reset role;
rollback;
select 'PASS: class isolation, scoped writes, one class, 15-student cap, anonymous denial; temporary writes rolled back' as verification;
