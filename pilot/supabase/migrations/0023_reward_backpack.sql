-- Teacher-managed gifts and use workflow. No purchase/refund or device API.
begin;
create table public.pilot_student_rewards (
 id uuid primary key default gen_random_uuid(),class_id uuid not null,student_id uuid not null,item_id uuid not null,
 item_name text not null check(char_length(item_name) between 1 and 80),item_icon text not null check(char_length(item_icon) between 1 and 20),
 kind text not null check(kind in ('physical','privilege')),description text not null check(char_length(description)<=1000),
 source text not null check(source in ('gift','purchase')),price_paid integer not null check(price_paid between 0 and 10000),
 status text not null default 'available' check(status in ('available','requested','redeemed','revoked')),
 version integer not null default 1 check(version between 1 and 1000000),
 requested_at timestamptz,redeemed_at timestamptz,revoked_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(class_id,id),unique(class_id,student_id,id),
 foreign key(class_id,student_id) references public.pilot_students(class_id,id),
 foreign key(class_id,item_id) references public.pilot_shop_items(class_id,id),
 check(source<>'gift' or price_paid=0),
 check(status<>'requested' or requested_at is not null),
 check(status<>'redeemed' or redeemed_at is not null),
 check(status<>'revoked' or revoked_at is not null)
);
create index pilot_backpack_student on public.pilot_student_rewards(class_id,student_id,created_at desc,id);
create table public.pilot_reward_history (
 id uuid primary key default gen_random_uuid(),class_id uuid not null,student_id uuid not null,reward_id uuid not null,
 request_id uuid not null,action text not null check(action in ('gift','request','return','redeem','revoke')),
 note text not null check(char_length(btrim(note)) between 1 and 200),actor_id uuid not null references public.pilot_teachers(id),
 from_status text,to_status text not null,version integer not null,created_at timestamptz not null default now(),
 unique(class_id,request_id),unique(class_id,reward_id,version),
 foreign key(class_id,student_id,reward_id) references public.pilot_student_rewards(class_id,student_id,id)
);
create index pilot_backpack_history on public.pilot_reward_history(class_id,reward_id,created_at desc,id);
alter table public.pilot_student_rewards enable row level security;
alter table public.pilot_reward_history enable row level security;
revoke all on public.pilot_student_rewards,public.pilot_reward_history from public,anon,authenticated;
grant select on public.pilot_student_rewards,public.pilot_reward_history to authenticated;
create policy backpack_owner on public.pilot_student_rewards for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id and 'rewards'=any(c.enabled_modules)));
create policy backpack_history_owner on public.pilot_reward_history for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id and 'rewards'=any(c.enabled_modules)));
create function pilot_private.lock_backpack_class(target_class uuid,target_student uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare teacher uuid:=pilot_private.require_teacher();
begin
 perform 1 from public.pilot_classes where id=target_class and owner_id=teacher and deleted_at is null and 'rewards'=any(enabled_modules) for update;
 if not found or not exists(select 1 from public.pilot_students where id=target_student and class_id=target_class and deleted_at is null)
 then raise exception 'Backpack access denied' using errcode='42501'; end if;
 return teacher;
end;$$;
create function public.gift_pilot_reward(target_class uuid,target_student uuid,target_item uuid,request_key uuid,gift_note text) returns uuid
language plpgsql security definer set search_path='' as $$
declare teacher uuid:=pilot_private.lock_backpack_class(target_class,target_student); item public.pilot_shop_items%rowtype;
 previous public.pilot_reward_history%rowtype; reward public.pilot_student_rewards%rowtype;
begin
 if request_key is null or gift_note is null or char_length(btrim(gift_note)) not between 1 and 200 then raise exception 'Gift fields required' using errcode='23514'; end if;
 select * into previous from public.pilot_reward_history where class_id=target_class and request_id=request_key;
 if found then
  select * into reward from public.pilot_student_rewards where id=previous.reward_id and class_id=target_class;
  if previous.action<>'gift' or previous.student_id<>target_student or reward.item_id<>target_item or previous.note<>btrim(gift_note)
  then raise exception 'Reward request conflict' using errcode='23514'; end if;
  return reward.id;
 end if;
 select * into item from public.pilot_shop_items where id=target_item and class_id=target_class and not archived;
 if not found then raise exception 'Product access denied' using errcode='42501'; end if;
 if (select count(*) from public.pilot_student_rewards where class_id=target_class and student_id=target_student)>=1000 then raise exception 'Backpack limit reached' using errcode='23514'; end if;
 insert into public.pilot_student_rewards(class_id,student_id,item_id,item_name,item_icon,kind,description,source,price_paid)
 values(target_class,target_student,target_item,item.name,item.icon,item.kind,item.description,'gift',0) returning * into reward;
 insert into public.pilot_reward_history(class_id,student_id,reward_id,request_id,action,note,actor_id,from_status,to_status,version)
 values(target_class,target_student,reward.id,request_key,'gift',btrim(gift_note),teacher,null,'available',1);
 return reward.id;
end;$$;
create function public.manage_pilot_reward(target_class uuid,target_student uuid,target_reward uuid,request_key uuid,expected_version integer,reward_action text,action_note text) returns void
language plpgsql security definer set search_path='' as $$
declare teacher uuid:=pilot_private.lock_backpack_class(target_class,target_student); previous public.pilot_reward_history%rowtype;
 reward public.pilot_student_rewards%rowtype; next_status text;
begin
 if request_key is null or expected_version is null or action_note is null or char_length(btrim(action_note)) not between 1 and 200 or reward_action is null or reward_action not in ('request','return','redeem','revoke')
 then raise exception 'Reward action fields required' using errcode='23514'; end if;
 select * into previous from public.pilot_reward_history where class_id=target_class and request_id=request_key;
 if found then
  if previous.student_id<>target_student or previous.reward_id<>target_reward or previous.action<>reward_action or previous.note<>btrim(action_note)
  then raise exception 'Reward request conflict' using errcode='23514'; end if;
  return;
 end if;
 select * into reward from public.pilot_student_rewards where id=target_reward and class_id=target_class and student_id=target_student for update;
 if not found or reward.source<>'gift' then raise exception 'Reward access denied' using errcode='42501'; end if;
 if reward.version<>expected_version then raise exception 'Reward version changed' using errcode='23514'; end if;
 if reward_action='request' and reward.status='available' then next_status:='requested';
 elsif reward_action='return' and reward.status='requested' then next_status:='available';
 elsif reward_action='redeem' and reward.status='requested' then next_status:='redeemed';
 elsif reward_action='revoke' and reward.status in ('available','requested') then next_status:='revoked';
 else raise exception 'Invalid reward transition' using errcode='23514'; end if;
 update public.pilot_student_rewards set status=next_status,version=version+1,updated_at=now(),
 requested_at=case when next_status='requested' then now() when next_status='available' then null else requested_at end,
 redeemed_at=case when next_status='redeemed' then now() else redeemed_at end,
 revoked_at=case when next_status='revoked' then now() else revoked_at end
 where id=target_reward and class_id=target_class;
 insert into public.pilot_reward_history(class_id,student_id,reward_id,request_id,action,note,actor_id,from_status,to_status,version)
 values(target_class,target_student,target_reward,request_key,reward_action,btrim(action_note),teacher,reward.status,next_status,reward.version+1);
end;$$;
revoke all on function pilot_private.lock_backpack_class(uuid,uuid) from public,anon,authenticated;
revoke all on function public.gift_pilot_reward(uuid,uuid,uuid,uuid,text),public.manage_pilot_reward(uuid,uuid,uuid,uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.gift_pilot_reward(uuid,uuid,uuid,uuid,text),public.manage_pilot_reward(uuid,uuid,uuid,uuid,integer,text,text) to authenticated;
commit;
