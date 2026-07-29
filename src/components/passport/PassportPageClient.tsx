"use client";

import { useCallback, useEffect, useState } from "react";
import { ProgressBar } from "@/components/passport/ProgressBar";
import {
  StudentChecklist,
  type ChecklistStudent,
} from "@/components/passport/StudentChecklist";
import { SummaryCard } from "@/components/passport/SummaryCard";
import { WeekSelector } from "@/components/passport/WeekSelector";
import { Button } from "@/components/ui/button";

type PassportType = "Chinese" | "English";

type PassportView = {
  type: PassportType;
  week: number;
  currentWeek: number;
  startWeek: number;
  endWeek: number;
  completedCount: number;
  totalCount: number;
  students: ChecklistStudent[];
};

type PassportPageClientProps = {
  type: PassportType;
  title: string;
};

export function PassportPageClient({ type, title }: PassportPageClientProps) {
  const [view, setView] = useState<PassportView | null>(null);
  const [week, setWeek] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [settingCurrent, setSettingCurrent] = useState(false);

  const load = useCallback(
    async (selectedWeek?: number) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ type });
        if (selectedWeek !== undefined) {
          params.set("week", String(selectedWeek));
        }
        const response = await fetch(`/api/passport?${params.toString()}`);
        const json = (await response.json()) as {
          data?: PassportView;
          error?: string;
        };
        if (!response.ok) {
          throw new Error(json.error ?? "讀取護照失敗");
        }
        if (!json.data) {
          throw new Error("讀取護照失敗");
        }
        setView(json.data);
        setWeek(json.data.week);
      } catch (err) {
        setError(err instanceof Error ? err.message : "讀取護照失敗");
      } finally {
        setLoading(false);
      }
    },
    [type],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function handleWeekChange(nextWeek: number) {
    setWeek(nextWeek);
    await load(nextWeek);
  }

  async function handleToggle(student: ChecklistStudent) {
    if (week === null) return;
    setBusyId(student.studentId);
    setError(null);
    try {
      const response = await fetch("/api/passport", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: student.studentId,
          type,
          week,
          completed: !student.completed,
        }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error ?? "更新失敗");
      }
      await load(week);
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新失敗");
    } finally {
      setBusyId(null);
    }
  }

  async function handleSetAsCurrentWeek() {
    if (week === null) return;
    setSettingCurrent(true);
    setError(null);
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentWeek: week }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error ?? "更新目前週失敗");
      }
      await load(week);
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新目前週失敗");
    } finally {
      setSettingCurrent(false);
    }
  }

  const incomplete = view ? view.totalCount - view.completedCount : 0;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
          {view ? (
            <p className="mt-1 text-sm text-gray-500">
              設定中的目前週：第 {view.currentWeek} 週
            </p>
          ) : null}
        </div>
        {view && week !== null ? (
          <div className="flex flex-wrap items-center gap-2">
            <WeekSelector
              week={week}
              startWeek={view.startWeek}
              endWeek={view.endWeek}
              currentWeek={view.currentWeek}
              disabled={loading || busyId !== null}
              onChange={(next) => {
                void handleWeekChange(next);
              }}
            />
            {week !== view.currentWeek ? (
              <Button
                variant="secondary"
                size="sm"
                disabled={settingCurrent}
                onClick={() => {
                  void handleSetAsCurrentWeek();
                }}
              >
                設為目前週
              </Button>
            ) : null}
          </div>
        ) : null}
      </header>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading && !view ? (
        <p className="text-sm text-gray-400">載入中…</p>
      ) : null}

      {view ? (
        <>
          <ProgressBar
            completed={view.completedCount}
            total={view.totalCount}
          />
          <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
            <StudentChecklist
              students={view.students}
              busyId={busyId}
              onToggle={(student) => {
                void handleToggle(student);
              }}
            />
            <SummaryCard
              week={view.week}
              completed={view.completedCount}
              incomplete={incomplete}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
