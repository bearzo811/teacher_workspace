# TDD Errata — 2026-07-29

本文件記錄 PRD／初版 TDD 之後拍板的架構決策。  
**已併入 `TDD.md` v1.0 與 `PRD.md` v1.0**；本檔保留作決策軌跡與原則說明。

---

## 決策總表

| 項目 | 決策 | 理由 |
|------|------|------|
| Auth | MVP 不登入（Mock Teacher） | 自用；之後接 Supabase Auth 不改 Domain 模型 |
| Settings | 新增 `class_settings` | 班級、學年度、護照起迄週、目前週 |
| 今日工作 | 手動勾選 | 待辦本質；非完成率自動勾 |
| 本週來源 | 手動 `current_week` | 校曆／補課等無法可靠自動算 |
| 作業建立 | 預設模板 + 自由新增 | 效率與彈性 |
| 護照寫入 | API Upsert | 前端不預建全班週次紀錄 |
| todayTasks 清單 | API／Service 衍生 | 不必任務定義表 |
| todayTasks 勾選 | `daily_task_completions` | 正式 Domain Data |
| 學生刪除 | Soft delete（`is_active`） | 保留歷史紀錄 |
| 學生排序 | 一律 `seat_number` | 導師使用習慣 |

---

## 1. Auth

* MVP：**無登入**。
* 資料語意上綁定單一教師／單一班級。
* 未來 Auth 為基礎設施層，不要求現在拆 `teacher_id`（可於 V2 再加）。

---

## 2. `class_settings`

```text
id
school_year
grade
class_name
current_week
chinese_start_week
chinese_end_week
english_start_week
english_end_week
created_at
updated_at
```

MVP 單班級單列。多班級留待之後，不過度設計。

---

## 3. 今日工作：清單 vs 勾選狀態

初版「todayTasks 不需資料表」與「手動勾選」衝突，修正為：

| 層 | 策略 |
|----|------|
| 任務清單 | Service 衍生（MVP：國語護照／英語護照／作業三項） |
| 勾選狀態 | 表 `daily_task_completions` 持久化 |

### `daily_task_completions`

```text
id
task_date          -- DATE
task_key           -- chinese_passport | english_passport | homework
completed          -- BOOLEAN
completed_at       -- TIMESTAMP
created_at
updated_at
```

唯一鍵：`(task_date, task_key)`。

### 為何不用 localStorage

* 換電腦資料仍在（接上雲端 DB 後）
* 未來接 Auth 不必改結構
* 可回溯某日完成情況
* 未來加每日任務（打掃、聯絡家長）可擴 `task_key`，架構不變

→ 勾選狀態是 **Domain Data**，不是 UI 狀態。

---

## 4. Dashboard Widget 分類原則（專案級）

### Data Widget（資料型）

由 Service 計算，例如：國語／英語／作業完成率、未完成學生。

**Widget 與 Page 不可自行計算。**

### Action Widget（操作型）

需資料表保存，例如：今日工作、未來提醒、AI 建議。

**不可只存在前端；禁止 localStorage 當正式資料來源。**

### 總原則（必須遵守）

> 所有 Dashboard Widget 都必須有唯一資料來源（Single Source of Truth）。  
> 資料型 Widget 只能來自 Service 聚合；  
> 操作型 Widget 必須有持久化資料，不允許以 localStorage 作為正式資料來源。

### 資料流

```text
Dashboard → DashboardService → 統一回傳
  - 今日工作（清單衍生 + completions 狀態）
  - 國語／英語／作業完成率
  - 未完成學生
```

避免各頁各算導致數字不一致。

---

## 5. 護照 Upsert

點擊完成時：無紀錄則 INSERT，有則 UPDATE。  
前端不預先為全班產生週次列。

---

## 6. 作業混合建立

* 模板（可勾選建立）：國習、數習、生字、英文  
* 亦可自由新增任意 `title`  
* 皆寫入 `homework`（`title` + `date`）

---

## 7. 學生 Soft Delete 與座號

* 轉學等：`is_active = false`，不物理刪除  
* 所有學生列表／打勾清單：`ORDER BY seat_number`  
* 不以 `created_at` 排序

---

## 8. 對初版 TDD／PRD 的修正摘要

| 原文／模糊處 | 修正後 |
|--------------|--------|
| todayTasks 不需資料表 | 清單不需定義表；勾選需 `daily_task_completions` |
| 今日工作與完成率關係不明 | 手動勾選，與完成率解耦 |
| Settings 未入 schema | 新增 `class_settings` |
| Auth 未寫 | MVP 無登入 |
| 護照 PATCH by id only | Upsert by (student, type, week) |
| Dashboard 可能前端自算 | 強制 `DashboardService` |
| 學生刪除未定 | Soft delete |
| 排序未定 | `seat_number` |

---

## 文件狀態

| 文件 | 狀態 |
|------|------|
| `PRD.md` | v1.0 已同步 |
| `TDD.md` | v1.0 已同步 |
| `TDD_ERRATA.md` | 本檔 |
| `PROJECT_RULES.md` | 開發硬規範 |
| `AI_COLLABORATION.md` | AI 協作手冊 |

下一步：建立專案骨架（程式碼）前，須先確認本 Errata 無異議；骨架階段仍不自動開始，等使用者下令。
