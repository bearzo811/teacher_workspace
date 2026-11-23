-- Private purchase engine + teacher shop controls/preview. No student/device API.
begin;
create function pilot_private.shop_today() returns date language sql stable set search_path='' as $$select timezone('Asia/Taipei',now())::date$$;
create function pilot_private.reward_level(xp bigint,base integer) returns integer language plpgsql immutable set search_path='' as $$
declare result integer;
begin
 if xp is null or xp<0 or xp>1000000000 or base is null or base<1 or base>10000 then return null; end if;
 result:=floor((1+sqrt(1+8*xp::numeric/base))/2)::integer;
 while base::bigint*result*(result+1)/2<=xp loop result:=result+1; end loop;
 while base::bigint*result*(result-1)/2>xp loop result:=result-1; end loop;
 return result;
end;$$;
create table public.pilot_shop_settings (
 class_id uuid primary key references public.pilot_classes(id),is_open boolean not null,version integer not null check(version between 1 and 1000000),
 actor_id uuid not null references public.pilot_teachers(id),updated_at timestamptz not null default now()
);
create table public.pilot_shop_setting_history (
 class_id uuid not null references public.pilot_classes(id),version integer not null,is_open boolean not null,
 actor_id uuid not null references public.pilot_teachers(id),created_at timestamptz not null default now(),primary key(class_id,version)
);
alter table public.pilot_shop_items add column offer_version integer not null default 1 check(offer_version between 1 and 1000000);
create function pilot_private.bump_shop_offer() returns trigger language plpgsql set search_path='' as $$
begin
 new.offer_version:=old.offer_version+case when row(new.name,new.icon,new.kind,new.description,new.price,new.min_level,new.archived) is distinct from row(old.name,old.icon,old.kind,old.description,old.price,old.min_level,old.archived) then 1 else 0 end;
 return new;
end;$$;
create trigger pilot_shop_offer_before before update on public.pilot_shop_items for each row execute function pilot_private.bump_shop_offer();
create table public.pilot_purchase_receipts (
 id uuid primary key default gen_random_uuid(),class_id uuid not null,student_id uuid not null,item_id uuid not null,reward_id uuid not null,
 request_id uuid not null,offer_version integer not null,price_paid integer not null check(price_paid between 0 and 10000),
 ledger_id uuid,stock_consumed boolean not null,rule_version integer not null,shop_version integer not null,
 created_at timestamptz not null default now(),unique(class_id,request_id),unique(reward_id),
 foreign key(class_id,student_id,reward_id) references public.pilot_student_rewards(class_id,student_id,id),
 foreign key(class_id,item_id) references public.pilot_shop_items(class_id,id),
 foreign key(class_id,student_id,ledger_id) references public.pilot_reward_ledger(class_id,student_id,id),
 foreign key(class_id,rule_version) references public.pilot_reward_rule_history(class_id,version),
 foreign key(class_id,shop_version) references public.pilot_shop_setting_history(class_id,version),
 check((price_paid=0)=(ledger_id is null))
);
alter table public.pilot_shop_settings enable row level security;
alter table public.pilot_shop_setting_history enable row level security;
alter table public.pilot_purchase_receipts enable row level security;
revoke all on public.pilot_shop_settings,public.pilot_shop_setting_history,public.pilot_purchase_receipts from public,anon,authenticated;
grant select on public.pilot_shop_settings,public.pilot_shop_setting_history,public.pilot_purchase_receipts to authenticated;
create policy shop_setting_owner on public.pilot_shop_settings for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id and 'rewards'=any(c.enabled_modules)));
create policy shop_setting_history_owner on public.pilot_shop_setting_history for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id and 'rewards'=any(c.enabled_modules)));
create policy purchase_receipt_owner on public.pilot_purchase_receipts for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id and 'rewards'=any(c.enabled_modules)));
alter table public.pilot_reward_history add column actor_kind text not null default 'teacher' check(actor_kind in ('teacher','system','device'));
alter table public.pilot_reward_history drop constraint pilot_reward_history_action_check;
alter table public.pilot_reward_history add constraint pilot_reward_history_action_check check(action in ('gift','purchase','request','return','redeem','revoke'));
create index pilot_shop_homework_due on public.pilot_assignments(class_id,term_id,due_day) where not archived;
create function public.configure_pilot_shop(target_class uuid,open_shop boolean,expected_version integer) returns void
language plpgsql security definer set search_path='' as $$
declare teacher uuid:=pilot_private.require_teacher(); previous public.pilot_shop_settings%rowtype; next_version integer;
begin
 perform 1 from public.pilot_classes where id=target_class and owner_id=teacher and deleted_at is null and 'rewards'=any(enabled_modules) for update;
 if not found then raise exception 'Shop access denied' using errcode='42501'; end if;
 if open_shop is null or expected_version is null or (open_shop and not exists(select 1 from public.pilot_reward_rules where class_id=target_class)) then raise exception 'Confirmed shop rules required' using errcode='23514'; end if;
 select * into previous from public.pilot_shop_settings where class_id=target_class;
 if found and previous.is_open=open_shop then return; end if;
 if coalesce(previous.version,0)<>expected_version then raise exception 'Shop version changed' using errcode='23514'; end if;
 next_version:=coalesce(previous.version,0)+1;
 insert into public.pilot_shop_setting_history(class_id,version,is_open,actor_id) values(target_class,next_version,open_shop,teacher);
 insert into public.pilot_shop_settings(class_id,is_open,version,actor_id) values(target_class,open_shop,next_version,teacher)
 on conflict(class_id) do update set is_open=excluded.is_open,version=excluded.version,actor_id=excluded.actor_id,updated_at=now();
end;$$;
create function pilot_private.shop_eligibility(target_class uuid,target_student uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare classroom public.pilot_classes%rowtype; term public.pilot_terms%rowtype; rules public.pilot_reward_rules%rowtype;
 today date:=pilot_private.shop_today(); current_week integer:=0; work_count integer:=0; passport_count integer:=0; reading_count integer:=0;
 term_ready boolean; coins bigint:=0; xp bigint:=0; level integer;
begin
 select * into classroom from public.pilot_classes where id=target_class and deleted_at is null and 'rewards'=any(enabled_modules);
 if not found or not exists(select 1 from public.pilot_teachers where id=classroom.owner_id and active)
  or not exists(select 1 from public.pilot_students where id=target_student and class_id=target_class and deleted_at is null)
 then raise exception 'Shop student access denied' using errcode='42501'; end if;
 select * into term from public.pilot_terms where class_id=target_class and active;
 term_ready:=found or not(classroom.enabled_modules && array['homework','passport','reading']);
 if term.id is not null then
  if 'homework'=any(classroom.enabled_modules) then
   select count(*)::integer into work_count from public.pilot_assignments a where a.class_id=target_class and a.term_id=term.id and not a.archived and a.blocks_shop and a.due_day<=today
    and not exists(select 1 from public.pilot_homework_checks h where h.class_id=target_class and h.assignment_id=a.id and h.student_id=target_student and h.status='completed');
  end if;
  if 'passport'=any(classroom.enabled_modules) and today>=term.start_date then
   current_week:=((least(today,term.end_date)-term.start_date+(extract(isodow from term.start_date)::integer-1))/7)+1;
   select count(*)::integer into passport_count from public.pilot_passports p cross join lateral generate_series(p.first_week,least(p.last_week,current_week)) w(week)
    where p.class_id=target_class and p.term_id=term.id and not p.archived
     and not exists(select 1 from public.pilot_passport_checks h where h.class_id=target_class and h.passport_id=p.id and h.student_id=target_student and h.week=w.week and h.completed);
  end if;
  if 'reading'=any(classroom.enabled_modules) then
   select count(*)::integer into reading_count from generate_series(date_trunc('month',term.start_date::timestamp),date_trunc('month',term.end_date::timestamp),interval '1 month') m(month)
    cross join (values('newspaper'),('reflection')) k(kind)
    where extract(month from m.month) not in (7,8) and (m.month+interval '1 month')::date<=today
     and not exists(select 1 from public.pilot_reading_checks h where h.class_id=target_class and h.term_id=term.id and h.student_id=target_student and h.kind=k.kind and h.month=m.month::date and h.status='completed');
  end if;
 end if;
 select * into rules from public.pilot_reward_rules where class_id=target_class;
 select coalesce(b.coin_net,0),coalesce(b.xp_total,0) into coins,xp from public.pilot_reward_balances b where b.class_id=target_class and b.student_id=target_student;
 coins:=coalesce(coins,0);xp:=coalesce(xp,0);
 if rules.class_id is not null then level:=pilot_private.reward_level(xp,(rules.rules->>'level_base_xp')::integer); end if;
 return jsonb_build_object('shop_open',coalesce((select s.is_open from public.pilot_shop_settings s where s.class_id=target_class),false),
  'rules_confirmed',rules.class_id is not null,'term_ready',term_ready,'homework',work_count,'passports',passport_count,'reading',reading_count,
  'learning_clear',term_ready and work_count=0 and passport_count=0 and reading_count=0,'coins',greatest(coins,0),'coin_net',coins,'xp',xp,'level',level);
end;$$;
create function public.get_pilot_shop_eligibility(target_class uuid,target_student uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare teacher uuid:=pilot_private.require_teacher();
begin
 if not exists(select 1 from public.pilot_classes where id=target_class and owner_id=teacher and deleted_at is null and 'rewards'=any(enabled_modules)) then raise exception 'Shop access denied' using errcode='42501'; end if;
 return pilot_private.shop_eligibility(target_class,target_student);
end;$$;
create function pilot_private.purchase_pilot_reward(target_class uuid,target_student uuid,target_item uuid,request_key uuid,expected_offer integer,expected_price integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare classroom public.pilot_classes%rowtype; item public.pilot_shop_items%rowtype; receipt public.pilot_purchase_receipts%rowtype;
 eligibility jsonb; reward_id uuid; ledger_id uuid; rules_version integer; shop_version integer;
begin
 select * into classroom from public.pilot_classes where id=target_class and deleted_at is null and 'rewards'=any(enabled_modules) for update;
 if not found or not exists(select 1 from public.pilot_teachers where id=classroom.owner_id and active)
  or not exists(select 1 from public.pilot_students where id=target_student and class_id=target_class and deleted_at is null) then raise exception 'Purchase access denied' using errcode='42501'; end if;
 if request_key is null or expected_offer is null or expected_offer<1 or expected_price is null or expected_price not between 0 and 10000 then raise exception 'Purchase fields required' using errcode='23514'; end if;
 select * into receipt from public.pilot_purchase_receipts where class_id=target_class and request_id=request_key;
 if found then
  if receipt.student_id<>target_student or receipt.item_id<>target_item or receipt.offer_version<>expected_offer or receipt.price_paid<>expected_price then raise exception 'Purchase request conflict' using errcode='23514'; end if;
  return receipt.reward_id;
 end if;
 if exists(select 1 from public.pilot_reward_history where class_id=target_class and request_id=request_key) or exists(select 1 from public.pilot_reward_ledger where class_id=target_class and request_id=request_key) then raise exception 'Purchase request conflict' using errcode='23514'; end if;
 eligibility:=pilot_private.shop_eligibility(target_class,target_student);
 if not (eligibility->>'shop_open')::boolean then raise exception 'Shop closed' using errcode='23514'; end if;
 if not (eligibility->>'rules_confirmed')::boolean or not (eligibility->>'learning_clear')::boolean then raise exception 'Purchase learning blocked' using errcode='23514'; end if;
 select * into item from public.pilot_shop_items where id=target_item and class_id=target_class and not archived for update;
 if not found then raise exception 'Product access denied' using errcode='42501'; end if;
 if item.offer_version<>expected_offer or item.price<>expected_price then raise exception 'Product offer changed' using errcode='23514'; end if;
 if item.stock=0 then raise exception 'Product sold out' using errcode='23514'; end if;
 if eligibility->>'level' is null or (eligibility->>'level')::integer<item.min_level then raise exception 'Level too low' using errcode='23514'; end if;
 if (eligibility->>'coins')::bigint<item.price then raise exception 'Insufficient coins' using errcode='23514'; end if;
 if (select count(*) from public.pilot_student_rewards where class_id=target_class and student_id=target_student)>=1000 then raise exception 'Backpack limit reached' using errcode='23514'; end if;
 select version into rules_version from public.pilot_reward_rules where class_id=target_class;
 select version into shop_version from public.pilot_shop_settings where class_id=target_class;
 if item.price>0 then
  insert into public.pilot_reward_ledger(class_id,student_id,request_id,coin_delta,xp_delta,reason,actor_id)
  values(target_class,target_student,request_key,-item.price,0,'兌換：'||item.name,classroom.owner_id) returning id into ledger_id;
  update public.pilot_reward_balances set coin_net=coin_net-item.price where class_id=target_class and student_id=target_student;
 end if;
 if item.stock>0 then update public.pilot_shop_items set stock=stock-1,version=version+1,updated_at=now() where id=item.id and class_id=target_class; end if;
 insert into public.pilot_student_rewards(class_id,student_id,item_id,item_name,item_icon,kind,description,source,price_paid)
 values(target_class,target_student,item.id,item.name,item.icon,item.kind,item.description,'purchase',item.price) returning id into reward_id;
 insert into public.pilot_reward_history(class_id,student_id,reward_id,request_id,action,note,actor_id,actor_kind,from_status,to_status,version)
 values(target_class,target_student,reward_id,request_key,'purchase','私有購買引擎入包',classroom.owner_id,'system',null,'available',1);
 insert into public.pilot_purchase_receipts(class_id,student_id,item_id,reward_id,request_id,offer_version,price_paid,ledger_id,stock_consumed,rule_version,shop_version)
 values(target_class,target_student,item.id,reward_id,request_key,item.offer_version,item.price,ledger_id,item.stock>0,rules_version,shop_version);
 return reward_id;
end;$$;
revoke all on function pilot_private.shop_today(),pilot_private.reward_level(bigint,integer),pilot_private.bump_shop_offer(),pilot_private.shop_eligibility(uuid,uuid),pilot_private.purchase_pilot_reward(uuid,uuid,uuid,uuid,integer,integer) from public,anon,authenticated;
revoke all on function public.configure_pilot_shop(uuid,boolean,integer),public.get_pilot_shop_eligibility(uuid,uuid) from public,anon,authenticated;
grant execute on function public.configure_pilot_shop(uuid,boolean,integer),public.get_pilot_shop_eligibility(uuid,uuid) to authenticated;
commit;
