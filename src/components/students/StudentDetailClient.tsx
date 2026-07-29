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
        </>
      ) : null}
    </div>
  );
}
