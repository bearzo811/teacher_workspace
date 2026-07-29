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
| `passport_records` | 國語／英語護照（`type`） |
| `homework` | 作業（title + date） |
| `homework_records` | 學生作業完成 |
| `class_settings` | 班級／目前週／護照起迄週 |
| `daily_task_completions` | 今日工作勾選（Domain Data） |

Schema 原始碼：`src/db/schema.ts`  
Client：`src/db/index.ts`（僅 server／API／Service 使用）

## Notes

* MVP 無 Auth；RLS 可先關或暫不啟用（自用單人）
* App 連線建議 Transaction pooler（`prepare: false` 已設）
* 勿把 `.env.local` commit 進 git
