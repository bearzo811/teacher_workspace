# Teacher Workspace

國小導師每日工作台（MVP）。

## Docs

| File | Purpose |
|------|---------|
| [PRD.md](./PRD.md) | 產品需求 |
| [TDD.md](./TDD.md) | 技術設計 |
| [TDD_ERRATA.md](./TDD_ERRATA.md) | 架構決策紀錄 |
| [PROJECT_RULES.md](./PROJECT_RULES.md) | 開發硬規範 |
| [DATABASE.md](./DATABASE.md) | Supabase + Drizzle schema |
| [docs/architecture/](./docs/architecture/) | Architecture Review（Inventory／Self Review／Proposal／Gate） |
| [docs/PRODUCT_BLUEPRINT_V1.md](./docs/PRODUCT_BLUEPRINT_V1.md) | **v1 正式產品藍圖（Today／大屏／每日任務）** |
| [AI_COLLABORATION.md](./AI_COLLABORATION.md) | AI 協作方式 |

## Stack

Next.js 15 · React 19 · TypeScript · Tailwind CSS · Zustand · Lucide  
Drizzle ORM · Supabase PostgreSQL（方案 C）

## Develop

```bash
npm install
cp .env.example .env.local   # 填入 Supabase DATABASE_URL
npm run db:generate && npm run db:migrate
npm run dev
```

開啟 [http://localhost:3000](http://localhost:3000)

DB 細節見 [DATABASE.md](./DATABASE.md)。

## 現況

MVP 功能已齊：Dashboard、國語／英語護照總表（三態）、作業管理、學生 CRUD／詳細統計、系統設定、聯絡簿、**教室大屏**（`/display`）。

教室大屏：聯絡簿／作業繳交／本週護照；可開座號自助打勾。
