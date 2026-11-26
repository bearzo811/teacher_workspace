# 小班開放註冊試用版：獨立應用

新版試用站：[teacher-workspace-pilot.vercel.app](https://teacher-workspace-pilot.vercel.app)。採 Google 註冊、不需邀請碼。2026-11-26 已接入班級、學習、獎勵、商店、配對白板、值日／代班與資料匯出；仍未完成全部試用及維運驗收，不代表正式資料搬移已獲授權。

- [免登入虛構班級示範](https://teacher-workspace-pilot.vercel.app/demo)：只使用當前頁面記憶體，不改班級資料。
- [第一次使用導覽](https://teacher-workspace-pilot.vercel.app/guide)：六步設定及日常流程。
- [導師工作台](https://teacher-workspace-pilot.vercel.app/workspace)：登入後管理自己的班級。

在專案根目錄先安裝既有依賴，再執行 `npm --prefix pilot run dev`，開啟 http://localhost:3010 。Next 的專案根目錄為 pilot，因此不讀取上一層的 `.env.local`。不要將舊站的環境檔複製進來。

## 部署界線

- 新建 Vercel 專案，Root Directory 指定 `pilot`。不要修改舊 Vercel 專案的 Root Directory、網域、環境變數或分支設定。
- 新專案已建立，Production 分支為 `codex/saas-pilot-foundation`。部署不得使用根目錄的舊 `.vercel` 綁定。
- 本應用只透過新版 Supabase SDK 操作新版業務資料，不載入 `../src`。禁止匯入舊站服務以暫時接通功能。
- 本機依賴可由父目錄解析；雲端部署前須確認本目錄的獨立 lockfile 已提交。
- `vercel.json` 沒有 Cron；舊站的扣點排程不得複製到新版。
- 新版使用獨立 `teacher-pilot-auth` cookie，伺服器驗證使用者且禁止共用快取；環境檢查只接受新版 Supabase URL 與 publishable key，不能將舊站或高權限 key 當成替代品。
- OAuth 與註冊部署步驟見 [supabase/README.md](supabase/README.md)。最新逐模組驗收限制見 `../docs/architecture/2026-11-11-saas/`；雲端業務 migration 至 0042。

## 舊站回歸基準

來源版本：`5bd6cf1`。正式資料不複製到示範環境。

- 聯絡簿：建立與修改、次一上課日繳交、刪除同步。
- 作業：四態、個人完成率、下課／商店限制、欠繳排序與列印。
- 護照／閱讀：提早獎勵、上課日逾期扣點、月底欠繳。
- 生活：獨立出缺席、返校日、值日／代班、午餐兩項直接勾選。
- 商店：等級與金幣檢查、原子購買、背包／核銷、重試不重複扣款。
- 大屏：六分頁開關、座號取消、即時回饋、1280×720 與 3840×2160。

以上仍需完整整合驗收，不代表所有尺寸與情境均通過。新版跨班隔離、配對與撤銷已有測試；實體白板、每日排程自然觸發、真實匯出檔還原、自動加密備份及正式試用仍待完成。

## 本機檢查

從專案根目錄執行 `node --import tsx --test pilot/tests/*.test.ts`，再執行 `npm --prefix pilot run build`。

隔離還原工具：`node --import tsx pilot/scripts/verify-class-export.ts FILE SHA256_FROM_EXPORT_RECEIPT`。只在全新的記憶體資料庫驗證，沒有雲端還原功能；SHA-256 須使用原匯出紀錄的指紋。不要把學生資料檔提交到 Git。
