# Google 開放註冊與小班資料庫

## 2026-11-12 註冊制設定

系統已取消邀請名單，舊邀請 migration 從未執行並已移除；禁止執行瀏覽器殘留的邀請 SQL。新版唯一初始化檔為 `migrations/0001_registration.sql`，只適用於 Supabase `yqogdgvkeghyuibydqhw`。

- Google 已驗證帳號首次註冊即建立自己的 teacher；停用帳號不能透過重新註冊恢復。
- teachers／classes／students 皆啟用 RLS；匿名不能讀寫，一般登入者只能讀自己的資料，不能直接改表。
- 建立班級／學生透過限定函式，不接受客戶端指定 owner；一人一班由唯一索引保護，15 人限制以班級列鎖保護。
- 先以虛構名冊驗證真實登入、雙班隔離與名冊上限。其他教室模組、編輯刪除及真正的並行負載尚未驗收。
- 本機測試改為 `node --import tsx --test pilot/tests/*.test.ts`，其中 PGlite auth stubs 不代表真實 OAuth 測試。
- 應用只設定新版 URL 與 publishable key；Site URL 為 `https://teacher-workspace-pilot.vercel.app`，額外 callback 僅 `https://teacher-workspace-pilot.vercel.app/auth/callback`，不使用萬用字元。
- Google provider callback 為 `https://yqogdgvkeghyuibydqhw.supabase.co/auth/v1/callback`，Google 測試模式與系統註冊規則分開，不未經確認對外發布。

## 雲端狀態

以上為待執行的 registration migration 與驗收計畫，不代表雲端已通過。舊邀請版本保留於 Git 歷史，不再提供可複製的邀請 SQL。
