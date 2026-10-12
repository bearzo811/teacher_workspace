import { test } from "node:test";
import assert from "node:assert/strict";
import { orderDebts } from "../src/lib/debtOrder";

const items = ["oldHomework", "newHomework", "passport", "reading"].map((key) => ({ key, label: key }));
test("未設定排序保留分類順序", () => {
  assert.deepEqual(orderDebts(items, []).map((x) => x.key), items.map((x) => x.key));
});
test("預設作業依繳交日由新到舊，同日保留順序，護照與閱讀在後", () => {
  const rows = [
    { key: "homework:old", label: "舊", dueDate: "2026-09-30" },
    { key: "homework:new", label: "新", dueDate: "2026-10-12" },
    { key: "homework:same", label: "同日", dueDate: "2026-10-12" },
    { key: "chinese:W3", label: "護照" },
    { key: "reflection:9", label: "閱讀" },
  ];
  assert.deepEqual(orderDebts(rows, []).map((x) => x.key), ["homework:new", "homework:same", "homework:old", "chinese:W3", "reflection:9"]);
  assert.deepEqual(orderDebts(rows, ["homework:old", "homework:new"]).slice(0, 2).map((x) => x.key), ["homework:old", "homework:new"]);
});
test("個別學生可將閱讀置頂，不改動原始清單", () => {
  assert.equal(orderDebts(items, ["reading"])[0].key, "reading");
  assert.equal(orderDebts(items, [])[0].key, "oldHomework");
});
test("完成項目消失後接續下一項，新項目依預設順序附加", () => {
  const saved = ["completed", "passport", "oldHomework"];
  assert.deepEqual(orderDebts(items, saved).map((x) => x.key), ["passport", "oldHomework", "newHomework", "reading"]);
});
