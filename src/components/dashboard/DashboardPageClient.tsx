"use client";

import { useCallback, useEffect, useState } from "react";
import { ProgressCard } from "@/components/dashboard/ProgressCard";
import { QuickActionCard } from "@/components/dashboard/QuickActionCard";
import { RemainingCard } from "@/components/dashboard/RemainingCard";
import { TodayTaskCard } from "@/components/dashboard/TodayTaskCard";
import type {
  DashboardData,
  DashboardTodayTask,
} from "@/types/dashboard";

function formatTodayLabel(date: Date) {
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  return `${date.getMonth() + 1}/${date.getDate()}（${weekdays[date.getDay()]}）`;
}

export function DashboardPageClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/dashboard");
      const json = (await response.json()) as {
        data?: DashboardData;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(json.error ?? "讀取 Dashboard 失敗");
      }
      setData(json.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "讀取 Dashboard 失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleToggleTask(task: DashboardTodayTask) {
    setBusyKey(task.taskKey);
    setError(null);
    try {
      const response = await fetch("/api/daily-tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskKey: task.taskKey,
          completed: !task.completed,
        }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error ?? "更新今日工作失敗");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新今日工作失敗");
    } finally {
      setBusyKey(null);
    }
  }

  const todayLabel = formatTodayLabel(new Date());

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">今天 {todayLabel}</p>
      </header>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading && !data ? (
        <p className="text-sm text-gray-400">載入中…</p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <TodayTaskCard
          tasks={data?.todayTasks ?? []}
          busyKey={busyKey}
          onToggle={(task) => {
            void handleToggleTask(task);
          }}
        />
        <ProgressCard
          title="國語完成率"
          week={data?.passportSummary.chinese.week}
          completed={data?.passportSummary.chinese.completed}
          total={data?.passportSummary.chinese.total}
        />
        <ProgressCard
          title="英語完成率"
          week={data?.passportSummary.english.week}
          completed={data?.passportSummary.english.completed}
          total={data?.passportSummary.english.total}
        />
        <ProgressCard
          title="作業完成率"
          pendingLabel="待 Sprint 5"
        />
        <RemainingCard
          chinese={data?.remainingStudents.chinese ?? []}
          english={data?.remainingStudents.english ?? []}
          homework={data?.remainingStudents.homework ?? []}
        />
        <QuickActionCard />
      </div>
    </div>
  );
}
