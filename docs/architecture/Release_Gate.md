# Release Gate — Teacher Workspace

**Version aspirational:** post-display MVP  
**Date:** 2026-07-30  
**Framework:** Architecture Review v1.0

---

## Checklist

- [ ] **功能完整性**：符合 PRD/TDD（含聯絡簿雙日期、教室大屏三面板、座號自助開關）
- [ ] **架構健康度**：未在未批准下新增 God Component／重複邏輯；Inventory 已更新
- [ ] **資料一致性**：migration `0003` 已上目標 DB；schema／API／docs 一致
- [ ] **UI/UX**：老師端主流程與 `/display` 可操作；無明顯退步
- [ ] **安全性**：符合**當前**威脅模型（自用）；若已公網 → 見 Proposal P1/P2
- [ ] **效能**：大屏輪詢可接受；無明顯卡頓
- [ ] **文件同步**：README／PRD／DATABASE／`docs/architecture/*` 已對齊

---

## Open「立即」items（from Proposal）

| ID | Item | Status |
|----|------|--------|
| P1 | 部署暴露面防護 | OPEN |
| P2 | Supabase RLS | OPEN |
| P3 | 拆 DisplayPageClient | OPEN |
| P8 | seat_number unique | OPEN |

---

## Decision

**FAIL（預設）** — 仍有未關閉的「立即」項。

可選：

- `PASS WITH WAIVER`：僅自用、URL 不外流，明確豁免 P1/P2，並接受風險。  
- External Review 批准並完成重構後改 `PASS`。

**Waiver reason（若有）：**

```text

```

**Signed off by:**
