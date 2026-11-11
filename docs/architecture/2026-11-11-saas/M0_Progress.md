# M0 實作進度

日期：2026-11-11。分支：`codex/saas-pilot-foundation`。

## 已完成

- `pilot/` 獨立 Next.js 應用根目錄、設定與套件資訊，預設 port 3010。
- 不匯入舊站服務，不讀取上一層的環境檔；無資料庫連線或寫入 API。
- 獨立 Vercel 設定不包含 Cron；雲端建立與部署驗證結果如下。
- 原站 TypeScript 排除新版目錄，保留原站路由與功能。
- 新版 production build 成功；原站 TypeScript 檢查通過；6 個測試檔共 23 項測試通過，未執行有資料庫寫入的整合測試。

## 尚未完成／不可以宣稱已通過

- Supabase `teacher-workspace-pilot`（`yqogdgvkeghyuibydqhw`）已由使用者建立，頁面顯示 Healthy，東京區域。
- Vercel `teacher-workspace-pilot` 已建立，Root Directory=`pilot`、Next.js、Node 24.x；未接入資料庫。
- 使用者已完成 GitHub application 授權，repository 連線成功；Production 分支已確認為 `codex/saas-pilot-foundation`，不再是 `main`。
- 開發入口部署 `dpl_9AxV534or1rYiqPWmULMzqprrp5U` 為 Ready，東京執行區域；瀏覽器確認 https://teacher-workspace-pilot.vercel.app 可開啟且無資料庫功能。Vercel 既有部署保護保留。
- Git push 自動觸發目前仍為 disabled；本次為明確指定新版專案及 Git 分支的部署，不代表自動部署已驗收。
- Google OAuth、應用環境變數與雲端端對端隔離驗收尚未完成。
- Google Cloud 專案 `Teacher Workspace Pilot`（`spatial-yew-514405-j3`）已獨立建立；使用者已同意以其目前 Google 帳號信箱作為 OAuth 支援聯絡信箱。OAuth 憑證尚未建立，不記錄密鑰於此文件。
- OAuth 初始化表單已填寫應用名稱、支援／通知信箱與外部測試模式；停在 Google 使用者資料政策同意步驟，等待使用者接受，尚未提交建立品牌。
- 完整舊站瀏覽器回歸、跨班授權、登入、裝置配對尚未驗收。
- 目前僅可預覽開發狀態，不能邀請老師操作真實資料。

下一階段先配置獨立雲端環境，再接入 M1 身分與班級資料模型；不得將現有正式資料庫接入新版作為捷徑。不得將本分支部署到舊站專案。

## 新版依賴修補

新版 Next.js 改為 15.5.29，僅在新版 override PostCSS 8.5.32，重解相容間接依賴。2026-11-11 安裝後 npm audit 回報 0 個已知漏洞；這不是無漏洞保證。原站 package.json 與 lockfile 未修改。
