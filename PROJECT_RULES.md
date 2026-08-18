# PROJECT_RULES.md

Cursor（與所有 AI 協作者）永遠遵守本文件。  
若與臨時對話衝突，以本文件＋`PRD.md`＋`TDD.md`＋`TDD_ERRATA.md` 為準。

---

## Product Philosophy

Teacher Workspace 是國小導師的**每日工作台**。

目標不是功能完整，而是：

> 老師每天會打開這一個網頁，完成班級日常管理。

自用、單一班級（MVP）、Desktop 優先。

---

## Design Goal

每一個功能都要回答：

> 能不能讓老師今天少切換一個工具／少漏一件事？

如果不能：不要開發。

Backlog（打掃、AI、多班級、Auth 等）未經 PRD 更新與使用者確認，禁止實作。

---

## Architecture Principles（硬性）

### 1. Component First

* 國語護照與英語護照**共用**同一套 Passport UI／邏輯，只依 `type`（`Chinese`／`English`）換資料。
* 禁止複製兩套幾乎相同的頁面或元件。

### 2. Widget 化 Dashboard

* Dashboard 只組合 Widget，不寫死未來業務。
* 新增功能＝新增 Widget（＋必要時新資料），不重構整個 Dashboard。

### 3. Widget Single Source of Truth

* **Data Widget**：只能消費 Service／API 聚合結果，禁止在元件內自行算完成率。
* **Action Widget**：狀態必須持久化到 DB；**禁止**以 localStorage 作為正式 Domain Data。
* 今日工作：清單由 Service 衍生；勾選寫入 `daily_task_completions`。

### 4. Data Driven Passport

* 護照使用單一 `passport_records` + `type`。
* 禁止為「數學護照」等直接複製新表／新頁，除非 PRD／TDD 明確變更策略。

### 5. Service 聚合

* Dashboard 相關統計統一走 `DashboardService`（或同等單一入口）。
* 禁止 Dashboard 頁、護照頁、作業頁各自算一套數字。

### 6. Desktop First

* 第一版優先桌面操作體驗；平板可用；手機可瀏覽即可，不要求完整操作。

---

## Data Principles

* 學生：**軟刪除**（`is_active = false`），禁止物理刪除作為預設行為。
* 學生列表／打勾清單：一律依 **`seat_number`** 排序。
* 本週：讀 `class_settings.current_week`（手動），禁止偷偷自動推算校曆週。
* 護照／作業完成寫入：優先 **Upsert**，前端不預建全班空紀錄。
* 作業：支援模板（國習、數習、生字、英文）+ 自由新增。
* 不得擅自新增資料表／欄位；需要時先更新 `TDD.md`（與必要時 `PRD.md`）並經確認。

---

## Auth（MVP 安全強化）

* 單一教師使用環境變數密碼與安全 session cookie 登入。
* 大屏使用獨立、受限的短效 session；不得持有教師權限。
* 不加入 Supabase Auth／OAuth／多使用者／多班級權限；需要時先改 PRD／TDD。

---

## UI Rules

* 區塊以 **Card** 為主，風格一致。
* Button 只三種：`Primary`／`Secondary`／`Ghost`。
* 語意色不超過四種：**Blue／Green／Red／Gray**。
* 使用 **shadcn/ui** + Lucide；不要另起一套設計系統。
* 產品 UI 文案：**繁體中文**。
* 程式識別子：英文。

---

## Code Principles

* Small Component、Single Responsibility、Reusable、Readable。
* 單一元件避免超過 **300 行**。
* TypeScript 型別安全；避免 `any` 當常態。
* 業務邏輯放 `services/`；Store（Zustand）只做 UI 狀態與伺服器結果快取，**不重算**完成率。
* API 經 Route Handlers；DB 存取經 Drizzle，禁止 Page 直接散落 raw SQL（集中在 lib／services）。

---

## Naming

| 種類 | 規則 | 例 |
|------|------|-----|
| 元件 | PascalCase | `StudentChecklist` |
| 檔案（元件） | 與元件同名 | `StudentChecklist.tsx` |
| 函式／變數 | camelCase | `getPassportSummary` |
| DB 表／欄位 | snake_case | `seat_number` |
| API path | kebab-case | `/api/homework-record` |
| task_key | snake_case | `chinese_passport` |
| Zustand store | camelCase + Store | `passportStore` |

---

## State（Zustand）何時用

**可用：**

* 目前選取的週、搜尋字串、UI 開關
* API 結果的客戶端快取（與伺服器一致的資料）

**不可用：**

* 當成完成率的計算引擎
* 當成今日工作勾選的唯一儲存（必須打 API 寫 DB）

---

## 開發方式

1. 開工前閱讀：`PRD.md`、`TDD.md`、`TDD_ERRATA.md`、`PROJECT_RULES.md`、`AI_COLLABORATION.md`
2. **一次只做一個 Task**；完成後停止，等確認
3. 不要一次做完整個 Sprint／全部 Milestone
4. 不「順便」做 Backlog 功能

---

## Git

* Commit 訊息清楚（why > what）
* **僅在使用者要求時** commit／push
* 不強制 push；部署前必須先問 OK

建議格式：

```text
feat: …
fix: …
docs: …
chore: …
```

---

## 禁止事項

未經 PRD／TDD 更新與確認，不要自行加入：

* Supabase Auth／OAuth／多教師／多班級
* localStorage 當護照／作業／今日工作正式資料
* 複製國語／英語兩套護照頁
* Dashboard Widget 內自行計算完成率
* AI 功能、報表、家長通知、打掃等 Backlog
* 物理刪除學生
* 自動推算「本週」凌駕手動設定
* 超過四色語意色或自創複雜 Button 變體

---

## 文件優先

| 變更類型 | 先更新 |
|----------|--------|
| 產品行為 | `PRD.md` |
| 架構／API／表結構 | `TDD.md`（重大決策可附 `TDD_ERRATA.md`） |
| 協作方式 | `AI_COLLABORATION.md` |
| 本規範 | `PROJECT_RULES.md` |

未更新文件 → 不寫程式（例行 bugfix 除外，但仍不得偷加功能）。

---

## 語言

* UI：繁體中文  
* 程式碼：英文識別子  
* 文件：繁中為主，專有名詞可英文  
