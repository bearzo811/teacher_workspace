import { test } from "node:test";
import assert from "node:assert/strict";
import { orderDebts } from "../src/lib/debtOrder";

const items = ["oldHomework", "newHomework", "passport", "reading"].map((key) => ({ key, label: key }));
test("未設定排序保留預設舊作業、護照、閱讀順序", () => {
  assert.deepEqual(orderDebts(items, []).map((x) => x.key), items.map((x) => x.key));
});
test("個別學生可將閱讀置頂，不改動原始清單", () => {
  assert.equal(orderDebts(items, ["reading"])[0].key, "reading");
  assert.equal(orderDebts(items, [])[0].key, "oldHomework");
});
test("完成項目消失後接續下一項，新項目依預設順序附加", () => {
  const saved = ["completed", "passport", "oldHomework"];
  assert.deepEqual(orderDebts(items, saved).map((x) => x.key), ["passport", "oldHomework", "newHomework", "reading"]);
});
