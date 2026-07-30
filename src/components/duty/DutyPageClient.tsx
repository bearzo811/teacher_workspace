"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import {
  formatDateInput,
  formatDisplayDate,
  parseDateInput,
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
  studentCount: number;
  expectedStudentCount: number;
  warning: string | null;
  days: DutyDayView[];
};

type CellRef = { date: string; slotKey: DutySlotKey };

function addDays(dateStr: string, delta: number) {
  const date = parseDateInput(dateStr);
  date.setDate(date.getDate() + delta);
  return formatDateInput(date);
}

function startOfWeekMonday(dateStr: string) {
  const date = parseDateInput(dateStr);
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + offset);
  return formatDateInput(date);
}

const COLUMN_GROUPS: { title: string; slots: DutySlotKey[] }[] = [
  { title: "值日生・抬餐桶", slots: ["meal_bucket_1", "meal_bucket_2"] },
  { title: "擦黑板＋倒垃圾", slots: ["blackboard"] },
  { title: "掃拖前", slots: ["sweep_1a", "sweep_1b"] },
  { title: "掃拖中", slots: ["sweep_2a", "sweep_2b"] },
  { title: "掃拖後", slots: ["sweep_3a", "sweep_3b"] },
];

export function DutyPageClient() {
  const [anchor, setAnchor] = useState(() => startOfWeekMonday(todayDateString()));
  const [range, setRange] = useState<DutyRangeView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<CellRef | null>(null);

  const from = anchor;
  const to = addDays(anchor, 6); // 週一～週日

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/duty?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
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
  }, [from, to]);

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

  const dates = eachDateList(from, to);

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">值日表</h1>
          <p className="mt-1 text-sm text-gray-500">
            上課日輪流分配・點兩格交換・六日／放假不排
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setAnchor(addDays(anchor, -7));
              setSelected(null);
            }}
          >
            上週
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setAnchor(startOfWeekMonday(todayDateString()));
              setSelected(null);
            }}
          >
            本週
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setAnchor(addDays(anchor, 7));
              setSelected(null);
            }}
          >
            下週
          </Button>
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
          <CardTitle>本週總表（一～日）</CardTitle>
          <CardDescription>
            {formatDisplayDate(from)} ～ {formatDisplayDate(to)}
            {selected
              ? ` ｜ 已選 ${selected.date} ${selected.slotKey}`
              : " ｜ 先點一格，再點另一格交換"}
          </CardDescription>
        </div>
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
            {dates.map((date) => {
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
                    {day?.isHoliday ? (
                      <span className="ml-1 text-xs">放假</span>
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
                        {day?.isHoliday ? (
                          <span className="text-xs text-slate-300">—</span>
                        ) : (
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
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <p className="text-xs text-gray-400">
        提示：琥珀色格子＝手動交換過；在其上按右鍵可還原成自動輪排。
      </p>
    </div>
  );
}

function eachDateList(from: string, to: string) {
  const out: string[] = [];
  const cursor = parseDateInput(from);
  const end = parseDateInput(to);
  while (cursor <= end) {
    out.push(formatDateInput(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}
