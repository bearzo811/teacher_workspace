# 效能量測與改善提案 — Teacher Workspace

日期：2026-08-18  
範圍：本機 Node 程序連線至目前設定的 Supabase Postgres；量測 service 聚合函式，不包含瀏覽器繪製與 HTTP 傳輸。

## 實測結果

| 路徑 | 連線池 `max=1` | 連線池 `max=5`（僅量測覆寫） | 結論 |
| --- | ---: | ---: | --- |
| `getDisplayData()` 冷載入 | 5,542 ms | 2,421 ms | 連線排隊是主要成本 |
| `getDisplayData()` 熱載入 | 4,501 ms | 1,830 ms | 非 React 渲染問題 |
| `getTodayBoard()` 冷載入 | 2,137 ms | 707 ms | 多個獨立查詢被序列化 |
| `getTodayBoard()` 熱載入 | 1,901 ms | 709 ms | 同上 |
| `getDashboardData()` 熱載入 | 1,138 ms | 未量測 | 可作為較小聚合的基準 |

## 事實與根因

1. `src/db/index.ts` 預設 `DATABASE_POOL_MAX ?? 1`；`.env.example` 也設定 `DATABASE_POOL_MAX=1`。
2. `getDisplayData()` 先讀設定、聯絡簿，接著用一個大型 `Promise.all` 呼叫約 20 個領域讀取；多個 service 又各自重複讀取設定、學生、護照／閱讀紀錄。
3. pool 為 1 時，這些看似平行的 SQL 在同一條資料庫連線上排隊，因此每個遠端 round-trip 都被累加。
4. 大屏每次學生操作後會在 800 ms 後重抓完整 `/api/display`；該完整刷新又約需 4.5 秒，並與下一次操作競爭同一條連線。
5. 寫入路徑也不是單一 SQL：例如作業回報包含作業、學生、既有紀錄、寫入／更新、歷史紀錄與獎勵對帳；例行任務同樣包含上課日判斷、學生讀取、upsert 與獎勵對帳。
6. 班級只有 9 位學生，資料列數不是目前主因；缺少的索引會在資料量增加後成為次要問題。

## 已辨識的索引缺口

| 查詢條件 | 目前狀態 | 建議 |
| --- | --- | --- |
| `homework.date` | 無索引 | `homework_date_idx` |
| `homework.contact_book_date` | 無索引 | `homework_contact_book_date_idx` |
| `calendar_events.date` | 無索引 | `calendar_events_date_idx` |
| `passport_records.type, week` | 現有唯一索引以 `student_id` 起首，不適合矩陣查詢 | `passport_records_type_week_student_idx` |
| `reading_records.type, school_year, semester` | 現有唯一索引以 `student_id` 起首 | `reading_records_type_term_student_idx` |

## 改善提案（依收益／成本排序）

### P10 — 拆除互動後的完整大屏刷新

- 收益：★★★★★；成本：★★☆☆☆；標記：`立即`
- 做什麼：保留目前 optimistic UI；每個寫入 API 回傳該筆更新後的最小資料，直接合併到 client state。操作後不再呼叫完整 `/api/display`，僅保留低頻背景同步。
- 驗收：點擊後 100 ms 內顯示成功狀態；單次操作不產生完整 display 聚合請求。

### P11 — 依面板延遲載入與快取大屏資料

- 收益：★★★★★；成本：★★★☆☆；標記：`立即`
- 做什麼：初始 `/api/display` 只回傳黑板、今日任務、座號與必要設定；護照／閱讀矩陣、欠繳明細、商店資料改為切入該面板才載入。設定、學生、當期矩陣採 10–30 秒 server cache，寫入時以 tag／版本失效。
- 驗收：初始大屏 p95 < 800 ms（本地到 Supabase）；切換面板僅抓該面板資料。

### P12 — 聚合查詢去重並調整資料庫連線池

- 收益：★★★★★；成本：★★☆☆☆；標記：`立即`
- 做什麼：`getDisplayData` 只讀一次 settings、學生、作業紀錄；護照／閱讀改為每個領域一次批次讀取。預設 `DATABASE_POOL_MAX=3`；實測設定為 5 時可更快，但目前 Supabase session pool 上限為 15，多程序同時使用會觸發 `EMAXCONNSESSION`，僅能在確認額度後提高。
- 不做什麼：不把資料庫密碼或 pool 限額硬編碼進原始碼。
- 驗收：在現有資料下完整 display 熱載入 < 1,000 ms，Today < 400 ms；以 p50／p95 監控。

### P13 — 為高頻查詢新增精準索引與 `EXPLAIN ANALYZE`

- 收益：★★★☆☆；成本：★☆☆☆☆；標記：`下一版`
- 做什麼：新增上述索引 migration，並在實際資料庫用 `EXPLAIN (ANALYZE, BUFFERS)` 保存前後比較。
- 驗收：索引符合實際查詢計畫；不新增未使用或重複索引。

### P14 — 即時同步改用資料版本／SSE（非每次全量輪詢）

- 收益：★★★★☆；成本：★★★☆☆；標記：`下一版`
- 做什麼：寫入時遞增班級資料版本；大屏以輕量版本檢查或 SSE 接收變更，再只刷新受影響面板。若日後使用 Supabase Realtime，需加入權限與斷線重連策略。
- 驗收：教師端與大屏在 1 秒內同步；無資料變動時不傳輸完整矩陣。

## 建議執行批次

先做 **P10 + P12**：它們直接消除學生操作後的等待感，且量測支持效益。接著做 **P11**，讓大屏初始載入也變快；索引與即時同步留給下一批。
