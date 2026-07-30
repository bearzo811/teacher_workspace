# Architecture Inventory — Teacher Workspace

**Date:** 2026-07-30  
**Mode:** Full  
**Commit baseline:** local (post teacher/display split; may include uncommitted work)

---

## 1. Overview

| Item | Value |
|------|-------|
| Name | Teacher Workspace（導師工作台） |
| Stack | Next.js 15 App Router, React 19, TypeScript, Tailwind 4, Drizzle, Supabase Postgres, Lucide |
| Package manager | npm |
| Build | `next build --turbopack` |
| TypeScript | Yes |
| State | Component `useState` + fetch（Zustand installed, **unused**） |
| Routing | App Router；`(teacher)` + `/display` |
| API | Route Handlers → Services → Drizzle |
| DB | Supabase Postgres |
| Auth | None（MVP） |
| Deploy | Vercel（`teacher-workspace`） |

---

## 2. Folder tree（ignore node_modules / .next）

```text
src/
  app/(teacher)/     # teacher pages + AppShell
  app/display/       # classroom display
  app/api/           # REST-ish handlers
  components/        # feature UI + ui/
  db/                # schema + client
  services/          # domain SSOT
  store/             # Zustand (dead)
  types/
  lib/               # dates, cn
  hooks/             # empty
  utils/             # empty
docs/architecture/   # this review pack
drizzle/             # migrations 0000–0003
```

---

## 3. Architecture narrative

```text
Page (thin) → *PageClient (fetch + UI state)
  → /api/* (validate)
  → *Service (domain + aggregation)
  → Drizzle → Supabase
```

- Dashboard / Display aggregations: `dashboardService` / `displayService` only.
- Contact book date ≠ homework due date (`contact_book_date` vs `date`).
- Display writes: homework-record / passport with `X-Display-Mode` + settings flags.

---

## 4. Components

**Count:** 29 under `src/components/**/*.tsx`

| File | ~Lines | Notes |
|------|--------|-------|
| `settings/SettingsPageClient.tsx` | 382 | Largest；settings + display flags |
| `display/DisplayPageClient.tsx` | 352 | Polling, carousel, seat lock, mutations |
| `contact-book/ContactBookPageClient.tsx` | 315 | Editor + preview + print |
| `passport/PassportPageClient.tsx` | 234 | |
| `homework/HomeworkPageClient.tsx` | 230 | |
| `students/StudentsPageClient.tsx` | 209 | |
| Others | ≤166 | Mostly OK |

**>300 lines:** SettingsPageClient, DisplayPageClient, ContactBookPageClient  

**God / extract candidates:** DisplayPageClient, SettingsPageClient, ContactBookPageClient；shared fetch boilerplate across PageClients.

---

## 5. Hooks

| Name | Status |
|------|--------|
| Custom hooks | **None**（`src/hooks/` empty） |
| Patterns in pages | `useState` / `useEffect` / `useCallback`；display uses `useSearchParams` + Suspense |

---

## 6. Services

| Service | Responsibility | SRP |
|---------|----------------|-----|
| `studentService` | CRUD, soft delete, detail stats | OK / slightly heavy detail |
| `passportService` | Week, matrix, dashboard summary, upsert | **Fat** (~413 lines) |
| `homeworkService` | Day view, create/delete, records | OK |
| `contactBookService` | Note + reconcile homework dual-date | OK |
| `classSettingsService` | Single-row settings | Clear |
| `dashboardService` | Dashboard SSOT + daily tasks | OK |
| `displayService` | Display SSOT + token/toggle asserts | OK |

**Duplication:** date helpers partially split (`lib/dates` vs service-local); matrix assembly patterns similar across passport/homework.

---

## 7. Database

| Table | Key fields | Indexes / constraints |
|-------|------------|------------------------|
| `students` | name, seat_number, is_active | PK；seat unique only in service |
| `passport_records` | student_id, type, week, status | UNIQUE(student,type,week)；FK student |
| `homework` | title, date(due), contact_book_date | PK |
| `homework_records` | homework_id, student_id, completed | UNIQUE(hw,student)；FKs |
| `class_settings` | class meta, weeks, display_* | Single-row convention |
| `daily_task_completions` | task_date, task_key, completed | UNIQUE(date,key) |
| `contact_book_days` | date, note | UNIQUE(date) |

**Enums:** `passport_type`, `passport_status`, `daily_task_key`  

**RLS / Triggers / Views / Functions:** **not defined in repo migrations**.

---

## 8. API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/dashboard` | Dashboard aggregate |
| PATCH | `/api/daily-tasks` | Today task toggle |
| GET/PATCH | `/api/passport` | Matrix/week + status upsert |
| GET/POST | `/api/homework` | Day view / create |
| DELETE | `/api/homework/[id]` | Delete item |
| PATCH | `/api/homework-record` | Completion（display gate） |
| GET/PUT | `/api/contact-book` | Read/save + reconcile |
| GET/POST | `/api/students` | List/create |
| GET/PATCH/DELETE | `/api/students/[id]` | Detail/update/soft-delete |
| GET/PATCH | `/api/settings` | Class + display settings |
| GET | `/api/display` | Display aggregate（optional token） |

Contract: `{ data }` / `{ error }`；status often inferred from error message strings.

---

## 9. State

| Tech | Usage |
|------|-------|
| useState | Primary |
| Zustand | 4 stores present, **zero imports from UI** |
| Context / RQ / SWR / Redux | None |

---

## 10. Dependencies（notable）

| Package | Needed? |
|---------|---------|
| next/react/drizzle/postgres/tailwind | Yes |
| zustand | Questionable until wired |
| lucide / clsx / cva / tailwind-merge | Yes |

---

## 11. Routes

| Path | Role |
|------|------|
| `/` `/contact-book` `/chinese` `/english` `/homework` `/students` `/students/[id]` `/settings` | Teacher |
| `/display?token=` | Classroom |

Flow: settings/students → passports/homework；contact book → due homework next school day → display sync via polling.

---

## 12. UI kit

Shared: `Button`, `Card` only. No Dialog/Table/Form abstractions. Display uses separate dark styling.

---

## 13. Types

`src/types/*` + Drizzle inferred types. View models also live in services and PageClients（drift risk）. No Zod.

---

## 14. Errors / UX states

Per-page string errors + loading text；`window.confirm` for deletes；no Error Boundary；no product `not-found` page；optimistic update + reload on failure in places.

---

## 15. Security

No auth. APIs public if URL known. `displayToken` is query-string soft gate. RLS not in repo. Suitable only for private/single-teacher threat model.

---

## 16. Performance

Route-level splitting only. Display polls every N seconds（default 20）. No virtual lists（class size ~9 OK）. Aggregations recompute on each request.

---

## 17. Tech debt snapshot

| Level | Items |
|-------|-------|
| High | No auth/RLS on public deploy； Zustand dead code； display token ≠ auth |
| Med | Fat PageClients； fat passportService； stringly status codes； seat_number no DB unique； weekends-only nextSchoolDay |
| Low | Empty hooks/utils； default public SVGs； thin shared UI |
