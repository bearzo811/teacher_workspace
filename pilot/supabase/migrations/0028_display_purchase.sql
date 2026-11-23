-- Device-scoped purchasing; no teacher settings or reward redemption allowed.
begin;
alter table public.pilot_display_devices add unique(class_id,id);
alter table public.pilot_purchase_receipts add column device_id uuid;
alter table public.pilot_purchase_receipts add foreign key(class_id,device_id) references public.pilot_display_devices(class_id,id);
alter table public.pilot_reward_history add column device_id uuid;
alter table public.pilot_reward_history add foreign key(class_id,device_id) references public.pilot_display_devices(class_id,id);
create function public.buy_pilot_display_reward(device_token text,target_student uuid,target_item uuid,request_key uuid,expected_offer integer,expected_price integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare classroom uuid:=pilot_private.require_display(device_token); device uuid; reward uuid;
begin
 perform 1 from public.pilot_classes where id=classroom for update;
 -- Revocation uses the same class lock; revalidate after waiting for that lock.
 perform pilot_private.require_display(device_token);
 select id into device from public.pilot_display_devices where class_id=classroom and token_hash=encode(sha256(convert_to(device_token,'UTF8')),'hex');
 reward:=pilot_private.purchase_pilot_reward(classroom,target_student,target_item,request_key,expected_offer,expected_price);
 update public.pilot_purchase_receipts set device_id=device where class_id=classroom and reward_id=reward and device_id is null;
 update public.pilot_reward_history set actor_kind='device',device_id=device,note='白板購買入包' where class_id=classroom and reward_id=reward and action='purchase' and device_id is null;
 return reward;
end;$$;
revoke all on function public.buy_pilot_display_reward(text,uuid,uuid,uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.buy_pilot_display_reward(text,uuid,uuid,uuid,integer,integer) to anon,authenticated;
commit;
