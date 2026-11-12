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
- 啟用環境後部署 `dpl_2RVpUg6PE2jQjJtF9dBPFjT5jjy4` 為 Ready；新版 `/login` 按鈕可用，實際點擊可到 Google 帳號選擇頁，client ID 與新版 Supabase callback 對應正確。尚未代使用者選帳號／同意授權，等待使用者登入驗收。

## 真實 Google 帳號 A 驗收（2026-11-12）

- 使用者完成 Google 授權並返回 `/workspace`，註冊成功，不需要邀請名單。
- 透過畫面建立「開發驗收測試班（虛構）」與「1 號 測試學生01」，重新開啟工作台仍存在。
- 再送出相同座號被拒絕，顯示錯誤，名冊維持 1／15，沒有建立重複資料。
- 畫面可即時顯示「儲存中…」；尚未將此觀察當成效能 P95 通過。
- 登出返回 `/login`；再直接開 `/workspace` 仍回到 `/login`，不能讀取班級。
- 虛構班級及 1 位虛構學生保留於新版作隔離驗收 fixture，未輸入真實學生資料，舊站未操作。
- 已停在第二個 Google 帳號選擇頁，等待使用者登入帳號 B；雙帳號雲端隔離與真實並行上限仍未宣稱完成。

## 帳號 B 與雲端權限驗收（2026-11-12，更新上述待辦）

- 使用者以第二個 Google 帳號登入後，畫面僅顯示建立班級，不會看到 A 班。
- 已建立「隔離驗收 B 班（虛構）」與「2 號 B班測試學生02」；工作台只顯示 B 班與該名學生。
- `pilot/supabase/tests/cloud-isolation.sql` 已先經 PGlite 執行成功，再在新版雲端執行成功，最終回傳 PASS。
- 雲端 SQL 用交易內的 JWT claims 與 `SET LOCAL ROLE authenticated` 驗證真實資料庫 policy：A↔B 雙向讀取不可見、跨班 RPC 寫入拒絕、直接改表拒絕、第二個使用中班級拒絕、第 16 位學生拒絕；anon 讀取與註冊 RPC 亦拒絕。
- 上限測試臨時增加 14 筆虛構學生後整筆交易 ROLLBACK，未更改 grants 或 auth users。重新開啟 B 工作台確認仍為 1／15。
- 這不是用竊取／修改的真實 OAuth token 發送跨班 HTTP 請求，也不是並行壓力測試；沒有將所有舊業務領域的隔離視為已完成。
- 本機新舊 27 項測試再次通過。兩個虛構班級及各 1 位虛構學生保留作後續測試，舊站完全未操作。

下一步：名冊編輯／移除、學期及逐班規則、其餘業務領域與大屏授權，仍依 M1～M5 分階段實作；目前不是完整產品試用版本。
