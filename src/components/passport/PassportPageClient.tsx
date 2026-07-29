"use client";

import { useCallback, useEffect, useState } from "react";
import {
  PassportMatrix,
  type MatrixStudent,
} from "@/components/passport/PassportMatrix";
import { ProgressBar } from "@/components/passport/ProgressBar";

type PassportType = "Chinese" | "English";

type PassportMatrixView = {
  type: PassportType;
  currentWeek: number;
  startWeek: number;
  endWeek: number;
  weeks: number[];
  weekTotals: { week: number; completed: number; total: number }[];
  students: MatrixStudent[];
  overallCompleted: number;
  overallTotal: number;
};

type PassportPageClientProps = {
  type: PassportType;
  title: string;
};

export function PassportPageClient({ type, title }: PassportPageClientProps) {
  const [view, setView] = useState<PassportMatrixView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/passport?type=${type}`);
      const json = (await response.json()) as {
        data?: PassportMatrixView;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(json.error ?? "讀取護照失敗");
      }
      if (!json.data) {
        throw new Error("讀取護照失敗");
      }
      setView(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "讀取護照失敗");
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    void load();
  }, [load]);

  function applyLocalToggle(
    studentId: string,
    week: number,
    completed: boolean,
  ) {
    setView((prev) => {
      if (!prev) return prev;
      const students = prev.students.map((student) => {
        if (student.studentId !== studentId) return student;
        const cells = student.cells.map((cell) =>
          cell.week === week ? { ...cell, completed } : cell,
        );
        return {
          ...student,
          cells,
          completedCount: cells.filter((cell) => cell.completed).length,
        };
      });
      const weekTotals = prev.weeks.map((w) => ({
        week: w,
        completed: students.filter((student) =>
          student.cells.some((cell) => cell.week === w && cell.completed),
        ).length,
        total: students.length,
      }));
      const overallCompleted = students.reduce(
        (sum, student) => sum + student.completedCount,
        0,
      );
      return {
        ...prev,
        students,
        weekTotals,
        overallCompleted,
        overallTotal: students.length * prev.weeks.length,
      };
    });
  }

  async function handleToggle(
    studentId: string,
    week: number,
    nextCompleted: boolean,
  ) {
    const key = `${studentId}:${week}`;
    setBusyKey(key);
    setError(null);
    applyLocalToggle(studentId, week, nextCompleted);
    try {
      const response = await fetch("/api/passport", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          type,
          week,
          completed: nextCompleted,
        }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error ?? "更新失敗");
      }
    } catch (err) {
      applyLocalToggle(studentId, week, !nextCompleted);
      setError(err instanceof Error ? err.message : "更新失敗");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleSetCurrentWeek(week: number) {
    if (!view || week === view.currentWeek) return;
    setError(null);
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentWeek: week }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error ?? "更新目前週失敗");
      }
      setView((prev) => (prev ? { ...prev, currentWeek: week } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新目前週失敗");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        {view ? (
          <p className="mt-1 text-sm text-gray-500">
            第 {view.startWeek}～{view.endWeek} 週總表｜目前週：第{" "}
            {view.currentWeek} 週｜{view.students.length} 位學生
          </p>
        ) : null}
      </header>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading && !view ? (
        <p className="text-sm text-gray-400">載入中…</p>
      ) : null}

      {view ? (
        <>
          <ProgressBar
            completed={view.overallCompleted}
            total={view.overallTotal}
          />
          <PassportMatrix
            weeks={view.weeks}
            currentWeek={view.currentWeek}
            weekTotals={view.weekTotals}
            students={view.students}
            busyKey={busyKey}
            onToggle={(studentId, week, nextCompleted) => {
              void handleToggle(studentId, week, nextCompleted);
            }}
            onSetCurrentWeek={(week) => {
              void handleSetCurrentWeek(week);
            }}
          />
          <p className="text-xs text-gray-400">
            點格子＝切換完成。點週次標題＝設為目前週。藍色欄＝目前週。左側姓名固定可橫向捲動。
          </p>
        </>
      ) : null}
    </div>
  );
}
