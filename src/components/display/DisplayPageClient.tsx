"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DisplayContactBookPanel } from "@/components/display/DisplayContactBookPanel";
import { DisplayHomeworkPanel } from "@/components/display/DisplayHomeworkPanel";
import { DisplayPassportPanel } from "@/components/display/DisplayPassportPanel";
import { cn } from "@/lib/utils";
import { nextPassportStatus, type PassportStatus } from "@/types/passport";
import type { DisplayData } from "@/types/display";

type PanelKey = "contact" | "homework" | "passport";

const PANEL_ORDER: PanelKey[] = ["contact", "homework", "passport"];
const PANEL_LABEL: Record<PanelKey, string> = {
  contact: "聯絡簿",
  homework: "作業",
  passport: "護照",
};
const SEAT_IDLE_MS = 30_000;
const CAROUSEL_MS = 60_000;

export function DisplayPageClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [data, setData] = useState<DisplayData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string>("");
  const [panel, setPanel] = useState<PanelKey>("contact");
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
      if (!response.ok) {
        throw new Error(json.error ?? "讀取失敗");
      }
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
    const seconds = data.displaySettings.refreshSeconds;
    const id = setInterval(() => {
      void load();
    }, seconds * 1000);
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
    idleTimer.current = setTimeout(() => {
      setActiveStudentId(null);
    }, SEAT_IDLE_MS);
  }

  function selectStudent(studentId: string) {
    setActiveStudentId((prev) => (prev === studentId ? null : studentId));
    bumpIdle();
  }

  async function handleHomeworkToggle(
    studentId: string,
    homeworkId: string,
    nextCompleted: boolean,
  ) {
    if (!data?.displaySettings.allowStudentHomeworkToggle) return;
    if (activeStudentId !== studentId) return;
    const key = `${studentId}:${homeworkId}`;
    setBusyKey(key);
    bumpIdle();
    setData((prev) => {
      if (!prev) return prev;
      const students = prev.homework.students.map((student) => {
        if (student.studentId !== studentId) return student;
        const cells = student.cells.map((cell) =>
          cell.homeworkId === homeworkId
            ? { ...cell, completed: nextCompleted }
            : cell,
        );
        const missingTitles = cells
          .filter((cell) => !cell.completed)
          .map((cell) => cell.title);
        return {
          ...student,
          cells,
          missingTitles,
          allDone:
            prev.homework.items.length > 0 && missingTitles.length === 0,
        };
      });
      return {
        ...prev,
        homework: {
          ...prev.homework,
          students,
          completedStudentCount: students.filter((s) => s.allDone).length,
        },
      };
    });
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
          completed: nextCompleted,
          displayMode: true,
        }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "更新失敗");
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新失敗");
      await load();
    } finally {
      setBusyKey(null);
    }
  }

  async function handlePassportToggle(
    studentId: string,
    type: "Chinese" | "English",
    week: number,
    current: PassportStatus,
  ) {
    if (!data?.displaySettings.allowStudentPassportToggle) return;
    if (activeStudentId !== studentId) return;
    const next = nextPassportStatus(current);
    const key = `${studentId}:${type}:${week}`;
    setBusyKey(key);
    bumpIdle();
    setData((prev) => {
      if (!prev) return prev;
      const side = type === "Chinese" ? "chinese" : "english";
      const view = prev.passport[side];
      const students = view.students.map((student) =>
        student.studentId === studentId
          ? { ...student, status: next }
          : student,
      );
      const completedCount = students.filter(
        (s) => s.status === "completed",
      ).length;
      const missingParentCount = students.filter(
        (s) => s.status === "missing_parent",
      ).length;
      const notStartedCount = students.filter(
        (s) => s.status === "not_started",
      ).length;
      return {
        ...prev,
        passport: {
          ...prev.passport,
          [side]: {
            ...view,
            students,
            completedCount,
            missingParentCount,
            notStartedCount,
          },
        },
      };
    });
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
          status: next,
          displayMode: true,
        }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "更新失敗");
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新失敗");
      await load();
    } finally {
      setBusyKey(null);
    }
  }

  const canHomework =
    Boolean(data?.displaySettings.allowStudentHomeworkToggle) &&
    Boolean(activeStudentId);
  const canPassport =
    Boolean(data?.displaySettings.allowStudentPassportToggle) &&
    Boolean(activeStudentId);

  const showSeatPicker = useMemo(
    () =>
      Boolean(
        data?.displaySettings.allowStudentHomeworkToggle ||
          data?.displaySettings.allowStudentPassportToggle,
      ),
    [data],
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
            選自己的座號後才能打勾（30 秒無操作會取消）
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
        {panel === "contact" ? (
          <DisplayContactBookPanel
            className={data.className}
            schoolYear={data.schoolYear}
            date={data.contactBook.date}
            dueDate={data.contactBook.dueDate}
            titles={data.contactBook.titles}
            note={data.contactBook.note}
          />
        ) : null}
        {panel === "homework" ? (
          <DisplayHomeworkPanel
            homework={data.homework}
            activeStudentId={activeStudentId}
            canToggle={canHomework}
            busyKey={busyKey}
            onToggle={(studentId, homeworkId, next) => {
              void handleHomeworkToggle(studentId, homeworkId, next);
            }}
          />
        ) : null}
        {panel === "passport" ? (
          <DisplayPassportPanel
            chinese={data.passport.chinese}
            english={data.passport.english}
            activeStudentId={activeStudentId}
            canToggle={canPassport}
            busyKey={busyKey}
            onToggle={(studentId, type, week, current) => {
              void handlePassportToggle(studentId, type, week, current);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
