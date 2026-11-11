import assert from "node:assert/strict";
import test from "node:test";
import { DISPLAY_PANEL_ORDER, isDisplayHiddenPanels, resolveDisplayPanel, visibleDisplayPanels } from "../src/lib/displayPanels";

test("舊設定預設顯示全部六個分頁，保留原有順序", () => {
  assert.deepEqual(visibleDisplayPanels(), [...DISPLAY_PANEL_ORDER]);
});
test("隱藏分頁不出現在導覽與輪播順序；目前分頁隱藏時切換到第一個開放分頁", () => {
  const visible = visibleDisplayPanels(["today", "lunch"]);
  assert.deepEqual(visible, ["passport", "student", "debts", "calendar"]);
  assert.equal(resolveDisplayPanel("today", visible), "passport");
  assert.equal(resolveDisplayPanel("calendar", visible), "calendar");
});
test("只開一頁與全部隱藏都有明確結果，重新開放後可恢復", () => {
  const onlyCalendar = visibleDisplayPanels(DISPLAY_PANEL_ORDER.filter((key) => key !== "calendar"));
  assert.equal(resolveDisplayPanel("today", onlyCalendar), "calendar");
  assert.equal(resolveDisplayPanel("today", visibleDisplayPanels([...DISPLAY_PANEL_ORDER])), null);
  assert.equal(resolveDisplayPanel("today", visibleDisplayPanels([])), "today");
});
test("API 拒絕未知分頁、重複鍵值及非陣列設定", () => {
  for (const value of [null, "today", {}, ["unknown"], ["today", "today"], [true]]) assert.equal(isDisplayHiddenPanels(value), false);
  assert.equal(isDisplayHiddenPanels([]), true);
  assert.equal(isDisplayHiddenPanels([...DISPLAY_PANEL_ORDER]), true);
});
