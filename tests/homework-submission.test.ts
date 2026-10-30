import { test } from "node:test";
import assert from "node:assert/strict";
import { unsubmittedTitles } from "../src/lib/homeworkSubmission";

test("只有未交列入缺交；待確認、未訂正及完成皆視為已交", () => {
  assert.deepEqual(unsubmittedTitles([
    { title: "數習", status: "unsubmitted" },
    { title: "國習", status: "pending_confirmation" },
    { title: "數卷", status: "correction_required" },
    { title: "國卷", status: "completed" },
  ]), ["數習"]);
});
test("沒有作業不產生缺交項目", () => {
  assert.deepEqual(unsubmittedTitles([]), []);
});
