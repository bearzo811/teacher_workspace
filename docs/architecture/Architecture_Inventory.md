# Architecture Inventory — Teacher Workspace

日期：2026-08-30  
模式：Full（開學前）

## 1. Overview

| 項目 | 事實 |
| --- | --- |
| 前端／路由 | Next.js 15 App Router、React 19、TypeScript、Tailwind 4 |
| 資料 | PostgreSQL（Supabase）＋ Drizzle ORM；29 個 migration（`0000`–`0028`） |
| 部署 | Vercel production；教師工作台與 `/display` 分離 layout |
| 使用者 | 單一班級／單一教師；9 位學生的大屏互動設計 |
| 後台功能 | Today、聯絡簿、值日、行事曆／學期、作業、護照、讀報／心得、每日任務／出缺席、學生、商店、設定、課程計劃 |
| 大屏功能 | 聯絡簿、護照／閱讀、午餐影音與任務、學生資訊／背包／商店、欠繳、行事曆 |
| 驗證 | `npm run lint`、`npm run test:gamification`（6/6）與 production build 於 2026-08-30 通過 |

## 2. Architecture narrative

教師頁面透過 32 個 Route Handlers 呼叫 service；service 直接使用 Drizzle/Postgres。大屏以 `displayService.getDisplayData()` 聚合全班資料；前端以版本輪詢與 optimistic update 顯示學生操作。學期日期、放假／補課、返校日、作業繳交日與值日輪排均共用 calendar／term 規則。

## 3. 主要模組與責任

| Layer | 代表檔案 | 責任 |
| --- | --- | --- |
| UI | `src/components/*` | 教師工作台與大屏互動 |
| Display | `DisplayPageClient.tsx`、`displayService.ts` | 教室大屏聚合、輪詢、學生自助操作 |
| Domain services | `*Service.ts` | 作業、聯絡簿、護照、閱讀、值日、商店、課程計劃等規則 |
| API | `src/app/api/**/route.ts` | 請求解析、授權、回應 |
| Data | `src/db/schema.ts` | 26+ 業務表、唯一索引與查詢索引 |

## 4. 大型元件

| 檔案 | 行數 | 風險 |
| --- | ---: | --- |
| `src/components/display/DisplayPageClient.tsx` | 2,400+ | 高：多面板、互動、輪詢與商店／背包集中 |
| `src/components/course-plans/CoursePlanPageClient.tsx` | 750+ | 中：週導覽、編輯、發布、自動存集中 |
| `src/db/schema.ts` | 730+ | 中：單一 schema 檔可接受，但跨域變更成本高 |
| `src/services/gamificationService.ts` | 650+ | 中：點數、XP、帳本、結算集中 |

## 5. Database／資料完整性

- 核心實體涵蓋學生、學期／名冊、聯絡簿、作業／繳交、每日任務、出缺席、值日、行事曆、護照、閱讀、點數、商店／背包、課程計劃。
- 作業紀錄、每日任務、出缺席、值日覆寫、閱讀與護照均有主要 unique constraint；作業日期、行事曆、帳本、背包有索引。
- `shopService`、`gamificationService`、`coursePlanService`、`termService` 使用 transaction；聯絡簿儲存及其後續作業／獎勵同步未見單一 transaction。
- RLS、資料庫 trigger、備份與復原策略：**不在此 repo 中**。

## 6. Auth／安全現況

- 教師工作台由 middleware 與教師 session 保護。
- `/display` 依產品決策公開，`isDisplayKeyRequest()` 固定回傳 `true`。
- 因此公開 display mutation endpoints 可被任何拿到正式網址的人呼叫：每日任務、作業回報、護照、閱讀、商店購買／背包使用、午餐影音清除。
- 大屏功能開關僅是業務開關，不是來源驗證。

## 7. Performance

- 寫入以 optimistic UI 更新，並以 `touchDisplayVersion()` 讓大屏短輪詢抓取變更。
- 大屏初次載入仍聚合聯絡簿、值日、作業、護照兩份 matrix、閱讀兩份 matrix、每日任務、欠繳、點數、背包與行事曆；沒有 per-class cache 或 payload 分頁。
- 已存在 `0022_display_performance_indexes.sql`，但 repo 未見 p95／錯誤率等 production 觀測資料。

## 8. Tech debt snapshot

- 高：公開大屏寫入缺乏可撤銷的教室範圍驗證。
- 高：大屏 client 過大、缺 E2E 測試。
- 中：開學關鍵流程無一鍵「開學前檢查」與資料備份／復原演練。
- 中：聯絡簿建立、作業建立、帳本影響未被同一 transaction 包住。
- 低：未使用／很少使用的 Zustand store 造成架構訊號混雜。

日期：2026-08-23

模式：Full

範圍：儲存庫原始碼、遷移與設定；包含課程計劃功能。正式環境 RLS 不在 repo。

## 1. 總覽

| 項目 | 事實 |
| --- | --- |
| 產品 | 單一老師、單一班級的國小導師工作台與教室大屏 |
| 技術棧 | Next.js 15.5.22、React 19.1、TypeScript、Tailwind 4 |
| API／DB | App Router Route Handlers、Drizzle ORM 0.45、postgres.js、Supabase Postgres |
| 前端狀態 | `*PageClient` 內 `useState` + 直接 `fetch`；4 個 Zustand store 無引用 |
| 資料流 | `PageClient → /api/* → service → Drizzle → Postgres` |
| 規模 | 17 個頁面、32 個 API route、20 個 service、38 個 component |
| 資料模型 | 32 張表、13 個 enum、遷移 `0000`–`0025` |
| 驗證 | 教師 HMAC session cookie；大屏雜湊存取碼；Cron Bearer secret |
| 部署 | Vercel `hnd1`；每日 `16:05 UTC` 執行 gamification settle |

## 2. 目錄

```text
src/
  app/(teacher)/       # 14 個教師頁面 + layout session guard
  app/display/         # 教室大屏
  app/login/           # 教師登入
  app/api/             # 32 個 Route Handler
  components/          # 38 個元件
  db/                  # Drizzle schema + lazy DB client
  services/            # 20 個領域服務
  lib/                 # auth、日期、錯誤與純函式
  store/               # 4 個未使用 Zustand store
  types/               # 10 個型別模組
drizzle/               # 0000–0025 + 維運 SQL
tests/                 # 2 個測試檔、5 個案例
scripts/               # 6 個維運／smoke script
docs/architecture/     # Architecture Review Framework 產物
```

## 3. 路由與領域

教師頁：`/`、`/course-plans`、`/contact-book`、`/duty`、`/calendar`、`/homework`、`/chinese`、`/english`、`/reading`、`/routines`、`/students`、`/students/[id]`、`/shop`、`/settings`。

其他頁：`/login`、`/display`、`/architecture-review`。

API 領域：auth、calendar、contact-book、course-plans、daily-tasks、dashboard、display、duty、export、homework、passport、points、reading、routines、settings、shop、students、term-passports、terms、today、cron。

## 4. 大型檔案

| 行數 | 檔案 | 責任 |
| ---: | --- | --- |
| 2518 | `src/components/display/DisplayPageClient.tsx` | 輪詢、導覽、寫入與多個面板 |
| 725 | `src/db/schema.ts` | 全部 schema |
| 718+ | `src/components/course-plans/CoursePlanPageClient.tsx` | 週視圖、自動儲存、作業編輯與發布 |
| 652 | `src/services/gamificationService.ts` | 規則、效果、帳本與結算 |
| 568 | `src/services/homeworkService.ts` | 作業查詢、狀態、進度與獎勵 |
| 557 | `src/components/homework/HomeworkPageClient.tsx` | 作業管理 |
| 545 | `src/components/contact-book/ContactBookPageClient.tsx` | 聯絡簿、簿本與大屏日期 |
| 515 | `src/components/settings/SettingsPageClient.tsx` | 班級、大屏與養成設定 |
| 489 | `src/components/calendar/CalendarPageClient.tsx` | 行事曆 CRUD |
| 474 | `src/services/displayService.ts` | 大屏聚合與 cache |
| 436 | `src/services/coursePlanService.ts` | 課程計劃查詢、儲存與發布 |

自訂 hooks：無。

## 5. 課程計劃功能

| 面向 | 實作 |
| --- | --- |
| 頁面 | `/course-plans`；國語／數學 Tab；一次顯示一科的週一至週五 |
| 主表 | `course_plans`：term、date、subject、unit、planned_content |
| 子表 | `course_plan_assignments`：book、page、note、sort、published_homework_id |
| 唯一性 | 每學期／日期／科目一筆；同計劃不可重複簿本＋頁數 |
| 日期規則 | 使用 active term + `calendar_day_overrides`；假日不可輸入 |
| 儲存 | 700ms debounce，欄位 blur 立即送出；日資料在 DB transaction 內 reconcile |
| 發布 | 每日發布；下一上課日為繳交日；transaction 建立／更新 `homework` |
| 同步狀態 | unpublished／published／outdated；重複正式作業會阻止發布 |
| 刪除語意 | 刪除計劃作業不刪正式 `homework`；FK `ON DELETE SET NULL` |

資料流：

```text
CoursePlanPageClient
  → GET /api/course-plans?weekStart&subject
  → PUT /api/course-plans
  → POST /api/course-plans { action: "publish" }
  → coursePlanService transaction
  → homework + touchDisplayVersion()
```

## 6. Database

- 32 張表；大部分 FK 使用預設 `ON DELETE NO ACTION`。
- 課程計劃例外：plan 刪除 cascade assignments；正式 homework 刪除時 published link 設為 null。
- `0022` 已加入 homework、calendar、passport、reading 的顯示路徑索引。
- `0025` 新增課程計劃 enum、2 張表、2 個 unique index 與 2 個查詢 index。
- Transaction：gamification、shop、term、course plan 使用 DB transaction。
- 聯絡簿 reconcile 與部分「紀錄 + gamification」仍跨多次獨立寫入。
- `class_settings` 仍以 `limit(1)` 讀取；業務表沒有 class／teacher tenant key。
- RLS／DB role policy 不在 repo；應用層以單老師 session 保護。
- postgres.js pool 預設 max 3，可用環境變數下修。

## 7. Auth 與安全邊界

| 邊界 | 現況 |
| --- | --- |
| 教師登入 | `TEACHER_PASSWORD` 至少 12 字；HMAC session cookie 8 小時 |
| 教師頁／API | middleware：未登入頁面轉址，API 回 401；teacher layout 再檢查 |
| 大屏 key | DB 儲存 hash；設定 API 只回 `hasDisplayToken` |
| 大屏寫入 | route 驗證 display key 並檢查功能開關 |
| Cron | `Authorization: Bearer CRON_SECRET` |

已知不一致：

- `/api/shop` 支援 display key，但未列入 middleware 的 display API 白名單，純大屏請求會先被 401。
- `/api/points` 只依 middleware，route 內沒有第二層 `requireTeacher()`。
- Display session cookie 已存在，但多數 route 實際使用 display key。

## 8. State、UI、型別與錯誤

- 前端每頁自行處理 loading／saving／error；沒有共用 query/resource hook。
- UI kit 只有 `Button`、`Card`；表格與表單皆為領域元件內實作。
- API 契約主要為 `{ data }`／`{ error }`。
- 輸入驗證手寫；數個 route 以 `message.includes()` 推斷 4xx／5xx。
- 沒有 runtime schema validator、統一錯誤碼、payload size 或 rate limit。

## 9. 效能

- 大屏 15 秒程序內 cache + version polling；版本變更時才重抓。
- `displayService` 仍單次聚合約 20 路資料；未按面板延遲載入。
- `DisplayPageClient` 從上次盤點的 2086 行增至 2518 行。
- 課程計劃週讀取固定 5 日；assignment 查詢依 plan IDs 批次讀取。
- 2026-08-23 build：shared first-load JS 128 kB；`/course-plans` 136 kB。

## 10. 測試與維運

- `tests/gamification.test.ts`：4/4。
- `tests/course-plans.integration.test.ts`：1/1；覆蓋儲存、週讀取、route GET、發布、outdated 更新、重複拒絕、假日拒絕與清理。
- 尚無 auth、完整 E2E、a11y 測試。
- 無 `.github/workflows`。
- `drizzle-kit check` 通過；repo 只有初始 snapshot，後續 migration 採手寫 SQL + journal。
- 2026-08-23 通過 ESLint、`tsc --noEmit`、production build、既有測試與課程計劃 DB 整合測試。
- `0025` 已套用目標 Supabase；瀏覽器 smoke 已驗證 Tab、週導覽、自動存、發布、更新、聯絡簿 due date 與行事曆假日鎖定。測試資料已清除。

## 11. 技術債快照

- 高：核心教師流程仍缺完整 E2E，也沒有 CI。
- 高：聯絡簿等聚合命令仍可能部分提交。
- 中：新課程計劃 client 718+ 行；既有 display client 2518 行。
- 中：API 驗證與錯誤狀態碼分散。
- 中：大屏 middleware／route 權限規則有不一致。
- 低：未使用 Zustand store 與手寫 migration metadata 工作流。
