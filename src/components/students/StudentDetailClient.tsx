"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { StudentDetail } from "@/types/student";

type StudentDetailClientProps = {
  studentId: string;
};

export function StudentDetailClient({ studentId }: StudentDetailClientProps) {
  const [data, setData] = useState<StudentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/students/${studentId}`);
      const json = (await response.json()) as {
        data?: StudentDetail;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(json.error ?? "讀取學生失敗");
      }
      setData(json.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "讀取學生失敗");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">學生詳細</h1>
          <p className="mt-1 text-sm text-gray-500">護照與作業進度總覽</p>
        </div>
        <Link
          href="/students"
          className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
        >
          回列表
        </Link>
      </header>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading && !data ? (
        <p className="text-sm text-gray-400">載入中…</p>
      ) : null}

      {data ? (
        <>
          <Card>
            <CardTitle>
              {data.seatNumber}　{data.name}
            </CardTitle>
            <CardDescription>座號與姓名</CardDescription>
          </Card>

          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle>Level {data.gamification.level}</CardTitle>
                <CardDescription>學生養成進度</CardDescription>
              </div>
              <div className="rounded-full bg-amber-100 px-4 py-2 text-lg font-semibold text-amber-800">
                {data.gamification.coins} 金幣
              </div>
            </div>
            <div className="mt-5">
              <div className="flex justify-between text-sm text-gray-600">
                <span>XP</span>
                <span>
                  {data.gamification.currentLevelXp} /{" "}
                  {data.gamification.nextLevelXp}
                </span>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-violet-500"
                  style={{
                    width: `${data.gamification.progressPercent}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-gray-400">
                累積 {data.gamification.totalXp} XP
              </p>
            </div>
          </Card>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardTitle>國語護照</CardTitle>
              <CardDescription>已完成週數</CardDescription>
              <p className="mt-4 text-2xl font-semibold text-gray-900">
                {data.chinese.completed} / {data.chinese.total}
              </p>
            </Card>
            <Card>
              <CardTitle>英語護照</CardTitle>
              <CardDescription>已完成週數</CardDescription>
              <p className="mt-4 text-2xl font-semibold text-gray-900">
                {data.english.completed} / {data.english.total}
              </p>
            </Card>
            <Card>
              <CardTitle>作業</CardTitle>
              <CardDescription>
                {data.homework.total === 0
                  ? "尚無作業紀錄"
                  : `${data.homework.completed} / ${data.homework.total}`}
              </CardDescription>
              <p className="mt-4 text-2xl font-semibold text-gray-900">
                {data.homework.percent}%
              </p>
            </Card>
          </div>

          <Card>
            <CardTitle>最近養成紀錄</CardTitle>
            <CardDescription>最近 20 筆 XP／金幣變動</CardDescription>
            {data.gamificationRecent.length === 0 ? (
              <p className="mt-4 text-sm text-gray-400">尚無紀錄</p>
            ) : (
              <ul className="mt-4 divide-y divide-gray-100">
                {data.gamificationRecent.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between gap-3 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium text-gray-800">
                        {entry.reason}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(entry.createdAt).toLocaleString("zh-TW")}
                      </p>
                    </div>
                    <span
                      className={
                        entry.delta >= 0
                          ? "font-semibold text-emerald-600"
                          : "font-semibold text-rose-600"
                      }
                    >
                      {entry.delta >= 0 ? "+" : ""}
                      {entry.delta} {entry.currency === "xp" ? "XP" : "金幣"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
