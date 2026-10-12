import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { NextRequest } from "next/server";
import { middleware } from "../src/middleware";
import { GET } from "../src/app/api/cron/gamification-settle/route";

test("排程專用結算只呼叫護照，不呼叫舊作業結算（隔離 DB）", async () => {
  const route = readFileSync(new URL("../src/app/api/cron/gamification-settle/route.ts", import.meta.url), "utf8");
  assert.match(route, /await settleScheduledPassportOverdue\(\)/);
  assert.doesNotMatch(route, /\bsettleGamificationOverdue\b/);
  const source = ts.createSourceFile("service.ts", readFileSync(new URL("../src/services/gamificationService.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
  const fn = source.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "settleScheduledPassportOverdue");
  assert.ok(fn);
  const javascript = ts.transpileModule(fn.getText(source), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const now = new Date("2026-10-12T16:05:00Z");
  const settings = { test: true };
  let calls = 0;
  const context = {
    exports: {} as { settleScheduledPassportOverdue?: (date: Date) => Promise<unknown> },
    getGamificationSettings: async () => settings,
    settlePassportDailyOverduePenalties: async (date: Date, rules: unknown) => {
      assert.equal(date, now);
      assert.equal(rules, settings);
      calls += 1;
      return 2;
    },
    settleHomeworkPenalties: () => { throw new Error("不可補扣舊作業"); },
  };
  runInNewContext(javascript, context);
  const result = await context.exports.settleScheduledPassportOverdue!(now);
  assert.equal(JSON.stringify(result), JSON.stringify({ homeworkChanged: 0, passportChanged: 2 }));
  assert.equal(calls, 1);
});

test("排程入口不需要教師 cookie，交由 route 驗證 Bearer", async () => {
  const response = await middleware(new NextRequest("https://example.test/api/cron/gamification-settle", {
    headers: { authorization: "Bearer test-only" },
  }));
  assert.equal(response.headers.get("x-middleware-next"), "1");
});

test("其他排程與教師 API 仍受登入保護", async () => {
  for (const path of ["/api/cron/other", "/api/cron/gamification-settle/extra", "/api/settings", "/api/export"]) {
    const response = await middleware(new NextRequest(`https://example.test${path}`));
    assert.equal(response.status, 401, path);
    assert.deepEqual(await response.json(), { error: "請先以老師身分登入" });
  }
});

test("未帶密鑰、密鑰錯誤或伺服器未設定密鑰皆拒絕，不進入結算", async () => {
  const original = process.env.CRON_SECRET;
  try {
    process.env.CRON_SECRET = "audit-test-secret-not-production";
    for (const authorization of [undefined, "Bearer wrong", "Basic audit-test-secret-not-production"]) {
      const response = await GET(new Request("https://example.test/api/cron/gamification-settle", {
        headers: authorization ? { authorization } : {},
      }));
      assert.equal(response.status, 401);
      assert.deepEqual(await response.json(), { error: "Unauthorized" });
    }
    delete process.env.CRON_SECRET;
    const response = await GET(new Request("https://example.test/api/cron/gamification-settle", {
      headers: { authorization: "Bearer undefined" },
    }));
    assert.equal(response.status, 401);
  } finally {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  }
});
