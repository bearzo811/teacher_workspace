# Tech Lead Self Review — Student Gamification

Date: 2026-08-09
Grade: **B+**

## What is solid

- One service-layer settlement path covers teacher, display and cron writers.
- Deterministic effect keys, advisory locks and delta reconciliation prevent duplicate rewards.
- Immutable ledger preserves auditability; profile projection keeps display reads cheap.
- Historical records start at zero and rule changes do not reprice active effects.

## Top smells / risks

1. Teacher APIs still have the repo's existing no-auth boundary; gamification does not solve it.
2. `gamificationService.ts` owns commands, reads and overdue scans and should split if the domain grows.
3. `DisplayPageClient.tsx` and `SettingsPageClient.tsx` became larger; extraction remains deferred.
4. Deleting a homework reverses effects before domain deletion, but the two operations are not one shared DB transaction.
5. Cron integration depends on a production `CRON_SECRET` and migration `0013`; release is blocked until both are verified.

## Immediate assessment

No unapproved adjacent refactor was performed. G1–G6 match the owner-approved plan.

# Lite Tech Lead Self Review — Display DB Performance

Date: 2026-08-09

## Scope

- Vercel Functions pinned to Tokyo (`hnd1`) near Supabase Tokyo.
- Daily routine reads changed from per-student/per-task queries to one daily batch query.
- No data contract or UI behavior changes.

## Grade

**A-**

## Top smells

1. `getDisplayData` still aggregates many service queries; acceptable at current sub-second warm latency.
2. Several services independently read settings and active students; future optimization can pass request-scoped snapshots.
3. No response cache was added because immediate post-toggle refresh must not return stale data.

# Tech Lead Self Review — Teacher Workspace

**Persona:** Google L6-style Tech Lead  
**Date:** 2026-07-30  
**Based on:** `Architecture_Inventory.md`

---

## Self Grade

**B**

產品流程（聯絡簿→繳交日→大屏）想得清楚，Service 聚合方向正確；但公網部署卻零認證、Zustand 名實不符、PageClient／passportService 已開始變胖。以「自用 MVP」可活；以「可給別班老師用的產品」還不夠。

---

## Architecture Smells

| Smell               | Where                                     | Severity | Evidence                                   |
| ------------------- | ----------------------------------------- | -------- | ------------------------------------------ |
| God Component       | `DisplayPageClient`, `SettingsPageClient` | High     | 350–380 行；polling＋mutation＋UI 一鍋     |
| God Service         | `passportService.ts`                      | Med      | ~413 行；矩陣／摘要／upsert 全塞           |
| Dead Code           | `src/store/*`, empty `hooks/`, `utils/`   | Med      | Zustand 零引用；目錄謊言                   |
| Duplicate Logic     | `*PageClient` fetch/error/busy            | Med      | 同構樣板複製 7 次                          |
| Primitive Obsession | API errors                                | Med      | 用中文 `message.includes` 決定 HTTP status |
| Feature Envy        | Display mutations via teacher APIs        | Low–Med  | 靠 header／flag 旁路，權限模型未成形       |
| Long Method         | `saveContactBook`, display handlers       | Low–Med  | 可讀但難測                                 |
| Tight Coupling      | UI ↔ fetch shapes                         | Med      | View types 散落 Client／Service            |
| Missing Boundary    | Auth / tenancy                            | **High** | 單班假設寫死在 settings 單列               |

無明顯 circular dependency（層級仍是 UI→API→Service→DB）。

---

## Scalability（1 → 10 → 100 班）

| Scale  | What breaks                                                                            |
| ------ | -------------------------------------------------------------------------------------- |
| 1 班   | 現況可接受（~9 生、polling 20s）                                                       |
| 10 班  | `class_settings` 單列炸；需 teacher/class 模型；API 無隔離＝資料串班災難               |
| 100 班 | Dashboard/Display 全量聚合＋輪詢不可接受；需 cache/Realtime、權限、觀測、多租戶 schema |

座號／護照矩陣在 10 班×30 生×15 週會開始痛，但遠小於「無租戶隔離」的問題。

---

## Maintainability（半年後還敢改嗎？）

- **敢改：** contact book dual-date、display route group、drizzle migrations — 邊界清楚。
- **不敢大改：** DisplayPageClient／Settings 肥檔；任意加 Auth 會碰到每個 API。
- **文件尚可：** PRD/TDD/Rules 在；但實作已超前部分文件，靠 Inventory 補洞。

半年後若沒拆 PageClient、沒清死碼，新功能會優先往神元件堆，債會指數成長。

---

## Refactoring cost（若今天加登入／權限／多教師）

| Change                   | Blast radius                                                        |
| ------------------------ | ------------------------------------------------------------------- |
| Login（Supabase Auth）   | 全 API + layout + display middleware；**大**                        |
| 角色（老師 vs 大屏唯讀） | display 寫入路徑、settings；中                                      |
| 多教師／多班             | schema 幾乎全表加 `class_id`、settings 重寫、所有 queries；**極大** |
| React Query              | 所有 PageClient；中，但是線性可拆                                   |

結論：Auth／多租戶不是「加一個 provider」；現在的單租戶捷徑會變成遷移稅。

---

## Top 5 issues（ordered）

1. **公網零認證／無 RLS** — 安全邊界不存在。
2. **God Components（Display／Settings）** — 下一輪功能的主要摩擦。
3. **Zustand dead + 無 data-fetching 層** — 架構故事與實作分裂。
4. **passportService 過肥 + 型別分散** — domain 核心難測。
5. **seat_number 無 DB unique／假日未建模** — 真實教室 edge case。

---

## What I would praise in a promo doc

- Contact book vs due date split matches real teacher days.
- Dashboard/Display SSOT services prevent divergent completion math.
- Single deploy, dual layout is the right MVP tradeoff.

---

## Lite Self Review — Student detail latency / Gamification overview

Date: 2026-08-09

- Student detail now reads passport records once and aggregates homework totals in SQL, instead of issuing four full-row queries.
- Gamification profile, settings, and ledger reads execute in one query round.
- Serverless DB pool default is one connection per instance to prevent aggregate Supabase pool exhaustion.
- Display reuses the existing batched `data.personal` payload; the new overview page adds no API or DB query.
- The overview is ordered by seat number and intentionally does not introduce leaderboard semantics.

**Grade: A-** — Query fan-out and connection pressure are reduced without changing API contracts. Remaining debt: `DisplayPageClient` grew further and should only be split after Proposal approval.
