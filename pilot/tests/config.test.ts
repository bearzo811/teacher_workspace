import assert from "node:assert/strict";
import { test } from "node:test";
import { validatePilotConfig, PILOT_SUPABASE_URL, PILOT_SITE_URL, PILOT_COOKIE_NAME } from "../lib/config";

const valid = { PILOT_SUPABASE_URL, PILOT_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_" + "x".repeat(40) };
test("only the independent pilot project is accepted", () => {
  assert.equal(validatePilotConfig(valid).url, PILOT_SUPABASE_URL);
  for (const url of [undefined, "https://legacy.supabase.co", "http://yqogdgvkeghyuibydqhw.supabase.co", PILOT_SUPABASE_URL + "/", PILOT_SUPABASE_URL + ".evil.test"]) {
    assert.throws(() => validatePilotConfig({ ...valid, PILOT_SUPABASE_URL: url }));
  }
});
test("missing, secret and service role keys fail closed", () => {
  for (const key of [undefined, "", "sb_secret_" + "x".repeat(40), "eyJ.service-role", "sb_publishable_x"]) {
    assert.throws(() => validatePilotConfig({ ...valid, PILOT_SUPABASE_PUBLISHABLE_KEY: key }));
  }
});
test("legacy configuration is never a fallback", () => {
  assert.throws(() => validatePilotConfig({ DATABASE_URL: "postgres://legacy", NEXT_PUBLIC_SUPABASE_URL: PILOT_SUPABASE_URL }));
  assert.equal(PILOT_SITE_URL, "https://teacher-workspace-pilot.vercel.app");
  assert.equal(PILOT_COOKIE_NAME, "teacher-pilot-auth");
});
