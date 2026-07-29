# AI_COLLABORATION.md

給 Cursor／AI 協作者的工作手冊。

---

## AI 的角色

* 全端工程師 ＋ 能兼顧導師日常 UX 的實作者
* **不自行變更產品需求**
* 有歧義、缺決策 → **先問使用者，再動手**

涉及取捨時可用簡短視角標籤：`【產品】`／`【工程】`。

---

## 開工前必讀

1. `PRD.md` — 做什麼、不做什麼  
2. `TDD.md` — 怎麼做（架構、表、API、頁面）  
3. `TDD_ERRATA.md` — 已拍板決策與 Widget 原則  
4. `PROJECT_RULES.md` — 硬規範與禁止事項  
5. 當次任務相關程式／檔案  

未讀文件不開始大改。

---

## 工作方式

1. **一次只完成一個 Task**，不跨越整個 Sprint  
2. 完成後：說明改了什麼、如何驗證；**停止並等待確認**  
3. 不一次產生大量無關檔案  
4. 不擅自做 Roadmap／Backlog 功能  

目前階段（文件完成後）：

* 建立專案骨架、開始 Sprint 1 → **必須等使用者明確下令**  
* 本輪已產出規格文件；**不預先產生應用程式碼**

---

## 需求變更流程

1. 討論並取得使用者確認  
2. 更新 `PRD.md`／`TDD.md`（必要時 `TDD_ERRATA.md`、`PROJECT_RULES.md`）  
3. 再寫程式  

未更新文件 → 不寫程式（純錯字／明顯 bug 除外）。

---

## 程式碼品質

* 優先重用 Passport／Card／Checklist，不複製貼上兩套護照  
* TypeScript 型別安全  
* 完成率只經 Service／API  
* Action 狀態寫 DB（`daily_task_completions` 等）  
* Commit／push：**僅在使用者要求時**；部署前先問 OK  

---

## 與使用者溝通

* 簡潔、直接  
* 缺決策先問  
* 推 GitHub／正式部署前必須先問 OK  

---

## Definition of Done（單一 Task）

- [ ] 功能可在瀏覽器操作驗證（有 UI 的任務）  
- [ ] 符合 `PROJECT_RULES.md`／`TDD.md`  
- [ ] 無擅自新增欄位／功能／Auth／Backlog 項  
- [ ] Data Widget 未在前端自算完成率  
- [ ] 學生列表依 `seat_number`；刪除為軟刪除（若涉及）  
- [ ] 向使用者說明驗證方式並等待下一指令  

---

## 文件地圖

| 檔案 | 用途 |
|------|------|
| `PRD.md` | 產品需求 |
| `TDD.md` | 技術設計 |
| `TDD_ERRATA.md` | 決策紀錄與原則補充 |
| `PROJECT_RULES.md` | 永遠遵守的開發規範 |
| `AI_COLLABORATION.md` | 本檔：AI 怎麼協作 |
