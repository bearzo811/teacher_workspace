-- Pilot-only virtual classroom rewards. No purchases or automatic rewards yet.
begin;
create table public.pilot_reward_balances (
 class_id uuid not null,
 student_id uuid not null,
 coin_net bigint not null default 0 check(coin_net between -1000000000 and 1000000000),
 xp_total bigint not null default 0 check(xp_total between 0 and 1000000000),
 primary key(class_id,student_id),
 foreign key(class_id,student_id) references public.pilot_students(class_id,id)
);
create table public.pilot_reward_ledger (
 id uuid primary key default gen_random_uuid(),
 class_id uuid not null,
 student_id uuid not null,
 request_id uuid not null,
 coin_delta integer not null check(coin_delta between -10000 and 10000),
 xp_delta integer not null check(xp_delta between -10000 and 10000),
 reason text not null check(char_length(btrim(reason)) between 1 and 200),
 actor_id uuid not null references public.pilot_teachers(id),
 created_at timestamptz not null default now(),
 unique(class_id,request_id),
 foreign key(class_id,student_id) references public.pilot_students(class_id,id),
 check(coin_delta<>0 or xp_delta<>0)
);
create index pilot_reward_student_history on public.pilot_reward_ledger(class_id,student_id,created_at desc,id);
alter table public.pilot_reward_balances enable row level security;
alter table public.pilot_reward_ledger enable row level security;
revoke all on public.pilot_reward_balances,public.pilot_reward_ledger from public,anon,authenticated;
grant select on public.pilot_reward_balances,public.pilot_reward_ledger to authenticated;
create policy reward_balance_owner on public.pilot_reward_balances for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id and 'rewards'=any(c.enabled_modules)));
create policy reward_ledger_owner on public.pilot_reward_ledger for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id and 'rewards'=any(c.enabled_modules)));
create function public.adjust_pilot_rewards(target_class uuid,target_student uuid,request_key uuid,coins integer,xp integer,adjustment_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare teacher uuid:=pilot_private.require_teacher(); previous public.pilot_reward_ledger%rowtype; result uuid;
begin
 perform 1 from public.pilot_classes where id=target_class and owner_id=teacher and deleted_at is null and 'rewards'=any(enabled_modules) for update;
 if not found then raise exception 'Reward class access denied' using errcode='42501'; end if;
 if not exists(select 1 from public.pilot_students where id=target_student and class_id=target_class and deleted_at is null)
 then raise exception 'Reward student access denied' using errcode='42501'; end if;
 if request_key is null or coins is null or xp is null or adjustment_reason is null
 then raise exception 'Reward fields required' using errcode='23514'; end if;
 select * into previous from public.pilot_reward_ledger where class_id=target_class and request_id=request_key;
 if found then
  if previous.student_id<>target_student or previous.coin_delta<>coins or previous.xp_delta<>xp or previous.reason<>btrim(adjustment_reason)
  then raise exception 'Reward request conflict' using errcode='23514'; end if;
  return previous.id;
 end if;
 insert into public.pilot_reward_ledger(class_id,student_id,request_id,coin_delta,xp_delta,reason,actor_id)
 values(target_class,target_student,request_key,coins,xp,btrim(adjustment_reason),teacher) returning id into result;
 insert into public.pilot_reward_balances(class_id,student_id,coin_net,xp_total)
 values(target_class,target_student,0,0) on conflict(class_id,student_id) do nothing;
 update public.pilot_reward_balances set coin_net=coin_net+coins,xp_total=xp_total+xp
 where class_id=target_class and student_id=target_student;
 return result;
end;
$$;
revoke all on function public.adjust_pilot_rewards(uuid,uuid,uuid,integer,integer,text) from public,anon,authenticated;
grant execute on function public.adjust_pilot_rewards(uuid,uuid,uuid,integer,integer,text) to authenticated;
commit;
