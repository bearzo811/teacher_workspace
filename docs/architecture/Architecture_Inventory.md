# 架構盤點 — Teacher Workspace

日期：2026-08-18
模式：完整審核
範圍：儲存庫原始碼、遷移、設定與本機驗證；正式環境的資料庫／RLS 設定不在儲存庫中。

## 1. 總覽

| 項目 | 事實 |
| --- | --- |
| 產品 | 單一班級的國小導師工作台，包含教室大屏 |
| 技術棧 | Next.js 15.5 App Router、React 19、TypeScript、Tailwind 4、Drizzle ORM、postgres.js、Supabase Postgres |
| 前端狀態 | 元件內的 React state 加上直接 `fetch`；已安裝 Zustand 5，但 `src/store` 之外未使用其中 4 個 store |
| 路由 | 13 個頁面：教師路由群組、`/display`，以及 18 個 Route Handler 檔案 |
| 伺服器流程 | `PageClient` → `/api/*` → service → Drizzle → Postgres |
| 資料模型 | 18 張資料表、5 個 enum、遷移 `0000`–`0013` |
| 身分驗證 | 沒有教師驗證。Cron 使用 `CRON_SECRET`；大屏 GET 可比對 query string token。 |
| 部署 | Vercel 東京區域（`hnd1`），每日 `16:05 UTC`（台北時間 00:05）執行 Cron |
| 驗證 | 2026-08-18 本機通過 `npm run lint`、`npm run test:gamification`（4/4）與 `npm run build` |

## 2. 目錄結構

```text
src/
  app/(teacher)/         # 11 個教師頁面與 shell
  app/display/           # 教室大屏
  app/api/               # 18 個 API 路由檔（GET/POST/PATCH/PUT/DELETE）
  components/            # 35 個功能／UI 元件
  db/                    # Drizzle schema 與延遲初始化的伺服器端 DB client
  services/              # 14 個領域／查詢服務
  lib/                   # 日期、學期週次、值日、錯誤、養成系統
  store/                 # 4 個未使用的 Zustand store
  types/                 # API／畫面契約
drizzle/                 # 14 個編號遷移與 journal
tests/                   # 1 個測試檔（養成系統純函式）
scripts/                 # 維運、遷移與 smoke test 指令稿
docs/architecture/       # 架構審核文件
```

## 3. 架構說明

```text
教師頁面／大屏頁面
  → 客戶端區域狀態與直接 fetch
  → Next Route Handler
  → 領域服務（查詢、命令、畫面資料聚合）
  → Drizzle／postgres.js 連線池（預設 max 1）
  → Supabase Postgres
```

- 教師端與大屏的寫入會共用商業邏輯服務。大屏自助寫入僅靠 request header 與班級設定開關控制。
- `displayService.getDisplayData()` 聚合設定、聯絡簿、值日、行事曆、作業、護照、閱讀、例行事項與養成系統。
- 養成系統使用效果紀錄、帳本紀錄與投影資料；其寫入路徑已有 DB transaction／advisory lock。

## 4. 檔案規模熱點

| 檔案 | 行數 | 說明 |
| --- | ---: | --- |
| `src/components/display/DisplayPageClient.tsx` | 2,086 | 輪詢、導覽、座位狀態、寫入與六個面板集中在同一客戶端模組 |
| `src/components/settings/SettingsPageClient.tsx` | 638 | 設定表單、養成系統與大屏設定 |
| `src/services/gamificationService.ts` | 593 | 規則、投影寫入、帳本、讀取與逾期結算 |
| `src/services/homeworkService.ts` | 545 | 查詢、命令、進度與獎勵對帳 |
| `src/components/contact-book/ContactBookPageClient.tsx` | 519 | 編輯、簿本、設定與儲存狀態 |
| `src/components/homework/HomeworkPageClient.tsx` | 493 | 當日檢視、作業紀錄與刪除操作 |
| `src/components/calendar/CalendarPageClient.tsx` | 488 | 範圍／單日讀取與寫入 |

## 5. 服務與狀態

| 領域 | 單一事實來源 | 說明 |
| --- | --- | --- |
| 學生 | `studentService`／`students` | 透過 `isActive` 軟刪除；沒有租戶／班級外鍵 |
| 作業／聯絡簿 | `homeworkService`、`contactBookService` | 儲存聯絡簿會進行多次獨立 DB 寫入 |
| 護照／閱讀／例行事項 | 各自的 service 與紀錄資料表 | 每筆紀錄均有複合唯一索引 |
| 行事曆／值日 | 各自的 service 與覆寫資料 | `calendar_events` 在 schema／migration 中沒有 `date` 索引 |
| 養成系統 | `gamificationService` | 效果＋不可變帳本＋投影，為目前最完整的 transaction 處理 |
| 前端狀態 | 元件 `useState` | 重複的 fetch／載入／錯誤流程；Zustand store 未使用 |

## 6. 資料庫事實

| 關注面向 | 證據 |
| --- | --- |
| 資料完整性 | 多數紀錄表有複合唯一索引；外鍵均採 `ON DELETE no action` |
| 租戶模型 | `class_settings` 以 `limit(1)` 讀取；業務資料表沒有 class／teacher ID |
| 索引覆蓋 | 唯一索引支援紀錄 upsert，養成系統有查找索引；`calendar_events(date)` 與常用的 `homework(date/contact_book_date)` 查詢索引不在 schema／migration 中。 |
| 寫入原子性 | 養成系統使用 `db.transaction`；聯絡簿對帳與作業／護照完成後的獎勵對帳為跨 service 多步寫入，沒有同一個包覆交易。 |
| RLS | 不在儲存庫中。`DATABASE.md` 表示 MVP 可不啟用 RLS。 |
| 破壞性遷移 | `0009_homework_books.sql` 在調整結構前會刪除作業紀錄與作業；僅適合有明確備份／發版流程的情況。 |

## 7. API、安全性與錯誤

| 事實 | 證據 |
| --- | --- |
| 可寫入端點 | 15 個路由檔提供 POST／PUT／PATCH／DELETE，皆不要求教師身分／session。 |
| Cron 保護 | `/api/cron/gamification-settle` 驗證 `Authorization: Bearer CRON_SECRET`。 |
| 大屏 token | `/api/display?token=` 比對 `class_settings` 中的明文值；未驗證的 `GET /api/settings` 也會回傳該值，因此並非有效存取邊界。 |
| 大屏寫入保護 | 路由信任 `X-Display-Mode: 1` 與功能開關；request header 可被偽造。 |
| 輸入驗證 | 各路由手寫檢查，沒有共用 schema 驗證器、內容大小限制或一致的 UUID／日期邊界驗證。 |
| 錯誤契約 | JSON `{ error: string }`；數個路由以 `message.includes(...)` 決定 HTTP status，`apiErrorMessage` 可能回傳巢狀錯誤原因。 |

## 8. 效能與 UX 事實

| 面向 | 證據 |
| --- | --- |
| 大屏刷新 | 客戶端每隔設定的 5 秒以上輪詢完整 `/api/display`；載入 closure 依賴整個 `data`，每次回應都會重建輪詢 effect。 |
| 大屏聚合 | 單次請求會先讀聯絡簿，再並行呼叫 16 個 service，之後讀取養成系統；目前班級規模尚可，但資料量／班級數成長時成本高。 |
| UI 載入量 | 首次載入共用 JS：127 kB；`/display`：137 kB；教師頁面：132–136 kB（build 輸出）。 |
| 請求 UX | 多數頁面各自實作載入／錯誤／儲存狀態；未發現取消請求、統一重試或 optimistic update 行為。 |
| 無障礙 | 沒有自動化無障礙測試；大屏以觸控／座號操作為主，但未記錄鍵盤焦點或降低動態效果檢查。 |

## 9. 測試與維運事實

- 僅 1 個測試檔，涵蓋 4 個養成系統／日期純函式案例；沒有路由、service 整合、授權、遷移、無障礙或端對端測試套件。
- `scripts/` 有實用的維運 smoke check，但未被設定為預設 CI 測試指令。
- 儲存庫中未發現 CI workflow 檔案。
- `.env*` 與 `.vercel` 均被忽略；本輪未發現被追蹤的連線字串。

## 10. 技術債快照

- 高：沒有教師授權／租戶隔離；大屏 token 由設定 API 洩漏。
- 高：多步領域寫入可能部分提交。
- 中：`DisplayPageClient` 為 2,086 行的 God Component，且大屏端點是廣泛、輪詢式的資料聚合。
- 中：API 驗證與錯誤語意重複且脆弱。
- 中：自動化測試覆蓋極薄，且沒有儲存庫 CI workflow。
- 低：未使用的 Zustand store 與部分缺少的查詢索引。
