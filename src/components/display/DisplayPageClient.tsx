"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import {
  formatDisplayDate,
  formatMonthTitle,
  addMonths,
  monthDateRange,
} from "@/lib/dates";
import { cn } from "@/lib/utils";
import { MonthCalendarGrid } from "@/components/calendar/MonthCalendarGrid";
import { buildMonthGrid } from "@/lib/calendarMonth";
import type {
  DisplayData,
  DisplayDebtRow,
  DisplayPersonalRow,
} from "@/types/display";
import { formatCountdownLabel, type CalendarEventView } from "@/types/calendar";
import {
  nextBinaryPassportStatus,
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

function updatePassportMatrix(
  matrix: PassportMatrixView,
  studentId: string,
  week: number,
  status: PassportStatus,
): PassportMatrixView {
  const students = matrix.students.map((student) => {
    if (student.studentId !== studentId) return student;
    const cells = student.cells.map((cell) =>
      cell.week === week ? { ...cell, status } : cell,
    );
    return {
      ...student,
      cells,
      completedCount: cells.filter((cell) => cell.status === "completed").length,
    };
  });
  const weekTotals = matrix.weekTotals.map((total) => {
    if (total.week !== week) return total;
    const cells = students.flatMap((student) =>
      student.cells.filter((cell) => cell.week === week),
    );
    return {
      ...total,
      completed: cells.filter((cell) => cell.status === "completed").length,
      missingParent: cells.filter((cell) => cell.status === "missing_parent").length,
      notStarted: cells.filter((cell) => cell.status === "not_started").length,
    };
  });
  return {
    ...matrix,
    students,
    weekTotals,
    overallCompleted: students.reduce((sum, student) => sum + student.completedCount, 0),
  };
}

function updateReadingMatrix(
  matrix: ReadingMatrixView,
  studentId: string,
  month: number,
  status: PassportStatus,
): ReadingMatrixView {
  const students = matrix.students.map((student) => {
    if (student.studentId !== studentId) return student;
    const cells = student.cells.map((cell) =>
      cell.month === month ? { ...cell, status } : cell,
    );
    return {
      ...student,
      cells,
      completedCount: cells.filter((cell) => cell.status === "completed").length,
    };
  });
  const monthTotals = matrix.monthTotals.map((total) => {
    if (total.month !== month) return total;
    const cells = students.flatMap((student) =>
      student.cells.filter((cell) => cell.month === month),
    );
    return {
      ...total,
      completed: cells.filter((cell) => cell.status === "completed").length,
      missingParent: cells.filter((cell) => cell.status === "missing_parent").length,
      notStarted: cells.filter((cell) => cell.status === "not_started").length,
    };
  });
  return {
    ...matrix,
    students,
    monthTotals,
    overallCompleted: students.reduce((sum, student) => sum + student.completedCount, 0),
  };
}

function updateHomeworkStatus(
  homework: DisplayData["homework"],
  studentId: string,
  homeworkId: string,
  status: "unsubmitted" | "pending_confirmation",
) {
  const students = homework.students.map((student) => {
    if (student.studentId !== studentId) return student;
    const cells = student.cells.map((cell) =>
      cell.homeworkId === homeworkId
        ? { ...cell, status, completed: false }
        : cell,
    );
    const missingTitles = cells
      .filter((cell) => cell.status !== "completed")
      .map((cell) => cell.title);
    return { ...student, cells, missingTitles, allDone: missingTitles.length === 0 };
  });
  return {
    ...homework,
    students,
    completedStudentCount: students.filter((student) => student.allDone).length,
  };
}

type PanelKey =
  "today" | "passport" | "lunch" | "student" | "debts" | "calendar";

const PANEL_ORDER: PanelKey[] = [
  "today",
  "passport",
  "lunch",
  "student",
  "debts",
  "calendar",
];
const PANEL_LABEL: Record<PanelKey, string> = {
  today: "聯絡簿",
  passport: "護照與閱讀",
  lunch: "午餐",
  student: "學生資訊",
  debts: "欠繳作業",
  calendar: "行事曆",
};
const SEAT_IDLE_MS = 30_000;
const CAROUSEL_MS = 60_000;

type DisplayLayout = "ultra" | "wide" | "standard" | "compact";

function getDisplayLayout(width: number, height: number, devicePixelRatio = 1): DisplayLayout {
  // 瀏覽器網址列與 Windows 工作列會吃掉高度，不能單靠高度判定。
  // 1280×720 的電子白板一律保留雙欄；只有真正窄或接近直式的畫面才改直向。
  if (width < 1120 || width / Math.max(height, 1) < 1.45) {
    return "compact";
  }
  // Windows 的顯示比例可能讓 4K 白板回報為 1920 或 2560 CSS px；以實際像素一起判定。
  if (width * devicePixelRatio >= 3000 && height * devicePixelRatio >= 1600) {
    return "ultra";
  }
  if (width < 1500 || height < 900) return "standard";
  return "wide";
}

export function DisplayPageClient() {
  const searchParams = useSearchParams();
  const displayKey = searchParams.get("key") ?? "";
  const displayHeaders = useMemo<Record<string, string>>(
    () => {
      const headers: Record<string, string> = {};
      if (displayKey) headers["X-Display-Key"] = displayKey;
      return headers;
    },
    [displayKey],
  );
  const [data, setData] = useState<DisplayData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState("");
  const [panel, setPanel] = useState<PanelKey>("today");
  const [studentView, setStudentView] = useState<"overview" | "shop" | "backpack">("overview");
  const [backpackStudentId, setBackpackStudentId] = useState<string | null>(null);
  const [progressPanel, setProgressPanel] = useState<"passport" | "reading">(
    "passport",
  );
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [shopRequests, setShopRequests] = useState<Set<string>>(() => new Set());
  const [needsScroll, setNeedsScroll] = useState(false);
  const [viewport, setViewport] = useState({ width: 1440, height: 900, devicePixelRatio: 1 });
  const displaySyncInterval = data
    ? Math.max(2, Math.min(data.displaySettings.refreshSeconds, 5)) * 1000
    : 0;
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const displayVersionRef = useRef("");
  const contentScrollRef = useRef<HTMLDivElement>(null);

  const displayLayout = getDisplayLayout(viewport.width, viewport.height, viewport.devicePixelRatio);
  const configuredFontSize = data?.displaySettings.fontSize ?? 16;
  // `html` 的字級同時也是所有 rem 間距與元件尺寸的基準。不能因為面板是 4K
  // 就強制放大，否則 Windows 的縮放比例下會把整個版面一起撐出可視範圍。
  // 保留導師設定的字級，但依 CSS 可用空間設安全上限，優先確保學生不用縮放瀏覽器。
  const maxFontSize = displayLayout === "compact" ? 16 : displayLayout === "standard" ? 18 : displayLayout === "wide" ? 20 : 22;
  const minFontSize = 12;
  const effectiveFontSize = Math.min(
    Math.max(configuredFontSize, minFontSize),
    maxFontSize,
  );

  useEffect(() => {
    function updateViewport() {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio || 1,
      });
    }
    updateViewport();
    window.addEventListener("resize", updateViewport);
    return () => window.removeEventListener("resize", updateViewport);
  }, []);

  useEffect(() => {
    const previous = document.documentElement.style.fontSize;
    // 字級仍由導師設定，但會依可用空間設上限，避免小螢幕把按鈕擠出畫面。
    document.documentElement.style.fontSize = `${effectiveFontSize}px`;
    return () => { document.documentElement.style.fontSize = previous; };
  }, [effectiveFontSize]);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/display", { headers: displayHeaders });
      const json = (await response.json()) as {
        data?: DisplayData;
        error?: string;
      };
      if (!response.ok) throw new Error(json.error ?? "讀取失敗");
      const nextData = json.data ?? null;
      displayVersionRef.current = nextData?.version ?? displayVersionRef.current;
      setData(nextData);
      setError(null);
      const now = new Date();
      setUpdatedAt(
        `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "讀取失敗");
    }
  }, [displayHeaders]);

  useEffect(() => {
    void load();
  }, [load]);

  const checkDisplayVersion = useCallback(async () => {
    try {
      const response = await fetch("/api/display/version", {
        headers: displayHeaders,
      });
      const json = (await response.json()) as {
        data?: { version?: string };
      };
      if (!response.ok || !json.data?.version) return;
      if (displayVersionRef.current && json.data.version !== displayVersionRef.current) {
        void load();
      }
    } catch {
      // 背景同步失敗不影響學生當下已看到的 optimistic UI；下次輪詢會再嘗試。
    }
  }, [displayHeaders, load]);

  useEffect(() => {
    if (!displaySyncInterval) return;
    const id = setInterval(() => {
      void checkDisplayVersion();
    }, displaySyncInterval);
    return () => clearInterval(id);
  }, [displaySyncInterval, checkDisplayVersion]);

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
    idleTimer.current = setTimeout(
      () => {
        setActiveStudentId(null);
      },
      SEAT_IDLE_MS,
    );
  }

  function selectStudent(studentId: string) {
    if (activeStudentId === studentId) {
      setActiveStudentId(null);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      return;
    }
    setActiveStudentId(studentId);
    bumpIdle();
    setPanel((prev) => (prev === "passport" || prev === "student" || prev === "lunch" ? prev : "today"));
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
    if (activeStudentId !== studentId) return;
    await patchRoutineRequest(studentId, taskKey, completed);
  }

  async function patchRoutineRequest(
    studentId: string,
    taskKey: string,
    completed: boolean,
  ) {
    if (!data) return;
    const previousData = data;
    const taskDate = data.today;
    setBusyKey(`${studentId}:${taskKey}`);
    bumpIdle();
    // 點擊當下先更新畫面；網路與資料庫寫入在背景完成，失敗才還原。
    setData((previous) => {
      if (!previous) return previous;
      const personal = previous.personal.map((row) => {
        if (row.studentId !== studentId) return row;
        if (taskKey === "morning_cleaning") return { ...row, morningCleaning: completed };
        if (taskKey === "summer_homework_submitted") return { ...row, summerHomeworkSubmitted: completed };
        if (taskKey === "contact_book_copied") return { ...row, contactBookCopied: completed };
        if (taskKey === "lunch_brushing") return { ...row, lunchBrushing: completed };
        if (taskKey === "noon_cleaning") return { ...row, noonCleaning: completed };
        return row;
      });
      const updateProgress = (items: DisplayData["progress"], key: string) =>
        items.map((item) => item.key === key
          ? { ...item, completed: Math.max(0, item.completed + (completed ? 1 : -1)) }
          : item);
      return {
        ...previous,
        personal,
        progress: updateProgress(previous.progress, taskKey),
        lunchProgress: updateProgress(previous.lunchProgress, taskKey),
      };
    });
    try {
      const response = await fetch("/api/routines", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...displayHeaders },
        body: JSON.stringify({
          studentId,
          taskKey,
          completed,
          taskDate,
        }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "更新失敗");
    } catch (err) {
      setData(previousData);
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
    const previousData = data;
    setBusyKey(`${studentId}:${type}:${week}`);
    bumpIdle();
    setData((current) => {
      if (!current) return current;
      const matrixKey = type === "Chinese" ? "chineseMatrix" : "englishMatrix";
      return {
        ...current,
        passport: {
          ...current.passport,
          [matrixKey]: updatePassportMatrix(
            current.passport[matrixKey], studentId, week, status,
          ),
        },
        personal: current.personal.map((row) =>
          row.studentId !== studentId
            ? row
            : type === "Chinese"
              ? { ...row, chinesePassport: status }
              : { ...row, englishPassport: status },
        ),
      };
    });
    try {
      const response = await fetch("/api/passport", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...displayHeaders },
        body: JSON.stringify({
          studentId,
          type,
          week,
          status,
        }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "更新失敗");
    } catch (err) {
      setData(previousData);
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
    const previousData = data;
    setBusyKey(`${studentId}:${homeworkId}`);
    bumpIdle();
    setData((current) => {
      if (!current) return current;
      const homework = updateHomeworkStatus(
        current.homework,
        studentId,
        homeworkId,
        next ? "pending_confirmation" : "unsubmitted",
      );
      const submittedRows = homework.students.filter((row) =>
        row.cells.every((cell) => cell.status !== "unsubmitted"),
      );
      return {
        ...current,
        homework,
        progress: current.progress.map((item) =>
          item.key === "homework"
            ? {
                ...item,
                completed: submittedRows.length,
                missingNames: homework.students
                  .filter((row) => row.cells.some((cell) => cell.status === "unsubmitted"))
                  .map((row) => row.name),
              }
            : item,
        ),
      };
    });
    try {
      const response = await fetch("/api/homework-record", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...displayHeaders },
        body: JSON.stringify({
          studentId,
          homeworkId,
          status: next ? "pending_confirmation" : "unsubmitted",
        }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "更新失敗");
    } catch (err) {
      setData(previousData);
      setError(err instanceof Error ? err.message : "更新失敗");
    } finally {
      setBusyKey(null);
    }
  }

  async function requestShopItem(studentId: string, itemId: string) {
    if (!data?.shop.open || activeStudentId !== studentId) return;
    const requestKey = `${studentId}:${itemId}`;
    setBusyKey(`shop:${itemId}`);
    setShopRequests((previous) => new Set(previous).add(requestKey));
    try {
      const response = await fetch("/api/shop", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...displayHeaders },
        body: JSON.stringify({ action: "purchase", studentId, itemId }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "兌換失敗");
    } catch (err) {
      setShopRequests((previous) => {
        const next = new Set(previous);
        next.delete(requestKey);
        return next;
      });
      setError(err instanceof Error ? err.message : "兌換失敗");
    } finally {
      setBusyKey(null);
    }
  }

  async function requestBackpackUse(rewardId: string, cancel = false) {
    if (!data) return;
    const previousData = data;
    setBusyKey(`reward:${rewardId}`);
    setData((current) => current ? { ...current, backpacks: current.backpacks.map((bag) => ({ ...bag, items: bag.items.map((item) => item.id === rewardId ? { ...item, status: cancel ? "available" : "requested" } : item) })) } : current);
    try {
      const response = await fetch("/api/shop", { method: "POST", headers: { "Content-Type": "application/json", ...displayHeaders }, body: JSON.stringify({ action: cancel ? "cancel-use" : "request-use", rewardId }) });
      const json = await response.json() as { error?: string }; if (!response.ok) throw new Error(json.error ?? "更新背包失敗");
    } catch (err) { setData(previousData); setError(err instanceof Error ? err.message : "更新背包失敗"); }
    finally { setBusyKey(null); }
  }

  async function claimDutySubstitution(id: string) {
    if (!data || !activeStudentId) return;
    const previousData = data;
    setBusyKey(`substitution:${id}`);
    bumpIdle();
    setData((current) => current ? {
      ...current,
      dutyToday: {
        ...current.dutyToday,
        substitutions: current.dutyToday.substitutions.map((item) =>
          item.id === id
            ? { ...item, status: "claimed", isVolunteer: true, substituteStudentId: activeStudentId, substituteStudentName: current.students.find((student) => student.studentId === activeStudentId)?.name ?? null }
            : item,
        ),
      },
    } : current);
    try {
      const response = await fetch("/api/display/duty-substitution", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...displayHeaders },
        body: JSON.stringify({ id, studentId: activeStudentId }),
      });
      const json = await response.json() as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "登記代班失敗");
    } catch (err) {
      setData(previousData);
      setError(err instanceof Error ? err.message : "登記代班失敗");
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
    const previousData = data;
    setBusyKey(`${studentId}:${type}:${month}`);
    bumpIdle();
    setData((current) => {
      if (!current) return current;
      return {
        ...current,
        reading: {
          ...current.reading,
          [type]: updateReadingMatrix(current.reading[type], studentId, month, status),
        },
      };
    });
    try {
      const response = await fetch("/api/reading", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...displayHeaders },
        body: JSON.stringify({
          studentId,
          type,
          month,
          status,
        }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "更新失敗");
    } catch (err) {
      setData(previousData);
      setError(err instanceof Error ? err.message : "更新失敗");
    } finally {
      setBusyKey(null);
    }
  }

  const showSeatPicker = Boolean(
    data &&
    panel !== "calendar" && panel !== "lunch" && panel !== "debts" &&
    !(panel === "student" && studentView === "overview") &&
    data.students.length > 0,
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
        "flex h-full min-h-0 flex-col overflow-hidden overscroll-none",
        displayLayout === "compact" ? "gap-[8px]" : displayLayout === "ultra" ? "gap-[24px]" : "gap-[16px]",
        showSeatPicker ? "pb-[112px]" : "pb-[80px]",
      )}
    >
      <header className={cn("flex shrink-0 flex-wrap items-center justify-between", displayLayout === "compact" ? "gap-2" : "gap-3")}>
        <div className={cn("flex flex-wrap items-center", displayLayout === "compact" ? "gap-3" : "gap-4 md:gap-8")}>
          <h1 className="text-2xl font-semibold md:text-3xl">
            {data.className}
          </h1>
          <DisplayHeaderClock />
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-300">聯絡簿：{formatDisplayDate(data.contactBook.date)}</p>
          <span className="text-sm text-slate-500">更新 {updatedAt}</span>
        </div>
      </header>

      {error ? <p className="shrink-0 text-sm text-rose-300">{error}</p> : null}

      <div
        ref={contentScrollRef}
        className={cn(
          "flex min-h-0 flex-1 flex-col overscroll-none",
          needsScroll || displayLayout === "compact" ? "overflow-auto" : "overflow-hidden",
        )}
      >
        {panel === "today" ? (
          <TodayPanel
            data={data}
            row={activePersonal}
            busyKey={busyKey}
            canRoutine={Boolean(
              activeStudentId,
            )}
            canHomework={Boolean(
              activeStudentId &&
              data.displaySettings.allowStudentHomeworkToggle,
            )}
            onRoutine={(taskKey, completed) => {
              if (!activeStudentId) return;
              void patchRoutine(activeStudentId, taskKey, completed);
            }}
            onHomework={(homeworkId, next) => {
              if (!activeStudentId) return;
              void toggleHomeworkCell(activeStudentId, homeworkId, next);
            }}
            onClaimSubstitution={(id) => void claimDutySubstitution(id)}
            layout={displayLayout}
          />
        ) : null}

        {panel === "calendar" ? <CalendarOverviewPanel data={data} /> : null}

        {panel === "lunch" ? (
          <LunchPanel
            data={data}
            busyKey={busyKey}
            displayHeaders={displayHeaders}
            onRoutineCell={(studentId, taskKey, completed) => {
              void patchRoutineRequest(studentId, taskKey, completed);
            }}
          />
        ) : null}

        {panel === "student" ? (
          studentView === "shop" ? (
            <ShopDisplayPanel
              data={data}
              row={activePersonal}
              hasDebt={Boolean(activePersonal && data.debts.find((debt) => debt.studentId === activePersonal.studentId)?.hasBlockingDebt)}
              busyKey={busyKey}
              requestedItems={shopRequests}
              layout={displayLayout}
              onBack={() => setStudentView("overview")}
              onRequest={(itemId) => {
                if (activeStudentId) void requestShopItem(activeStudentId, itemId);
              }}
            />
          ) : studentView === "backpack" ? (
            <BackpackDisplayPanel bag={data.backpacks.find((item) => item.studentId === backpackStudentId) ?? null} busyKey={busyKey} onBack={() => setStudentView("overview")} onRequest={(rewardId, cancel) => void requestBackpackUse(rewardId, cancel)} />
          ) : (
            <GamificationOverviewPanel
              rows={data.personal}
              debts={data.debts}
              shopOpen={data.shop.open}
              onOpenShop={() => setStudentView("shop")}
              onOpenBackpack={(studentId) => { setBackpackStudentId(studentId); setStudentView("backpack"); }}
            />
          )
        ) : null}

        {panel === "debts" ? <DebtsPanel debts={data.debts} /> : null}

        {panel === "passport" ? (
          <div className="flex h-full min-h-0 gap-3">
            <aside
              className="flex w-32 shrink-0 flex-col justify-end gap-2 rounded-2xl border border-slate-700 bg-slate-900/80 p-2"
              aria-label="護照與閱讀分類"
            >
              {(
                [
                  ["passport", "護照"],
                  ["reading", "讀報閱讀"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setProgressPanel(key)}
                  className={cn(
                    "min-h-16 rounded-xl border px-3 text-lg font-semibold transition",
                    progressPanel === key
                      ? "border-sky-300 bg-sky-500 text-white"
                      : "border-slate-600 bg-slate-800 text-slate-200 active:bg-slate-700",
                  )}
                >
                  {label}
                </button>
              ))}
            </aside>

            <div className="min-h-0 min-w-0 flex-1">
              {progressPanel === "passport" ? (
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
                        nextBinaryPassportStatus(current),
                      );
                    }}
                  />
                ) : (
                  <PassportMatrixOverview
                    chinese={data.passport.chineseMatrix}
                    english={data.passport.englishMatrix}
                  />
                )
              ) : activeStudentId ? (
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
              )}
            </div>
          </div>
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-700 bg-slate-950/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_30px_rgba(0,0,0,0.35)] backdrop-blur">
        <div className="mx-auto flex w-full items-end gap-3">
          <nav
            className="flex shrink-0 gap-2 overflow-x-auto"
            aria-label="大屏頁面"
          >
            {PANEL_ORDER.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setPanel(key);
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

function GamificationOverviewPanel({
  rows,
  debts,
  shopOpen,
  onOpenShop,
  onOpenBackpack,
}: {
  rows: DisplayPersonalRow[];
  debts: DisplayDebtRow[];
  shopOpen: boolean;
  onOpenShop: () => void;
  onOpenBackpack: (studentId: string) => void;
}) {
  const sorted = useMemo(
    () => [...rows].sort((a, b) => a.seatNumber - b.seatNumber),
    [rows],
  );
  const debtStudentIds = useMemo(
    () => new Set(debts.filter((debt) => debt.hasBlockingDebt).map((debt) => debt.studentId)),
    [debts],
  );
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="shrink-0">
        <h2 className="text-3xl font-semibold">個人點數</h2>
      </div>
      <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-1 gap-3 overflow-auto sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {sorted.map((row) => (
          <button
            type="button"
            onClick={() => onOpenBackpack(row.studentId)}
            key={row.studentId}
            className="flex min-h-36 flex-col justify-between rounded-2xl border border-slate-700 bg-slate-900/80 p-4 text-left transition active:scale-[0.98]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-slate-400">{row.seatNumber} 號</p>
                <h3 className="mt-1 text-2xl font-semibold">{row.name}</h3>
              </div>
              <div className="flex items-center gap-2">
                {debtStudentIds.has(row.studentId) ? (
                  <span className="rounded-full border border-rose-400/60 bg-rose-500/20 px-2.5 py-1 text-sm font-semibold text-rose-100">欠繳</span>
                ) : null}
                <span className="rounded-full border border-violet-400/50 bg-violet-500/20 px-3 py-1 font-semibold text-violet-200">
                  Lv.{row.gamification.level}
                </span>
              </div>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-sm text-slate-400">
                <span>XP</span>
                <span>
                  {row.gamification.currentLevelXp} /{" "}
                  {row.gamification.nextLevelXp}
                </span>
              </div>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-700">
                <div
                  className="h-full rounded-full bg-violet-400"
                  style={{ width: `${row.gamification.progressPercent}%` }}
                />
              </div>
              <p className="mt-3 text-right text-xl font-semibold text-amber-200">
                {row.gamification.coins} 金幣
              </p>
            </div>
          </button>
        ))}
        <button
          type="button"
          disabled={!shopOpen}
          onClick={onOpenShop}
          className={cn(
            "flex min-h-36 flex-col items-center justify-center rounded-2xl border p-4 text-center transition",
            shopOpen
              ? "border-amber-300 bg-amber-500/15 text-amber-100 active:scale-[0.98]"
              : "cursor-not-allowed border-slate-700 bg-slate-900/50 text-slate-500",
          )}
        >
          <span className="text-4xl">🛍️</span>
          <span className="mt-3 text-2xl font-semibold">班級商店</span>
          <span className="mt-1 text-base">{shopOpen ? "點此進入" : "尚未開放"}</span>
        </button>
      </div>
    </section>
  );
}

function ShopDisplayPanel({
  data,
  row,
  hasDebt,
  busyKey,
  requestedItems,
  layout,
  onBack,
  onRequest,
}: {
  data: DisplayData;
  row: DisplayPersonalRow | null;
  hasDebt: boolean;
  busyKey: string | null;
  requestedItems: Set<string>;
  layout: DisplayLayout;
  onBack: () => void;
  onRequest: (itemId: string) => void;
}) {
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden rounded-2xl border border-amber-400/40 bg-slate-900/80 p-4">
      <div className="flex shrink-0 items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-amber-100">班級商店</h2>
          <p className="mt-0.5 text-sm text-slate-400">
            {row
              ? hasDebt
                ? "你有尚未完成的項目，完成前不能使用商店"
                : "確認你的點數後，點選想兌換的商品"
              : "請先從下方選擇自己的座號"}
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="min-h-10 rounded-xl border border-slate-600 bg-slate-800 px-4 text-base font-semibold text-slate-100"
        >
          返回個人點數
        </button>
      </div>

      {row ? (
        <div className="shrink-0 rounded-2xl border border-violet-400/50 bg-violet-500/10 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-400">目前兌換者</p>
              <p className="text-2xl font-semibold">{row.seatNumber} 號 {row.name}</p>
            </div>
            <div className="flex gap-2 text-lg font-semibold">
              <span className="rounded-full border border-violet-400/50 px-3 py-1.5 text-violet-200">Lv.{row.gamification.level}</span>
              <span className="rounded-full border border-amber-400/50 bg-amber-500/10 px-3 py-1.5 text-amber-200">{row.gamification.coins} 金幣</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-20 shrink-0 items-center justify-center rounded-2xl border border-dashed border-slate-600 text-xl text-slate-400">
          請點下方自己的座號
        </div>
      )}

      {row && hasDebt ? (
        <p className="shrink-0 rounded-xl border border-rose-400/50 bg-rose-500/15 px-4 py-2 text-base font-semibold text-rose-100">
          尚有欠繳項目，請先到「欠繳作業」頁確認並完成，暫時不能兌換商品。
        </p>
      ) : null}

      <div
        className={cn(
          "grid min-h-0 flex-1 auto-rows-fr gap-3 overflow-hidden",
          // 大屏以三欄、兩列呈現目前六項商品：卡片夠寬，且不必在商品區捲動。
          // 商品日後增加時才在超寬螢幕改四欄，仍優先把所有商品留在同一畫面。
          data.shop.items.length > 6 && (layout === "ultra" || layout === "wide")
            ? "grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
            : "grid-cols-2 md:grid-cols-3",
        )}
      >
        {data.shop.items.map((item) => {
          const requested = row
            ? requestedItems.has(`${row.studentId}:${item.id}`)
            : false;
          const affordable = Boolean(row && row.gamification.coins >= item.price);
          const levelMet = Boolean(row && row.gamification.level >= item.minLevel);
          return (
            <button
              key={item.id}
              type="button"
              disabled={!row || hasDebt || requested || !affordable || !levelMet || busyKey === `shop:${item.id}`}
              onClick={() => onRequest(item.id)}
              className={cn(
                "flex min-h-0 h-full flex-col rounded-2xl border p-3 text-left transition disabled:cursor-default disabled:opacity-45",
                requested
                  ? "border-emerald-400 bg-emerald-500/15 text-emerald-100"
                  : "border-amber-300/50 bg-slate-950/50 text-amber-50 enabled:active:scale-[0.98]",
              )}
            >
              <span className="text-3xl">{item.icon}</span>
              <span className="mt-2 text-lg font-semibold leading-tight">{item.name}</span>
              <span className="mt-auto pt-2 text-base text-amber-200">
                {requested ? "✓ 已放入背包" : `${item.price} 金幣`}
              </span>
              <span className={cn("mt-1 text-sm font-semibold", levelMet ? "text-emerald-300" : "text-rose-300")}>
                需 Lv.{item.minLevel}
              </span>
              {item.stock >= 0 ? <span className="mt-1 text-sm text-slate-400">庫存 {item.stock}</span> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function BackpackDisplayPanel({ bag, busyKey, onBack, onRequest }: { bag: DisplayData["backpacks"][number] | null; busyKey: string | null; onBack: () => void; onRequest: (rewardId: string, cancel: boolean) => void }) {
  const grouped = useMemo(() => {
    const map = new Map<string, DisplayData["backpacks"][number]["items"]>();
    for (const item of bag?.items.filter((item) => item.status === "available" || item.status === "requested") ?? []) {
      const key = `${item.itemName}:${item.kind}:${item.description}:${item.status}`; map.set(key, [...(map.get(key) ?? []), item]);
    }
    return [...map.values()];
  }, [bag]);
  return <section className="flex min-h-0 flex-1 flex-col gap-4 rounded-2xl border border-violet-400/40 bg-slate-900/80 p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="text-3xl font-semibold">{bag ? `${bag.seatNumber} 號 ${bag.name} 的背包` : "學生背包"}</h2><p className="mt-1 text-base text-slate-400">獎品永久保留；使用後請交給老師核銷。</p></div><button type="button" onClick={onBack} className="min-h-12 rounded-xl border border-slate-600 bg-slate-800 px-4 text-lg font-semibold">返回</button></div>{!bag ? <div className="flex flex-1 items-center justify-center text-xl text-slate-400">請選擇學生</div> : grouped.length === 0 ? <div className="flex flex-1 items-center justify-center text-xl text-slate-400">背包目前沒有可使用的獎品</div> : <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-auto sm:grid-cols-2 lg:grid-cols-3">{grouped.map((items) => { const item = items[0]; const requested = item.status === "requested"; return <div key={`${item.id}:${item.status}`} className="flex min-h-40 flex-col rounded-2xl border border-violet-400/40 bg-slate-950/50 p-4"><span className="text-4xl">{item.itemIcon}</span><b className="mt-2 text-xl">{item.itemName} × {items.length}</b><span className="mt-1 text-sm text-slate-400">{item.kind === "physical" ? "實體獎品" : "權益獎品"}{item.description ? `・${item.description}` : ""}</span><button type="button" disabled={busyKey === `reward:${item.id}`} onClick={() => onRequest(item.id, requested)} className={cn("mt-auto min-h-12 rounded-xl px-3 text-lg font-semibold", requested ? "bg-slate-700 text-slate-100" : "bg-violet-500 text-white")}>{requested ? "取消使用申請" : item.kind === "physical" ? "我要領取" : "我要使用"}</button></div>; })}</div>}</section>;
}

function DebtsPanel({
  debts,
}: {
  debts: DisplayDebtRow[];
}) {
  const debtCount = debts.filter((row) => row.hasBlockingDebt).length;

  return (
    <section className="flex h-full min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      <div className="shrink-0">
        <h2 className="text-2xl font-semibold">欠繳作業</h2>
        <p className="text-sm text-slate-400">
          作業狀態、護照與閱讀進度一覽 ·
          {` ${debtCount} 人尚有需要自己完成的項目`}
        </p>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-3 gap-2">
          {debts.map((row) => (
              <article
                key={row.studentId}
                className={cn(
                  "flex min-h-0 flex-col overflow-hidden rounded-xl border bg-slate-900/90 p-2.5",
                  row.hasBlockingDebt ? "border-rose-400/40" : "border-emerald-400/40",
                )}
              >
                <div className="flex shrink-0 items-center justify-between gap-2">
                  <h3 className="text-xl font-semibold">
                  {row.seatNumber} {row.name}
                  </h3>
                  <span className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
                    row.hasBlockingDebt
                      ? "border border-rose-400/60 bg-rose-500/20 text-rose-100"
                      : "border border-emerald-400/60 bg-emerald-500/20 text-emerald-100",
                  )}>
                    {row.hasBlockingDebt ? "不能下課" : "可以下課"}
                  </span>
                </div>
                {row.hasDebt ? (
                  <div className="min-h-0 overflow-hidden">
                    <HomeworkStatusGroups items={row.homework} />
                    <DebtGroup label="國語護照" items={row.chinesePassport} />
                    <DebtGroup label="英語護照" items={row.englishPassport} />
                    <DebtGroup label="讀報" items={row.newspaper} />
                    <DebtGroup label="閱讀心得" items={row.reflection} />
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-emerald-200">所有需要完成的項目都已完成。</p>
                )}
              </article>
          ))}
      </div>
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
    <div className="mt-1.5">
      <p className="text-xs font-semibold text-slate-400">{label}</p>
      <ul className="mt-0.5 flex flex-wrap gap-1">
        {items.map((item) => (
          <li
            key={`${label}-${item.label}-${item.note ?? ""}`}
            className="rounded-md border border-rose-400/40 bg-rose-500/15 px-1.5 py-0.5 text-xs text-rose-100"
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

const HOMEWORK_STATUS_META = {
  unsubmitted: {
    label: "未交（請繳交）",
    className: "border-rose-400/50 bg-rose-500/15 text-rose-100",
  },
  correction_required: {
    label: "需訂正",
    className: "border-orange-400/50 bg-orange-500/15 text-orange-100",
  },
  pending_confirmation: {
    label: "已交，待老師確認",
    className: "border-amber-400/50 bg-amber-500/15 text-amber-100",
  },
  completed: {
    label: "已完成",
    className: "border-emerald-400/50 bg-emerald-500/15 text-emerald-100",
  },
} as const;

function HomeworkStatusGroups({
  items,
}: {
  items: DisplayDebtRow["homework"];
}) {
  if (items.length === 0) return null;
  const statuses = [
    "unsubmitted",
    "correction_required",
    "pending_confirmation",
  ] as const;

  return (
    <div className="mt-1.5 space-y-1">
      <p className="text-xs font-semibold text-slate-400">作業</p>
      {statuses.map((status) => {
        const grouped = items.filter((item) => item.status === status);
        if (grouped.length === 0) return null;
        const meta = HOMEWORK_STATUS_META[status];
        return (
          <div key={status}>
            <p className="text-xs font-medium text-slate-300">
              {meta.label} <span className="text-slate-500">{grouped.length}</span>
            </p>
            <ul className="mt-0.5 flex flex-wrap gap-1">
              {grouped.map((item) => (
                <li
                  key={`${status}-${item.label}`}
                  className={cn("rounded-md border px-1.5 py-0.5 text-xs", meta.className)}
                >
                  {item.label}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
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
  onClaimSubstitution,
  layout,
}: {
  data: DisplayData;
  row: DisplayPersonalRow | null;
  busyKey: string | null;
  canRoutine: boolean;
  canHomework: boolean;
  onRoutine: (taskKey: string, completed: boolean) => void;
  onHomework: (homeworkId: string, next: boolean) => void;
  onClaimSubstitution: (id: string) => void;
  layout: DisplayLayout;
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
    <section className={cn(
      "grid min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/80",
      layout === "compact" ? "h-auto gap-[10px] p-[12px]" : "gap-4 p-4 lg:grid-cols-2",
    )}>
      <div className={cn("flex min-h-0 flex-col gap-3", layout === "compact" && "min-h-[360px]")}>
        <div
          ref={boardViewportRef}
          className="flex min-h-0 flex-1 justify-center overflow-hidden rounded-sm border-[8px] border-amber-950 bg-[#173d2b] text-stone-100 shadow-[inset_0_0_30px_rgba(0,0,0,0.45),0_8px_18px_rgba(0,0,0,0.35)] ring-2 ring-amber-800"
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
        {data.dutyToday.substitutions.some((item) => item.status === "open" || item.status === "claimed" || item.status === "assigned") ? (
          <DutySubstitutionCallout
            items={data.dutyToday.substitutions}
            row={row}
            busyKey={busyKey}
            onClaim={onClaimSubstitution}
          />
        ) : null}
      </div>

      <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
        <div className="min-h-0 flex-1 overflow-hidden">
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
        </div>
      </div>
    </section>
  );
}

function DutySubstitutionCallout({
  items,
  row,
  busyKey,
  onClaim,
}: {
  items: DisplayData["dutyToday"]["substitutions"];
  row: DisplayPersonalRow | null;
  busyKey: string | null;
  onClaim: (id: string) => void;
}) {
  return (
    <section className="shrink-0 rounded-2xl border border-amber-300/70 bg-amber-950/40 p-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-amber-100">需要代班</h2>
        <span className="rounded-full bg-amber-300/15 px-3 py-1 text-sm font-bold text-amber-200">完成後 +3 金幣</span>
      </div>
      <div className="mt-2 grid gap-2">
        {items.filter((item) => item.status !== "cancelled" && item.status !== "confirmed").map((item) => (
          <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-100/20 bg-slate-950/40 px-3 py-2">
            <p className="text-base text-slate-100"><span className="font-semibold">{item.label}</span>・{item.absentStudentName}請假</p>
            {item.status === "open" ? (
              <button type="button" disabled={!row || busyKey === `substitution:${item.id}`} onClick={() => onClaim(item.id)} className="rounded-lg bg-amber-300 px-3 py-2 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">
                {row ? "我要代班" : "先選座號"}
              </button>
            ) : (
              <span className="text-sm font-semibold text-emerald-300">{item.substituteStudentName} 已接下</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function TodayProgressOverview({ data }: { data: DisplayData }) {
  return (
    <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2 self-stretch overflow-hidden">
      <h2 className="text-2xl font-semibold leading-tight text-slate-200">
        今日進度
      </h2>
      <div className={cn("grid min-h-0 gap-2 overflow-hidden", data.progress.length === 2 ? "grid-rows-2" : "grid-rows-3")}>
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
                <p className="mt-1.5 whitespace-normal break-words text-base leading-snug text-rose-300">
                  未完成：{item.missingNames.join("、")}
                </p>
              ) : (
                <p className="mt-1.5 text-base text-emerald-300">全部完成</p>
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

function LunchPanel({
  data,
  busyKey,
  displayHeaders,
  onRoutineCell,
}: {
  data: DisplayData;
  busyKey: string | null;
  displayHeaders: Record<string, string>;
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
  const duties = useMemo(
    () => data.dutyToday.slots
      .filter((slot) => slot.name && slot.seatNumber !== null)
      .sort((a, b) => (a.seatNumber ?? 0) - (b.seatNumber ?? 0)),
    [data.dutyToday.slots],
  );
  const videoUrl = toYouTubeEmbedUrl(data.lunchVideoQuery);

  // 午餐時間只讓學生看一種重點：有影片時專心播放；沒有影片時才完整展示工作。
  if (videoUrl) {
    return (
      <section className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/80 p-3">
        <div className="h-full w-full overflow-hidden rounded-xl bg-black">
          <LunchVideoPlayer query={data.lunchVideoQuery} src={videoUrl} displayHeaders={displayHeaders} />
        </div>
      </section>
    );
  }

  return (
    <section className="grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/80 p-4">
        <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950/40 p-3">
          <h2 className="shrink-0 text-xl font-semibold text-slate-100">今日午餐工作</h2>
          <div className="mt-2 min-h-0 flex-1 overflow-auto">
              {data.isReturnDay ? (
                <p className="text-lg text-slate-400">返校日，無午餐工作</p>
              ) : data.dutyToday.isHoliday ? (
                <p className="text-lg text-slate-400">今天放假，無午餐工作</p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {duties.map((slot) => (
                    <article key={slot.slotKey} className="rounded-xl border border-slate-600/80 bg-slate-900/90 px-3 py-2">
                      <p className="text-base font-semibold text-slate-50">{slot.name}</p>
                      <p className="mt-0.5 text-lg font-semibold text-amber-200">{displayDutyLabel(slot.label)}</p>
                    </article>
                  ))}
                </div>
              )}
          </div>
        </div>
        <LunchTaskMatrix
          rows={rows}
          busyKey={busyKey}
          onRoutineCell={onRoutineCell}
        />
    </section>
  );
}

const LUNCH_TASKS = [
  { key: "lunch_brushing" as const, label: "刷牙" },
  { key: "noon_cleaning" as const, label: "中午打掃" },
];

function displayDutyLabel(label: string) {
  return label
    .replace("二年級餐桶車", "餐桶車（二）")
    .replace("四年級餐桶車", "餐桶車（四）")
    .replace("二年級餐桶", "餐桶（二）")
    .replace("四年級餐桶", "餐桶（四）")
    .replace(/[①②③④]/g, "")
    .replace("＋", "・");
}

function LunchTaskMatrix({
  rows,
  busyKey,
  onRoutineCell,
}: {
  rows: DisplayPersonalRow[];
  busyKey: string | null;
  onRoutineCell: (
    studentId: string,
    taskKey: "lunch_brushing" | "noon_cleaning",
    completed: boolean,
  ) => void;
}) {
  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950/50 p-3">
      <h2 className="shrink-0 text-xl font-semibold text-slate-100">午餐任務</h2>
      <div className="mt-2 grid min-h-0 flex-1 gap-1" style={{ gridTemplateColumns: `4.5rem repeat(${rows.length}, minmax(0, 1fr))` }}>
        <div aria-hidden />
        {rows.map((row) => <div key={row.studentId} className="flex items-center justify-center text-sm font-bold text-amber-200">{row.seatNumber}</div>)}
        {LUNCH_TASKS.flatMap((task) => [
          <div key={`${task.key}-label`} className="flex items-center text-sm font-semibold text-slate-200">{task.label}</div>,
          ...rows.map((row) => {
            const done = task.key === "lunch_brushing" ? row.lunchBrushing : row.noonCleaning;
            const key = `${row.studentId}:${task.key}`;
            return <button key={key} type="button" disabled={busyKey === key} onClick={() => onRoutineCell(row.studentId, task.key, !done)} className={cn("mx-auto flex h-8 w-[88%] max-w-10 items-center justify-center rounded-md border text-sm font-bold transition active:scale-95", done ? "border-emerald-300 bg-emerald-500 text-white" : "border-slate-600 bg-slate-800 text-slate-500")}>{done ? "✓" : ""}</button>;
          }),
        ])}
      </div>
    </div>
  );
}

function LunchVideoPlayer({ query, src, displayHeaders }: { query: string; src: string; displayHeaders: Record<string, string> }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const endedRef = useRef(false);
  useEffect(() => {
    endedRef.current = false;
    const listen = (event: MessageEvent) => {
      if (!event.origin.includes("youtube")) return;
      let data: unknown;
      try { data = typeof event.data === "string" ? JSON.parse(event.data) : event.data; } catch { return; }
      if (!data || typeof data !== "object" || !("event" in data) || (data as { event?: string }).event !== "onStateChange" || (data as { info?: number }).info !== 0 || endedRef.current) return;
      endedRef.current = true;
      void fetch("/api/display/video-ended", { method: "POST", headers: { "Content-Type": "application/json", ...displayHeaders }, body: JSON.stringify({ query }) });
    };
    window.addEventListener("message", listen);
    return () => window.removeEventListener("message", listen);
  }, [displayHeaders, query]);
  const connect = () => {
    const target = iframeRef.current?.contentWindow;
    if (!target) return;
    target.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), "*");
    target.postMessage(JSON.stringify({ event: "command", func: "addEventListener", args: ["onStateChange"] }), "*");
  };
  return <iframe ref={iframeRef} title="午餐影音" src={src} onLoad={connect} className="h-full w-full border-0" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />;
}

function toYouTubeEmbedUrl(value: string): string | null {
  const query = value.trim();
  if (!query) return null;
  try {
    const url = new URL(query);
    const id = url.hostname === "youtu.be" ? url.pathname.slice(1) : url.searchParams.get("v") ?? (url.pathname.startsWith("/embed/") ? url.pathname.split("/")[2] : "");
    if (/^[A-Za-z0-9_-]{11}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&enablejsapi=1`;
  } catch { /* 歌名改用 YouTube 搜尋播放清單 */ }
  return `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(query)}&autoplay=1&rel=0&enablejsapi=1`;
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
        Number.isFinite(next) && next > 0
          ? Math.min(Math.max(next, 0.2), 3)
          : 1;
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
                      cell.week === matrix.currentWeek &&
                        "ring-2 ring-amber-300",
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
        Number.isFinite(next) && next > 0
          ? Math.min(Math.max(next, 0.2), 3)
          : 1;
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
        {title}
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-3xl font-semibold">
          {row.seatNumber} {row.name}
        </h2>
        <div className="flex items-center gap-3 text-lg">
          <span className="rounded-full border border-violet-400/50 bg-violet-500/20 px-3 py-1 font-semibold text-violet-200">
            Lv.{row.gamification.level}
          </span>
          <span className="rounded-full border border-amber-400/50 bg-amber-500/20 px-3 py-1 font-semibold text-amber-200">
            {row.gamification.coins} 金幣
          </span>
        </div>
      </div>
      <div className="mt-3">
        <div className="flex justify-between text-sm text-slate-400">
          <span>XP</span>
          <span>
            {row.gamification.currentLevelXp} / {row.gamification.nextLevelXp}
          </span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-700">
          <div
            className="h-full rounded-full bg-violet-400"
            style={{ width: `${row.gamification.progressPercent}%` }}
          />
        </div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <ul className="space-y-3 text-xl">
          <CheckRow
            label="上午打掃"
            done={row.morningCleaning}
            disabled={
              !canRoutine || busyKey === `${row.studentId}:morning_cleaning`
            }
            onToggle={() => onRoutine("morning_cleaning", !row.morningCleaning)}
          />
          <CheckRow
            label={data.isReturnDay ? "交暑假作業" : "抄聯絡簿"}
            done={data.isReturnDay ? row.summerHomeworkSubmitted : row.contactBookCopied}
            disabled={
              !canRoutine || busyKey === `${row.studentId}:${data.isReturnDay ? "summer_homework_submitted" : "contact_book_copied"}`
            }
            onToggle={() =>
              onRoutine(
                data.isReturnDay ? "summer_homework_submitted" : "contact_book_copied",
                !(data.isReturnDay ? row.summerHomeworkSubmitted : row.contactBookCopied),
              )
            }
          />
        </ul>
        {data.isReturnDay ? null : <ul className="space-y-3 text-xl">
          {hwCells.length === 0 ? (
            <li className="rounded-xl border border-slate-700 px-4 py-3 text-slate-400">
              今日無繳交項
            </li>
          ) : (
            hwCells.map((cell) => {
              const submitted = cell.completed || cell.status === "pending_confirmation";
              return (
              <CheckRow
                key={cell.homeworkId}
                label={cell.title}
                done={submitted}
                note={
                  cell.status === "pending_confirmation"
                    ? "已送出，待老師確認"
                    : cell.status === "correction_required"
                      ? "請訂正後再交"
                      : undefined
                }
                noteTone={
                  cell.status === "correction_required" ? "warning" : "success"
                }
                disabled={
                  !canHomework ||
                  busyKey === `${row.studentId}:${cell.homeworkId}`
                }
                onToggle={() => onHomework(cell.homeworkId, !submitted)}
              />
              );
            })
          )}
        </ul>}
      </div>
    </div>
  );
}

function CheckRow({
  label,
  done,
  note,
  noteTone = "warning",
  disabled,
  onToggle,
}: {
  label: string;
  done: boolean;
  note?: string;
  noteTone?: "warning" | "success";
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
            <span className={cn(
              "ml-2 text-base",
              noteTone === "success" ? "text-emerald-300" : "text-amber-300",
            )}>{note}</span>
          ) : null}
        </span>
      </button>
    </li>
  );
}
