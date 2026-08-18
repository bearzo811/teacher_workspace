"use client";

import { useCallback, useEffect, useState } from "react";
import {
  PassportMatrix,
  type MatrixStudent,
} from "@/components/passport/PassportMatrix";
import { ProgressBar } from "@/components/passport/ProgressBar";
import {
  nextBinaryPassportStatus,
  PASSPORT_STATUS_LABEL,
  type PassportStatus,
} from "@/types/passport";

type PassportType = "Chinese" | "English";

type PassportMatrixView = {
  type: PassportType;
  currentWeek: number;
  weekLabel: string;
  startWeek: number;
  endWeek: number;
  weeks: number[];
  weekTotals: {
    week: number;
    completed: number;
    missingParent: number;
    notStarted: number;
    total: number;
  }[];
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

  function applyLocalStatus(
    studentId: string,
    week: number,
    status: PassportStatus,
  ) {
    setView((prev) => {
      if (!prev) return prev;
      const students = prev.students.map((student) => {
        if (student.studentId !== studentId) return student;
        const cells = student.cells.map((cell) =>
          cell.week === week ? { ...cell, status } : cell,
        );
        return {
          ...student,
          cells,
          completedCount: cells.filter((cell) => cell.status === "completed")
            .length,
        };
      });
      const weekTotals = prev.weeks.map((w) => {
        const statuses = students.map(
          (student) =>
            student.cells.find((cell) => cell.week === w)?.status ??
            "not_started",
        );
        return {
          week: w,
          completed: statuses.filter((s) => s === "completed").length,
          missingParent: 0,
          notStarted: statuses.filter((s) => s === "not_started").length,
          total: students.length,
        };
      });
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
    current: PassportStatus,
  ) {
    const next = nextBinaryPassportStatus(current);
    const key = `${studentId}:${week}`;
    setBusyKey(key);
    setError(null);
    applyLocalStatus(studentId, week, next);
    try {
      const response = await fetch("/api/passport", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          type,
          week,
          status: next,
        }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error ?? "更新失敗");
      }
    } catch (err) {
      applyLocalStatus(studentId, week, current);
      setError(err instanceof Error ? err.message : "更新失敗");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        {view ? (
          <p className="mt-1 text-sm text-gray-500">
            第 {view.startWeek}～{view.endWeek} 週總表｜目前：
            {view.weekLabel}｜{view.students.length} 位學生
          </p>
        ) : null}
      </header>

      <div className="flex flex-wrap gap-4 text-xs text-gray-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded border border-gray-300 bg-white" />
          {PASSPORT_STATUS_LABEL.not_started}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="flex h-5 w-5 items-center justify-center rounded border border-green-600 bg-green-600 text-[10px] text-white">
            ✓
          </span>
          {PASSPORT_STATUS_LABEL.completed}
        </span>
      </div>

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
            onToggle={(studentId, week, current) => {
              void handleToggle(studentId, week, current);
            }}
          />
          <p className="text-xs text-gray-400">
            點格子切換：未開始 ↔ 已完成。目前週由設定「第一週開啟日」自動推算。
          </p>
        </>
      ) : null}
    </div>
  );
}
