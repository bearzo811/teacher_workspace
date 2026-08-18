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
  items: {
    id: string;
    bookId: string;
    bookName: string;
    pageLabel: string;
    title: string;
    date: string;
  }[];
  students: {
    studentId: string;
    name: string;
    seatNumber: number;
    cells: { homeworkId: string; title: string; completed: boolean; status: "unsubmitted" | "pending_confirmation" | "correction_required" | "completed" }[];
    allDone: boolean;
    missingTitles: string[];
  }[];
  completedStudentCount: number;
  totalStudentCount: number;
};

type BookProgress = {
  bookId: string;
  bookName: string;
  assignmentCount: number;
  completedPercent: number;
  assignments: {
    id: string;
    pageLabel: string;
    date: string;
    title: string;
  }[];
  students: {
    studentId: string;
    name: string;
    seatNumber: number;
    completedCount: number;
    totalCount: number;
    completedPercent: number;
    cells: { homeworkId: string; completed: boolean }[];
  }[];
};

export function HomeworkPageClient() {
  const searchParams = useSearchParams();
  const queryDate = searchParams.get("date");
  const [date, setDate] = useState(() => queryDate || todayDateString());
  const [view, setView] = useState<HomeworkDayView | null>(null);
  const [bookProgress, setBookProgress] = useState<BookProgress[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [expandedBookId, setExpandedBookId] = useState<string | null>(null);

  useEffect(() => {
    if (queryDate) setDate(queryDate);
  }, [queryDate]);

  const loadProgress = useCallback(async () => {
    const response = await fetch("/api/homework?progress=1");
    const json = (await response.json()) as {
      data?: BookProgress[];
      error?: string;
    };
    if (!response.ok) throw new Error(json.error ?? "讀取簿本進度失敗");
    setBookProgress(json.data ?? []);
  }, []);

  const load = useCallback(
    async (selectedDate: string) => {
      setLoading(true);
      setError(null);
      try {
        const [response] = await Promise.all([
          fetch(`/api/homework?date=${encodeURIComponent(selectedDate)}`),
          loadProgress(),
        ]);
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
    },
    [loadProgress],
  );

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
          cell.homeworkId === homeworkId
            ? {
                ...cell,
                completed,
                status: completed
                  ? ("completed" as const)
                  : ("unsubmitted" as const),
              }
            : cell,
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

  async function handleSetStatus(
    studentId: string,
    homeworkId: string,
    status: "unsubmitted" | "pending_confirmation" | "correction_required" | "completed",
  ) {
    const key = `${studentId}:${homeworkId}`;
    setBusyKey(key);
    setError(null);
    try {
      const response = await fetch("/api/homework-record", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, homeworkId, status }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "更新失敗");
      await load(date);
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新失敗");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleBatchSetStatus(
    studentIds: string[],
    status: "correction_required" | "completed",
  ) {
    if (!view || view.items.length === 0) return;
    setError(null);
    try {
      const responses = await Promise.all(
        studentIds.flatMap((studentId) =>
          view.items.map(async (item) => {
            const response = await fetch("/api/homework-record", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ studentId, homeworkId: item.id, status }),
            });
            if (!response.ok) {
              const json = (await response.json()) as { error?: string };
              throw new Error(json.error ?? "批次更新失敗");
            }
          }),
        ),
      );
      await Promise.all(responses);
      await load(date);
    } catch (err) {
      setError(err instanceof Error ? err.message : "批次更新失敗");
    }
  }

  function applyBookMatrixToggle(
    bookId: string,
    studentId: string,
    homeworkId: string,
    completed: boolean,
  ) {
    setBookProgress((prev) =>
      prev.map((book) => {
        if (book.bookId !== bookId) return book;
        const students = book.students.map((student) => {
          if (student.studentId !== studentId) return student;
          const cells = student.cells.map((cell) =>
            cell.homeworkId === homeworkId ? { ...cell, completed } : cell,
          );
          const completedCount = cells.filter((cell) => cell.completed).length;
          const totalCount = cells.length;
          return {
            ...student,
            cells,
            completedCount,
            totalCount,
            completedPercent:
              totalCount === 0
                ? 0
                : Math.round((completedCount / totalCount) * 100),
          };
        });
        const completedCells = students.reduce(
          (sum, student) => sum + student.completedCount,
          0,
        );
        const totalCells = book.assignmentCount * students.length;
        const completedPercent =
          totalCells === 0
            ? 0
            : Math.round((completedCells / totalCells) * 100);
        return { ...book, students, completedPercent };
      }),
    );
  }

  async function handleBookMatrixToggle(
    bookId: string,
    studentId: string,
    homeworkId: string,
    nextCompleted: boolean,
  ) {
    const key = `book:${studentId}:${homeworkId}`;
    setBusyKey(key);
    setError(null);
    applyBookMatrixToggle(bookId, studentId, homeworkId, nextCompleted);
    // 若剛好是今日作業表同一格，同步本地今日表
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
      applyBookMatrixToggle(bookId, studentId, homeworkId, !nextCompleted);
      applyLocalToggle(studentId, homeworkId, !nextCompleted);
      setError(err instanceof Error ? err.message : "更新失敗");
    } finally {
      setBusyKey(null);
    }
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
      void loadProgress();
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

      {bookProgress.length > 0 ? (
        <Card>
          <CardTitle>簿本進度</CardTitle>
          <CardDescription>
            點簿本展開矩陣（橫＝指派作業、縱＝學生）；進度以份數計算
          </CardDescription>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {bookProgress.map((book) => {
              const expanded = expandedBookId === book.bookId;
              return (
                <button
                  key={book.bookId}
                  type="button"
                  onClick={() =>
                    setExpandedBookId((prev) =>
                      prev === book.bookId ? null : book.bookId,
                    )
                  }
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left transition",
                    expanded
                      ? "border-blue-400 bg-blue-50"
                      : "border-gray-200 bg-white hover:bg-gray-50",
                  )}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-medium text-gray-900">
                      {book.bookName}
                      <span className="ml-2 text-xs font-normal text-gray-500">
                        {expanded ? "收合" : "展開"}
                      </span>
                    </p>
                    <p className="text-sm text-blue-700">
                      {book.completedPercent}%
                    </p>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">
                    已指派 {book.assignmentCount} 份
                  </p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${book.completedPercent}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {expandedBookId
            ? (() => {
                const book = bookProgress.find(
                  (item) => item.bookId === expandedBookId,
                );
                if (!book) return null;
                if (book.assignments.length === 0) {
                  return (
                    <p className="mt-4 text-sm text-gray-400">
                      「{book.bookName}」尚無指派作業
                    </p>
                  );
                }
                return (
                  <div className="mt-4 overflow-auto rounded-xl border border-gray-200">
                    <table className="min-w-full border-collapse text-center text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="sticky left-0 z-10 border-b border-r border-gray-200 bg-gray-50 px-2 py-2">
                            座號
                          </th>
                          <th className="sticky left-12 z-10 border-b border-r border-gray-200 bg-gray-50 px-2 py-2 text-left">
                            姓名
                          </th>
                          {book.assignments.map((item) => (
                            <th
                              key={item.id}
                              className="border-b border-gray-200 px-2 py-2 font-medium text-gray-700"
                              title={`${item.date} · ${item.title}`}
                            >
                              <div>{item.pageLabel}</div>
                              <div className="text-[10px] font-normal text-gray-400">
                                {item.date.slice(5)}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {book.students.map((student) => (
                          <tr
                            key={student.studentId}
                            className="border-t border-gray-100"
                          >
                            <td className="sticky left-0 z-10 bg-white px-2 py-1 font-medium">
                              {student.seatNumber}
                            </td>
                            <td className="sticky left-12 z-10 bg-white px-2 py-1 text-left">
                              {student.name}
                            </td>
                            {student.cells.map((cell) => {
                              const key = `book:${student.studentId}:${cell.homeworkId}`;
                              return (
                                <td key={cell.homeworkId} className="px-1 py-1">
                                  <button
                                    type="button"
                                    title={
                                      cell.completed ? "已完成" : "未完成"
                                    }
                                    disabled={busyKey === key}
                                    onClick={() => {
                                      void handleBookMatrixToggle(
                                        book.bookId,
                                        student.studentId,
                                        cell.homeworkId,
                                        !cell.completed,
                                      );
                                    }}
                                    className={cn(
                                      "mx-auto flex h-8 w-8 items-center justify-center rounded-md border text-sm font-bold",
                                      cell.completed
                                        ? "border-green-600 bg-green-600 text-white"
                                        : "border-gray-300 bg-white text-gray-300",
                                    )}
                                  >
                                    {cell.completed ? "✓" : ""}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()
            : null}
        </Card>
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
              onSetStatus={(studentId, homeworkId, status) => {
                void handleSetStatus(studentId, homeworkId, status);
              }}
              onBatchSetStatus={(studentIds, status) => {
                void handleBatchSetStatus(studentIds, status);
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
