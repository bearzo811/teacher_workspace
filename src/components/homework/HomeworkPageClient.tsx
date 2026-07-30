"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { HomeworkChecklist } from "@/components/homework/HomeworkChecklist";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ProgressBar } from "@/components/passport/ProgressBar";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { todayDateString } from "@/lib/dates";

type HomeworkDayView = {
  date: string;
  items: { id: string; title: string; date: string }[];
  students: {
    studentId: string;
    name: string;
    seatNumber: number;
    cells: { homeworkId: string; title: string; completed: boolean }[];
    allDone: boolean;
    missingTitles: string[];
  }[];
  completedStudentCount: number;
  totalStudentCount: number;
};

export function HomeworkPageClient() {
  const searchParams = useSearchParams();
  const queryDate = searchParams.get("date");
  const [date, setDate] = useState(() => queryDate || todayDateString());
  const [view, setView] = useState<HomeworkDayView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    if (queryDate) setDate(queryDate);
  }, [queryDate]);

  const load = useCallback(async (selectedDate: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/homework?date=${encodeURIComponent(selectedDate)}`,
      );
      const json = (await response.json()) as {
        data?: HomeworkDayView;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(json.error ?? "讀取作業失敗");
      }
      setView(json.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "讀取作業失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(date);
  }, [date, load]);

  function applyLocalToggle(
    studentId: string,
    homeworkId: string,
    completed: boolean,
  ) {
    setView((prev) => {
      if (!prev) return prev;
      const students = prev.students.map((student) => {
        if (student.studentId !== studentId) return student;
        const cells = student.cells.map((cell) =>
          cell.homeworkId === homeworkId ? { ...cell, completed } : cell,
        );
        const missingTitles = cells
          .filter((cell) => !cell.completed)
          .map((cell) => cell.title);
        return {
          ...student,
          cells,
          missingTitles,
          allDone: prev.items.length > 0 && missingTitles.length === 0,
        };
      });
      return {
        ...prev,
        students,
        completedStudentCount: students.filter((s) => s.allDone).length,
      };
    });
  }

  async function handleToggle(
    studentId: string,
    homeworkId: string,
    nextCompleted: boolean,
  ) {
    const key = `${studentId}:${homeworkId}`;
    setBusyKey(key);
    setError(null);
    applyLocalToggle(studentId, homeworkId, nextCompleted);
    try {
      const response = await fetch("/api/homework-record", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          homeworkId,
          completed: nextCompleted,
        }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error ?? "更新失敗");
      }
    } catch (err) {
      applyLocalToggle(studentId, homeworkId, !nextCompleted);
      setError(err instanceof Error ? err.message : "更新失敗");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleDeleteItem(homeworkId: string) {
    const ok = window.confirm("確定刪除這個作業？（相關打勾也會刪除）");
    if (!ok) return;
    setError(null);
    try {
      const response = await fetch(`/api/homework/${homeworkId}`, {
        method: "DELETE",
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error ?? "刪除失敗");
      }
      await load(date);
    } catch (err) {
      setError(err instanceof Error ? err.message : "刪除失敗");
    }
  }

  const missing = view?.students.filter((s) => s.missingTitles.length > 0) ?? [];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">作業管理</h1>
          <p className="mt-1 text-sm text-gray-500">
            作業請在「聯絡簿」建立並同步；這裡負責打勾檢查
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/contact-book"
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
          >
            去聯絡簿
          </Link>
          <label className="text-sm text-gray-600">
            日期
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="ml-2 h-10 rounded-lg border border-gray-200 px-3 text-sm outline-none ring-blue-500 focus:ring-2"
            />
          </label>
        </div>
      </header>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading && !view ? (
        <p className="text-sm text-gray-400">載入中…</p>
      ) : null}

      {view ? (
        <>
          <ProgressBar
            completed={view.completedStudentCount}
            total={view.totalStudentCount}
          />

          <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
            <HomeworkChecklist
              items={view.items}
              students={view.students}
              busyKey={busyKey}
              onToggle={(studentId, homeworkId, nextCompleted) => {
                void handleToggle(studentId, homeworkId, nextCompleted);
              }}
              onDeleteItem={(homeworkId) => {
                void handleDeleteItem(homeworkId);
              }}
            />

            <Card>
              <CardTitle>缺交</CardTitle>
              <CardDescription>
                {view.items.length === 0
                  ? "請先到聯絡簿建立作業"
                  : `${view.completedStudentCount} / ${view.totalStudentCount} 全交`}
              </CardDescription>
              {view.items.length === 0 ? (
                <p className="mt-3 text-sm text-gray-400">—</p>
              ) : missing.length === 0 ? (
                <p className="mt-3 text-sm text-gray-400">全部交齊</p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm text-gray-700">
                  {missing.map((student) => (
                    <li key={student.studentId}>
                      {student.name}
                      <span className="ml-1 text-xs text-red-600">
                        {student.missingTitles.join("、")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
