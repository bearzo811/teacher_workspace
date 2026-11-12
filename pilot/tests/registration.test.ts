import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { test } from "node:test";

for (const management of [false, true]) test(`Google registration boundaries (roster management ${management ? "enabled" : "disabled"})`, async () => {
  const db = new PGlite();
  const a = "00000000-0000-0000-0000-000000000001";
  const b = "00000000-0000-0000-0000-000000000002";
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key, email_confirmed_at timestamptz);
      create table auth.identities(user_id uuid, provider text);
      create function auth.uid() returns uuid language sql as
        'select (nullif(current_setting(''request.jwt.claims'', true), '''')::jsonb->>''sub'')::uuid';
      create function auth.jwt() returns jsonb language sql as
        'select coalesce(nullif(current_setting(''request.jwt.claims'', true), ''''), ''{}'')::jsonb';
      grant usage on schema auth to authenticated;
      insert into auth.users values ('${a}',now()),('${b}',now());
      insert into auth.identities values ('${a}','google'),('${b}','google');
    `);
    await db.exec(await readFile(new URL("../supabase/migrations/0001_registration.sql", import.meta.url), "utf8"));
    if (management) await db.exec(await readFile(new URL("../supabase/migrations/0002_roster_management.sql", import.meta.url), "utf8"));
    async function login(id: string, provider = "google") {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: id, app_metadata: { provider } })]);
      await db.exec("set role authenticated");
    }
    async function register() { return (await db.query<{ ok: boolean }>("select public.register_pilot_teacher() as ok")).rows[0].ok; }
    async function create(name: string) { return (await db.query<{ id: string }>("select public.create_pilot_class($1) as id", [name])).rows[0].id; }
    async function add(classId: string, seat: number) { return db.query("select public.add_pilot_student($1,$2,$3)", [classId, seat, `測試學生${seat}`]); }
    await db.exec("set role anon");
    await assert.rejects(register(), /permission denied/);
    await assert.rejects(db.query("select * from public.pilot_classes"), /permission denied/);
    await login(a, "email");
    assert.equal(await register(), false);
    await assert.rejects(create("未註冊"), /access denied/);
    await login(a);
    await db.exec("reset role; update auth.users set email_confirmed_at=null");
    await login(a);
    assert.equal(await register(), false);
    await db.exec("reset role; update auth.users set email_confirmed_at=now(); delete from auth.identities");
    await login(a);
    assert.equal(await register(), false);
    await db.exec(`reset role; insert into auth.identities values ('${a}','google'),('${b}','google')`);
    await login(a);
    assert.equal(await register(), true, "no invitation required");
    assert.equal(await register(), true, "idempotent registration");
    const ca = await create("開發驗收測試班（虛構）");
    await assert.rejects(create("重複班級"), /unique constraint/);
    await assert.rejects(db.query("insert into public.pilot_classes(owner_id,name) values ($1,'繞過')", [a]), /permission denied/);
    for (let seat = 1; seat <= 15; seat++) await add(ca, seat);
    await assert.rejects(add(ca,16), /Student limit/);
    assert.equal((await db.query("select * from public.pilot_students")).rows.length, 15);
    await login(a,"email");
    assert.equal((await db.query("select * from public.pilot_classes")).rows.length,0);
    assert.equal((await db.query("select * from public.pilot_students")).rows.length,0);
    await login(b);
    assert.equal(await register(), true);
    assert.equal((await db.query("select * from public.pilot_teachers")).rows.length, 1);
    assert.equal((await db.query("select * from public.pilot_classes")).rows.length, 0);
    assert.equal((await db.query("select * from public.pilot_students")).rows.length, 0);
    await assert.rejects(add(ca,1), /access denied/);
    const cb = await create("隔離驗收 B 班（虛構）");
    const bStudent = (await add(cb,1)).rows[0].add_pilot_student;
    await db.exec("reset role");
    const rollbackTest = await db.exec(await readFile(new URL("../supabase/tests/cloud-isolation.sql", import.meta.url), "utf8"));
    assert.match(JSON.stringify(rollbackTest.at(-1)?.rows), /PASS:/);
    await login(b);
    assert.equal((await db.query("select * from public.pilot_students")).rows.length,1,"cloud test rolls all temporary writes back");
    await assert.rejects(add(cb,1), /unique constraint/);
    await assert.rejects(add(cb,0), /check constraint/);
    await assert.rejects(db.query("update public.pilot_teachers set active=true"), /permission denied/);
    await db.exec(`reset role; update public.pilot_teachers set active=false where id='${b}'`);
    await login(b);
    assert.equal(await register(), false, "re-register cannot reactivate suspended teacher");
    assert.equal((await db.query("select * from public.pilot_classes")).rows.length,0);
    assert.equal((await db.query("select * from public.pilot_students")).rows.length,0);
    await assert.rejects(add(cb,2), /access denied/);
    await login(a);
    assert.equal((await db.query("select * from public.pilot_students")).rows.length,15);
    if (!management) return;
    for (const sql of ["select public.update_pilot_student($1,90,'跨班')", "select public.archive_pilot_student($1)", "select public.restore_pilot_student($1)"]) {
      await assert.rejects(db.query(sql,[bStudent]),/access denied/);
    }
    await assert.rejects(db.query("select public.rename_pilot_class($1,'跨班')",[cb]),/access denied/);
    await db.query("select public.rename_pilot_class($1,'改名測試')",[ca]);
    assert.equal((await db.query<{name:string}>("select name from public.pilot_classes")).rows[0].name,"改名測試");
    const aStudent = (await db.query<{id:string}>("select id from public.pilot_students where seat=1")).rows[0].id;
    await assert.rejects(db.query("select public.update_pilot_student($1,2,'重複座號')",[aStudent]),/unique constraint/);
    await db.query("select public.update_pilot_student($1,17,'修改後的學生')",[aStudent]);
    await db.query("select public.archive_pilot_student($1)",[aStudent]);
    assert.equal((await db.query("select * from public.pilot_students where deleted_at is null")).rows.length,14);
    assert.equal((await db.query("select * from public.pilot_students where deleted_at is not null")).rows.length,1,"owner can see their recovery list");
    const replacement = (await add(ca,17)).rows[0].add_pilot_student;
    await assert.rejects(db.query("select public.restore_pilot_student($1)",[aStudent]),/Student limit/);
    const spare = (await db.query<{id:string}>("select id from public.pilot_students where seat=2")).rows[0].id;
    await db.query("select public.archive_pilot_student($1)",[spare]);
    await assert.rejects(db.query("select public.restore_pilot_student($1)",[aStudent]),/unique constraint/);
    await db.query("select public.archive_pilot_student($1)",[replacement]);
    await db.query("select public.restore_pilot_student($1)",[aStudent]);
    await db.query("select public.restore_pilot_student($1)",[spare]);
    assert.equal((await db.query("select * from public.pilot_students where deleted_at is null")).rows.length,15);
    await login(b);
    assert.equal((await db.query("select * from public.pilot_students")).rows.length,0,"suspended teacher cannot see A recovery records");
    await assert.rejects(db.query("select public.restore_pilot_student($1)",[bStudent]),/access denied/);
    await db.exec(`reset role; update public.pilot_teachers set active=true where id='${b}'`);
    await login(b);
    assert.equal((await db.query("select * from public.pilot_students")).rows.length,1,"active B cannot see A active or archived students");
    await assert.rejects(db.query("select public.restore_pilot_student($1)",[aStudent]),/access denied/);
    await db.exec("reset role");
    await db.exec(await readFile(new URL("../supabase/migrations/0003_class_modules.sql", import.meta.url), "utf8"));
    await login(b);
    const beforeModules = (await db.query<{enabled_modules:string[];modules_configured_at:string|null}>("select enabled_modules,modules_configured_at from public.pilot_classes")).rows[0];
    assert.deepEqual(beforeModules.enabled_modules, []);
    assert.equal(beforeModules.modules_configured_at, null);
    await assert.rejects(db.query("select public.configure_pilot_modules($1,array['passport'])",[ca]),/access denied/);
    await assert.rejects(db.query("select public.configure_pilot_modules($1,array['unknown'])",[cb]),/check constraint/);
    await assert.rejects(db.query("select public.configure_pilot_modules($1,null)",[cb]),/Modules required/);
    await db.query("select public.configure_pilot_modules($1,array['homework','reading'])",[cb]);
    assert.deepEqual((await db.query<{enabled_modules:string[]}>("select enabled_modules from public.pilot_classes")).rows[0].enabled_modules,["homework","reading"]);
    await db.query("select public.configure_pilot_modules($1,array[]::text[])",[cb]);
    assert.equal((await db.query("select * from public.pilot_students")).rows.length,1,"disabling modules preserves roster");
    await assert.rejects(db.query("update public.pilot_classes set enabled_modules=array['passport']"),/permission denied/);
    await db.exec("reset role; set role anon");
    await assert.rejects(db.query("select public.configure_pilot_modules($1,array[]::text[])",[cb]),/permission denied/);
    await assert.rejects(db.query("select public.create_pilot_class_with_modules('匿名',array[]::text[])"),/permission denied/);
    await db.exec(`reset role; update public.pilot_teachers set active=false where id='${b}'`);
    await login(b);
    await assert.rejects(db.query("select public.configure_pilot_modules($1,array[]::text[])",[cb]),/access denied/);
    // A fresh teacher's class and selected modules are committed atomically.
    const c = "00000000-0000-0000-0000-000000000003";
    await db.exec(`reset role; insert into auth.users values ('${c}',now()); insert into auth.identities values ('${c}','google')`);
    await login(c);
    assert.equal(await register(),true);
    await assert.rejects(db.query("select public.create_pilot_class_with_modules('無效模組',array['unknown'])"),/check constraint/);
    assert.equal((await db.query("select * from public.pilot_classes")).rows.length,0,"failed setup leaves no partial class");
    await db.query("select public.create_pilot_class_with_modules('新老師測試班',array['routines'])");
    assert.deepEqual((await db.query<{enabled_modules:string[]}>("select enabled_modules from public.pilot_classes")).rows[0].enabled_modules,["routines"]);
    await assert.rejects(db.query("select public.create_pilot_class_with_modules('第二班',array[]::text[])"),/unique constraint/);
    await db.exec("reset role");
    await db.exec(await readFile(new URL("../supabase/migrations/0004_academic_calendar.sql",import.meta.url),"utf8"));
    await login(a);
    const ta=(await db.query<{id:string}>("select public.create_pilot_term($1,'上學期','2026-09-01','2027-01-22') as id",[ca])).rows[0].id;
    const ta2=(await db.query<{id:string}>("select public.create_pilot_term($1,'下學期','2027-02-15','2027-06-30') as id",[ca])).rows[0].id;
    assert.equal((await db.query("select * from public.pilot_terms where active")).rows.length,1);
    await db.query("select public.activate_pilot_term($1)",[ta2]);
    assert.equal((await db.query<{id:string}>("select id from public.pilot_terms where active")).rows[0].id,ta2);
    await assert.rejects(db.query("select public.create_pilot_term($1,'錯誤','2027-06-30','2027-02-15')",[ca]),/check constraint/);
    await assert.rejects(db.query("select public.create_pilot_term($1,'過長','2026-01-01','2028-01-01')",[ca]),/check constraint/);
    await db.query("select public.set_pilot_day($1,'2026-09-05',true,'補課')",[ta]);
    await assert.rejects(db.query("select public.set_pilot_day($1,'2026-08-28',true,'學期外')",[ta]),/outside term/);
    await assert.rejects(db.query("select public.update_pilot_term($1,'縮短','2026-09-07','2027-01-22')",[ta]),/outside term/);
    await login(c);
    assert.equal((await db.query("select * from public.pilot_terms")).rows.length,0);
    assert.equal((await db.query("select * from public.pilot_day_overrides")).rows.length,0);
    for (const sql of ["select public.activate_pilot_term($1)","select public.set_pilot_day($1,'2026-09-05',false,'跨班')","select public.update_pilot_term($1,'跨班','2026-09-01','2027-01-22')"]) {
      await assert.rejects(db.query(sql,[ta]),/access denied/);
    }
    await assert.rejects(db.query("select public.create_pilot_term($1,'跨班','2026-09-01','2027-01-22')",[ca]),/access denied/);
    await assert.rejects(db.query("insert into public.pilot_terms(class_id,name,start_date,end_date) values ($1,'繞過','2026-09-01','2027-01-22')",[ca]),/permission denied/);
    await login(a);
    await db.query("select public.set_pilot_day($1,'2026-09-05',null,'')",[ta]);
    assert.equal((await db.query("select * from public.pilot_day_overrides")).rows.length,0);
    await db.query("select public.update_pilot_term($1,'任意日期','2026-09-02','2027-01-20')",[ta]);
    assert.equal((await db.query("select * from public.pilot_terms")).rows.length,2,"switching and editing preserves terms");
    await login(b);
    await assert.rejects(db.query("select public.create_pilot_term($1,'停用','2026-09-01','2027-01-22')",[cb]),/access denied/);
    await db.exec("reset role; set role anon");
    await assert.rejects(db.query("select * from public.pilot_terms"),/permission denied/);
    await assert.rejects(db.query("select public.activate_pilot_term($1)",[ta]),/permission denied/);
  } finally { await db.close(); }
});
