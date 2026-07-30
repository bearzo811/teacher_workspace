"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DisplayContactBookPanel } from "@/components/display/DisplayContactBookPanel";
import { cn } from "@/lib/utils";
import type { DisplayData, DisplayPersonalRow } from "@/types/display";
import type { PassportStatus } from "@/types/passport";

type PanelKey = "info" | "progress" | "personal";

const PANEL_ORDER: PanelKey[] = ["info", "progress", "personal"];
const PANEL_LABEL: Record<PanelKey, string> = {
  info: "聯絡簿",
  progress: "今日進度",
  personal: "個人完成",
};
const SEAT_IDLE_MS = 30_000;
const CAROUSEL_MS = 60_000;

export function DisplayPageClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [data, setData] = useState<DisplayData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState("");
  const [panel, setPanel] = useState<PanelKey>("info");
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!data) return;
    const id = setInterval(() => {
      void load();
    }, data.displaySettings.refreshSeconds * 1000);
    return () => clearInterval(id);
  }, [data?.displaySettings.refreshSeconds, load, data]);

  useEffect(() => {
    if (!data?.displaySettings.carouselEnabled) return;
    const id = setInterval(() => {
      setPanel((prev) => {
        const index = PANEL_ORDER.indexOf(prev);
        return PANEL_ORDER[(index + 1) % PANEL_ORDER.length];
      });
    }, CAROUSEL_MS);
    return () => clearInterval(id);
  }, [data?.displaySettings.carouselEnabled]);

  function bumpIdle() {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setActiveStudentId(null), SEAT_IDLE_MS);
  }

  function selectStudent(studentId: string) {
    setActiveStudentId((prev) => (prev === studentId ? null : studentId));
    bumpIdle();
    setPanel("personal");
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
          taskDate: data.today,
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

  async function completePassport(
    studentId: string,
    type: "Chinese" | "English",
    week: number,
    current: PassportStatus,
  ) {
    if (!data?.displaySettings.allowStudentPassportToggle) return;
    if (activeStudentId !== studentId) return;
    if (current === "completed" || current === "missing_parent") return;
    setBusyKey(`${studentId}:${type}`);
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
          status: "completed",
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

  const showSeatPicker = Boolean(
    data?.displaySettings.allowStudentHomeworkToggle ||
      data?.displaySettings.allowStudentPassportToggle ||
      data?.displaySettings.allowStudentRoutineToggle,
  );

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
    <div className="flex min-h-[calc(100vh-2rem)] flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
            Classroom Display
          </p>
          <h1 className="text-2xl font-semibold md:text-3xl">
            {data.schoolYear} {data.className}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PANEL_ORDER.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setPanel(key)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition md:text-base",
                panel === key
                  ? "bg-sky-500 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700",
              )}
            >
              {PANEL_LABEL[key]}
            </button>
          ))}
          <span className="ml-2 text-sm text-slate-500">更新 {updatedAt}</span>
        </div>
      </header>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      {showSeatPicker ? (
        <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3">
          <p className="mb-2 text-sm text-slate-400">
            選自己的座號後到「個人完成」打勾（30 秒無操作會取消）
          </p>
          <div className="flex flex-wrap gap-2">
            {data.students.map((student) => (
              <button
                key={student.studentId}
                type="button"
                onClick={() => selectStudent(student.studentId)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-base font-medium transition",
                  activeStudentId === student.studentId
                    ? "border-sky-400 bg-sky-500 text-white"
                    : "border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700",
                )}
              >
                {student.seatNumber} {student.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1">
        {panel === "info" ? (
          <DisplayContactBookPanel
            className={data.className}
            schoolYear={data.schoolYear}
            date={data.contactBook.date}
            dueDate={data.contactBook.dueDate}
            titles={data.contactBook.titles}
            note={data.contactBook.note}
          />
        ) : null}

        {panel === "progress" ? (
          <section className="grid gap-4 rounded-2xl border border-slate-700 bg-slate-900/80 p-6 md:grid-cols-2">
            <h2 className="text-3xl font-semibold md:col-span-2">今日進度</h2>
            {data.progress.map((item) => {
              const pct =
                item.total > 0
                  ? Math.round((item.completed / item.total) * 100)
                  : 0;
              return (
                <div
                  key={item.key}
                  className="rounded-xl border border-slate-700 bg-slate-950/50 p-4"
                >
                  <div className="flex items-end justify-between">
                    <p className="text-xl">{item.label}</p>
                    <p className="text-2xl text-emerald-300">
                      {item.completed} / {item.total}
                    </p>
                  </div>
                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </section>
        ) : null}

        {panel === "personal" ? (
          <PersonalPanel
            row={activePersonal}
            data={data}
            busyKey={busyKey}
            canRoutine={Boolean(
              activeStudentId && data.displaySettings.allowStudentRoutineToggle,
            )}
            canPassport={Boolean(
              activeStudentId && data.displaySettings.allowStudentPassportToggle,
            )}
            canHomework={Boolean(
              activeStudentId && data.displaySettings.allowStudentHomeworkToggle,
            )}
            onRoutine={(taskKey, completed) => {
              if (!activeStudentId) return;
              void patchRoutine(activeStudentId, taskKey, completed);
            }}
            onPassport={(type, week, status) => {
              if (!activeStudentId) return;
              void completePassport(activeStudentId, type, week, status);
            }}
            onHomework={(homeworkId, next) => {
              if (!activeStudentId) return;
              void toggleHomeworkCell(activeStudentId, homeworkId, next);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function PersonalPanel({
  row,
  data,
  busyKey,
  canRoutine,
  canPassport,
  canHomework,
  onRoutine,
  onPassport,
  onHomework,
}: {
  row: DisplayPersonalRow | null;
  data: DisplayData;
  busyKey: string | null;
  canRoutine: boolean;
  canPassport: boolean;
  canHomework: boolean;
  onRoutine: (taskKey: string, completed: boolean) => void;
  onPassport: (
    type: "Chinese" | "English",
    week: number,
    status: PassportStatus,
  ) => void;
  onHomework: (homeworkId: string, next: boolean) => void;
}) {
  if (!row) {
    return (
      <section className="flex h-full items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/80 p-8">
        <p className="text-2xl text-slate-400">先選座號，查看個人今日清單</p>
      </section>
    );
  }

  const hwCells =
    data.homework.students.find((s) => s.studentId === row.studentId)?.cells ??
    [];

  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6">
      <h2 className="text-3xl font-semibold">
        {row.seatNumber} {row.name} · 今天
      </h2>
      <ul className="mt-6 space-y-3 text-xl">
        <CheckRow
          label="已抄聯絡簿"
          done={row.contactBookCopied}
          disabled={!canRoutine || busyKey === `${row.studentId}:contact_book_copied`}
          onToggle={() =>
            onRoutine("contact_book_copied", !row.contactBookCopied)
          }
        />
        {hwCells.length === 0 ? (
          <li className="rounded-xl border border-slate-700 px-4 py-3 text-slate-400">
            作業（今日無繳交項）
          </li>
        ) : (
          hwCells.map((cell) => (
            <CheckRow
              key={cell.homeworkId}
              label={`作業：${cell.title}`}
              done={cell.completed}
              disabled={
                !canHomework ||
                busyKey === `${row.studentId}:${cell.homeworkId}`
              }
              onToggle={() => onHomework(cell.homeworkId, !cell.completed)}
            />
          ))
        )}
        <CheckRow
          label={`國語護照 W${data.passport.chinese.week}`}
          done={row.chinesePassport === "completed"}
          note={
            row.chinesePassport === "missing_parent" ? "缺家長（請找老師）" : undefined
          }
          disabled={
            !canPassport ||
            row.chinesePassport === "completed" ||
            row.chinesePassport === "missing_parent" ||
            busyKey === `${row.studentId}:Chinese`
          }
          onToggle={() =>
            onPassport(
              "Chinese",
              data.passport.chinese.week,
              row.chinesePassport,
            )
          }
        />
        <CheckRow
          label={`英語護照 W${data.passport.english.week}`}
          done={row.englishPassport === "completed"}
          note={
            row.englishPassport === "missing_parent" ? "缺家長（請找老師）" : undefined
          }
          disabled={
            !canPassport ||
            row.englishPassport === "completed" ||
            row.englishPassport === "missing_parent" ||
            busyKey === `${row.studentId}:English`
          }
          onToggle={() =>
            onPassport(
              "English",
              data.passport.english.week,
              row.englishPassport,
            )
          }
        />
        <CheckRow
          label="上午打掃"
          done={row.morningCleaning}
          disabled={!canRoutine || busyKey === `${row.studentId}:morning_cleaning`}
          onToggle={() => onRoutine("morning_cleaning", !row.morningCleaning)}
        />
        <CheckRow
          label="午餐刷牙"
          done={row.lunchBrushing}
          disabled={!canRoutine || busyKey === `${row.studentId}:lunch_brushing`}
          onToggle={() => onRoutine("lunch_brushing", !row.lunchBrushing)}
        />
        <CheckRow
          label="中午打掃"
          done={row.noonCleaning}
          disabled={!canRoutine || busyKey === `${row.studentId}:noon_cleaning`}
          onToggle={() => onRoutine("noon_cleaning", !row.noonCleaning)}
        />
      </ul>
    </section>
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
            done ? "border-emerald-300 bg-emerald-500 text-white" : "border-slate-500",
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
