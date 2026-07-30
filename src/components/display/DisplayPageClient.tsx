"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  Fragment,
} from "react";
import { useSearchParams } from "next/navigation";
import { formatDisplayDate, formatMonthTitle, addMonths, monthDateRange } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { MonthCalendarGrid } from "@/components/calendar/MonthCalendarGrid";
import { buildMonthGrid } from "@/lib/calendarMonth";
import type { DisplayData, DisplayDebtRow, DisplayPersonalRow } from "@/types/display";
import {
  formatCountdownLabel,
  type CalendarEventView,
} from "@/types/calendar";
import {
  nextPassportStatus,
  type PassportStatus,
} from "@/types/passport";
import type { PassportMatrixView } from "@/services/passportService";
import {
  READING_SEMESTER_LABEL,
  READING_TYPE_LABEL,
  type ReadingMatrixView,
  type ReadingType,
} from "@/types/reading";

type PanelKey =
  | "today"
  | "lunch"
  | "debts"
  | "passport"
  | "reading"
  | "calendar";

const PANEL_ORDER: PanelKey[] = [
  "today",
  "passport",
  "reading",
  "debts",
  "lunch",
  "calendar",
];
const PANEL_LABEL: Record<PanelKey, string> = {
  today: "首頁",
  lunch: "午餐",
  debts: "欠繳作業名單",
  passport: "護照總表",
  reading: "讀報閱讀",
  calendar: "行事曆",
};
const SEAT_IDLE_MS = 30_000;
const CAROUSEL_MS = 60_000;

export function DisplayPageClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [data, setData] = useState<DisplayData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState("");
  const [panel, setPanel] = useState<PanelKey>("today");
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [needsScroll, setNeedsScroll] = useState(false);
  const [savingContactDate, setSavingContactDate] = useState(false);
  const [editingContactDate, setEditingContactDate] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentScrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const qs = token ? `?token=${encodeURIComponent(token)}` : "";
      const response = await fetch(`/api/display${qs}`);
      const json = (await response.json()) as {
        data?: DisplayData;
        error?: string;
      };
      if (!response.ok) throw new Error(json.error ?? "讀取失敗");
      setData(json.data ?? null);
      setError(null);
      const now = new Date();
      setUpdatedAt(
        `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "讀取失敗");
    }
  }, [token]);

  async function setContactBookDate(next: string) {
    setSavingContactDate(true);
    setError(null);
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayContactBookDate: next }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "更新聯絡簿日期失敗");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新聯絡簿日期失敗");
    } finally {
      setSavingContactDate(false);
    }
  }

  // 大屏無鍵盤時，用按鈕直接換日更穩
  function shiftContactBookDate(delta: number) {
    if (!data) return;
    const next = new Date(`${data.contactBook.date}T00:00:00`);
    next.setDate(next.getDate() + delta);
    const nextStr = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
    void setContactBookDate(nextStr === data.today ? "" : nextStr);
  }

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!data) return;
    // 正在選日期時暫停輪詢，否則原生日曆會被重繪關掉
    if (editingContactDate) return;
    const id = setInterval(() => {
      void load();
    }, data.displaySettings.refreshSeconds * 1000);
    return () => clearInterval(id);
  }, [data?.displaySettings.refreshSeconds, load, data, editingContactDate]);

  useEffect(() => {
    if (!data?.displaySettings.carouselEnabled || activeStudentId) return;
    const id = setInterval(() => {
      setPanel((prev) => {
        const index = PANEL_ORDER.indexOf(prev);
        return PANEL_ORDER[(index + 1) % PANEL_ORDER.length];
      });
    }, CAROUSEL_MS);
    return () => clearInterval(id);
  }, [activeStudentId, data?.displaySettings.carouselEnabled]);

  function bumpIdle() {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setActiveStudentId(null), SEAT_IDLE_MS);
  }

  function selectStudent(studentId: string) {
    setActiveStudentId((prev) => (prev === studentId ? null : studentId));
    bumpIdle();
    // 護照／閱讀／欠繳／午餐留當頁；其餘選座後回「首頁」點個人項
    setPanel((prev) =>
      prev === "passport" ||
      prev === "reading" ||
      prev === "debts"
        ? prev
        : "today",
    );
  }

  const activePersonal = useMemo(
    () => data?.personal.find((p) => p.studentId === activeStudentId) ?? null,
    [data, activeStudentId],
  );

  async function patchRoutine(
    studentId: string,
    taskKey: string,
    completed: boolean,
  ) {
    if (!data?.displaySettings.allowStudentRoutineToggle) return;
    if (activeStudentId !== studentId) return;
    await patchRoutineRequest(studentId, taskKey, completed);
  }

  async function patchRoutineRequest(
    studentId: string,
    taskKey: string,
    completed: boolean,
  ) {
    if (!data?.displaySettings.allowStudentRoutineToggle) return;
    const taskDate = data.today;
    setBusyKey(`${studentId}:${taskKey}`);
    bumpIdle();
    try {
      const response = await fetch("/api/routines", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Display-Mode": "1",
        },
        body: JSON.stringify({
          studentId,
          taskKey,
          completed,
          displayMode: true,
          taskDate,
        }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "更新失敗");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新失敗");
    } finally {
      setBusyKey(null);
    }
  }

  async function setPassport(
    studentId: string,
    type: "Chinese" | "English",
    week: number,
    status: PassportStatus,
  ) {
    if (!data?.displaySettings.allowStudentPassportToggle) return;
    if (activeStudentId !== studentId) return;
    setBusyKey(`${studentId}:${type}:${week}`);
    bumpIdle();
    try {
      const response = await fetch("/api/passport", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Display-Mode": "1",
        },
        body: JSON.stringify({
          studentId,
          type,
          week,
          status,
          displayMode: true,
        }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "更新失敗");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新失敗");
    } finally {
      setBusyKey(null);
    }
  }

  async function toggleHomeworkCell(
    studentId: string,
    homeworkId: string,
    next: boolean,
  ) {
    if (!data?.displaySettings.allowStudentHomeworkToggle) return;
    if (activeStudentId !== studentId) return;
    setBusyKey(`${studentId}:${homeworkId}`);
    bumpIdle();
    try {
      const response = await fetch("/api/homework-record", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Display-Mode": "1",
        },
        body: JSON.stringify({
          studentId,
          homeworkId,
          completed: next,
          displayMode: true,
        }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "更新失敗");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新失敗");
    } finally {
      setBusyKey(null);
    }
  }

  async function setReading(
    studentId: string,
    type: ReadingType,
    month: number,
    status: PassportStatus,
  ) {
    if (!data?.displaySettings.allowStudentReadingToggle) return;
    if (activeStudentId !== studentId) return;
    setBusyKey(`${studentId}:${type}:${month}`);
    bumpIdle();
    try {
      const response = await fetch("/api/reading", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Display-Mode": "1",
        },
        body: JSON.stringify({
          studentId,
          type,
          month,
          status,
          displayMode: true,
        }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "更新失敗");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新失敗");
    } finally {
      setBusyKey(null);
    }
  }

  const showSeatPicker =
    Boolean(
      (panel === "today" ||
        panel === "passport" ||
        panel === "reading") &&
        (data?.displaySettings.allowStudentHomeworkToggle ||
          data?.displaySettings.allowStudentPassportToggle ||
          data?.displaySettings.allowStudentRoutineToggle ||
          data?.displaySettings.allowStudentReadingToggle),
    );

  useLayoutEffect(() => {
    const el = contentScrollRef.current;
    if (!el) return;

    function measure() {
      if (!el) return;
      const overflow = el.scrollHeight > el.clientHeight + 2;
      setNeedsScroll((prev) => (prev === overflow ? prev : overflow));
      if (!overflow && el.scrollTop !== 0) el.scrollTop = 0;
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    for (const child of Array.from(el.children)) {
      observer.observe(child);
    }
    return () => observer.disconnect();
  }, [panel, activeStudentId, data, showSeatPicker, updatedAt]);

  if (error && !data) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <p className="text-2xl text-rose-300">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <p className="text-2xl text-slate-400">載入教室大屏…</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col gap-4 overflow-hidden overscroll-none",
        showSeatPicker ? "pb-28" : "pb-20",
      )}
    >
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 md:gap-8">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
              Classroom Display
            </p>
            <h1 className="text-2xl font-semibold md:text-3xl">
              {data.className}
            </h1>
          </div>
          <DisplayHeaderClock />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <span className="whitespace-nowrap">聯絡簿日期</span>
            <button
              type="button"
              disabled={savingContactDate}
              onClick={() => shiftContactBookDate(-1)}
              aria-label="前一天"
              className="h-10 w-10 rounded-lg border border-slate-600 text-slate-200 transition hover:bg-slate-800 disabled:opacity-40"
            >
              ‹
            </button>
            <input
              type="date"
              value={data.contactBook.date}
              disabled={savingContactDate}
              onFocus={() => setEditingContactDate(true)}
              onBlur={() => setEditingContactDate(false)}
              onChange={(event) => {
                const next = event.target.value;
                if (!next) return;
                // 選今天＝改回跟系統今天
                void setContactBookDate(next === data.today ? "" : next);
              }}
              className="h-10 rounded-lg border border-slate-600 bg-slate-900 px-3 text-base text-slate-100 outline-none ring-sky-500 focus:ring-2"
            />
            <button
              type="button"
              disabled={savingContactDate}
              onClick={() => shiftContactBookDate(1)}
              aria-label="後一天"
              className="h-10 w-10 rounded-lg border border-slate-600 text-slate-200 transition hover:bg-slate-800 disabled:opacity-40"
            >
              ›
            </button>
          </label>
          <button
            type="button"
            disabled={
              savingContactDate || data.contactBook.followsSystemToday
            }
            onClick={() => {
              void setContactBookDate("");
            }}
            className="h-10 rounded-lg border border-slate-600 px-3 text-sm text-slate-200 transition hover:bg-slate-800 disabled:cursor-default disabled:opacity-40"
          >
            {data.contactBook.followsSystemToday ? "跟今天" : "改回今天"}
          </button>
          <span className="text-sm text-slate-500">更新 {updatedAt}</span>
        </div>
      </header>

      {error ? <p className="shrink-0 text-sm text-rose-300">{error}</p> : null}

      <div
        ref={contentScrollRef}
        className={cn(
          "flex min-h-0 flex-1 flex-col overscroll-none",
          needsScroll ? "overflow-auto" : "overflow-hidden",
        )}
      >
        {panel === "today" ? (
          <TodayPanel
            data={data}
            row={activePersonal}
            busyKey={busyKey}
            canRoutine={Boolean(
              activeStudentId && data.displaySettings.allowStudentRoutineToggle,
            )}
            canHomework={Boolean(
              activeStudentId && data.displaySettings.allowStudentHomeworkToggle,
            )}
            onRoutine={(taskKey, completed) => {
              if (!activeStudentId) return;
              void patchRoutine(activeStudentId, taskKey, completed);
            }}
            onHomework={(homeworkId, next) => {
              if (!activeStudentId) return;
              void toggleHomeworkCell(activeStudentId, homeworkId, next);
            }}
          />
        ) : null}

        {panel === "lunch" ? (
          <LunchPanel
            data={data}
            busyKey={busyKey}
            canRoutine={data.displaySettings.allowStudentRoutineToggle}
            onRoutineCell={(studentId, taskKey, completed) => {
              void patchRoutineRequest(studentId, taskKey, completed);
            }}
          />
        ) : null}

        {panel === "debts" ? (
          <DebtsPanel
            debts={data.debts}
            activeStudentId={activeStudentId}
          />
        ) : null}

        {panel === "calendar" ? <CalendarOverviewPanel data={data} /> : null}

        {panel === "passport" ? (
          activeStudentId ? (
            <PassportStudentFocus
              studentId={activeStudentId}
              studentLabel={
                activePersonal
                  ? `${activePersonal.seatNumber} ${activePersonal.name}`
                  : ""
              }
              chinese={data.passport.chineseMatrix}
              english={data.passport.englishMatrix}
              canToggle={Boolean(
                data.displaySettings.allowStudentPassportToggle,
              )}
              busyKey={busyKey}
              onCycle={(type, week, current) => {
                void setPassport(
                  activeStudentId,
                  type,
                  week,
                  nextPassportStatus(current),
                );
              }}
            />
          ) : (
            <PassportMatrixOverview
              chinese={data.passport.chineseMatrix}
              english={data.passport.englishMatrix}
            />
          )
        ) : null}

        {panel === "reading" ? (
          activeStudentId ? (
            <ReadingStudentFocus
              studentId={activeStudentId}
              studentLabel={
                activePersonal
                  ? `${activePersonal.seatNumber} ${activePersonal.name}`
                  : ""
              }
              newspaper={data.reading.newspaper}
              reflection={data.reading.reflection}
              canToggle={Boolean(
                data.displaySettings.allowStudentReadingToggle,
              )}
              busyKey={busyKey}
              onCycle={(type, month, current) => {
                void setReading(
                  activeStudentId,
                  type,
                  month,
                  nextPassportStatus(current),
                );
              }}
            />
          ) : (
            <ReadingMatrixOverview
              newspaper={data.reading.newspaper}
              reflection={data.reading.reflection}
            />
          )
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-700 bg-slate-950/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_30px_rgba(0,0,0,0.35)] backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-end gap-3">
          <nav className="grid shrink-0 grid-cols-6 gap-2" aria-label="大屏頁面">
            {PANEL_ORDER.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setPanel(key);
                  if (key === "debts") setActiveStudentId(null);
                }}
                className={cn(
                  "min-h-14 min-w-20 rounded-xl border px-4 text-base font-semibold transition",
                  panel === key
                    ? "border-sky-300 bg-sky-500 text-white"
                    : "border-slate-600 bg-slate-800 text-slate-200 active:bg-slate-700",
                )}
              >
                {PANEL_LABEL[key]}
              </button>
            ))}
          </nav>

          {showSeatPicker ? (
            <div className="min-w-0 flex-1">
              <p className="mb-1 truncate text-sm text-slate-400">
                選自己的座號
                {activePersonal
                  ? ` · ${activePersonal.seatNumber} ${activePersonal.name}（30 秒後取消）`
                  : ""}
              </p>
              <div className="flex snap-x gap-2 overflow-x-auto pb-1">
                {data.students.map((student) => (
                  <button
                    key={student.studentId}
                    type="button"
                    onClick={() => selectStudent(student.studentId)}
                    className={cn(
                      "h-14 min-w-14 snap-start rounded-xl border text-xl font-bold transition",
                      activeStudentId === student.studentId
                        ? "border-amber-200 bg-amber-400 text-slate-950"
                        : "border-slate-600 bg-slate-800 text-slate-100 active:bg-slate-700",
                    )}
                  >
                    {student.seatNumber}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DebtsPanel({
  debts,
  activeStudentId,
}: {
  debts: DisplayDebtRow[];
  activeStudentId: string | null;
}) {
  const rows = useMemo(() => {
    const withDebt = debts.filter((row) => row.hasDebt);
    if (!activeStudentId) return withDebt;
    return withDebt.filter((row) => row.studentId === activeStudentId);
  }, [activeStudentId, debts]);

  const debtCount = debts.filter((row) => row.hasDebt).length;

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="shrink-0">
        <h2 className="text-3xl font-semibold">欠繳作業名單</h2>
        <p className="mt-1 text-base text-slate-400">
          作業（繳交日已到未交）· 護照（本週以前未完成）· 讀報／心得（本學期未完成）
          {` · ${debtCount} 人有欠繳`}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-slate-600">
          <p className="text-2xl text-emerald-300">
            {activeStudentId ? "這位同學沒有欠繳" : "全班沒有欠繳"}
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((row) => (
              <article
                key={row.studentId}
                className="rounded-2xl border border-rose-400/40 bg-slate-900/90 p-4"
              >
                <h3 className="text-2xl font-semibold text-rose-100">
                  {row.seatNumber} {row.name}
                </h3>
                <DebtGroup label="作業" items={row.homework} />
                <DebtGroup label="國語護照" items={row.chinesePassport} />
                <DebtGroup label="英語護照" items={row.englishPassport} />
                <DebtGroup label="讀報" items={row.newspaper} />
                <DebtGroup label="閱讀心得" items={row.reflection} />
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function DebtGroup({
  label,
  items,
}: {
  label: string;
  items: { label: string; note?: string }[];
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-sm font-semibold text-slate-400">{label}</p>
      <ul className="mt-1 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <li
            key={`${label}-${item.label}-${item.note ?? ""}`}
            className="rounded-lg border border-rose-400/40 bg-rose-500/15 px-2.5 py-1 text-base text-rose-100"
          >
            {item.label}
            {item.note ? (
              <span className="ml-1 text-amber-300">({item.note})</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TodayPanel({
  data,
  row,
  busyKey,
  canRoutine,
  canHomework,
  onRoutine,
  onHomework,
}: {
  data: DisplayData;
  row: DisplayPersonalRow | null;
  busyKey: string | null;
  canRoutine: boolean;
  canHomework: boolean;
  onRoutine: (taskKey: string, completed: boolean) => void;
  onHomework: (homeworkId: string, next: boolean) => void;
}) {
  const boardViewportRef = useRef<HTMLDivElement>(null);
  const boardContentRef = useRef<HTMLDivElement>(null);
  const [boardLayout, setBoardLayout] = useState({
    scale: 1,
    width: 0,
    height: 0,
  });

  useLayoutEffect(() => {
    const viewport = boardViewportRef.current;
    const content = boardContentRef.current;
    if (!viewport || !content) return;

    function measure() {
      if (!viewport || !content) return;
      const width = viewport.clientWidth;
      const height = viewport.clientHeight;
      if (width < 8 || height < 8) return;

      // 固定用黑板的完整寬度排版，再依高度縮小，避免文字提早擠成窄欄。
      content.style.width = `${width}px`;
      const naturalHeight = content.scrollHeight;
      const naturalWidth = content.scrollWidth;
      const scale = Math.min(
        1,
        width / Math.max(naturalWidth, 1),
        height / Math.max(naturalHeight, 1),
      );

      setBoardLayout((previous) => {
        if (
          Math.abs(previous.scale - scale) < 0.005 &&
          Math.abs(previous.width - naturalWidth) < 1 &&
          Math.abs(previous.height - naturalHeight) < 1
        ) {
          return previous;
        }
        return { scale, width: naturalWidth, height: naturalHeight };
      });
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(content);
    return () => observer.disconnect();
  }, [
    data.contactBook.date,
    data.contactBook.titles,
    data.contactBook.notes,
    data.calendarEvents,
  ]);

  return (
    <section className="grid min-h-0 flex-1 gap-4 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/80 p-4 lg:grid-cols-2">
      <div
        ref={boardViewportRef}
        className="flex h-full min-h-0 justify-center overflow-hidden rounded-sm border-[8px] border-amber-950 bg-[#173d2b] text-stone-100 shadow-[inset_0_0_30px_rgba(0,0,0,0.45),0_8px_18px_rgba(0,0,0,0.35)] ring-2 ring-amber-800"
      >
        <div
          className="relative shrink-0"
          style={
            boardLayout.width
              ? {
                  width: boardLayout.width * boardLayout.scale,
                  height: boardLayout.height * boardLayout.scale,
                }
              : { width: "100%" }
          }
        >
          <div
            ref={boardContentRef}
            className="absolute left-0 top-0 p-5"
            style={{
              transform: `scale(${boardLayout.scale})`,
              transformOrigin: "top left",
            }}
          >
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-4xl font-semibold tracking-wide text-stone-50">
                {formatDisplayDate(data.contactBook.date)}
              </p>
              <p className="shrink-0 text-3xl font-medium text-amber-100/90">
                {data.contactBook.weekProgressLabel}
              </p>
            </div>
            {data.contactBook.dutyLeaders.length > 0 ? (
              <p className="mt-3 text-3xl font-medium text-amber-50">
                值日生：
                {data.contactBook.dutyLeaders
                  .map((leader) => leader.name)
                  .join("、")}
              </p>
            ) : null}
            <div className="mt-5 border-t border-dashed border-stone-300/40 pt-4">
              {data.contactBook.titles.length === 0 &&
              data.contactBook.notes.length === 0 ? (
                <p className="mt-3 text-3xl text-stone-400">（尚未填寫）</p>
              ) : (
                <ol className="mt-3 list-decimal space-y-3 pl-10 text-3xl leading-relaxed">
                  {data.contactBook.titles.map((title) => (
                    <li key={`hw-${title}`}>{title}</li>
                  ))}
                  {data.contactBook.notes.map((text) => (
                    <li key={`note-${text}`}>{text}</li>
                  ))}
                </ol>
              )}
            </div>
            {data.calendarEvents.length > 0 ? (
              <div className="mt-6 border-t border-dashed border-stone-300/40 pt-4">
                <p className="text-2xl font-semibold text-amber-100">
                  行事曆：
                </p>
                <ul className="mt-3 space-y-2 text-2xl leading-relaxed">
                  {data.calendarEvents.map((event) => (
                    <li key={event.id}>
                      {event.allDay
                        ? event.title
                        : `${event.timeLabel} ${event.title}`}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {row ? (
        <PersonalChecklist
          data={data}
          row={row}
          busyKey={busyKey}
          canRoutine={canRoutine}
          canHomework={canHomework}
          onRoutine={onRoutine}
          onHomework={onHomework}
        />
      ) : (
        <TodayProgressOverview data={data} />
      )}
    </section>
  );
}

function TodayProgressOverview({ data }: { data: DisplayData }) {
  return (
    <div className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-2 self-stretch overflow-hidden">
      <h2 className="text-2xl font-semibold leading-tight text-slate-200">
        今日進度
      </h2>
      <p className="text-sm leading-tight text-slate-500">
        選座號後改為個人打勾
      </p>
      <div className="grid min-h-0 grid-rows-3 gap-2 overflow-hidden">
        {data.progress.map((item) => {
          const pct =
            item.total > 0
              ? Math.round((item.completed / item.total) * 100)
              : 0;
          return (
            <div
              key={item.key}
              className="flex min-h-0 flex-col justify-center overflow-hidden rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-2"
            >
              <div className="flex items-end justify-between gap-2">
                <p className="truncate text-xl font-semibold">{item.label}</p>
                <p className="shrink-0 text-2xl text-emerald-300">
                  {item.completed} / {item.total}
                </p>
              </div>
              <div className="mt-1.5 h-2.5 shrink-0 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              {item.missingNames.length > 0 ? (
                <p className="mt-1.5 break-words text-base leading-snug text-rose-300">
                  未完成：{item.missingNames.join("、")}
                </p>
              ) : (
                <p className="mt-1.5 text-base text-slate-500">全部完成</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function useClockLabel() {
  const [label, setLabel] = useState(() => formatClockNow());
  useEffect(() => {
    const id = setInterval(() => setLabel(formatClockNow()), 1000);
    return () => clearInterval(id);
  }, []);
  return label;
}

function DisplayHeaderClock() {
  const clock = useClockLabel();
  return (
    <div className="border-l border-slate-700 pl-4 md:pl-8">
      <p className="text-xs uppercase tracking-[0.2em] text-amber-200/80">
        現在時間
      </p>
      <p className="font-mono text-3xl font-semibold tabular-nums leading-none text-amber-100 md:text-4xl">
        {clock}
      </p>
    </div>
  );
}

function formatClockNow() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
}

const LUNCH_DUTY_GROUPS: {
  title: string;
  slotKeys: string[];
}[] = [
  { title: "抬餐桶（值日生）", slotKeys: ["meal_bucket_1", "meal_bucket_2"] },
  { title: "擦黑板＋倒垃圾", slotKeys: ["blackboard"] },
  { title: "掃拖（前）", slotKeys: ["sweep_1a", "sweep_1b"] },
  { title: "掃拖（中）", slotKeys: ["sweep_2a", "sweep_2b"] },
  { title: "掃拖（後）", slotKeys: ["sweep_3a", "sweep_3b"] },
];

const LUNCH_DUTY_LEFT = LUNCH_DUTY_GROUPS.slice(0, 2);
const LUNCH_DUTY_RIGHT = LUNCH_DUTY_GROUPS.slice(2);

function LunchDutyCard({
  group,
  people,
}: {
  group: (typeof LUNCH_DUTY_GROUPS)[number];
  people: ({ name: string | null } | undefined)[];
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center rounded-lg border border-slate-600/80 bg-slate-900/90 px-3 py-2.5">
      <p className="truncate text-lg font-semibold text-amber-200">
        {group.title}
      </p>
      <p className="mt-1 truncate text-xl font-semibold leading-snug text-slate-50">
        {people.length === 0
          ? "—"
          : people.map((slot) => slot?.name ?? "—").join("、")}
      </p>
    </div>
  );
}

function LunchPanel({
  data,
  busyKey,
  canRoutine,
  onRoutineCell,
}: {
  data: DisplayData;
  busyKey: string | null;
  canRoutine: boolean;
  onRoutineCell: (
    studentId: string,
    taskKey: "lunch_brushing" | "noon_cleaning",
    completed: boolean,
  ) => void;
}) {
  const rows = useMemo(
    () => [...data.personal].sort((a, b) => a.seatNumber - b.seatNumber),
    [data.personal],
  );

  return (
    <section className="grid min-h-0 flex-1 gap-4 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/80 p-4 lg:grid-cols-2">
      <div className="flex h-full min-h-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-600 bg-slate-950/30">
        <p className="text-lg text-slate-500">影音區（預留）</p>
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1.55fr)_minmax(0,1fr)] gap-2 overflow-hidden">
        <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950/40 p-3">
          <h2 className="shrink-0 text-2xl font-semibold text-slate-100">
            中午打掃分配
          </h2>
          <div className="mt-2 min-h-0 flex-1 overflow-hidden">
            {data.dutyToday.isHoliday ? (
              <p className="text-lg text-slate-400">當天放假，無值日排程</p>
            ) : (
              <div className="grid h-full min-h-0 grid-cols-2 gap-2">
                <div className="flex min-h-0 flex-col gap-2">
                  {LUNCH_DUTY_LEFT.map((group) => {
                    const people = group.slotKeys
                      .map((key) =>
                        data.dutyToday.slots.find((slot) => slot.slotKey === key),
                      )
                      .filter(Boolean);
                    return (
                      <LunchDutyCard
                        key={group.title}
                        group={group}
                        people={people}
                      />
                    );
                  })}
                </div>
                <div className="flex min-h-0 flex-col gap-2">
                  {LUNCH_DUTY_RIGHT.map((group) => {
                    const people = group.slotKeys
                      .map((key) =>
                        data.dutyToday.slots.find((slot) => slot.slotKey === key),
                      )
                      .filter(Boolean);
                    return (
                      <LunchDutyCard
                        key={group.title}
                        group={group}
                        people={people}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <LunchRoutineMatrix
          rows={rows}
          lunchProgress={data.lunchProgress}
          busyKey={busyKey}
          canRoutine={canRoutine}
          onRoutineCell={onRoutineCell}
        />
      </div>
    </section>
  );
}

const LUNCH_MATRIX_TASKS = [
  { key: "lunch_brushing" as const, label: "刷牙" },
  { key: "noon_cleaning" as const, label: "打掃" },
];

function LunchRoutineMatrix({
  rows,
  lunchProgress,
  busyKey,
  canRoutine,
  onRoutineCell,
}: {
  rows: DisplayPersonalRow[];
  lunchProgress: DisplayData["lunchProgress"];
  busyKey: string | null;
  canRoutine: boolean;
  onRoutineCell: (
    studentId: string,
    taskKey: "lunch_brushing" | "noon_cleaning",
    completed: boolean,
  ) => void;
}) {
  const summary = useMemo(() => {
    const map = new Map(lunchProgress.map((item) => [item.key, item]));
    return LUNCH_MATRIX_TASKS.map((task) => {
      const item = map.get(task.key);
      return {
        ...task,
        completed: item?.completed ?? 0,
        total: item?.total ?? rows.length,
      };
    });
  }, [lunchProgress, rows.length]);

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950/50 px-2 pb-2 pt-1">
      {!canRoutine ? (
        <p className="shrink-0 truncate text-right text-xs text-slate-500">
          未開放自行打勾
        </p>
      ) : null}

      <div
        className={cn("grid min-h-0 flex-1 gap-0.5", !canRoutine ? "" : "mt-0")}
        style={{
          gridTemplateColumns: `2.75rem repeat(${rows.length}, minmax(0, 1fr))`,
          gridTemplateRows: `auto repeat(${LUNCH_MATRIX_TASKS.length}, minmax(0, 1fr))`,
        }}
      >
        <div aria-hidden className="min-h-0" />
        {rows.map((row) => (
          <div
            key={`head-${row.studentId}`}
            className="flex min-h-0 items-center justify-center self-center text-sm font-bold tabular-nums text-amber-200"
            title={row.name}
          >
            {row.seatNumber}
          </div>
        ))}

        {LUNCH_MATRIX_TASKS.map((task) => {
          const stat = summary.find((item) => item.key === task.key);
          return (
            <Fragment key={task.key}>
              <div className="flex h-full min-h-0 flex-col items-center justify-center gap-0.5 px-0.5 text-center leading-tight">
                <span className="text-base font-semibold text-slate-200">
                  {task.label}
                </span>
                <span className="text-xs tabular-nums text-emerald-300">
                  {stat?.completed ?? 0}/{stat?.total ?? rows.length}
                </span>
              </div>
              {rows.map((row) => {
                const done =
                  task.key === "lunch_brushing"
                    ? row.lunchBrushing
                    : row.noonCleaning;
                const cellKey = `${row.studentId}:${task.key}`;
                return (
                  <div
                    key={`${row.studentId}-${task.key}`}
                    className="flex h-full min-h-0 items-center justify-center px-0.5"
                  >
                    <button
                      type="button"
                      disabled={!canRoutine || busyKey === cellKey}
                      aria-label={`${row.seatNumber} ${row.name} ${task.label}${done ? " 已完成" : " 未完成"}`}
                      onClick={() =>
                        onRoutineCell(row.studentId, task.key, !done)
                      }
                      className={cn(
                        "flex h-9 w-[92%] max-w-[2.85rem] items-center justify-center rounded-md border text-sm font-bold transition active:scale-[0.98]",
                        done
                          ? "border-emerald-300 bg-emerald-500 text-white"
                          : "border-slate-600 bg-slate-800/90 text-slate-500",
                        canRoutine && "hover:brightness-110",
                        !canRoutine && "cursor-default opacity-90",
                      )}
                    >
                      {done ? "✓" : ""}
                    </button>
                  </div>
                );
              })}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

function CalendarOverviewPanel({ data }: { data: DisplayData }) {
  const [cursor, setCursor] = useState({
    year: data.calendarMonth.year,
    month: data.calendarMonth.month,
  });
  const [monthEvents, setMonthEvents] = useState<CalendarEventView[]>(
    data.calendarMonth.events,
  );
  const [holidayOverrides, setHolidayOverrides] = useState<
    Record<string, boolean>
  >(data.calendarMonth.holidayOverrides ?? {});
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [monthError, setMonthError] = useState<string | null>(null);

  const isCurrentMonth =
    cursor.year === data.calendarMonth.year &&
    cursor.month === data.calendarMonth.month;

  useEffect(() => {
    // 跟著 display refresh 的本月資料同步；切到他月時不覆蓋
    if (!isCurrentMonth) return;
    setMonthEvents(data.calendarMonth.events);
    setHolidayOverrides(data.calendarMonth.holidayOverrides ?? {});
  }, [
    data.calendarMonth.events,
    data.calendarMonth.holidayOverrides,
    isCurrentMonth,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function loadMonth() {
      if (
        cursor.year === data.calendarMonth.year &&
        cursor.month === data.calendarMonth.month
      ) {
        setMonthEvents(data.calendarMonth.events);
        setHolidayOverrides(data.calendarMonth.holidayOverrides ?? {});
        setMonthError(null);
        return;
      }

      setLoadingMonth(true);
      setMonthError(null);
      try {
        const { from, to } = monthDateRange(cursor.year, cursor.month);
        const response = await fetch(
          `/api/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        );
        const json = (await response.json()) as {
          data?: CalendarEventView[];
          holidayOverrides?: Record<string, boolean>;
          error?: string;
        };
        if (!response.ok) throw new Error(json.error ?? "讀取失敗");
        if (!cancelled) {
          setMonthEvents(json.data ?? []);
          setHolidayOverrides(json.holidayOverrides ?? {});
        }
      } catch (err) {
        if (!cancelled) {
          setMonthError(err instanceof Error ? err.message : "讀取失敗");
        }
      } finally {
        if (!cancelled) setLoadingMonth(false);
      }
    }

    void loadMonth();
    return () => {
      cancelled = true;
    };
  }, [
    cursor.month,
    cursor.year,
    data.calendarMonth.events,
    data.calendarMonth.holidayOverrides,
    data.calendarMonth.month,
    data.calendarMonth.year,
  ]);

  const cells = useMemo(
    () =>
      buildMonthGrid(cursor.year, cursor.month, monthEvents, holidayOverrides),
    [cursor.month, cursor.year, holidayOverrides, monthEvents],
  );

  return (
    <section className="grid h-full min-h-0 gap-6 overflow-auto lg:grid-cols-[1.5fr_1fr]">
      <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-3xl font-semibold">
              {formatMonthTitle(cursor.year, cursor.month)}
            </h2>
            <p className="mt-1 text-base text-slate-400">
              {loadingMonth ? "載入中…" : "活動總覽"}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                setCursor((prev) => addMonths(prev.year, prev.month, -1))
              }
              className="min-h-12 rounded-xl border border-slate-600 bg-slate-800 px-4 text-base font-semibold text-slate-100 active:bg-slate-700"
            >
              上月
            </button>
            <button
              type="button"
              onClick={() =>
                setCursor({
                  year: data.calendarMonth.year,
                  month: data.calendarMonth.month,
                })
              }
              className="min-h-12 rounded-xl border border-slate-600 bg-slate-800 px-4 text-base font-semibold text-slate-100 active:bg-slate-700"
            >
              本月
            </button>
            <button
              type="button"
              onClick={() =>
                setCursor((prev) => addMonths(prev.year, prev.month, 1))
              }
              className="min-h-12 rounded-xl border border-slate-600 bg-slate-800 px-4 text-base font-semibold text-slate-100 active:bg-slate-700"
            >
              下月
            </button>
          </div>
        </div>
        {monthError ? (
          <p className="mt-2 text-base text-rose-300">{monthError}</p>
        ) : null}
        <div className="mt-4">
          <MonthCalendarGrid
            cells={cells}
            today={data.today}
            variant="display"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-5">
        <h2 className="text-3xl font-semibold">倒數</h2>
        <p className="mt-1 text-base text-slate-400">今天起未來活動</p>
        <ul className="mt-4 space-y-3">
          {data.calendarCountdown.length === 0 ? (
            <li className="text-xl text-slate-500">近期沒有活動</li>
          ) : (
            data.calendarCountdown.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-slate-600 bg-slate-950/50 px-4 py-3"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-2xl font-semibold text-stone-50">
                    {item.title}
                  </p>
                  <p className="shrink-0 text-xl font-bold text-amber-300">
                    {formatCountdownLabel(item.daysUntil)}
                  </p>
                </div>
                <p className="mt-1 text-lg text-slate-400">
                  {formatDisplayDate(item.date)}
                  {item.allDay ? "" : ` · ${item.timeLabel}`}
                </p>
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  );
}

function PassportMatrixOverview({
  chinese,
  english,
}: {
  chinese: PassportMatrixView;
  english: PassportMatrixView;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [box, setBox] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    function measure() {
      if (!viewport || !content) return;
      const width = content.offsetWidth;
      const height = content.offsetHeight;
      if (width < 8 || height < 8) return;
      const next = Math.min(
        (viewport.clientWidth - 16) / width,
        (viewport.clientHeight - 16) / height,
      );
      // 可放大也可縮小，讓雙矩陣盡量填滿可視區且不捲動
      const safe =
        Number.isFinite(next) && next > 0 ? Math.min(Math.max(next, 0.2), 3) : 1;
      setScale((prev) => (Math.abs(prev - safe) < 0.01 ? prev : safe));
      setBox((prev) =>
        Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1
          ? prev
          : { width, height },
      );
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(content);
    return () => observer.disconnect();
  }, [
    chinese.students.length,
    english.students.length,
    chinese.weeks.length,
    english.weeks.length,
  ]);

  return (
    <div
      ref={viewportRef}
      className="flex h-full min-h-0 w-full items-center justify-center overflow-hidden"
      aria-label="護照全班總表（唯讀）"
    >
      <div
        className="relative shrink-0 overflow-hidden"
        style={
          box.width
            ? { width: box.width * scale, height: box.height * scale }
            : undefined
        }
      >
        <div
          ref={contentRef}
          className="pointer-events-none w-max select-none"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <div className="flex gap-4">
            <CompactPassportMatrix title="國語護照" matrix={chinese} />
            <CompactPassportMatrix title="英語護照" matrix={english} />
          </div>
        </div>
      </div>
    </div>
  );
}

function CompactPassportMatrix({
  title,
  matrix,
}: {
  title: string;
  matrix: PassportMatrixView;
}) {
  return (
    <section className="shrink-0 rounded-xl border border-slate-700 bg-slate-900/80 p-3">
      <h2 className="whitespace-nowrap px-1 text-lg font-semibold">
        {title} · {matrix.weekLabel}
      </h2>
      <table className="mt-2 w-max border-collapse text-center text-xs leading-none">
        <thead>
          <tr className="bg-slate-800">
            <th className="whitespace-nowrap px-2 py-1.5">座號</th>
            <th className="whitespace-nowrap px-2 py-1.5 text-left">姓名</th>
            {matrix.weeks.map((week) => (
              <th
                key={week}
                className={cn(
                  "whitespace-nowrap px-1.5 py-1.5 font-medium",
                  week === matrix.currentWeek && "bg-sky-900 text-sky-200",
                )}
              >
                {week}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.students.map((student) => (
            <tr key={student.studentId} className="border-t border-slate-800">
              <td className="whitespace-nowrap px-2 py-1 font-medium">
                {student.seatNumber}
              </td>
              <td className="whitespace-nowrap px-2 py-1 text-left">
                {student.name}
              </td>
              {student.cells.map((cell) => (
                <td key={cell.week} className="px-1 py-1">
                  <span
                    aria-hidden
                    className={cn(
                      "mx-auto block h-5 w-5 rounded border",
                      cell.status === "completed" &&
                        "border-emerald-400 bg-emerald-500",
                      cell.status === "missing_parent" &&
                        "border-rose-400 bg-rose-500",
                      cell.status === "not_started" &&
                        "border-slate-600 bg-slate-800",
                      cell.week === matrix.currentWeek && "ring-1 ring-sky-400",
                    )}
                    title={
                      cell.status === "completed"
                        ? "完成"
                        : cell.status === "missing_parent"
                          ? "缺家長"
                          : "未開始"
                    }
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function PassportStudentFocus({
  studentId,
  studentLabel,
  chinese,
  english,
  canToggle,
  busyKey,
  onCycle,
}: {
  studentId: string;
  studentLabel: string;
  chinese: PassportMatrixView;
  english: PassportMatrixView;
  canToggle: boolean;
  busyKey: string | null;
  onCycle: (
    type: "Chinese" | "English",
    week: number,
    current: PassportStatus,
  ) => void;
}) {
  const rows = [
    { label: "國語護照", matrix: chinese, type: "Chinese" as const },
    { label: "英語護照", matrix: english, type: "English" as const },
  ];

  return (
    <section className="flex h-full min-h-0 flex-col justify-end gap-4 overflow-hidden">
      <div className="rounded-2xl border border-sky-400/50 bg-slate-900/90 p-4">
        <h2 className="text-3xl font-semibold text-sky-100">{studentLabel}</h2>
        <p className="mt-1 text-base text-slate-400">
          只顯示你的橫欄 · 點週數循環（未開始／缺／完成）
        </p>
      </div>
      {rows.map(({ label, matrix, type }) => {
        const student = matrix.students.find(
          (item) => item.studentId === studentId,
        );
        if (!student) return null;
        return (
          <div
            key={type}
            className="rounded-2xl border border-slate-600 bg-slate-900/90 p-4"
          >
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h3 className="text-2xl font-semibold">{label}</h3>
              <p className="text-sm text-slate-400">{matrix.weekLabel}</p>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {student.cells.map((cell) => {
                const key = `${studentId}:${type}:${cell.week}`;
                return (
                  <button
                    key={cell.week}
                    type="button"
                    disabled={!canToggle || busyKey === key}
                    aria-label={`${label}第 ${cell.week} 週`}
                    onClick={() => {
                      if (!canToggle) return;
                      onCycle(type, cell.week, cell.status);
                    }}
                    className={cn(
                      "flex h-16 min-w-16 flex-col items-center justify-center rounded-xl border text-lg font-bold transition active:scale-95",
                      cell.status === "completed" &&
                        "border-emerald-300 bg-emerald-500 text-white",
                      cell.status === "missing_parent" &&
                        "border-rose-300 bg-rose-500 text-white",
                      cell.status === "not_started" &&
                        "border-slate-500 bg-slate-800 text-slate-200",
                      cell.week === matrix.currentWeek && "ring-2 ring-amber-300",
                      canToggle && "cursor-pointer",
                      !canToggle && "cursor-default opacity-90",
                    )}
                  >
                    <span className="text-xs font-medium opacity-90">
                      W{cell.week}
                    </span>
                    {cell.status === "completed"
                      ? "✓"
                      : cell.status === "missing_parent"
                        ? "缺"
                        : "—"}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function ReadingMatrixOverview({
  newspaper,
  reflection,
}: {
  newspaper: ReadingMatrixView;
  reflection: ReadingMatrixView;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [box, setBox] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    function measure() {
      if (!viewport || !content) return;
      const width = content.offsetWidth;
      const height = content.offsetHeight;
      if (width < 8 || height < 8) return;
      const next = Math.min(
        (viewport.clientWidth - 16) / width,
        (viewport.clientHeight - 16) / height,
      );
      const safe =
        Number.isFinite(next) && next > 0 ? Math.min(Math.max(next, 0.2), 3) : 1;
      setScale((prev) => (Math.abs(prev - safe) < 0.01 ? prev : safe));
      setBox((prev) =>
        Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1
          ? prev
          : { width, height },
      );
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(content);
    return () => observer.disconnect();
  }, [
    newspaper.students.length,
    reflection.students.length,
    newspaper.months.length,
    reflection.months.length,
  ]);

  return (
    <div
      ref={viewportRef}
      className="flex h-full min-h-0 w-full items-center justify-center overflow-hidden"
      aria-label="閱讀全班總表（唯讀）"
    >
      <div
        className="relative shrink-0 overflow-hidden"
        style={
          box.width
            ? { width: box.width * scale, height: box.height * scale }
            : undefined
        }
      >
        <div
          ref={contentRef}
          className="pointer-events-none w-max select-none"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <div className="flex gap-4">
            <CompactReadingMatrix
              title={READING_TYPE_LABEL.newspaper}
              matrix={newspaper}
            />
            <CompactReadingMatrix
              title={READING_TYPE_LABEL.reflection}
              matrix={reflection}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function CompactReadingMatrix({
  title,
  matrix,
}: {
  title: string;
  matrix: ReadingMatrixView;
}) {
  return (
    <section className="shrink-0 rounded-xl border border-slate-700 bg-slate-900/80 p-3">
      <h2 className="whitespace-nowrap px-1 text-lg font-semibold">
        {title} · {matrix.overallCompleted}/{matrix.overallTotal}
      </h2>
      <table className="mt-2 w-max border-collapse text-center text-xs leading-none">
        <thead>
          <tr className="bg-slate-800">
            <th className="whitespace-nowrap px-2 py-1.5">座號</th>
            <th className="whitespace-nowrap px-2 py-1.5 text-left">姓名</th>
            {matrix.months.map((month) => (
              <th
                key={month}
                className={cn(
                  "whitespace-nowrap px-1.5 py-1.5 font-medium",
                  month === matrix.currentMonth && "bg-sky-900 text-sky-200",
                )}
              >
                {month}月
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.students.map((student) => (
            <tr key={student.studentId} className="border-t border-slate-800">
              <td className="whitespace-nowrap px-2 py-1 font-medium">
                {student.seatNumber}
              </td>
              <td className="whitespace-nowrap px-2 py-1 text-left">
                {student.name}
              </td>
              {student.cells.map((cell) => (
                <td key={cell.month} className="px-1 py-1">
                  <span
                    aria-hidden
                    className={cn(
                      "mx-auto block h-5 w-5 rounded border",
                      cell.status === "completed" &&
                        "border-emerald-400 bg-emerald-500",
                      cell.status === "missing_parent" &&
                        "border-rose-400 bg-rose-500",
                      cell.status === "not_started" &&
                        "border-slate-600 bg-slate-800",
                      cell.month === matrix.currentMonth &&
                        "ring-1 ring-sky-400",
                    )}
                    title={
                      cell.status === "completed"
                        ? "完成"
                        : cell.status === "missing_parent"
                          ? "缺家長"
                          : "未開始"
                    }
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function ReadingStudentFocus({
  studentId,
  studentLabel,
  newspaper,
  reflection,
  canToggle,
  busyKey,
  onCycle,
}: {
  studentId: string;
  studentLabel: string;
  newspaper: ReadingMatrixView;
  reflection: ReadingMatrixView;
  canToggle: boolean;
  busyKey: string | null;
  onCycle: (type: ReadingType, month: number, current: PassportStatus) => void;
}) {
  const rows = [
    {
      label: READING_TYPE_LABEL.newspaper,
      matrix: newspaper,
      type: "newspaper" as const,
    },
    {
      label: READING_TYPE_LABEL.reflection,
      matrix: reflection,
      type: "reflection" as const,
    },
  ];
  const termLabel = `${newspaper.schoolYear} 學年度${READING_SEMESTER_LABEL[newspaper.semester]}`;

  return (
    <section className="flex h-full min-h-0 flex-col justify-end gap-4 overflow-hidden">
      <div className="rounded-2xl border border-sky-400/50 bg-slate-900/90 p-4">
        <h2 className="text-3xl font-semibold text-sky-100">{studentLabel}</h2>
        <p className="mt-1 text-base text-slate-400">
          {termLabel} · 只顯示你的橫欄 · 點月份循環（未開始／缺／完成）
        </p>
      </div>
      {rows.map(({ label, matrix, type }) => {
        const student = matrix.students.find(
          (item) => item.studentId === studentId,
        );
        if (!student) return null;
        return (
          <div
            key={type}
            className="rounded-2xl border border-slate-600 bg-slate-900/90 p-4"
          >
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h3 className="text-2xl font-semibold">{label}</h3>
              <p className="text-sm text-slate-400">
                {student.completedCount}/{matrix.months.length}
              </p>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {student.cells.map((cell) => {
                const key = `${studentId}:${type}:${cell.month}`;
                return (
                  <button
                    key={cell.month}
                    type="button"
                    disabled={!canToggle || busyKey === key}
                    aria-label={`${label}${cell.month}月`}
                    onClick={() => {
                      if (!canToggle) return;
                      onCycle(type, cell.month, cell.status);
                    }}
                    className={cn(
                      "flex h-16 min-w-16 flex-col items-center justify-center rounded-xl border text-lg font-bold transition active:scale-95",
                      cell.status === "completed" &&
                        "border-emerald-300 bg-emerald-500 text-white",
                      cell.status === "missing_parent" &&
                        "border-rose-300 bg-rose-500 text-white",
                      cell.status === "not_started" &&
                        "border-slate-500 bg-slate-800 text-slate-200",
                      cell.month === matrix.currentMonth &&
                        "ring-2 ring-amber-300",
                      canToggle && "cursor-pointer",
                      !canToggle && "cursor-default opacity-90",
                    )}
                  >
                    <span className="text-xs font-medium opacity-90">
                      {cell.month}月
                    </span>
                    {cell.status === "completed"
                      ? "✓"
                      : cell.status === "missing_parent"
                        ? "缺"
                        : "—"}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function PersonalChecklist({
  data,
  row,
  busyKey,
  canRoutine,
  canHomework,
  onRoutine,
  onHomework,
}: {
  data: DisplayData;
  row: DisplayPersonalRow | null;
  busyKey: string | null;
  canRoutine: boolean;
  canHomework: boolean;
  onRoutine: (taskKey: string, completed: boolean) => void;
  onHomework: (homeworkId: string, next: boolean) => void;
}) {
  if (!row) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-600 p-8">
        <p className="text-2xl text-slate-400">選座號後在此打勾</p>
      </div>
    );
  }

  const hwCells =
    data.homework.students.find((s) => s.studentId === row.studentId)?.cells ??
    [];

  return (
    <div className="self-end">
      <h2 className="text-3xl font-semibold">
        {row.seatNumber} {row.name}
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <ul className="space-y-3 text-xl">
          <CheckRow
            label="上午打掃"
            done={row.morningCleaning}
            disabled={
              !canRoutine || busyKey === `${row.studentId}:morning_cleaning`
            }
            onToggle={() =>
              onRoutine("morning_cleaning", !row.morningCleaning)
            }
          />
          <CheckRow
            label="抄聯絡簿"
            done={row.contactBookCopied}
            disabled={
              !canRoutine ||
              busyKey === `${row.studentId}:contact_book_copied`
            }
            onToggle={() =>
              onRoutine("contact_book_copied", !row.contactBookCopied)
            }
          />
        </ul>
        <ul className="space-y-3 text-xl">
          {hwCells.length === 0 ? (
            <li className="rounded-xl border border-slate-700 px-4 py-3 text-slate-400">
              今日無繳交項
            </li>
          ) : (
            hwCells.map((cell) => (
              <CheckRow
                key={cell.homeworkId}
                label={cell.title}
                done={cell.completed}
                disabled={
                  !canHomework ||
                  busyKey === `${row.studentId}:${cell.homeworkId}`
                }
                onToggle={() => onHomework(cell.homeworkId, !cell.completed)}
              />
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

function CheckRow({
  label,
  done,
  note,
  disabled,
  onToggle,
}: {
  label: string;
  done: boolean;
  note?: string;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition",
          done
            ? "border-emerald-400/50 bg-emerald-500/20"
            : "border-slate-600 bg-slate-950/40",
          !disabled && "hover:brightness-110",
          disabled && "cursor-default opacity-80",
        )}
      >
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md border text-lg",
            done
              ? "border-emerald-300 bg-emerald-500 text-white"
              : "border-slate-500",
          )}
        >
          {done ? "✓" : ""}
        </span>
        <span className="flex-1">
          {label}
          {note ? (
            <span className="ml-2 text-base text-rose-300">{note}</span>
          ) : null}
        </span>
      </button>
    </li>
  );
}
