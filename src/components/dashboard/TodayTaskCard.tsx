"use client";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import type { DashboardTodayTask } from "@/types/dashboard";

type TodayTaskCardProps = {
  tasks: DashboardTodayTask[];
  busyKey?: string | null;
  onToggle: (task: DashboardTodayTask) => void;
};

export function TodayTaskCard({ tasks, busyKey, onToggle }: TodayTaskCardProps) {
  return (
    <Card>
      <CardTitle>今日工作</CardTitle>
      <CardDescription>手動勾選待辦（操作型 Widget）</CardDescription>
      <ul className="mt-4 space-y-2">
        {tasks.map((task) => {
          const busy = busyKey === task.taskKey;
          return (
            <li key={task.taskKey}>
              <button
                type="button"
                disabled={busy}
                onClick={() => onToggle(task)}
                className="flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded border text-xs ${
                    task.completed
                      ? "border-green-600 bg-green-600 text-white"
                      : "border-gray-300 bg-white text-transparent"
                  }`}
                >
                  ✓
                </span>
                {task.label}
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
