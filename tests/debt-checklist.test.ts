import assert from "node:assert/strict";
import test from "node:test";
import { prepareDebtChecklist, type DebtChecklistItem } from "../src/lib/debtChecklist";

const items: DebtChecklistItem[] = [
  { key: "homework:old", label: "國習 1-2", category: "作業", status: "unsubmitted", dueDate: "2026-09-02", contactBookDate: "2026-09-01" },
  { key: "homework:correction", label: "數習 3-4", category: "作業", status: "correction_required", dueDate: "2026-09-04" },
  { key: "homework:pending", label: "英習", category: "作業", status: "pending_confirmation" },
  { key: "homework:done", label: "國作", category: "作業", status: "completed" },
  { key: "chinese:W3", label: "國語護照 W3", category: "護照" },
  { key: "reflection:9", label: "閱讀心得 9月", category: "閱讀／讀報" },
];

test("列印僅包含需要學生處理的所有項目，保留聯絡簿日期與訂正狀態", () => {
  const result = prepareDebtChecklist(items, []);
  assert.deepEqual(result.map((item) => item.key), ["homework:correction", "homework:old", "chinese:W3", "reflection:9"]);
  assert.equal(result[1].contactBookDate, "2026-09-01");
  assert.equal(result[0].status, "correction_required");
  assert.equal(items.length, 6);
});
test("尊重個別排序，已刪除的排序鍵不會復活為欠繳項目", () => {
  assert.deepEqual(prepareDebtChecklist(items, ["deleted", "reflection:9", "homework:pending"]).map((item) => item.key),
    ["reflection:9", "homework:correction", "homework:old", "chinese:W3"]);
});
test("無欠繳時清單為空", () => {
  assert.deepEqual(prepareDebtChecklist(items.filter((item) => ["completed", "pending_confirmation"].includes(item.status ?? "")), []), []);
});
