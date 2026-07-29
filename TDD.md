# Teacher Workspace — Technical Design Document（TDD v1.0）

> **Version:** 1.0（已併入 2026-07-29 Errata 決策）  
> **Product:** Teacher Workspace  
> **Target:** Cursor AI Developer  
> **補充說明：** 拍板過程與原則詳見 `TDD_ERRATA.md`

---

## 一、技術架構

### Frontend

* Next.js 15（App Router）
* React 19
* TypeScript
* Tailwind CSS
* shadcn/ui
* Lucide Icons

### State（Zustand）

```text
studentStore
passportStore
homeworkStore
dashboardStore
```

用途：UI／快取。**完成率與 Dashboard 聚合不得在 store 內重算**；以 API／Service 結果為準。

### Database

Supabase PostgreSQL（正式）  
本機開發可用相同 schema 連線；MVP 無 Auth。

### ORM

Drizzle ORM

### Deploy

Vercel

### Auth（MVP）

不登入。資料綁定單一 Mock Teacher／單一班級。預留未來接 Supabase Auth，不影響現有 Domain 表結構。

---

## 二、資料夾架構

```text
src/
├── app/                 # App Router pages + API routes
├── components/
│   ├── dashboard/
│   ├── passport/
│   ├── homework/
│   ├── students/
│   └── ui/              # shadcn primitives
├── lib/
├── hooks/
├── store/
├── services/            # DashboardService 等業務聚合
├── types/
└── utils/
```

業務計算（完成率、未完成名單）放在 `services/`，不要散落在 Page／Widget。

---

## 三、Page Structure

```text
/                  Dashboard
/chinese           國語護照
/english           英語護照
/homework          作業管理
/students          學生列表
/students/[id]     學生詳細
/settings          系統設定
```

國語／英語頁共用 `PassportPage`（或同等 Component），僅 `type` 不同。

---

## 四、Sidebar

固定左側：

```text
Teacher Workspace
────────────
Dashboard
國語護照
英語護照
作業管理
學生中心
系統設定
```

Desktop 優先；平板可用；手機僅需可瀏覽。

---

## 五、Dashboard

### Widget 化

首頁不寫死業務區塊。結構：

```text
DashboardPage
  └── Widget 插槽
        ├── TodayTaskCard          （Action）
        ├── ProgressCard           （Data × 可多個）
        ├── RemainingCard          （Data）
        └── QuickActionCard        （導航，無獨立 Domain 表）
```

未來新增打掃／家長通知／AI 提醒：新增 Widget +（若為操作型）對應資料，不改 Dashboard 骨架。

### Widget 兩種類型（硬性）

| 類型 | 說明 | 資料來源 |
|------|------|----------|
| **Data Widget** | 完成率、未完成名單等 | 只能來自 Service 聚合 |
| **Action Widget** | 今日工作、未來提醒等 | 必須有持久化資料；禁止 localStorage 當正式來源 |

> 所有 Dashboard Widget 都必須有唯一資料來源（Single Source of Truth）。

### 資料流

```text
Dashboard UI
    ↓
GET /api/dashboard
    ↓
DashboardService（唯一計算點）
    ↓
回傳 todayTasks / passportSummary / homeworkSummary / remainingStudents
```

Dashboard 與各 Widget **不可自行計算**完成率。

---

## 六、Component 設計

### Dashboard

```text
DashboardPage
├── TodayTaskCard
├── ProgressCard
├── RemainingCard
└── QuickActionCard
```

### Passport（國語／英語共用）

```text
PassportPage
├── WeekSelector
├── ProgressBar
├── StudentChecklist
└── SummaryCard
```

### Homework

```text
HomeworkPage
├── HomeworkCreator      # 模板勾選 + 自由新增
├── HomeworkList
├── HomeworkChecklist
└── HomeworkSummary
```

### Students

```text
StudentsPage
├── SearchBar
├── StudentList          # order by seat_number
└── StudentCard

StudentDetailPage
└── 護照／作業統計（由 Service 或對應 API）
```

---

## 七、Database

### students

| Column | Type | Notes |
|--------|------|--------|
| id | uuid / serial PK | |
| name | text | |
| seat_number | int | **列表排序唯一依據** |
| is_active | boolean | 軟刪除：`false`＝轉學等 |
| created_at | timestamptz | |

不真刪學生，以保留歷史護照／作業紀錄。

### passport_records

單一表，`type` 區分國語／英語（利於未來數學護照等擴充）。

| Column | Type | Notes |
|--------|------|--------|
| id | PK | |
| student_id | FK → students | |
| type | text／enum | `Chinese` \| `English` |
| week | int | |
| completed | boolean | |
| completed_at | timestamptz nullable | |
| created_at / updated_at | timestamptz | 建議 |

唯一約束建議：`(student_id, type, week)`。

寫入採 **Upsert**：無則建、有則更新。

### homework

| Column | Type | Notes |
|--------|------|--------|
| id | PK | |
| title | text | |
| date | date | 作業所屬日 |
| created_at | timestamptz | |

建立方式：預設模板（國習、數習、生字、英文）勾選批次建立 + 自由新增任意 title。

### homework_records

| Column | Type | Notes |
|--------|------|--------|
| id | PK | |
| homework_id | FK | |
| student_id | FK | |
| completed | boolean | |
| completed_at | timestamptz nullable | 建議 |

唯一約束建議：`(homework_id, student_id)`；完成切換建議 Upsert。

### class_settings

| Column | Type | Notes |
|--------|------|--------|
| id | PK | MVP 預期單列 |
| school_year | text／int | 例：114 |
| grade | int／text | 例：4 |
| class_name | text | 例：四年三班 |
| current_week | int | **本週來源：手動** |
| chinese_start_week | int | 預設 3 |
| chinese_end_week | int | 預設 17 |
| english_start_week | int | 預設 3 |
| english_end_week | int | 預設 17 |
| created_at / updated_at | timestamptz | |

多班級：未來再加 `class_id`／多列；MVP 不過度設計。

### daily_task_completions

今日工作勾選狀態（**Domain Data**，非 UI 狀態）。

| Column | Type | Notes |
|--------|------|--------|
| id | PK | |
| task_date | date | |
| task_key | text | `chinese_passport` \| `english_passport` \| `homework` |
| completed | boolean | |
| completed_at | timestamptz nullable | |
| created_at / updated_at | timestamptz | |

唯一約束：`(task_date, task_key)`。

* **任務清單**：由 Service 衍生（MVP 固定三項），不另建任務定義表。  
* **勾選狀態**：本表持久化。  
禁止用 localStorage 當正式來源。

---

## 八、API

### Dashboard

```text
GET /api/dashboard
```

回傳（示意）：

```json
{
  "todayTasks": [
    { "taskKey": "chinese_passport", "label": "國語護照", "completed": false },
    { "taskKey": "english_passport", "label": "英語護照", "completed": false },
    { "taskKey": "homework", "label": "作業", "completed": false }
  ],
  "passportSummary": {
    "chinese": { "completed": 22, "total": 28 },
    "english": { "completed": 25, "total": 28 }
  },
  "homeworkSummary": { "completed": 27, "total": 28 },
  "remainingStudents": {
    "chinese": ["小明", "小志"],
    "english": ["小華"],
    "homework": [{ "name": "小美", "missing": ["英文"] }]
  }
}
```

實作：全部由 `DashboardService` 組裝。  
`todayTasks` 清單衍生 + 勾選狀態讀 `daily_task_completions`。

```text
PATCH /api/daily-tasks
```

Body：`{ taskDate, taskKey, completed }` → Upsert `daily_task_completions`。

### 護照

```text
GET  /api/passport?type=Chinese&week=8
PATCH /api/passport   # Upsert：studentId + type + week + completed
```

（若採 REST 資源 id：無 id 時仍須支援 upsert by unique key；前端不預建全班週次紀錄。）

### 作業

```text
GET  /api/homework?date=YYYY-MM-DD
POST /api/homework          # 單筆或模板批次
PATCH /api/homework-record  # Upsert 學生完成狀態
```

### 學生

```text
GET    /api/students
POST   /api/students
PATCH  /api/students/:id
DELETE /api/students/:id    # 實作為 soft delete → is_active=false
GET    /api/students/:id    # 含統計
```

列表：`is_active=true`，`ORDER BY seat_number`。

### 設定

```text
GET  /api/settings
PATCH /api/settings
```

---

## 九、UI 原則

* 區塊以 Card 為主，風格一致
* Button 只三種：Primary／Secondary／Ghost
* 語意色不超過四種：Blue／Green／Red／Gray
* Desktop 優先

---

## 十、開發順序（Sprints）

| Sprint | 內容 |
|--------|------|
| 1 | 專案骨架、Layout、Sidebar、Dashboard 殼＋Widget 插槽 |
| 2 | Student CRUD、搜尋、座號排序、軟刪除 |
| 3 | 國語護照、週切換、Dashboard 統計接線 |
| 4 | 英語護照（共用 Passport） |
| 5 | 作業（模板＋自由新增）、缺交、Dashboard |
| 6 | 學生中心詳細頁統計 |
| 7 | 設定頁（class_settings、目前週） |

實際執行以 `PROJECT_RULES.md`：一次一 Task，完成後停等確認。

---

## 十一、設計原則（摘要）

1. **Component First**：國語／英語共用 Passport，只換 `type`  
2. **Widget 化 Dashboard**：Data vs Action；Single Source of Truth  
3. **Data Driven**：護照同表 + `type`，不複製表／頁  
4. **Desktop First**，Mobile 可瀏覽即可  
5. **Service 聚合**：完成率只在 `DashboardService`（及對應讀取 API）計算  
6. **Domain Data 持久化**：操作型狀態入 DB，不用 localStorage 當正式來源  

完整 Errata 敘述見 `TDD_ERRATA.md`。
