-- Immutable teacher-published duty plans. No student claims or rewards in this migration.
begin;
create table public.pilot_duty_plans(
 id uuid primary key default gen_random_uuid(),class_id uuid not null,term_id uuid not null,revision integer not null check(revision>0),
 effective_from date not null,jobs jsonb not null,roster jsonb not null,request_id uuid not null,payload_hash text not null,
 actor_id uuid not null references public.pilot_teachers(id),created_at timestamptz not null default now(),
 unique(class_id,id),unique(class_id,term_id,revision),unique(class_id,request_id),
 foreign key(class_id,term_id) references public.pilot_terms(class_id,id)
);
create table public.pilot_duty_assignments(
 id uuid primary key default gen_random_uuid(),class_id uuid not null,plan_id uuid not null,student_id uuid not null,day date not null,
 job_id text not null,slot integer not null check(slot between 1 and 15),job_name text not null,group_key text not null,
 weight integer not null check(weight between 1 and 10),exclusive boolean not null,
 unique(class_id,id),unique(plan_id,day,job_id,slot),unique(plan_id,day,group_key,student_id),
 foreign key(class_id,plan_id) references public.pilot_duty_plans(class_id,id),
 foreign key(class_id,student_id) references public.pilot_students(class_id,id)
);
create index pilot_duty_day on public.pilot_duty_assignments(class_id,day);
alter table public.pilot_duty_plans enable row level security;
alter table public.pilot_duty_assignments enable row level security;
revoke all on public.pilot_duty_plans,public.pilot_duty_assignments from public,anon,authenticated;
grant select on public.pilot_duty_plans,public.pilot_duty_assignments to authenticated;
create policy duty_plan_owner on public.pilot_duty_plans for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id and 'duty'=any(c.enabled_modules)));
create policy duty_assignment_owner on public.pilot_duty_assignments for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id and 'duty'=any(c.enabled_modules)));

create function pilot_private.valid_duty_jobs(input jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare job jsonb;
begin
 if input is null or jsonb_typeof(input)<>'array' or jsonb_array_length(input) not between 1 and 30 or octet_length(input::text)>20000 then return false; end if;
 for job in select value from jsonb_array_elements(input) loop
  if jsonb_typeof(job)<>'object' or not(job ?& array['id','name','group','slots','weight','exclusive']) or (select count(*) from jsonb_object_keys(job))<>6 or jsonb_typeof(job->'id')<>'string' or coalesce(job->>'id','')!~'^[a-z0-9_-]{1,64}$'
   or jsonb_typeof(job->'name')<>'string' or char_length(btrim(job->>'name')) not between 1 and 60 or job->>'name'<>btrim(job->>'name')
   or jsonb_typeof(job->'group')<>'string' or char_length(btrim(job->>'group')) not between 1 and 40 or job->>'group'<>btrim(job->>'group')
   or jsonb_typeof(job->'slots')<>'number' or coalesce(job->>'slots','')!~'^[0-9]{1,2}$' or (job->>'slots')::integer not between 1 and 15
   or jsonb_typeof(job->'weight')<>'number' or coalesce(job->>'weight','')!~'^[0-9]{1,2}$' or (job->>'weight')::integer not between 1 and 10
   or jsonb_typeof(job->'exclusive')<>'boolean' then return false; end if;
 end loop;
 return (select count(distinct j->>'id')=count(*) and count(distinct (j->>'group',lower(j->>'name')))=count(*) and count(distinct j->>'group')<=6 from jsonb_array_elements(input) j);
exception when others then return false;
end;$$;

create function public.publish_pilot_duty_plan(target_class uuid,target_term uuid,starts_on date,job_specs jsonb,schedule jsonb,expected_roster jsonb,expected_revision integer,request_key uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare teacher uuid:=pilot_private.require_teacher(); term public.pilot_terms%rowtype; previous public.pilot_duty_plans%rowtype;
 latest integer; students integer; exclusive_slots integer; expected_rows integer; fingerprint text; plan uuid; snapshot jsonb;
begin
 perform 1 from public.pilot_classes where id=target_class and owner_id=teacher and deleted_at is null and 'duty'=any(enabled_modules) for update;
 if not found then raise exception 'Duty plan access denied' using errcode='42501'; end if;
 if request_key is null or starts_on is null or expected_revision is null or not pilot_private.valid_duty_jobs(job_specs) or schedule is null or jsonb_typeof(schedule)<>'array' or jsonb_array_length(schedule)>20000 or octet_length(schedule::text)>3000000 then raise exception 'Invalid duty plan' using errcode='23514'; end if;
 fingerprint:=encode(sha256(convert_to(jsonb_build_object('term',target_term,'start',starts_on,'jobs',job_specs,'schedule',schedule,'roster',expected_roster)::text,'UTF8')),'hex');
 select * into previous from public.pilot_duty_plans where class_id=target_class and request_id=request_key;
 if found then
  if previous.payload_hash<>fingerprint then raise exception 'Duty request conflict' using errcode='23514'; end if;
  return previous.id;
 end if;
 select * into term from public.pilot_terms where class_id=target_class and id=target_term and active;
 if not found or starts_on<term.start_date or starts_on>term.end_date then raise exception 'Active duty term required' using errcode='23514'; end if;
 select coalesce(max(revision),0) into latest from public.pilot_duty_plans where class_id=target_class and term_id=target_term;
 if expected_revision<>latest then raise exception 'Duty plan changed; reload' using errcode='40001'; end if;
 if latest>=100 then raise exception 'Duty plan version limit reached' using errcode='23514'; end if;
 if latest>0 and starts_on<=pilot_private.display_today() then raise exception 'New duty plan must start after today' using errcode='23514'; end if;
 select count(*),coalesce(jsonb_agg(jsonb_build_object('id',id,'seat',seat,'name',name) order by seat,id),'[]'::jsonb) into students,snapshot from public.pilot_students where class_id=target_class and deleted_at is null;
 if expected_roster is null or expected_roster<>snapshot then raise exception 'Duty roster changed; reload' using errcode='40001'; end if;
 select coalesce(sum((j->>'slots')::integer),0) into exclusive_slots from jsonb_array_elements(job_specs) j where (j->>'exclusive')::boolean;
 if students not between 1 and 15 or exclusive_slots>students or exists(select 1 from jsonb_array_elements(job_specs) j where not(j->>'exclusive')::boolean group by j->>'group' having sum((j->>'slots')::integer)>students-exclusive_slots) then raise exception 'Insufficient duty staffing' using errcode='23514'; end if;
 select count(*)*(select sum((j->>'slots')::integer) from jsonb_array_elements(job_specs) j) into expected_rows from generate_series(starts_on::timestamp,term.end_date::timestamp,interval '1 day') d where pilot_private.is_school_day(target_term,d::date);
 if expected_rows=0 or expected_rows>20000 or expected_rows<>jsonb_array_length(schedule) then raise exception 'Incomplete duty coverage; calendar may have changed' using errcode='23514'; end if;
 if exists(select 1 from jsonb_array_elements(schedule) a where jsonb_typeof(a)<>'object' or (select count(*) from jsonb_object_keys(a))<>4 or jsonb_typeof(a->'day')<>'string' or jsonb_typeof(a->'job_id')<>'string' or jsonb_typeof(a->'slot')<>'number' or jsonb_typeof(a->'student_id')<>'string') then raise exception 'Invalid duty assignment' using errcode='23514'; end if;
 if exists(select 1 from jsonb_to_recordset(schedule) a(day date,job_id text,slot integer,student_id uuid) left join jsonb_to_recordset(job_specs) j(id text,slots integer) on j.id=a.job_id where j.id is null or a.day is null or a.day<starts_on or a.day>term.end_date or not pilot_private.is_school_day(target_term,a.day) or a.slot is null or a.slot not between 1 and j.slots or not exists(select 1 from public.pilot_students s where s.class_id=target_class and s.id=a.student_id and s.deleted_at is null)) then raise exception 'Duty assignment access denied' using errcode='42501'; end if;
 if exists(select 1 from jsonb_to_recordset(schedule) a(day date,job_id text,student_id uuid) join jsonb_to_recordset(job_specs) j(id text,exclusive boolean) on j.id=a.job_id group by a.day,a.student_id having count(*)>1 and bool_or(j.exclusive)) then raise exception 'Exclusive duty conflict' using errcode='23514'; end if;
 insert into public.pilot_duty_plans(class_id,term_id,revision,effective_from,jobs,roster,request_id,payload_hash,actor_id) values(target_class,target_term,latest+1,starts_on,job_specs,snapshot,request_key,fingerprint,teacher) returning id into plan;
 insert into public.pilot_duty_assignments(class_id,plan_id,student_id,day,job_id,slot,job_name,group_key,weight,exclusive)
 select target_class,plan,a.student_id,a.day,a.job_id,a.slot,j.name,j."group",j.weight,j.exclusive from jsonb_to_recordset(schedule) a(day date,job_id text,slot integer,student_id uuid) join jsonb_to_recordset(job_specs) j(id text,name text,"group" text,weight integer,exclusive boolean) on j.id=a.job_id;
 return plan;
end;$$;

create function public.get_pilot_duty_planning(target_class uuid,target_term uuid,starts_on date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare teacher uuid:=pilot_private.require_teacher(); term public.pilot_terms%rowtype; latest public.pilot_duty_plans%rowtype;
begin
 perform 1 from public.pilot_classes where id=target_class and owner_id=teacher and deleted_at is null and 'duty'=any(enabled_modules) for update;
 if not found then raise exception 'Duty planning access denied' using errcode='42501'; end if;
 select * into term from public.pilot_terms where class_id=target_class and id=target_term and active;
 if not found or starts_on is null or starts_on<term.start_date or starts_on>term.end_date then raise exception 'Active duty term required' using errcode='23514'; end if;
 select * into latest from public.pilot_duty_plans where class_id=target_class and term_id=target_term order by revision desc limit 1;
 return jsonb_build_object('term',to_jsonb(term),'revision',coalesce(latest.revision,0),'jobs',coalesce(latest.jobs,'[]'::jsonb),'starts_on',starts_on,
 'students',coalesce((select jsonb_agg(jsonb_build_object('id',id,'seat',seat,'name',name) order by seat,id) from public.pilot_students where class_id=target_class and deleted_at is null),'[]'::jsonb),
 'overrides',coalesce((select jsonb_agg(to_jsonb(d)) from public.pilot_day_overrides d where term_id=target_term),'[]'::jsonb),
 'history',coalesce((select jsonb_agg(to_jsonb(h)) from (select a.student_id,a.job_id,count(*)::integer count,sum(a.weight)::integer total_weight from public.pilot_duty_assignments a join public.pilot_duty_plans p on p.id=a.plan_id and p.class_id=a.class_id where a.class_id=target_class and p.term_id=target_term and a.day<starts_on and p.revision=(select max(p2.revision) from public.pilot_duty_plans p2 where p2.class_id=target_class and p2.term_id=target_term and p2.effective_from<=a.day) group by a.student_id,a.job_id) h),'[]'::jsonb));
end;$$;

create function public.get_pilot_duty_month(target_class uuid,target_term uuid,target_month date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare teacher uuid:=pilot_private.require_teacher(); term public.pilot_terms%rowtype; rows jsonb; days jsonb;
begin
 if not exists(select 1 from public.pilot_classes where id=target_class and owner_id=teacher and deleted_at is null and 'duty'=any(enabled_modules)) then raise exception 'Duty month access denied' using errcode='42501'; end if;
 select * into term from public.pilot_terms where class_id=target_class and id=target_term;
 if not found or target_month is null or extract(day from target_month)<>1 or target_month not between date '2000-01-01' and date '2100-12-01' then raise exception 'Invalid duty month' using errcode='23514'; end if;
 select coalesce(jsonb_agg(d::date order by d),'[]'::jsonb) into days from generate_series(greatest(target_month,term.start_date)::timestamp,least((target_month+interval '1 month')::date-1,term.end_date)::timestamp,interval '1 day') d where pilot_private.is_school_day(target_term,d::date);
 select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'day',a.day,'job_id',a.job_id,'job_name',a.job_name,'group',a.group_key,'slot',a.slot,'student_id',a.student_id,'student_name',s->>'name','seat',(s->>'seat')::integer) order by a.day,a.group_key,a.job_name,a.slot),'[]'::jsonb) into rows from public.pilot_duty_assignments a join public.pilot_duty_plans p on p.id=a.plan_id and p.class_id=a.class_id join lateral jsonb_array_elements(p.roster) s on s->>'id'=a.student_id::text where a.class_id=target_class and p.term_id=target_term and a.day>=target_month and a.day<(target_month+interval '1 month')::date and pilot_private.is_school_day(target_term,a.day) and p.revision=(select max(p2.revision) from public.pilot_duty_plans p2 where p2.class_id=target_class and p2.term_id=target_term and p2.effective_from<=a.day);
 return jsonb_build_object('term',to_jsonb(term),'days',days,'assignments',rows);
end;$$;
revoke all on function pilot_private.valid_duty_jobs(jsonb),public.publish_pilot_duty_plan(uuid,uuid,date,jsonb,jsonb,jsonb,integer,uuid),public.get_pilot_duty_planning(uuid,uuid,date),public.get_pilot_duty_month(uuid,uuid,date) from public,anon,authenticated;
grant execute on function public.publish_pilot_duty_plan(uuid,uuid,date,jsonb,jsonb,jsonb,integer,uuid),public.get_pilot_duty_planning(uuid,uuid,date),public.get_pilot_duty_month(uuid,uuid,date) to authenticated;
commit;
