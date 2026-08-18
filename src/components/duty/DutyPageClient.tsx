"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import {
  formatDisplayDate,
  todayDateString,
} from "@/lib/dates";
import { DUTY_SLOT_KEYS, type DutySlotKey } from "@/lib/dutyRoster";
import { cn } from "@/lib/utils";

type DutySlotView = {
  slotKey: DutySlotKey;
  label: string;
  studentId: string | null;
  name: string | null;
  seatNumber: number | null;
  overridden: boolean;
};

type DutyDayView = {
  date: string;
  isHoliday: boolean;
  schoolDayIndex: number | null;
  slots: DutySlotView[];
  leaders: { studentId: string; name: string; seatNumber: number }[];
};

type DutyRangeView = {
  from: string;
  to: string;
  termStart: string;
  termName: string | null;
  studentCount: number;
  expectedStudentCount: number;
  warning: string | null;
  days: DutyDayView[];
};

type CellRef = { date: string; slotKey: DutySlotKey };

const COLUMN_GROUPS: { title: string; slots: DutySlotKey[] }[] = [
  { title: "值日生・抬餐桶", slots: ["meal_bucket_1", "meal_bucket_2"] },
  { title: "擦黑板＋倒垃圾", slots: ["blackboard"] },
  { title: "掃拖前", slots: ["sweep_1a", "sweep_1b"] },
  { title: "掃拖中", slots: ["sweep_2a", "sweep_2b"] },
  { title: "掃拖後", slots: ["sweep_3a", "sweep_3b"] },
];

export function DutyPageClient() {
  const [range, setRange] = useState<DutyRangeView | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<CellRef | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        "/api/duty?semester=active",
      );
      const json = (await response.json()) as {
        data?: DutyRangeView;
        error?: string;
      };
      if (!response.ok) throw new Error(json.error ?? "讀取失敗");
      setRange(json.data ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "讀取失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const today = todayDateString();

  const dayMap = useMemo(() => {
    const map = new Map<string, DutyDayView>();
    for (const day of range?.days ?? []) {
      map.set(day.date, day);
    }
    return map;
  }, [range]);

  async function handleSelect(date: string, slotKey: DutySlotKey) {
    const day = dayMap.get(date);
    if (!day || day.isHoliday) return;
    const slot = day.slots.find((s) => s.slotKey === slotKey);
    if (!slot?.studentId) return;

    if (!selected) {
      setSelected({ date, slotKey });
      setMessage("已選第一格，再點另一格即可交換");
      return;
    }

    if (selected.date === date && selected.slotKey === slotKey) {
      setSelected(null);
      setMessage(null);
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/duty", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "swap",
          a: selected,
          b: { date, slotKey },
        }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "交換失敗");
      setSelected(null);
      setMessage("已交換");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "交換失敗");
    } finally {
      setBusy(false);
    }
  }

  async function handleClear(date: string, slotKey: DutySlotKey) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/duty", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear", date, slotKey }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "還原失敗");
      setMessage("已還原為自動輪排");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "還原失敗");
    } finally {
      setBusy(false);
    }
  }

  const dates = useMemo(
    () => range?.days.map((day) => day.date) ?? [],
    [range?.days],
  );
  const months = useMemo(
    () => [...new Set(dates.map((date) => date.slice(0, 7)))],
    [dates],
  );

  useEffect(() => {
    setSelectedMonth((previous) => {
      if (previous && months.includes(previous)) return previous;
      const currentMonth = todayDateString().slice(0, 7);
      return months.includes(currentMonth) ? currentMonth : (months[0] ?? null);
    });
  }, [months]);

  const displayedDates = selectedMonth
    ? dates.filter((date) => date.startsWith(selectedMonth))
    : [];
  const selectedMonthLabel = selectedMonth
    ? `${Number(selectedMonth.slice(0, 4))} 年 ${Number(selectedMonth.slice(5, 7))} 月`
    : "";

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">值日表</h1>
          <p className="mt-1 text-sm text-gray-500">
            依行事曆的上課日排完整學期・點兩格交換
          </p>
        </div>
      </header>

      {range?.warning ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {range.warning}
        </p>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-green-600">{message}</p> : null}
      {loading && !range ? (
        <p className="text-sm text-gray-400">載入中…</p>
      ) : null}

      <Card className="overflow-auto !p-0">
        <div className="border-b border-gray-100 px-4 py-3">
          <CardTitle>
            {range?.termName ?? "目前學期"}{selectedMonthLabel ? `・${selectedMonthLabel}` : ""}值日表
          </CardTitle>
          <CardDescription>
            {range?.from && range?.to
              ? `${formatDisplayDate(range.from)} ～ ${formatDisplayDate(range.to)}｜全學期共 ${dates.length} 個上課日`
              : "建立啟用學期後，即會依行事曆自動排入所有上課日"}
            {selected
              ? ` ｜ 已選 ${selected.date} ${selected.slotKey}`
              : " ｜ 先點一格，再點另一格交換"}
          </CardDescription>
        </div>
        {months.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto border-b border-gray-100 px-4 py-3">
            {months.map((month) => (
              <button
                key={month}
                type="button"
                onClick={() => {
                  setSelectedMonth(month);
                  setSelected(null);
                }}
                className={cn(
                  "shrink-0 rounded-lg border px-3 py-2 text-sm font-medium transition",
                  selectedMonth === month
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
                )}
              >
                {Number(month.slice(5, 7))} 月
              </button>
            ))}
          </div>
        ) : null}
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs text-gray-500">
              <th className="sticky left-0 z-10 border-b border-gray-200 bg-gray-50 px-3 py-2">
                日期
              </th>
              {COLUMN_GROUPS.map((group) => (
                <th
                  key={group.title}
                  colSpan={group.slots.length}
                  className="border-b border-l border-gray-200 px-2 py-2 text-center"
                >
                  {group.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayedDates.map((date) => {
              const day = dayMap.get(date);
              const isToday = date === today;
              return (
                <tr
                  key={date}
                  className={cn(
                    "border-b border-gray-100",
                    isToday && "bg-blue-50/40",
                    day?.isHoliday && "bg-slate-50 text-slate-400",
                  )}
                >
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-inherit px-3 py-2 font-medium text-gray-800">
                    {formatDisplayDate(date)}
                    {isToday ? (
                      <span className="ml-1 text-xs text-blue-600">今天</span>
                    ) : null}
                  </td>
                  {DUTY_SLOT_KEYS.map((slotKey) => {
                    const slot = day?.slots.find((s) => s.slotKey === slotKey);
                    const active =
                      selected?.date === date && selected.slotKey === slotKey;
                    const disabled = !day || day.isHoliday || !slot?.studentId;
                    return (
                      <td
                        key={slotKey}
                        className="border-l border-gray-100 px-1 py-1 text-center"
                      >
                        <button
                          type="button"
                            disabled={disabled || busy}
                            onClick={() => {
                              void handleSelect(date, slotKey);
                            }}
                            onContextMenu={(event) => {
                              event.preventDefault();
                              if (slot?.overridden) {
                                void handleClear(date, slotKey);
                              }
                            }}
                            title={
                              slot?.overridden
                                ? "已手動交換（右鍵還原自動）"
                                : slot?.label
                            }
                            className={cn(
                              "min-w-[4.5rem] rounded-md px-1.5 py-1 text-xs transition",
                              active
                                ? "bg-blue-600 text-white"
                                : slot?.overridden
                                  ? "bg-amber-100 text-amber-900 ring-1 ring-amber-300"
                                  : "hover:bg-gray-100",
                              disabled && "cursor-default opacity-40",
                            )}
                          >
                            {slot?.name ?? "—"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        {selectedMonth && displayedDates.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">這個月沒有上課日。</p>
        ) : null}
      </Card>

      {selectedMonthLabel ? (
        <p className="text-sm text-gray-500">目前顯示：{selectedMonthLabel}（{displayedDates.length} 個上課日）</p>
      ) : null}

      <p className="text-xs text-gray-400">
        提示：琥珀色格子＝手動交換過；在其上按右鍵可還原成自動輪排。
      </p>
    </div>
  );
}
