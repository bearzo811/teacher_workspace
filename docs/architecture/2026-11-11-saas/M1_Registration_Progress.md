# M1 註冊修訂進度（2026-11-12）

使用者確認取消系統邀請制，改為 Google 首次登入自動註冊；先前邀請 SQL 未執行。此次修訂優先於 11/11 邀請制進度與架構文件。

## 已實作

- 刪除未部署的邀請 migration 與邀請測試，新增 Google 註冊 migration。
- 註冊不接受前端信箱或 owner；資料庫驗證 Google 身分、已驗證信箱。
- 每位老師一個使用中班級的唯一索引，學生名冊 15 人上限與班級列鎖。
- RLS 及限定寫入函式，帳號停用時不能重註冊恢復；跨班讀取為空，跨班新增被拒絕。
- 工作台新增建立班級、座號／姓名新增名冊；送出按鈕即時顯示儲存中，失敗顯示錯誤。
- 本機 PGlite 雙帳號測試通過，涵蓋 Google 直接註冊、私有讀寫、非 Google／未驗證拒絕、重註冊、一人一班、座號重複、第 16 人拒絕、停用與跨班存取。
- 新舊共 27 項測試與 production build 通過。部署 `dpl_FSxA1pU4DsFGe2zWm2Hz4RwdkZ5y` 為 Ready，瀏覽器確認新版 `/login` 已顯示註冊制文案，環境尚未設定時按鈕保持停用。
- Supabase SQL 草稿已換成 registration migration，未執行；舊邀請 migration 不會執行。

## 尚未完成

新版雲端 migration／RLS 真實驗證、環境變數與 URL 設定、實際 Google 登入、真實並行壓力；尚未提供名冊編輯刪除與其他教室模組。不能宣稱 M1 全部完成，也不能搬入真實學生資料。

## 2026-11-12 雲端初始化結果（更新上述待辦狀態）

- 使用者授權只操作新版、不影響舊站。先查新版 `public`／`pilot_private` 業務表為 0，再執行 `0001_registration.sql`，交易成功。
- 三張新版資料表 RLS=true；anon 沒有 SELECT；authenticated 只有 SELECT、無直接 INSERT／UPDATE／DELETE，寫入需限定函式。
- 三個公開函式 anon EXECUTE=false、authenticated EXECUTE=true，SECURITY DEFINER 皆固定空 search_path。
- 真實新版 Data API 的三個匿名 SELECT 與三個匿名 RPC 呼叫，全部回傳 401，沒有建立測試帳號或班級。
- 新版 Supabase Site URL 與唯一 Redirect URL 已設定為新版網域及 `/auth/callback`，不含萬用字元。
- 新 Vercel 專案 Production 已加入新版 URL 與 publishable key；沒有讀取或複製 service-role、secret key、Google Client Secret 或舊站環境變數。
- Google 真實帳號登入／登出、建立班級／虛構名冊、雙班真實隔離與並行驗收仍待執行。
