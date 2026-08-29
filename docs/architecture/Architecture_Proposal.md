# Architecture Proposal — Teacher Workspace

日期：2026-08-30

## 排序規則

依「收益－成本」排序。以下為建議，**尚未實作**。

## Proposal 1 — 免登入但不公開的大屏裝置模式

- 收益：★★★★★；成本：★★★☆☆；影響：中；標籤：立即
- 做什麼：第一台教師授權裝置建立長效、可撤銷的 display device session；所有學生寫入 API 只接受此 session，提供後台「重設教室大屏」按鈕。
- 不做什麼：不要求學生逐次輸入密碼，不增加帳號系統。
- 驗收：從外部無 cookie／無 device session 的 request 無法改任務、作業、護照、商店或影音；教室白板重新整理仍可操作。

## Proposal 2 — 開學前檢查與教師備份快照

- 收益：★★★★★；成本：★★☆☆☆；影響：小；標籤：立即
- 做什麼：設定頁加入檢查清單與「匯出本班快照 CSV/JSON」，檢查學期、9 人名冊、返校／開學日、值日、顯示日、商店開關。
- 不做什麼：不自動改資料。
- 驗收：教師能在開學前 10 分鐘內確認所有必填項，並下載可復原的快照。

## Proposal 3 — 開學核心 E2E smoke

- 收益：★★★★☆；成本：★★★☆☆；影響：中；標籤：立即
- 做什麼：以 Playwright 覆蓋聯絡簿→次日作業、學生回報、教師確認、缺席、午餐任務、欠繳封鎖商店、返校日。
- 不做什麼：不追求所有視覺細節截圖。
- 驗收：production build 前自動跑；任何核心流程失敗會阻擋部署。

## Proposal 4 — 聯絡簿／作業／點數的 transaction 邊界

- 收益：★★★★☆；成本：★★★☆☆；影響：中；標籤：下一版
- 做什麼：把建立或更新聯絡簿、作業同步與相關 effect reconcile 納入同一 DB transaction。
- 驗收：任何子寫入失敗後不殘留半套作業或錯誤點數。

## Proposal 5 — 拆分大屏 client

- 收益：★★★☆☆；成本：★★★★☆；影響：大；標籤：下一版
- 做什麼：將 display data hook、導航／選座號、各面板與 mutation 分檔。
- 驗收：主檔低於 500 行；每個面板可獨立測試。

## Proposal 6 — 多班／多教師 scope

- 收益：★★☆☆☆；成本：★★★★★；影響：大；標籤：可不改（除非擴班）
- 做什麼：class／teacher IDs、角色與全表 tenant scope。
- 驗收：兩個班級資料、值日、點數與大屏完全隔離。

## 建議開學批次

先核准 P1、P2、P3；在不改既有課堂流程下，先把公開寫入、開學設定遺漏與回歸風險降到可接受範圍。

日期：2026-08-23

排序規則：依（收益 − 成本）排序。標記：`立即`、`下一版`、`可不改`。

硬規則：擁有者批准特定提案 ID 前，不進行對應重構、DB 套用或部署。

## 排名

| ID | 提案 | 收益 | 成本 | 標記 |
| --- | --- | --- | --- | --- |
| P1 | 受控套用 0025 + 課程計劃 smoke test | ★★★★★ | ★☆☆☆☆ | 完成 |
| P2 | 課程計劃整合測試 | ★★★★★ | ★★★☆☆ | 完成 |
| P3 | 修正 route／middleware 權限矩陣 | ★★★★☆ | ★☆☆☆☆ | 下一版 |
| P4 | 拆分課程計劃 client 與 autosave hook | ★★★★☆ | ★★☆☆☆ | 下一版 |
| P5 | 聚合命令 transaction 一致性 | ★★★★★ | ★★★☆☆ | 下一版 |
| P6 | 統一 API validation／errors + CI | ★★★★☆ | ★★★☆☆ | 下一版 |
| P7 | 拆分大屏 client 與資料載入 | ★★★★☆ | ★★★★☆ | 下一版 |
| P8 | 多班／多租戶資料模型 | ★★★★★ | ★★★★★ | 可不改 |
| P9 | 移除或正式採用 Zustand | ★★☆☆☆ | ★★☆☆☆ | 可不改 |

## P1 — 受控套用 0025 + 課程計劃 smoke test

- 收益：★★★★★；成本：★☆☆☆☆；影響：小；標記：`立即`
- 狀態：**2026-08-23 完成**。`0025` 為純新增 migration，已成功套用；瀏覽器 smoke 通過，測試資料已清除。
- 做什麼：先備份目標 Supabase；執行 `0025_course_plans.sql`；驗證國語／數學切換、週導覽、自動存、假日鎖定、舊學期唯讀、發布、修改後更新、重複防護與刪除不連動。
- 不做什麼：不 push、不部署、不修改既有正式作業。
- 驗收：migration 成功；上述流程通過；rollback／備份位置有紀錄。

## P2 — 課程計劃整合測試

- 收益：★★★★★；成本：★★★☆☆；影響：中；標記：`立即`
- 狀態：**2026-08-23 完成核心範圍**。新增 1 個 DB 整合案例，覆蓋儲存、route 讀取、發布、更新、重複拒絕、假日拒絕與清理；獨立 test DB 併入 P6。
- 做什麼：建立隔離測試 DB fixture，測 `saveCoursePlanDay()`、`publishCoursePlanDay()`、假日拒絕、重複拒絕、published/outdated 與 transaction rollback；補至少一條瀏覽器 smoke。
- 不做什麼：不追求全 repo coverage。
- 驗收：失敗注入不留下半套 plan／homework；CI 可重複執行。

## P3 — 修正 route／middleware 權限矩陣

- 收益：★★★★☆；成本：★☆☆☆☆；影響：小；標記：`下一版`
- 做什麼：以明確矩陣列出 teacher／display／public／cron；修正 `/api/shop` display 白名單；敏感 route 加第二層 `requireTeacher()`；決定 display session 或 display key 的單一主路徑。
- 不做什麼：不導入多帳號 RBAC。
- 驗收：每個 API 的允許身分有 route test；display shop 不再被 middleware 誤擋。

## P4 — 拆分課程計劃 client 與 autosave hook

- 收益：★★★★☆；成本：★★☆☆☆；影響：中；標記：`下一版`
- 做什麼：拆成 WeekToolbar、SubjectTabs、CoursePlanDayCard、AssignmentEditor、`useCoursePlanAutosave`；保留現有 API 契約與 UX。
- 不做什麼：不新增實際進度、複製、列印等產品需求。
- 驗收：根 client <250 行；autosave hook 有慢網路、切週、舊回應不得覆蓋新輸入的測試。

## P5 — 聚合命令 transaction 一致性

- 收益：★★★★★；成本：★★★☆☆；影響：中；標記：`下一版`
- 做什麼：讓聯絡簿 reconcile 與「作業／護照紀錄 + gamification」共享 transaction context。
- 不做什麼：不改養成帳本規則。
- 驗收：各步驟失敗時全部 rollback；重送維持冪等。

## P6 — 統一 API validation／errors + CI

- 收益：★★★★☆；成本：★★★☆☆；影響：大；標記：`下一版`
- 做什麼：共用 runtime schema、穩定錯誤碼與安全 error mapping；CI 跑 lint、tsc、test、build、migration check。
- 不做什麼：不順便重寫前端狀態層。
- 驗收：畸形 JSON／日期／UUID／長字串有一致 4xx；內部 DB 錯誤不外洩。

## P7 — 拆分大屏 client 與資料載入

- 收益：★★★★☆；成本：★★★★☆；影響：大；標記：`下一版`
- 做什麼：依面板拆元件與 hooks；按需載入；量測後再決定 polling／SSE／Realtime。
- 驗收：根 client <300 行；未顯示面板不載入重型歷史矩陣；核心流程有 E2E。

## P8 — 多班／多租戶資料模型

- 收益：★★★★★；成本：★★★★★；影響：大；標記：`可不改`
- 僅在產品確定支援多班或多老師時啟動；屆時需 class／teacher membership、tenant-scoped FK、unique index、session 與 RLS。

## P9 — Zustand 決策

- 收益：★★☆☆☆；成本：★★☆☆☆；影響：小；標記：`可不改`
- 若短期不需要跨頁 client state，刪除 4 個未引用 store 與 Zustand；若需要，再以具體 use case 採用。

## 建議批准批次

課程計劃發布前：**P1 + P2 已完成**。

下一輪可維護性：**P3 + P4 + P6**。

P5、P7 各自獨立執行；P8、P9 等明確產品需求。
