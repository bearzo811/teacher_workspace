import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { test } from "node:test";

test("open Google registration retains ownership, one-class and 15-student database boundaries", async () => {
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
        'select nullif(current_setting(''test.uid'', true), '''')::uuid';
      create function auth.jwt() returns jsonb language sql as
        'select coalesce(nullif(current_setting(''test.jwt'', true), ''''), ''{}'')::jsonb';
      grant usage on schema auth to authenticated;
      insert into auth.users values ('${a}',now()),('${b}',now());
      insert into auth.identities values ('${a}','google'),('${b}','google');
    `);
    await db.exec(await readFile(new URL("../supabase/migrations/0001_registration.sql", import.meta.url), "utf8"));
    async function login(id: string, provider = "google") {
      await db.exec("reset role");
      await db.query("select set_config('test.uid',$1,false),set_config('test.jwt',$2,false)", [id, JSON.stringify({ app_metadata: { provider } })]);
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
    const ca = await create("A班");
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
    const cb = await create("B班");
    await add(cb,1);
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
  } finally { await db.close(); }
});
