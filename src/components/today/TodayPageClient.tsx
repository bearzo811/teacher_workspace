"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { TodayBoard, TodayItem } from "@/services/todayService";

const STATUS_DOT: Record<TodayItem["status"], string> = {
  done: "bg-emerald-500",
  attention: "bg-amber-400",
  pending: "bg-rose-500",
};

export function TodayPageClient() {
  const [board, setBoard] = useState<TodayBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/today");
      const json = (await response.json()) as {
        data?: TodayBoard;
        error?: string;
      };
      if (!response.ok) throw new Error(json.error ?? "讀取失敗");
      setBoard(json.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "讀取失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleManual(item: TodayItem) {
    if (!item.manualKey) return;
    setBusyKey(item.id);
    setError(null);
    try {
      const response = await fetch("/api/today", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskKey: item.manualKey,
          completed: !item.manualCompleted,
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

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">Today</h1>
        <p className="mt-1 text-sm text-gray-500">
          {board ? `${board.className} · ${board.date}` : "今日工作狀態"}
        </p>
      </header>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading && !board ? (
        <p className="text-sm text-gray-400">載入中…</p>
      ) : null}

      {board?.periods.map((period) => (
        <section key={period.period} className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            {period.label}
          </h2>
          <div className="grid gap-3">
            {period.items.map((item) => (
              <Card key={item.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-2.5 w-2.5 shrink-0 rounded-full",
                        STATUS_DOT[item.status],
                      )}
                    />
                    <CardTitle className="!text-lg">{item.label}</CardTitle>
                    {item.completed !== null && item.total !== null ? (
                      <span className="text-sm font-medium text-gray-700">
                        {item.completed}/{item.total}
                      </span>
                    ) : null}
                  </div>
                  <CardDescription className="mt-1">
                    {item.detail}
                    {item.missingNames.length > 0 && item.missingNames.length <= 6
                      ? ` · ${item.missingNames.join("、")}`
                      : item.missingNames.length > 6
                        ? ` · ${item.missingNames.slice(0, 6).join("、")}…`
                        : ""}
                  </CardDescription>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {item.manualKey ? (
                    <Button
                      variant={item.manualCompleted ? "secondary" : "primary"}
                      size="sm"
                      disabled={busyKey === item.id}
                      onClick={() => {
                        void handleManual(item);
                      }}
                    >
                      {item.manualCompleted ? "取消確認" : "確認完成"}
                    </Button>
                  ) : null}
                  <Link href={item.href}>
                    <Button variant="secondary" size="sm">
                      開始處理
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
