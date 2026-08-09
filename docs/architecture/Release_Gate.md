# Release Gate — Student Gamification MVP

Date: 2026-08-09

- [x] Owner approved proposals G1–G6.
- [x] TypeScript production build passes.
- [x] ESLint passes.
- [x] Gamification pure tests pass (4/4).
- [x] Drizzle migration journal check passes.
- [x] No database password or connection string appears in tracked source.
- [x] Owner approved the additive migration after backup/risk confirmation.
- [x] Migration `0013_student_gamification` applied.
- [x] Production `CRON_SECRET` configured; unauthenticated cron request returns 401.
- [x] Settlement service smoke test returns zero historical backfill changes.
- [x] Temporary-student integration test proves duplicate completion is idempotent and cancellation reverses XP.
- [x] Student detail, Settings and display API/UI smoke tests pass on migrated DB.
- [x] Production deployment verified at `teacher-workspace-five.vercel.app`.

**Gate: PASS**

# Lite Gate — Passport / reading sidebar

Date: 2026-08-09

- [x]「護照與閱讀」remains one bottom navigation entry.
- [x] Internal sidebar switches between full-size passport and reading views.
- [x] Sidebar controls are bottom-aligned beside the bottom navigation.
- [x] Full-class and seat-selected modes both preserve their original layouts and controls.
- [x] ESLint, production build, both sidebar views, and selected-seat browser smoke pass.
- [x] Production deployment and browser smoke pass.

**Gate: PASS**

---

# Lite Gate — Combined display progress page

Date: 2026-08-09

- [x] Passport and reading overview matrices render on one display page.
- [x] Seat-selected passport and reading controls remain available on the same page.
- [x] Display label changed from「學生養成」to「個人點數」.
- [x] Navigation reduced from seven to six panels.
- [x] ESLint, production build, overview browser smoke, and selected-seat browser smoke pass.
- [x] Production deployment and browser smoke pass.

**Gate: PASS**

---

# Lite Gate — Student detail / Gamification overview

Date: 2026-08-09

- [x] Student detail passport and homework reads are consolidated.
- [x] Gamification detail reads execute in one round.
- [x] Serverless DB pool default is one connection per instance.
- [x] Display has a separate seat-ordered page for all students' Level, XP, and coins.
- [x] New display page reuses the existing batch payload; no N+1 query added.
- [x] ESLint and production build pass.
- [x] Local DB smoke: student detail completes in 1.46s including script startup.
- [x] Browser smoke: all nine student cards and the seven-page navigation render correctly.
- [x] Production deployment and browser smoke pass.
- [x] Production student detail API: 0.49–0.70s (previously timed out beyond 20s).
- [x] Production display API: 0.66–1.83s including cold request.

**Gate: PASS**

---

# Historical Gate — Display DB Performance

Date: 2026-08-09

- [x] Production build passes.
- [x] Production deployment ready and aliased to `teacher-workspace-five.vercel.app`.
- [x] `/api/display` returns HTTP 200.
- [x] `/api/settings` returns HTTP 200.
- [x] 首頁作業進度使用所選聯絡簿的繳交日，不再固定使用系統今天。
- [x] Display API measured at 0.29–0.84s after deployment (previously ~9.6s).
- [x] Settings API measured at 0.16–0.93s after deployment.
- [x] At that checkpoint, no schema migration or destructive data operation.
- [x] No open immediate-release blocker.

**Gate: PASS**

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

| ID  | Item                 | Status |
| --- | -------------------- | ------ |
| P1  | 部署暴露面防護       | OPEN   |
| P2  | Supabase RLS         | OPEN   |
| P3  | 拆 DisplayPageClient | OPEN   |
| P8  | seat_number unique   | OPEN   |

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
