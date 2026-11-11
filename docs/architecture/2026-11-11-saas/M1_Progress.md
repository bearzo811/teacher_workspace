# M1 第一段：Google 登入與邀請閘門

日期：2026-11-11。狀態：程式與本機測試完成，尚未完成雲端初始化／真實登入驗收，M1 整體仍未完成。

- 已確認新版 Supabase Google provider 顯示 ENABLED，未讀取或記錄 Google Client Secret。
- 新增 `/login`、PKCE callback、伺服器身分驗證、獨立 cookie、登出與邀請資格頁。
- 回呼只回到固定新版網域，沒有使用前端 next 參數或轉送 Host 決定跳轉位置。
- OAuth 會話不使用 service-role key；邀請 SQL 資料表不直接授權一般使用者讀寫。沒有新增任何真實學生資料。
- 3 項環境測試及 1 項 PGlite SQL 整合測試（包含匿名拒絕、私表拒讀、未邀請、到期、非 Google、未驗證信箱、缺 Google identity、有效／重複接受、撤銷與冒領）通過。
- 本機 production build 通過；此階段不代表 Google 端對端登入或雲端 migration 已成功。
- 部署 `dpl_A8ugj9CKcVQEhZM2sFypVCtCxXLG` 為 Ready；瀏覽器確認正式新版 `/login` 在缺少新版環境設定時按鈕停用，不假裝已可登入。
- 邀請 migration 已載入新版 SQL Editor 草稿，但尚未執行；等待明確授權新增驗證權限與初始邀請名單。

待授權／執行：新版邀請 migration、初始管理者邀請、publishable key 設定、Supabase URL allowlist、Google 測試名單、實際登入與登出驗收。

後續 M1 仍包含一人一班、名冊上限、所有業務資料與快取的班級歸屬及雙班隔離測試；目前沒有把舊站單班 API 搬過來。
