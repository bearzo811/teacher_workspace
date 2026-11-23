-- Paired-device read-only shop; no purchasing capability granted here.
begin;
create function public.get_pilot_display_shop(device_token text,selected_student uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare classroom uuid:=pilot_private.require_display(device_token); room public.pilot_classes%rowtype;
begin
 select * into room from public.pilot_classes where id=classroom;
 if not('rewards'=any(room.enabled_modules)) then return jsonb_build_object('class_name',room.name,'enabled',false,'students','[]'::jsonb,'products','[]'::jsonb,'eligibility',null); end if;
 if selected_student is not null and not exists(select 1 from public.pilot_students where class_id=classroom and id=selected_student and deleted_at is null) then raise exception 'Display student access denied' using errcode='42501'; end if;
 return jsonb_build_object('class_name',room.name,'enabled',true,
 'students',coalesce((select jsonb_agg(jsonb_build_object('id',id,'seat',seat,'name',name) order by seat) from public.pilot_students where class_id=classroom and deleted_at is null),'[]'::jsonb),
 'products',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'icon',icon,'description',description,'kind',kind,'price',price,'min_level',min_level,'stock',stock,'offer_version',offer_version) order by min_level desc,price desc,name,id) from public.pilot_shop_items where class_id=classroom and not archived),'[]'::jsonb),
 'eligibility',case when selected_student is not null then pilot_private.shop_eligibility(classroom,selected_student) else null end);
end;$$;
revoke all on function public.get_pilot_display_shop(text,uuid) from public,anon,authenticated;
grant execute on function public.get_pilot_display_shop(text,uuid) to anon,authenticated;
commit;
