# Architecture Proposal — Teacher Workspace

**Date:** 2026-07-30  
**Rule:** Sort by (收益 − 成本). Tags: `立即` | `下一版` | `可不改`  
**Status:** Awaiting External Review approval — **no refactor until approved IDs listed below**

---

## Ranking summary

| ID | Title | 收益 | 成本 | Net | Tag |
|----|-------|------|------|-----|-----|
| P1 | 部署暴露面防護（Vercel Protection 或簡易 Auth） | ★★★★★ | ★★☆☆☆ | +3 | 立即 |
| P2 | 確認／啟用 Supabase RLS（deny-by-default + service role） | ★★★★★ | ★★★☆☆ | +2 | 立即 |
| P3 | 拆 `DisplayPageClient`（hooks + panels） | ★★★★☆ | ★★☆☆☆ | +2 | 立即 |
| P4 | 接線或刪除 Zustand；抽 `useApiResource` | ★★★★☆ | ★★★☆☆ | +1 | 下一版 |
| P5 | 拆 `SettingsPageClient`＋共用 Form Field | ★★★☆☆ | ★★☆☆☆ | +1 | 下一版 |
| P6 | `passportService` 分檔（query / commands / dashboard） | ★★★☆☆ | ★★☆☆☆ | +1 | 下一版 |
| P7 | API 錯誤碼結構化（取代 message.includes） | ★★★☆☆ | ★★☆☆☆ | +1 | 下一版 |
| P8 | `seat_number` DB unique（per class later） | ★★★☆☆ | ★☆☆☆☆ | +2 | 立即（小） |
| P9 | React Query／SWR | ★★★★★ | ★★★★☆ | +1 | 下一版 |
| P10 | 假日／校曆表 | ★★★☆☆ | ★★★☆☆ | 0 | 下一版 |
| P11 | Supabase Realtime 取代 polling | ★★★☆☆ | ★★★★☆ | −1 | 可不改 |
| P12 | 完整 shadcn UI kit | ★★☆☆☆ | ★★★☆☆ | −1 | 可不改 |

---

## Proposal 1 — 部署暴露面防護

- **收益:** ★★★★★  
- **成本:** ★★☆☆☆  
- **影響:** 小（設定）／中（若上 Auth）  
- **Tag:** `立即`  
- **做什麼:** Vercel Deployment Protection（密碼）或極簡老師密碼 gate；文件寫明威脅模型＝「URL 不公開」。  
- **不做什麼:** 先不上完整多使用者 Auth。  
- **驗收:** 未授權無法開 `/` 與 `/api/*`（或至少 Production）。

## Proposal 2 — Supabase RLS

- **收益:** ★★★★★  
- **成本:** ★★★☆☆  
- **影響:** 中（DB policies；App 已用 connection string）  
- **Tag:** `立即`  
- **做什麼:** 盤點目前用的 DB role；anon 全拒；僅 server connection 可寫。寫入 `DATABASE.md`。  
- **驗收:** 用 anon key 無法讀寫業務表（若專案有暴露 anon）。

## Proposal 3 — 拆 DisplayPageClient

- **收益:** ★★★★☆  
- **成本:** ★★☆☆☆  
- **影響:** 小–中（僅 display）  
- **Tag:** `立即`  
- **做什麼:** `useDisplayData`（poll）、`useSeatLock`、mutation helpers；Page 只組裝。  
- **驗收:** `DisplayPageClient` &lt; ~150 行；行為不變。

## Proposal 4 — Zustand 決策 + useApiResource

- **收益:** ★★★★☆  
- **成本:** ★★★☆☆  
- **影響:** 中（多 PageClient）  
- **Tag:** `下一版`  
- **做什麼:** 刪未用 store **或** 真正接搜尋／選週／選日；新增共用 fetch hook。  
- **驗收:** 無死 store；至少 3 個 PageClient 共用 hook。

## Proposal 5 — 拆 SettingsPageClient

- **收益:** ★★★☆☆  
- **成本:** ★★☆☆☆  
- **Tag:** `下一版`  
- **做什麼:** Basics / Passport weeks / Display settings 三塊元件。  
- **驗收:** 主檔 &lt; 200 行。

## Proposal 6 — 拆 passportService

- **收益:** ★★★☆☆  
- **成本:** ★★☆☆☆  
- **Tag:** `下一版`  
- **做什麼:** `passportQueries` / `passportCommands` / types 分檔。  
- **驗收:** 單檔 &lt; 200 行；API 行為不變。

## Proposal 7 — API 錯誤碼

- **收益:** ★★★☆☆  
- **成本:** ★★☆☆☆  
- **Tag:** `下一版`  
- **做什麼:** `{ error: { code, message } }`；route 用 code map status。  
- **驗收:** 不再用 `message.includes("座號")` 決定 400。

## Proposal 8 — seat_number unique

- **收益:** ★★★☆☆  
- **成本:** ★☆☆☆☆  
- **Tag:** `立即`  
- **做什麼:** unique index on `seat_number`（單班 MVP）；migration。  
- **驗收:** 重複座號 insert 失敗且 UI 有訊息。

## Proposal 9 — React Query

- **收益:** ★★★★★  
- **成本:** ★★★★☆  
- **Tag:** `下一版`  
- **做什麼:** 統一 cache／retry；display 可縮短與 mutation invalidate。  
- **驗收:** Dashboard/Homework/Passport 用 query hooks。

## Proposal 10 — 校曆／假日

- **收益:** ★★★☆☆  
- **成本:** ★★★☆☆  
- **Tag:** `下一版`  
- **做什麼:** `non_school_days` 或 settings JSON；`nextSchoolDay` 讀取。  
- **驗收:** 連假不會把繳交日算在放假日。

## Proposal 11 — Realtime

- **Tag:** `可不改`（polling 對 9 人班夠用；等痛再上）

## Proposal 12 — Full UI kit

- **Tag:** `可不改`（Button/Card 夠 MVP）

---

## Recommended batch（請 External Review 勾選）

建議第一刀（若你同意「立即」）：

- [ ] **P1** 部署防護  
- [ ] **P2** RLS 盤點／啟用  
- [ ] **P8** seat unique  
- [ ] **P3** 拆 DisplayPageClient  

下一版預設：P4 P5 P6 P7（P9 看你是否想一次換 data layer）

**Cursor 重構啟動口令範例：**  
`批准 Proposal P1 P3 P8，開始 Refactor`
