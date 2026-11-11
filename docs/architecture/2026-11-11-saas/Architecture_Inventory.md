# 【工程】架構事實盤點：多人試用改造基準

日期：2026-11-11｜模式：Full｜來源：本機程式碼，基準 commit `5bd6cf1`。未查驗雲端 DB 政策或實際帳務。

## 範圍與堆疊

- Next.js 15.5.22 App Router、React 19.1.0、TypeScript、Tailwind 4。
- Drizzle 0.45.2、postgres 3.4.9；`src/db/index.ts` 伺服器直接以 DATABASE_URL 連線，預設連線池 3。
- Vercel 部署、Supabase PostgreSQL；`vercel.json` 排程每日呼叫護照結算 API。
- `src/services` 22 個服務檔；`src/db/schema.ts` 有 35 個 pgTable 宣告。
- `src/components` 有 40 個 TSX 元件檔；`src/app` 有 18 個頁面與 35 個 API route 檔。

## 結構與資料流

`src/app`（頁面／API）→ `src/services`（領域邏輯）→ `src/db`（Drizzle／PostgreSQL）。`src/types` 為共用型別，`src/lib` 為日期、校務週次、排班、欠繳排序及授權等工具。

- 老師路由：`src/app/(teacher)`，由 layout 與 middleware 驗證教師 session。
- 大屏：`src/app/display`；聚合 `displayService.ts`，搭配版號輪詢。
- 列印：`src/app/(print)/students/[id]/debt-print`，獨立版面與教師授權。
- 頁面 client 元件多使用 useState／useEffect；`src/store` 另有 4 個 Zustand store。
- 未見獨立 `src/hooks` 目錄；UI 組件集中於 `src/components/ui`。

## 大型元件（超過 300 行）

- `DisplayPageClient.tsx`：2,465 行，含多分頁、寫入流程、輪詢、配對前的自助操作與大量版面。
- `CoursePlanPageClient.tsx`：756 行，目前相關入口隱藏。
- `SettingsPageClient.tsx`：671 行。
- `ContactBookPageClient.tsx`：662 行。
- `HomeworkPageClient.tsx`：546 行。
- `CalendarPageClient.tsx`：527 行。
- `DutyPageClient.tsx`：392 行。

行數為本輪讀取時結果，不代表本輪已修改這些元件。

## 服務與資料模型

22 個服務涵蓋聯絡簿、作業、護照、閱讀、排班、代班、出缺席、點數帳本、商店背包、學期、學生、匯出前資料及大屏聚合。最大服務為 `gamificationService.ts` 718 行、`homeworkService.ts` 622 行、`displayService.ts` 556 行、`dutyService.ts` 534 行。

35 張表涵蓋學生、學期名冊、作業／紀錄／歷程、護照、閱讀、班級設定、每日任務、出缺席、行事曆、排班／代班、點數效果／帳本、商品／獎品／訂單等。存在外鍵、索引與部分唯一鍵；尚無老師帳號、班級租戶、裝置配對、邀請、限時支援與 30 天刪除生命週期模型。

`classSettingsService.ts` 讀取單一設定列並以全域記憶體快取；`gamificationService.ts` 使用 `SETTINGS_ID = "default"`；大屏快取鍵以日期與顯示日為主，未帶班級身份。

## API 與錯誤處理

API 領域包括 `/api/auth`、`display`、`students`、`homework`、`passport`、`reading`、`routines`、`shop`、`settings`、`terms`、`export`、`cron` 等。多數採 GET／POST／PATCH，部分作業刪除使用 DELETE、欠繳排序使用 PUT。輸入驗證多在 route 內手寫；錯誤回應通常 `{ error }`，部分採 `apiErrorMessage`。

老師 API 由 middleware 與部分 route 內角色檢查共同控管；大屏相關端點有公開入口。Cron 有 Bearer secret 驗證。未見集中式租戶授權或集中限流；不能據此宣稱雲端防火牆未設置。

## 安全與效能現況

- 教師 session 為自訂 HMAC 簽章，payload 為 role 與 exp，沒有 user／class 身份。
- 教師登入目前比對共用環境密碼。
- `isDisplayKeyRequest()` 固定回傳 true，為現有單班免登入的刻意行為；新版必須替換。
- 商店有交易處理；大屏學生操作已有樂觀更新及失敗還原路徑。
- 護照／閱讀規則、日期與點數有現成測試，但不代表已有多班隔離覆蓋。
- Repository migrations 未見 RLS policy、資料庫角色隔離或安全 trigger 定義；線上實際狀態未知。
- `.github` 目錄未見於本輪檢查，不能假定已配置完整 CI。

## 技術債分級

高：全域班級上下文、匿名大屏權限、跨學期／班級歸屬改造、設定與快取共用。

中：大屏元件過大、route 驗證分散、操作流程與回饋狀態需一致化。

低／沿用：現有 UI kit、領域工具與大部分班務能力，可在明確邊界下持續使用。
