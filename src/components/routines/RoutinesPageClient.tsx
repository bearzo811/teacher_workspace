"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { todayDateString } from "@/lib/dates";

type RoutineView = {
  date: string;
  tasks: {
    taskKey: string;
    label: string;
    completedCount: number;
    totalCount: number;
    students: {
      studentId: string;
      name: string;
      seatNumber: number;
      completed: boolean;
    }[];
  }[];
};

export function RoutinesPageClient() {
  const [date, setDate] = useState(todayDateString);
  const [view, setView] = useState<RoutineView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async (selected: string) => {
    setError(null);
    try {
      const response = await fetch(
        `/api/routines?date=${encodeURIComponent(selected)}`,
      );
      const json = (await response.json()) as {
        data?: RoutineView;
        error?: string;
      };
      if (!response.ok) throw new Error(json.error ?? "讀取失敗");
      setView(json.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "讀取失敗");
    }
  }, []);

  useEffect(() => {
    void load(date);
  }, [date, load]);

  async function toggle(
    studentId: string,
    taskKey: string,
    next: boolean,
  ) {
    const key = `${studentId}:${taskKey}`;
    setBusyKey(key);
    try {
      const response = await fetch("/api/routines", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          taskKey,
          completed: next,
          taskDate: date,
        }),
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

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">每日任務</h1>
          <p className="mt-1 text-sm text-gray-500">
            打掃、刷牙；也可在大屏讓學生自助勾
          </p>
        </div>
        <label className="text-sm text-gray-600">
          日期
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="ml-2 h-10 rounded-lg border border-gray-200 px-3 text-sm outline-none ring-blue-500 focus:ring-2"
          />
        </label>
      </header>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {view?.tasks.map((task) => (
        <Card key={task.taskKey}>
          <CardTitle>
            {task.label}{" "}
            <span className="font-normal text-gray-500">
              {task.completedCount}/{task.totalCount}
            </span>
          </CardTitle>
          <CardDescription>點名勾選完成</CardDescription>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {task.students.map((student) => {
              const key = `${student.studentId}:${task.taskKey}`;
              return (
                <li key={student.studentId}>
                  <button
                    type="button"
                    disabled={busyKey === key}
                    onClick={() =>
                      void toggle(
                        student.studentId,
                        task.taskKey,
                        !student.completed,
                      )
                    }
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm",
                      student.completed
                        ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                        : "border-gray-200 bg-white text-gray-800",
                    )}
                  >
                    <span className="w-8 font-medium">{student.seatNumber}</span>
                    <span className="flex-1">{student.name}</span>
                    <span>{student.completed ? "✓" : ""}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
    </div>
  );
}
