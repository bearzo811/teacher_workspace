# Release Gate — Teacher Workspace／開學準備

日期：2026-08-30

模式：Full

範圍：目前教師工作台與教室大屏，針對單班新學期啟用。

## Checklist

- [x] 教師端與大屏的核心開學流程已存在。
- [x] `npm run lint` 通過（2026-08-30）。
- [x] `npm run test:gamification` 通過（6/6，2026-08-30）。
- [x] TypeScript／production build 在近期大屏更新時通過。
- [x] 學期、行事曆、返校日、名冊、出缺席、聯絡簿、作業、值日、護照／閱讀、欠繳、商店／背包均有資料模型與 UI。
- [ ] P1：大屏公開寫入風險已降低至可接受。
- [ ] P2：完成開學前檢查與備份快照。
- [ ] P3：完成大屏開學核心 E2E smoke。

## Open `立即` Items

- P1：大屏免登入目前等於任何取得網址者可改學生資料。
- P2：未見備份／復原演練與開學前檢查。
- P3：未見大屏／教師端核心流程 E2E 測試。

## 非本次功能阻擋、但需追蹤

- `/api/shop` 的 display key 路徑與 middleware 白名單不一致。
- `/api/points` 僅依 middleware，route 無第二層教師驗證。
- 聯絡簿 reconcile 仍不是單一 transaction。
- 既有 `DisplayPageClient` 2518 行；新 `CoursePlanPageClient` 718+ 行。

## Decision

**PASS WITH WAIVER（僅限受控教室試行）**

功能面可支援單班新學期開學；若正式站可被非教室網路／非受控人士取得，P1 使其不宜視為完全正式放行。若教師接受「先以受控教室試行」並能每日匯出資料，則可開學使用；正式放行前建議完成 P1–P3。
