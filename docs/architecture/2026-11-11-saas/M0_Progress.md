# M0 實作進度

日期：2026-11-11。分支：`codex/saas-pilot-foundation`。

## 已完成

- `pilot/` 獨立 Next.js 應用根目錄、設定與套件資訊，預設 port 3010。
- 不匯入舊站服務，不讀取上一層的環境檔；無資料庫連線或寫入 API。
- 獨立 Vercel 設定不包含 Cron，尚未綁定或部署雲端專案。
- 原站 TypeScript 排除新版目錄，保留原站路由與功能。
- 新版 production build 成功；原站 TypeScript 檢查通過；6 個測試檔共 23 項測試通過，未執行有資料庫寫入的整合測試。

## 尚未完成／不可以宣稱已通過

- Supabase `teacher-workspace-pilot`（`yqogdgvkeghyuibydqhw`）已由使用者建立，頁面顯示 Healthy，東京區域。
- Vercel `teacher-workspace-pilot` 已建立，Root Directory=`pilot`、Next.js、Node 24.x；未部署、未接入資料庫。
- Vercel CLI 連接 GitHub repository 回報無存取權，需由使用者登入 Vercel 網頁後確認 GitHub 整合授權。不得為此改動舊專案設定。
- Google OAuth、應用環境變數與雲端端對端隔離驗收尚未完成。
- 完整舊站瀏覽器回歸、跨班授權、登入、裝置配對尚未驗收。
- 目前僅可預覽開發狀態，不能邀請老師操作真實資料。

下一階段先配置獨立雲端環境，再接入 M1 身分與班級資料模型；不得將現有正式資料庫接入新版作為捷徑。不得將本分支部署到舊站專案。

## 新版依賴修補

新版 Next.js 改為 15.5.29，僅在新版 override PostCSS 8.5.32，重解相容間接依賴。2026-11-11 安裝後 npm audit 回報 0 個已知漏洞；這不是無漏洞保證。原站 package.json 與 lockfile 未修改。
