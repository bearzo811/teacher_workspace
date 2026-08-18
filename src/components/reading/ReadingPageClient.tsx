"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  nextPassportStatus,
  PASSPORT_STATUS_LABEL,
  type PassportStatus,
} from "@/types/passport";
import {
  READING_SEMESTER_LABEL,
  READING_TYPE_LABEL,
  type ReadingMatrixView,
  type ReadingType,
} from "@/types/reading";

function cellClass(status: PassportStatus) {
  switch (status) {
    case "completed":
      return "border-green-600 bg-green-600 text-white";
    case "missing_parent":
      return "border-red-500 bg-red-50 text-red-600";
    default:
      return "border-gray-300 bg-white text-gray-400";
  }
}

function cellMark(status: PassportStatus) {
  switch (status) {
    case "completed":
      return "✓";
    case "missing_parent":
      return "缺";
    default:
      return "";
  }
}

function ReadingMatrixTable({
  view,
  busyKey,
  onToggle,
}: {
  view: ReadingMatrixView;
  busyKey: string | null;
  onToggle: (studentId: string, month: number, current: PassportStatus) => void;
}) {
  if (view.students.length === 0) {
    return (
      <p className="text-sm text-gray-500">尚無在籍學生。請先到「學生」新增。</p>
    );
  }

  return (
    <div className="overflow-auto rounded-xl border border-gray-200 bg-white">
      <table className="min-w-full border-collapse text-center text-sm">
        <thead>
          <tr className="bg-gray-50">
            <th className="sticky left-0 z-10 border-b border-gray-200 bg-gray-50 px-2 py-2">
              座號
            </th>
            <th className="border-b border-gray-200 px-2 py-2">姓名</th>
            {view.months.map((month) => (
              <th
                key={month}
                className={cn(
                  "border-b border-gray-200 px-2 py-2",
                  month === view.currentMonth && "bg-blue-50 text-blue-700",
                )}
              >
                {month}月
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {view.students.map((student) => (
            <tr key={student.studentId} className="border-t border-gray-100">
              <td className="sticky left-0 z-10 bg-white px-2 py-1 font-medium">
                {student.seatNumber}
              </td>
              <td className="px-2 py-1 text-left">{student.name}</td>
              {student.cells.map((cell) => {
                const key = `${student.studentId}:${view.type}:${cell.month}`;
                return (
                  <td key={cell.month} className="px-1 py-1">
                    <button
                      type="button"
                      title={PASSPORT_STATUS_LABEL[cell.status]}
                      disabled={busyKey === key}
                      onClick={() =>
                        onToggle(student.studentId, cell.month, cell.status)
                      }
                      className={cn(
                        "mx-auto flex h-9 w-9 items-center justify-center rounded-md border text-sm font-bold",
                        cellClass(cell.status),
                        cell.month === view.currentMonth &&
                          "ring-2 ring-blue-400",
                      )}
                    >
                      {cellMark(cell.status)}
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
}

export function ReadingPageClient() {
  const [newspaper, setNewspaper] = useState<ReadingMatrixView | null>(null);
  const [reflection, setReflection] = useState<ReadingMatrixView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [newsRes, refRes] = await Promise.all([
        fetch("/api/reading?type=newspaper"),
        fetch("/api/reading?type=reflection"),
      ]);
      const newsJson = (await newsRes.json()) as {
        data?: ReadingMatrixView;
        error?: string;
      };
      const refJson = (await refRes.json()) as {
        data?: ReadingMatrixView;
        error?: string;
      };
      if (!newsRes.ok) throw new Error(newsJson.error ?? "讀取讀報失敗");
      if (!refRes.ok) throw new Error(refJson.error ?? "讀取心得失敗");
      setNewspaper(newsJson.data ?? null);
      setReflection(refJson.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "讀取失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleCell(
    type: ReadingType,
    studentId: string,
    month: number,
    current: PassportStatus,
  ) {
    const next = nextPassportStatus(current);
    const key = `${studentId}:${type}:${month}`;
    setBusyKey(key);
    setError(null);
    try {
      const response = await fetch("/api/reading", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          type,
          month,
          status: next,
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

  const termLabel = newspaper
    ? `${newspaper.schoolYear} 學年度${READING_SEMESTER_LABEL[newspaper.semester]}`
    : "";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">閱讀總表</h1>
        <p className="mt-1 text-sm text-gray-500">
          每個上課月各一篇讀報與閱讀心得（7、8 月除外）；三態：未開始／缺家長／已完成
        </p>
      </header>

      {termLabel ? (
        <p className="text-sm text-gray-500">目前自動顯示：{termLabel}</p>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-gray-400">載入中…</p> : null}

      <div className="grid gap-6 xl:grid-cols-2">
        {newspaper ? (
          <Card>
            <CardTitle>{READING_TYPE_LABEL.newspaper}</CardTitle>
            <CardDescription>
              完成 {newspaper.overallCompleted}/{newspaper.overallTotal}
            </CardDescription>
            <div className="mt-4">
              <ReadingMatrixTable
                view={newspaper}
                busyKey={busyKey}
                onToggle={(studentId, month, current) => {
                  void toggleCell("newspaper", studentId, month, current);
                }}
              />
            </div>
          </Card>
        ) : null}

        {reflection ? (
          <Card>
            <CardTitle>{READING_TYPE_LABEL.reflection}</CardTitle>
            <CardDescription>
              完成 {reflection.overallCompleted}/{reflection.overallTotal}
            </CardDescription>
            <div className="mt-4">
              <ReadingMatrixTable
                view={reflection}
                busyKey={busyKey}
                onToggle={(studentId, month, current) => {
                  void toggleCell("reflection", studentId, month, current);
                }}
              />
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
