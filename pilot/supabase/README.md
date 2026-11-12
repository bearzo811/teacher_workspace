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

2026-11-12 已在新版空資料庫執行 registration migration，並驗證 RLS、grants 及六項匿名 API 請求皆拒絕。不要重複執行初始化；真實登入與雙班隔離仍待驗收。舊邀請版本僅保留於 Git 歷史，不可執行。

同日補驗：兩個真實 Google 帳號已各自建立虛構班級；`tests/cloud-isolation.sql` 在雲端回傳 PASS，驗證雙向 policy、限定寫入與名冊上限並回滾臨時資料。它使用 SQL 交易內測試 claims，不能代替真正並行負載或其他業務模組的隔離驗收。

## 名冊編輯與可復原移除（已核准啟用）

`migrations/0002_roster_management.sql` 新增僅同班老師可用的改名、學生修改、移除與復原函式；資料保留不永久刪除，恢復仍檢查 15 人及座號衝突。會允許老師讀自己班級的已移除資料，不會讓其他班或匿名讀取。

2026-11-12 使用者同意後，已於新版執行並驗證 0002，再設定新版 Vercel 的 `PILOT_ROSTER_MANAGEMENT_ENABLED=true` 並部署。四個函式匿名無執行權限，遷移後隔離測試再次 PASS。未設定時新 UI 與 server actions 均維持關閉。不要重跑 migration，也不要在舊站執行。
