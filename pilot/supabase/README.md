# 邀請驗證資料庫（M1 第一段）

只適用於新版 Supabase `yqogdgvkeghyuibydqhw`。禁止在舊站執行。

`migrations/0001_invitation_gate.sql` 是一次性、交易式 migration：

- 建立未對 Data API 暴露的 `pilot_private.invitations`，撤銷匿名與一般登入者的直接讀寫權限，啟用 RLS，沒有一般使用者可用的資料表 policy。
- 只開放已登入者呼叫無參數的 `public.accept_pilot_invitation()`；匿名者不能呼叫。
- 函式驗證目前登入方式為 Google、使用者有確認信箱與 Google identity，再查邀請名單。只可接受自己的邀請。
- 邀請到期是「接受期限」；已接受者可繼續登入。撤銷則立即使後續資格驗證失敗。
- 沒有新增任何班級或學生資料表；未授權帳號不能建立或讀取班級。後續班級 API 必須另行驗證有效資格，不能只靠此頁面成功過一次。

目前不提供網頁新增邀請入口，必須由平台管理者在新版 SQL Editor 管理；邀請信箱不可放進前端環境變數。新增與撤銷範例（先取得對應使用者／管理者授權）：

```sql
insert into pilot_private.invitations(email, expires_at)
values ('invited-teacher@example.test', now() + interval '7 days');

-- 撤銷會在下一次邀請資格驗證時生效
update pilot_private.invitations set revoked_at = now()
where email = 'invited-teacher@example.test';
```

## 尚待雲端操作與驗收

1. 確認授權後，只在新版專案執行 migration 並核對 grants。
2. 新版環境只加入 `PILOT_SUPABASE_URL`、`PILOT_SUPABASE_PUBLISHABLE_KEY`，不使用 service-role key、資料庫密碼或 Google Client Secret。
3. Supabase Site URL=`https://teacher-workspace-pilot.vercel.app`，額外 Redirect URL 只加入 `https://teacher-workspace-pilot.vercel.app/auth/callback`。不要使用萬用字元或舊站網址。
4. Google 的 redirect URI 為 `https://yqogdgvkeghyuibydqhw.supabase.co/auth/v1/callback`，與 app callback 是不同層。
5. 邀請及未邀請 Google 帳號各驗證一次；清除 cookie／登出／重試／撤銷都要驗證。Google 測試模式使用者另由專案管理者加入，不等於產品邀請名單。

本機測試：從 repository 根目錄執行 `node --import tsx --test pilot/tests/*.test.ts`。PGlite 只提供記憶體 PostgreSQL 與測試版 Supabase auth stubs，不代表真實 OAuth、雲端 grants、跨班資料隔離或負載已通過。
