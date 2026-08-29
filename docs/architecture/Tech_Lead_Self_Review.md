# Tech Lead Self Review — Teacher Workspace

角色：Google L6-style Tech Lead

日期：2026-08-30

模式：Full

## 自評等級

**B-（可試行開學，不建議無條件正式放行）** — 單班教師的日常主流程已涵蓋且 lint／既有測試／build 通過；但依目前「大屏免登入」決策，公開網址可直接改學生資料，且缺少開學情境 E2E、備份驗證與關鍵流程 transaction。

## 開學必備流程覆蓋

| 流程 | 狀態 | 判斷 |
| --- | --- | --- |
| 建立學期、上課日、放假／返校日 | 已具備 | 行事曆、學期與 return day 規則已落地 |
| 名冊、座號、出缺席 | 已具備 | 出缺席已從日常任務拆開 |
| 前一天輸入聯絡簿、次上課日繳交 | 已具備 | 聯絡簿／作業日期規則與大屏作業回報存在 |
| 值日與午餐工作 | 已具備 | 8 位餐桶＋黑板／餐桶桌輪轉，大屏逐人顯示 |
| 護照、讀報、閱讀 | 已具備 | 教師／學生權限規則與欠繳彙整存在 |
| 點數、商店、背包 | 已具備 | 購買 transaction 與學生持有物存在 |
| 教師每日檢核與欠繳處理 | 已具備 | Today、作業、欠繳頁存在 |
| 教室大屏開機即用 | 已具備但有風險 | 不登入即可使用，也等於公開寫入 |

## Architecture Smells

| 異味 | 位置 | 嚴重度 | 證據 |
| --- | --- | --- | --- |
| 新 God Client | `CoursePlanPageClient.tsx` | 高 | 718+ 行混合週導覽、Tab、資料載入、日卡、自動存、作業編輯、發布 |
| 整合測試使用設定中的 DB | `course-plans.integration.test.ts` | 中 | 以唯一測試資料執行並清理；尚無獨立 test database |
| 聚合命令非原子 | `contactBookService` 等 | 高 | 多筆相依寫入與後續 reward reconcile 不在同一 transaction |
| 權限規則不一致 | middleware、shop、points | 中 | display shop 被 middleware 擋；points route 僅依 middleware |
| API 邊界脆弱 | Route Handlers | 中 | 手寫 body cast、`message.includes()` 決定 status |
| 既有 God Client 持續膨脹 | `DisplayPageClient.tsx` | 高 | 2518 行，較 2026-08-18 增加 432 行 |
| 單班假設散落 | schema／services | 中 | 無 class ID；設定以 `limit(1)` 取值 |
| 無 CI | repo | 中 | lint、build、test 靠人工執行 |
| 無效狀態層 | `src/store` | 低 | 4 個 Zustand store 無引用 |
| 大屏公開寫入 | `src/lib/access.ts`、display mutation API | 高 | `isDisplayKeyRequest()` 固定回傳 true；正式網址可被非教室來源操作 |
| 開學回歸不足 | `tests/` | 高 | 僅 6 個 gamification unit tests 與選擇性課程計劃 integration test；沒有大屏／日常流程 E2E |
| 無監測／復原證據 | repo／Vercel 設定 | 中 | 無 health check、錯誤通知、備份／復原 runbook |

## 新課程計劃設計評價

### 做對的地方

- 計劃與正式作業分表，不會把未確認的內容提前放入學生作業。
- `published_homework_id` 提供可追蹤同步；正式作業刪除會安全回到未發布。
- 日期統一走 active term 與 calendar override，沒有另做一套假日規則。
- 儲存與發布各自使用 DB transaction；重複作業有 service 與 DB 雙層防護。
- 舊學期唯讀、放假日鎖定、發布後刪除不連動正式作業，符合訪談決策。

### 做得不夠的地方

- Client 仍沿用「一頁包全部」模式，下一次加入實際進度或複製功能時會快速惡化。
- 自動儲存有 revision guard 與 blur flush；DB 整合與瀏覽器 smoke 已通過，但仍缺慢網路與切週競態的自動化測試。
- Service 將讀模型、normalize、儲存 reconcile、發布同步集中於 436 行單檔。
- 科目與簿本的對應靠中文 `subjectName === "國語" | "數學"`；重新命名科目會讓可選簿本消失。
- note 發布時併入 `homework.pageLabel`，是可運作的 MVP 編碼，但不是獨立正式欄位。

## Scalability（1 → 10 → 100）

- **1 班：** 符合目前產品。固定 5 日週查詢、兩科 Tab 與 max=3 pool 可接受。
- **10 班：** 現有 schema 無 class／teacher scope，所有 unique index、session 與查詢都會產生資料混用；不能只靠 UI 加班級切換。
- **100 班：** 需要 tenant-aware schema、角色／成員關係、每班大屏能力、查詢觀測與快取分片；目前完整 display 聚合輪詢不適用。

## Maintainability

六個月後可以理解資料模型，但不容易安全修改畫面。課程計劃的資料契約與核心回歸測試清楚，主要風險集中在大型 client。若直接在同檔加入實際進度、複製週計劃或列印，會同時碰觸自動存與發布狀態機，回歸範圍過大。

## Refactoring Cost

| 項目 | 成本 | 影響 |
| --- | --- | --- |
| 拆課程計劃 client | 中 | 抽 week navigation、day card、assignment editor、save hook；API 不需改 |
| 課程計劃測試隔離 | 中 | 需要獨立 test DB 或 transaction rollback fixture |
| 統一 API schema／errors | 高 | 32 個 route 橫切修改 |
| 聯絡簿 transaction | 中高 | gamification service 需接受 transaction context |
| 多班／多租戶 | 高 | 32 張表、所有 service、session 與 unique index |
| 拆 display client | 高 | 2518 行且缺 E2E 保護 |

## Top 5 Issues

1. 拆分 718+ 行課程計劃 client，避免下一個需求擴大狀態耦合。
2. 為整合測試提供獨立 test DB，並把 lint、test、build 放入 CI。
3. 修正 middleware 與 route 的大屏／教師授權規則不一致。
4. 讓聯絡簿等聚合命令具備完整 transaction 邊界。
5. 逐步統一 API runtime validation／錯誤碼。

## 2026-08-30 Top 5（開學導向）

1. 為大屏加上「教室裝置範圍」而不是全面公開寫入；保留免每日登入體驗。
2. 做一個 10 分鐘可完成的開學前檢查：學期、上課日、名冊、聯絡簿、作業、值日、大屏、商店開關。
3. 建立 Supabase 備份／匯出與錯誤復原 runbook，至少做一次演練。
4. 為大屏加 E2E smoke：選座號、作業回報、午餐任務、商店、欠繳封鎖、重新整理後狀態仍正確。
5. 拆 `DisplayPageClient.tsx`，將面板、資料同步與 mutation hook 分開，避免開學中改 UI 造成連鎖回歸。
