-- Voluntary cover of immutable published work. Signup never pays; teacher confirmation does.
begin;
create table public.pilot_duty_covers(
 id uuid primary key default gen_random_uuid(),class_id uuid not null,term_id uuid not null,day date not null,
 absent_student_id uuid not null,helper_student_id uuid not null,device_id uuid not null,
 status text not null default 'claimed' check(status in ('claimed','approved','cancelled')),
 version integer not null default 1 check(version>0),coins integer not null check(coins between 0 and 10000),rule_version integer,
 request_id uuid not null,award_id uuid,reversal_id uuid,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(class_id,id),unique(class_id,request_id),check(absent_student_id<>helper_student_id),
 foreign key(class_id,term_id) references public.pilot_terms(class_id,id),
 foreign key(class_id,absent_student_id) references public.pilot_students(class_id,id),
 foreign key(class_id,helper_student_id) references public.pilot_students(class_id,id),
 foreign key(class_id,device_id) references public.pilot_display_devices(class_id,id),
 foreign key(award_id) references public.pilot_reward_ledger(id),foreign key(reversal_id) references public.pilot_reward_ledger(id)
);
create unique index pilot_one_active_cover on public.pilot_duty_covers(class_id,day,absent_student_id) where status<>'cancelled';
create table public.pilot_duty_cover_jobs(
 class_id uuid not null,cover_id uuid not null,assignment_id uuid not null,primary key(cover_id,assignment_id),
 foreign key(class_id,cover_id) references public.pilot_duty_covers(class_id,id),
 foreign key(class_id,assignment_id) references public.pilot_duty_assignments(class_id,id)
);
create table public.pilot_duty_cover_events(
 id uuid primary key default gen_random_uuid(),class_id uuid not null,cover_id uuid not null,request_id uuid not null,
 action text not null check(action in ('claim','approve','cancel')),version integer not null,actor_id uuid references public.pilot_teachers(id),
 device_id uuid,created_at timestamptz not null default now(),unique(class_id,request_id),
 foreign key(class_id,cover_id) references public.pilot_duty_covers(class_id,id),
 foreign key(class_id,device_id) references public.pilot_display_devices(class_id,id)
);
alter table public.pilot_duty_covers enable row level security;
alter table public.pilot_duty_cover_jobs enable row level security;
alter table public.pilot_duty_cover_events enable row level security;
revoke all on public.pilot_duty_covers,public.pilot_duty_cover_jobs,public.pilot_duty_cover_events from public,anon,authenticated;
grant select on public.pilot_duty_covers,public.pilot_duty_cover_jobs,public.pilot_duty_cover_events to authenticated;
create policy duty_cover_owner on public.pilot_duty_covers for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id and 'duty'=any(c.enabled_modules)));
create policy duty_cover_job_owner on public.pilot_duty_cover_jobs for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id and 'duty'=any(c.enabled_modules)));
create policy duty_cover_event_owner on public.pilot_duty_cover_events for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id and 'duty'=any(c.enabled_modules)));

create function public.claim_pilot_display_duty(device_token text,target_absent uuid,target_helper uuid,request_key uuid,expected_rule_version integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare classroom uuid:=pilot_private.require_display(device_token); today date:=pilot_private.display_today();room public.pilot_classes%rowtype;
 term public.pilot_terms%rowtype; prior public.pilot_duty_covers%rowtype; rules public.pilot_reward_rules%rowtype; bonus integer:=0; device uuid; result uuid; selected_revision integer;
begin
 select * into room from public.pilot_classes where id=classroom and deleted_at is null and 'duty'=any(enabled_modules) for update;
 if not found then raise exception 'Duty cover access denied' using errcode='42501'; end if;
 perform pilot_private.require_display(device_token);
 if request_key is null or target_absent is null or target_helper is null or expected_rule_version is null or expected_rule_version<0 then raise exception 'Cover request required' using errcode='23514'; end if;
 select * into prior from public.pilot_duty_covers where class_id=classroom and request_id=request_key;
 if found then
  if prior.absent_student_id<>target_absent or prior.helper_student_id<>target_helper or coalesce(prior.rule_version,0)<>expected_rule_version then raise exception 'Cover request conflict' using errcode='23514'; end if;
  return prior.id;
 end if;
 if exists(select 1 from public.pilot_duty_cover_events where class_id=classroom and request_id=request_key) then raise exception 'Cover request conflict' using errcode='23514'; end if;
 if target_absent=target_helper or (select count(*) from public.pilot_students where class_id=classroom and id in (target_absent,target_helper) and deleted_at is null)<>2 then raise exception 'Cover student access denied' using errcode='42501'; end if;
 select * into term from public.pilot_terms where class_id=classroom and active;
 if term.id is null or not pilot_private.is_school_day(term.id,today) then raise exception 'Today school day required' using errcode='23514'; end if;
 if not exists(select 1 from public.pilot_attendance where class_id=classroom and day=today and student_id=target_absent and absent)
 or exists(select 1 from public.pilot_attendance where class_id=classroom and day=today and student_id=target_helper and absent) then raise exception 'Cover attendance changed' using errcode='23514'; end if;
 select max(p.revision) into selected_revision from public.pilot_duty_plans p where p.class_id=classroom and p.term_id=term.id and p.effective_from<=today;
 if not exists(select 1 from public.pilot_duty_assignments a join public.pilot_duty_plans p on p.class_id=a.class_id and p.id=a.plan_id where a.class_id=classroom and p.term_id=term.id and p.revision=selected_revision and a.day=today and a.student_id=target_absent) then raise exception 'No published work to cover' using errcode='23514'; end if;
 if 'rewards'=any(room.enabled_modules) then
  select * into rules from public.pilot_reward_rules where class_id=classroom;
  if not found then raise exception 'Confirm reward rules before cover signup' using errcode='23514'; end if;
  bonus:=(rules.rules->>'substitute_coins')::integer;
 end if;
 if coalesce(rules.version,0)<>expected_rule_version then raise exception 'Cover reward rules changed; reload' using errcode='40001'; end if;
 select id into device from public.pilot_display_devices where class_id=classroom and token_hash=encode(sha256(convert_to(device_token,'UTF8')),'hex');
 insert into public.pilot_duty_covers(class_id,term_id,day,absent_student_id,helper_student_id,device_id,coins,rule_version,request_id)
 values(classroom,term.id,today,target_absent,target_helper,device,bonus,rules.version,request_key) returning id into result;
 insert into public.pilot_duty_cover_jobs(class_id,cover_id,assignment_id)
 select classroom,result,a.id from public.pilot_duty_assignments a join public.pilot_duty_plans p on p.id=a.plan_id and p.class_id=a.class_id where a.class_id=classroom and p.term_id=term.id and p.revision=selected_revision and a.day=today and a.student_id=target_absent;
 insert into public.pilot_duty_cover_events(class_id,cover_id,request_id,action,version,device_id) values(classroom,result,request_key,'claim',1,device);
 return result;
end;$$;

create function public.review_pilot_duty_cover(target_class uuid,target_cover uuid,expected_version integer,review_action text,request_key uuid) returns integer
language plpgsql security definer set search_path='' as $$
declare teacher uuid:=pilot_private.require_teacher();room public.pilot_classes%rowtype; cover public.pilot_duty_covers%rowtype;
 prior public.pilot_duty_cover_events%rowtype; delta integer:=0; entry uuid; next_version integer;
begin
 select * into room from public.pilot_classes where id=target_class and owner_id=teacher and deleted_at is null for update;
 if not found then raise exception 'Duty cover access denied' using errcode='42501'; end if;
 if request_key is null or expected_version is null or review_action is null or review_action not in ('approve','cancel') then raise exception 'Invalid cover review' using errcode='23514'; end if;
 select * into prior from public.pilot_duty_cover_events where class_id=target_class and request_id=request_key;
 if found then
  if prior.cover_id<>target_cover or prior.action<>review_action or prior.version<>expected_version+1 then raise exception 'Cover request conflict' using errcode='23514'; end if;
  return prior.version;
 end if;
 select * into cover from public.pilot_duty_covers where class_id=target_class and id=target_cover for update;
 if not found then raise exception 'Duty cover access denied' using errcode='42501'; end if;
 if cover.version<>expected_version then raise exception 'Cover changed; reload' using errcode='40001'; end if;
 if cover.status='cancelled' or (review_action='approve' and cover.status<>'claimed') then raise exception 'Cover already reviewed' using errcode='23514'; end if;
 if review_action='approve' then
  if not ('duty'=any(room.enabled_modules)) then raise exception 'Duty module required' using errcode='23514'; end if;
  if not exists(select 1 from public.pilot_students where class_id=target_class and id=cover.helper_student_id and deleted_at is null) then raise exception 'Restore helper before approval' using errcode='23514'; end if;
  if cover.coins>0 and not ('rewards'=any(room.enabled_modules)) then raise exception 'Rewards module required for promised coins' using errcode='23514'; end if;
  delta:=cover.coins;
 elsif cover.status='approved' then delta:=-cover.coins;
 end if;
 if delta<>0 then
  insert into public.pilot_reward_ledger(class_id,student_id,request_id,coin_delta,xp_delta,reason,actor_id)
  values(target_class,cover.helper_student_id,request_key,delta,0,case when review_action='approve' then '老師確認代班完成 ' else '取消代班獎勵 ' end||cover.day::text,teacher) returning id into entry;
  insert into public.pilot_reward_balances(class_id,student_id) values(target_class,cover.helper_student_id) on conflict(class_id,student_id) do nothing;
  update public.pilot_reward_balances set coin_net=coin_net+delta where class_id=target_class and student_id=cover.helper_student_id;
 end if;
 next_version:=cover.version+1;
 update public.pilot_duty_covers set status=case when review_action='approve' then 'approved' else 'cancelled' end,version=next_version,updated_at=now(),award_id=case when review_action='approve' then entry else award_id end,reversal_id=case when review_action='cancel' then entry else reversal_id end where id=target_cover;
 insert into public.pilot_duty_cover_events(class_id,cover_id,request_id,action,version,actor_id) values(target_class,target_cover,request_key,review_action,next_version,teacher);
 return next_version;
end;$$;
create function public.get_pilot_display_substitutes(device_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare classroom uuid:=pilot_private.require_display(device_token);room public.pilot_classes%rowtype;term public.pilot_terms%rowtype;today date:=pilot_private.display_today();bonus integer:=0;ready boolean:=true;rules_version integer:=0;opportunities jsonb:='[]'::jsonb;
begin
 select * into room from public.pilot_classes where id=classroom;
 if not ('duty'=any(room.enabled_modules)) then return jsonb_build_object('opportunities','[]'::jsonb,'ready',false); end if;
 select * into term from public.pilot_terms where class_id=classroom and active;
 if term.id is null or not pilot_private.is_school_day(term.id,today) then return jsonb_build_object('opportunities','[]'::jsonb,'ready',false); end if;
 if 'rewards'=any(room.enabled_modules) then
  select (rules->>'substitute_coins')::integer,version into bonus,rules_version from public.pilot_reward_rules where class_id=classroom;
  ready:=found;bonus:=coalesce(bonus,0);
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('student_id',s.id,'name',s.name,'jobs',w.jobs,'cover_id',c.id,'status',c.status,'helper_name',h.name,'coins',coalesce(c.coins,bonus),'basis_changed',not coalesce(att.absent,false)) order by s.seat),'[]'::jsonb) into opportunities
 from public.pilot_students s
 join lateral(select jsonb_agg(a.job_name order by a.group_key,a.job_name,a.slot) jobs from public.pilot_duty_assignments a join public.pilot_duty_plans p on p.id=a.plan_id and p.class_id=a.class_id where a.class_id=classroom and a.student_id=s.id and a.day=today and p.term_id=term.id and p.revision=(select max(p2.revision) from public.pilot_duty_plans p2 where p2.class_id=classroom and p2.term_id=term.id and p2.effective_from<=today)) w on w.jobs is not null
 left join public.pilot_attendance att on att.class_id=classroom and att.student_id=s.id and att.day=today
 left join public.pilot_duty_covers c on c.class_id=classroom and c.day=today and c.absent_student_id=s.id and c.status<>'cancelled'
 left join public.pilot_students h on h.class_id=classroom and h.id=c.helper_student_id and h.deleted_at is null
 where s.class_id=classroom and s.deleted_at is null and (att.absent or c.id is not null);
 return jsonb_build_object('opportunities',opportunities,'ready',ready,'rule_version',coalesce(rules_version,0));
end;$$;
-- Keep original access checks in private base functions; only wrappers remain public.
alter function public.get_pilot_display_lunch(text) set schema pilot_private;
revoke all on function pilot_private.get_pilot_display_lunch(text) from public,anon,authenticated;
create function public.get_pilot_display_lunch(device_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare snapshot jsonb:=pilot_private.get_pilot_display_lunch(device_token);classroom uuid:=pilot_private.require_display(device_token);jobs jsonb;
begin
 select coalesce(jsonb_agg(j.value||jsonb_build_object('student_id',case when c.id is null then j.value->'student_id' when s.deleted_at is null then to_jsonb(s.id) else 'null'::jsonb end,'cover_id',c.id) order by j.ordinality),'[]'::jsonb) into jobs
 from jsonb_array_elements(snapshot->'jobs') with ordinality j(value,ordinality)
 left join public.pilot_duty_cover_jobs l on l.class_id=classroom and l.assignment_id=(j.value->>'id')::uuid
 and exists(select 1 from public.pilot_duty_covers active where active.class_id=classroom and active.id=l.cover_id and active.status<>'cancelled')
 left join public.pilot_duty_covers c on c.class_id=classroom and c.id=l.cover_id
 left join public.pilot_students s on s.class_id=classroom and s.id=c.helper_student_id;
 return jsonb_set(snapshot,'{jobs}',jobs);
end;$$;
revoke all on function public.get_pilot_display_lunch(text) from public,anon,authenticated;
grant execute on function public.get_pilot_display_lunch(text) to anon,authenticated;

alter function public.get_pilot_duty_planning(uuid,uuid,date) set schema pilot_private;
revoke all on function pilot_private.get_pilot_duty_planning(uuid,uuid,date) from public,anon,authenticated;
create function public.get_pilot_duty_planning(target_class uuid,target_term uuid,starts_on date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare snapshot jsonb:=pilot_private.get_pilot_duty_planning(target_class,target_term,starts_on);history jsonb;
begin
 select coalesce(jsonb_agg(to_jsonb(h)),'[]'::jsonb) into history from (
 select coalesce(c.helper_student_id,a.student_id) student_id,a.job_id,count(*)::integer count,sum(a.weight)::integer total_weight
 from public.pilot_duty_assignments a join public.pilot_duty_plans p on p.class_id=a.class_id and p.id=a.plan_id
 left join public.pilot_duty_cover_jobs l on l.class_id=target_class and l.assignment_id=a.id
 and exists(select 1 from public.pilot_duty_covers approved where approved.class_id=target_class and approved.id=l.cover_id and approved.status='approved')
 left join public.pilot_duty_covers c on c.class_id=target_class and c.id=l.cover_id
 where a.class_id=target_class and p.term_id=target_term and a.day<starts_on and p.revision=(select max(p2.revision) from public.pilot_duty_plans p2 where p2.class_id=target_class and p2.term_id=target_term and p2.effective_from<=a.day)
 group by coalesce(c.helper_student_id,a.student_id),a.job_id) h;
 return jsonb_set(snapshot,'{history}',history);
end;$$;
revoke all on function public.get_pilot_duty_planning(uuid,uuid,date) from public,anon,authenticated;
grant execute on function public.get_pilot_duty_planning(uuid,uuid,date) to authenticated;
revoke all on function public.get_pilot_display_substitutes(text) from public,anon,authenticated;
grant execute on function public.get_pilot_display_substitutes(text) to anon,authenticated;
revoke all on function public.claim_pilot_display_duty(text,uuid,uuid,uuid,integer) from public,anon,authenticated;
revoke all on function public.review_pilot_duty_cover(uuid,uuid,integer,text,uuid) from public,anon,authenticated;
grant execute on function public.claim_pilot_display_duty(text,uuid,uuid,uuid,integer) to anon,authenticated;
grant execute on function public.review_pilot_duty_cover(uuid,uuid,integer,text,uuid) to authenticated;
commit;
