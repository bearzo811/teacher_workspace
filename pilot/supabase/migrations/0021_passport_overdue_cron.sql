-- CLOUD ONLY, after separate explicit authorization. PGlite has no pg_cron.
-- Fixed daily UTC 16:05 = Asia/Taipei 00:05; no external HTTP or secret keys.
begin;
create extension if not exists pg_cron with schema pg_catalog;
do $$begin
 if coalesce(current_setting('cron.timezone',true),'GMT') not in ('GMT','UTC','Etc/UTC') then
  raise exception 'Expected UTC cron timezone; no job created';
 end if;
 if exists(select 1 from cron.job where jobname='teacher-pilot-passport-overdue-v1'
  and (command<>'select pilot_private.run_passport_overdue();' or username<>current_user)) then
  raise exception 'Existing cron job differs; refusing to overwrite';
 end if;
end;$$;
select cron.schedule('teacher-pilot-passport-overdue-v1','5 16 * * *','select pilot_private.run_passport_overdue();');
commit;
