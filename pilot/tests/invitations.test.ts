import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { test } from "node:test";

test("invitation migration enforces roles, verified Google identity and invitation lifecycle", async () => {
  const db = new PGlite();
  try {
    // Supabase auth contract stubs, not an OAuth end-to-end test.
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
      create table auth.identities(user_id uuid, provider text);
      create function auth.uid() returns uuid language sql as
        'select nullif(current_setting(''test.uid'', true), '''')::uuid';
      create function auth.jwt() returns jsonb language sql as
        'select coalesce(nullif(current_setting(''test.jwt'', true), ''''), ''{}'')::jsonb';
      insert into auth.users values ('00000000-0000-0000-0000-000000000001','test@example.test',now());
      insert into auth.identities values ('00000000-0000-0000-0000-000000000001','google');
    `);
    await db.exec(await readFile(new URL("../supabase/migrations/0001_invitation_gate.sql", import.meta.url), "utf8"));
    const uid = "00000000-0000-0000-0000-000000000001";
    async function login(provider = "google", user = uid) {
      await db.query("select set_config('test.uid', $1, false), set_config('test.jwt', $2, false)",
        [user, JSON.stringify({ app_metadata: { provider } })]);
      await db.exec("set role authenticated");
    }
    async function accept() {
      const { rows } = await db.query<{ allowed: boolean }>("select public.accept_pilot_invitation() as allowed");
      return rows[0].allowed;
    }
    await db.exec("set role anon");
    await assert.rejects(accept(), /permission denied/);
    await db.exec("reset role");
    await login();
    await assert.rejects(db.query("select * from pilot_private.invitations"), /permission denied/);
    assert.equal(await accept(), false, "not invited");
    await db.exec("reset role");
    await db.exec("insert into pilot_private.invitations(email, expires_at) values ('test@example.test', now() - interval '1 day')");
    await login();
    assert.equal(await accept(), false, "expired");
    await db.exec("reset role; update pilot_private.invitations set expires_at = now() + interval '7 days'");
    await login("email");
    assert.equal(await accept(), false, "non-Google provider");
    await db.exec("reset role; update auth.users set email_confirmed_at = null");
    await login();
    assert.equal(await accept(), false, "unverified email");
    await db.exec("reset role; update auth.users set email_confirmed_at = now(); delete from auth.identities");
    await login();
    assert.equal(await accept(), false, "missing Google identity");
    await db.exec(`reset role; insert into auth.identities values ('${uid}', 'google')`);
    await login();
    assert.equal(await accept(), true, "valid invitation");
    assert.equal(await accept(), true, "repeat login is idempotent");
    await db.exec("reset role; update pilot_private.invitations set expires_at = now() - interval '1 day'");
    await login();
    assert.equal(await accept(), true, "acceptance expiry does not end accepted access");
    await db.exec(`reset role;
      insert into auth.users values ('00000000-0000-0000-0000-000000000002', 'test@example.test', now());
      insert into auth.identities values ('00000000-0000-0000-0000-000000000002', 'google');`);
    await login("google", "00000000-0000-0000-0000-000000000002");
    assert.equal(await accept(), false, "same email cannot steal accepted invitation");
    await db.exec("reset role; update pilot_private.invitations set revoked_at = now()");
    await login();
    assert.equal(await accept(), false, "revocation takes effect after acceptance");
    await db.exec("reset role");
    const result = await db.query<{ accepted_user_id: string }>("select accepted_user_id from pilot_private.invitations");
    assert.equal(result.rows[0].accepted_user_id, uid);
  } finally { await db.close(); }
});
