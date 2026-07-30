# Database（Drizzle + Supabase Postgres）

## Setup

1. 到 [Supabase](https://supabase.com) 建立專案（免費方案即可）
2. **Project Settings → Database → Connection string → URI**
3. 複製連線字串，建立本機 `.env.local`：

```bash
cp .env.example .env.local
# 貼上 DATABASE_URL（含密碼）
```

4. 產生並套用 migration：

```bash
npm run db:generate
npm run db:migrate
```

開發期若想直接 push schema（不寫 migration 檔）：

```bash
npm run db:push
```

## Tables（對齊 TDD）

| Table | 說明 |
|-------|------|
| `students` | 學生；軟刪除 `is_active`；排序用 `seat_number` |
| `passport_records` | 國語／英語護照（`type`）；格子狀態 `status`：`not_started`／`missing_parent`／`completed` |
| `homework` | 作業：`date`＝繳交日、`contact_book_date`＝聯絡簿日期 |
| `homework_records` | 學生作業完成 |
| `class_settings` | 班級／目前週／護照起迄週／大屏開關與 token |
| `daily_task_completions` | 今日工作勾選（Domain Data） |
| `daily_student_tasks` | 學生當日已抄／打掃／刷牙 |
| `today_manual_completions` | 老師 Today 手動確認 |
| `contact_book_days` | 聯絡簿當日叮嚀；作業項目以 `contact_book_date` 同步寫入 `homework` |

Schema 原始碼：`src/db/schema.ts`  
Client：`src/db/index.ts`（僅 server／API／Service 使用）

## Notes

* MVP 無 Auth；RLS 可先關或暫不啟用（自用單人）
* App 連線建議 Transaction pooler（`prepare: false` 已設）
* 勿把 `.env.local` commit 進 git
