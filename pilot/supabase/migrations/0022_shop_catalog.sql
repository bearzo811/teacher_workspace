-- Teacher catalog only. No purchase, balance, inventory consumption or backpack API.
begin;
create table public.pilot_shop_items (
 id uuid primary key default gen_random_uuid(),class_id uuid not null references public.pilot_classes(id),
 create_request_id uuid not null,name text not null check(char_length(btrim(name)) between 1 and 80),
 icon text not null check(char_length(btrim(icon)) between 1 and 20),
 kind text not null check(kind in ('physical','privilege')),description text not null default '' check(char_length(description)<=1000),
 price integer not null check(price between 0 and 10000),min_level integer not null check(min_level between 1 and 1000),
 stock integer not null check(stock between -1 and 100000),archived boolean not null default false,
 version integer not null default 1 check(version between 1 and 1000000),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(class_id,id),unique(class_id,create_request_id)
);
create unique index pilot_shop_active_name on public.pilot_shop_items(class_id,lower(btrim(name))) where not archived;
alter table public.pilot_shop_items enable row level security;
revoke all on public.pilot_shop_items from public,anon,authenticated;
grant select on public.pilot_shop_items to authenticated;
create policy shop_catalog_owner on public.pilot_shop_items for select to authenticated using(exists(select 1 from public.pilot_classes c where c.id=class_id and 'rewards'=any(c.enabled_modules)));
create function public.save_pilot_shop_item(target_class uuid,target_item uuid,request_key uuid,expected_version integer,product_name text,product_icon text,product_kind text,product_description text,product_price integer,product_min_level integer,product_stock integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare teacher uuid:=pilot_private.require_teacher(); existing public.pilot_shop_items%rowtype; result uuid;
begin
 perform 1 from public.pilot_classes where id=target_class and owner_id=teacher and deleted_at is null and 'rewards'=any(enabled_modules) for update;
 if not found then raise exception 'Shop catalog access denied' using errcode='42501'; end if;
 if request_key is null or expected_version is null or product_name is null or product_icon is null or product_kind is null or product_description is null or product_price is null or product_min_level is null or product_stock is null then
  raise exception 'Product fields required' using errcode='23514';
 end if;
 if target_item is null then
  select * into existing from public.pilot_shop_items where class_id=target_class and create_request_id=request_key;
 else
  select * into existing from public.pilot_shop_items where class_id=target_class and id=target_item;
  if not found or existing.archived then raise exception 'Product access denied' using errcode='42501'; end if;
 end if;
 if existing.id is not null and not existing.archived and existing.name=btrim(product_name) and existing.icon=btrim(product_icon) and existing.kind=product_kind and existing.description=btrim(product_description) and existing.price=product_price and existing.min_level=product_min_level and existing.stock=product_stock then return existing.id; end if;
 if target_item is null then
  if existing.id is not null then raise exception 'Product request conflict' using errcode='23514'; end if;
  if expected_version<>0 then raise exception 'Product version changed' using errcode='23514'; end if;
  if (select count(*) from public.pilot_shop_items where class_id=target_class)>=200 then raise exception 'Catalog limit reached' using errcode='23514'; end if;
  insert into public.pilot_shop_items(class_id,create_request_id,name,icon,kind,description,price,min_level,stock)
  values(target_class,request_key,btrim(product_name),btrim(product_icon),product_kind,btrim(product_description),product_price,product_min_level,product_stock) returning id into result;
 else
  if existing.version<>expected_version then raise exception 'Product version changed' using errcode='23514'; end if;
  update public.pilot_shop_items set name=btrim(product_name),icon=btrim(product_icon),kind=product_kind,description=btrim(product_description),price=product_price,min_level=product_min_level,stock=product_stock,version=version+1,updated_at=now()
   where id=target_item and class_id=target_class returning id into result;
 end if;
 return result;
end;$$;
create function public.archive_pilot_shop_item(target_class uuid,target_item uuid,stop_using boolean,expected_version integer) returns void
language plpgsql security definer set search_path='' as $$
declare teacher uuid:=pilot_private.require_teacher(); existing public.pilot_shop_items%rowtype;
begin
 perform 1 from public.pilot_classes where id=target_class and owner_id=teacher and deleted_at is null and 'rewards'=any(enabled_modules) for update;
 if not found then raise exception 'Shop catalog access denied' using errcode='42501'; end if;
 select * into existing from public.pilot_shop_items where id=target_item and class_id=target_class;
 if not found or stop_using is null or expected_version is null then raise exception 'Product access denied' using errcode='42501'; end if;
 if existing.archived=stop_using then return; end if;
 if existing.version<>expected_version then raise exception 'Product version changed' using errcode='23514'; end if;
 update public.pilot_shop_items set archived=stop_using,version=version+1,updated_at=now() where id=target_item and class_id=target_class;
end;$$;
revoke all on function public.save_pilot_shop_item(uuid,uuid,uuid,integer,text,text,text,text,integer,integer,integer),public.archive_pilot_shop_item(uuid,uuid,boolean,integer) from public,anon,authenticated;
grant execute on function public.save_pilot_shop_item(uuid,uuid,uuid,integer,text,text,text,text,integer,integer,integer),public.archive_pilot_shop_item(uuid,uuid,boolean,integer) to authenticated;
commit;
