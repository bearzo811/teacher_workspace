# 名冊管理擴充（2026-11-12）

## 已實作並在新版雲端啟用

- 修改自己班級名稱、學生座號與姓名。
- 勾選確認後將自己的學生移入已移除名單，保留原始紀錄，沒有永久刪除。
- 從已移除名單復原；班級已滿 15 人或原座號已被使用時拒絕。
- 後端仍要求 Google 身分、有效老師帳號與同班擁有權。鎖定班級列後寫入，與既有新增流程共用人數及唯一座號防線。
- 老師只能讀自己班級的已移除名單；不開放匿名，也不允許直接改表。

Migration `pilot/supabase/migrations/0002_roster_management.sql` 不刪除任何既有資料。它擴充同班老師讀取已移除名單的 policy，並只授予 authenticated 呼叫四個限定函式，不授予資料表直接寫入權限。

環境開關 `PILOT_ROSTER_MANAGEMENT_ENABLED` 預設未設定／false。migration 未核准執行前，畫面及新 server actions 均不啟用；不可以只開啟環境開關而跳過 migration。

## 本機驗證

註冊舊版／管理擴充兩種 migration 狀態皆測試；包含跨班改名／編輯／移除／復原拒絕、班名與學生修改、重複座號拒絕、保留及復原資料、復原時人數上限與座號衝突、停用帳號拒絕、他班無法看見已移除資料。本機共 28 項新舊測試與 production build 通過。

## 雲端驗收（2026-11-12）

使用者說明後明確同意啟用名冊管理。僅在新版 Supabase `yqogdgvkeghyuibydqhw` 執行 0002，成功後設定新版 Vercel `PILOT_ROSTER_MANAGEMENT_ENABLED=true`，部署 `dpl_sunFLVtBgEUtfkkN47s7fWkqi6Yq` 已 Ready。

- 四個公開管理函式皆為 security definer、空 search_path；匿名無 EXECUTE，authenticated 有 EXECUTE，函式內另驗證老師與擁有權。
- 遷移後重跑雲端雙班隔離、限定寫入與人數上限測試，回傳 PASS，臨時資料全部回滾。
- 以 B 班虛構學生操作姓名修改、移入已移除名單、復原，名冊先 1→0 再 0→1；學生原名已還原。
- 班級改名透過實際登入畫面驗收成功，再還原虛構班名。
- 舊站及原有資料庫未變更。

手機／平板佈局與真正並行負載尚未驗收。不宣稱這是整個 M1 或完整產品。
