-- Teacher fulfillment of purchased rewards; refund/revocation remains unavailable.
begin;
create or replace function public.manage_pilot_reward(target_class uuid,target_student uuid,target_reward uuid,request_key uuid,expected_version integer,reward_action text,action_note text) returns void
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
 if not found then raise exception 'Reward access denied' using errcode='42501'; end if;
 if reward.source='purchase' and reward_action='revoke' then raise exception 'Purchase refund not enabled' using errcode='23514'; end if;
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
commit;

