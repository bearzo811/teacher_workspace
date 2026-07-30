# Architecture docs — Teacher Workspace

本目錄依 **Architecture Review Framework v1.0**（跨專案 skill：`architecture-review-framework`）。

| File | Phase | Owner |
|------|-------|--------|
| [Architecture_Inventory.md](./Architecture_Inventory.md) | 2 Inventory | Cursor |
| [Tech_Lead_Self_Review.md](./Tech_Lead_Self_Review.md) | 3 Self Review | Cursor |
| [Architecture_Proposal.md](./Architecture_Proposal.md) | 4 Proposal | Cursor |
| [External_Review.md](./External_Review.md) | 5 External | 你 |
| [Release_Gate.md](./Release_Gate.md) | Gate | 雙方 |

## 目前狀態（2026-07-30）

1. Phase 2–4 已產出。  
2. **等待你填 `External_Review.md`（Grade + 批准 Proposal IDs）。**  
3. 未批准前 **不進行程式重構**。  
4. Release Gate 預設 **FAIL**（P1/P2/P3/P8 仍 OPEN）；自用可明示 waiver。

## 下一步口令

- 填完 External Review 後：`批准 Proposal P1 P3 P8，開始 Refactor`（IDs 以你勾的為準）  
- 或：`豁免 P1 P2，Release Gate PASS WITH WAIVER`
