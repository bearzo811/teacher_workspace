"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MonthCalendarGrid } from "@/components/calendar/MonthCalendarGrid";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { buildMonthGrid } from "@/lib/calendarMonth";
import {
  addMonths,
  formatDateInput,
  formatDisplayDate,
  formatMonthTitle,
  monthDateRange,
  todayDateString,
} from "@/lib/dates";
import {
  formatCountdownLabel,
  resolveIsHoliday,
  type CalendarCountdownItem,
  type CalendarEventView,
} from "@/types/calendar";

type Draft = {
  title: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
};

const emptyDraft: Draft = {
  title: "",
  allDay: true,
  startTime: "08:00",
  endTime: "",
};

export function CalendarPageClient() {
  const today = todayDateString();
  const initial = today.split("-").map(Number);
  const [cursor, setCursor] = useState({
    year: initial[0],
    month: initial[1],
  });
  const [date, setDate] = useState(today);
  const [monthEvents, setMonthEvents] = useState<CalendarEventView[]>([]);
  const [holidayOverrides, setHolidayOverrides] = useState<
    Record<string, boolean>
  >({});
  const [dayEvents, setDayEvents] = useState<CalendarEventView[]>([]);
  const [dayIsHoliday, setDayIsHoliday] = useState(false);
  const [countdown, setCountdown] = useState<CalendarCountdownItem[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingHoliday, setSavingHoliday] = useState(false);

  const cells = useMemo(
    () =>
      buildMonthGrid(cursor.year, cursor.month, monthEvents, holidayOverrides),
    [cursor.month, cursor.year, holidayOverrides, monthEvents],
  );

  const loadMonth = useCallback(async (year: number, month: number) => {
    const { from, to } = monthDateRange(year, month);
    const response = await fetch(
      `/api/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    );
    const json = (await response.json()) as {
      data?: CalendarEventView[];
      holidayOverrides?: Record<string, boolean>;
      error?: string;
    };
    if (!response.ok) throw new Error(json.error ?? "讀取月曆失敗");
    setMonthEvents(json.data ?? []);
    setHolidayOverrides(json.holidayOverrides ?? {});
  }, []);

  const loadDay = useCallback(async (selectedDate: string) => {
    const response = await fetch(
      `/api/calendar?date=${encodeURIComponent(selectedDate)}`,
    );
    const json = (await response.json()) as {
      data?: CalendarEventView[];
      isHoliday?: boolean;
      holidayOverrides?: Record<string, boolean>;
      error?: string;
    };
    if (!response.ok) throw new Error(json.error ?? "讀取當日失敗");
    setDayEvents(json.data ?? []);
    setDayIsHoliday(
      typeof json.isHoliday === "boolean"
        ? json.isHoliday
        : resolveIsHoliday(selectedDate, json.holidayOverrides ?? {}),
    );
  }, []);

  const loadCountdown = useCallback(async () => {
    const from = todayDateString();
    const end = new Date();
    // 顯示未來一學年，避免 1 月等較遠的學期活動被 120 天上限排除。
    end.setDate(end.getDate() + 365);
    const to = formatDateInput(end);
    const response = await fetch(
      `/api/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    );
    const json = (await response.json()) as {
      data?: CalendarEventView[];
      error?: string;
    };
    if (!response.ok) throw new Error(json.error ?? "讀取倒數失敗");
    const todayStr = todayDateString();
    const items: CalendarCountdownItem[] = (json.data ?? [])
      .slice(0, 12)
      .map((event) => {
        const fromTime = new Date(`${todayStr}T00:00:00`).getTime();
        const toTime = new Date(`${event.date}T00:00:00`).getTime();
        const daysUntil = Math.round((toTime - fromTime) / 86_400_000);
        return { ...event, daysUntil };
      });
    setCountdown(items);
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        loadMonth(cursor.year, cursor.month),
        loadDay(date),
        loadCountdown(),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "讀取失敗");
    } finally {
      setLoading(false);
    }
  }, [cursor.month, cursor.year, date, loadCountdown, loadDay, loadMonth]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    setEditingId(null);
    setDraft(emptyDraft);
    setMessage(null);
  }, [date]);

  function shiftMonth(delta: number) {
    const next = addMonths(cursor.year, cursor.month, delta);
    setCursor(next);
  }

  function startEdit(event: CalendarEventView) {
    setEditingId(event.id);
    setDraft({
      title: event.title,
      allDay: event.allDay,
      startTime: event.startTime ?? "08:00",
      endTime: event.endTime ?? "",
    });
    setMessage(null);
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(emptyDraft);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        date,
        title: draft.title,
        allDay: draft.allDay,
        startTime: draft.allDay ? null : draft.startTime,
        endTime: draft.allDay || !draft.endTime.trim() ? null : draft.endTime,
      };
      const response = await fetch("/api/calendar", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingId ? { id: editingId, ...payload } : payload,
        ),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "儲存失敗");
      setMessage(editingId ? "已更新" : "已新增");
      setEditingId(null);
      setDraft(emptyDraft);
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "儲存失敗");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("確定刪除這個活動？")) return;
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/calendar?id=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "刪除失敗");
      if (editingId === id) cancelEdit();
      setMessage("已刪除");
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "刪除失敗");
    }
  }

  async function toggleHoliday(next: boolean) {
    setSavingHoliday(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/calendar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_holiday",
          date,
          isHoliday: next,
        }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "更新放假日失敗");
      setDayIsHoliday(next);
      setMessage(next ? "已設為放假日" : "已設為上課日");
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新放假日失敗");
    } finally {
      setSavingHoliday(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">行事曆</h1>
        <p className="mt-1 text-sm text-gray-500">
          月曆總覽＋倒數；當天活動會同步顯示在大屏黑板下方
        </p>
      </header>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-green-600">{message}</p> : null}
      {loading ? <p className="text-sm text-gray-400">載入中…</p> : null}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>{formatMonthTitle(cursor.year, cursor.month)}</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => shiftMonth(-1)}
              >
                上月
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const [y, m] = today.split("-").map(Number);
                  setCursor({ year: y, month: m });
                  setDate(today);
                }}
              >
                本月
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => shiftMonth(1)}
              >
                下月
              </Button>
            </div>
          </div>
          <CardDescription className="mt-1">
            點日期可查看／編輯；六日與七八月預設放假（紅字），可手動改某天
          </CardDescription>
          <div className="mt-4">
            <MonthCalendarGrid
              cells={cells}
              selectedDate={date}
              today={today}
              onSelectDate={setDate}
              variant="teacher"
            />
          </div>
        </Card>

        <Card>
          <CardTitle>倒數</CardTitle>
          <CardDescription>今天起未來活動</CardDescription>
          <ul className="mt-4 space-y-2">
            {countdown.length === 0 ? (
              <li className="text-sm text-gray-400">近期沒有活動</li>
            ) : (
              countdown.map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg border border-gray-200 px-3 py-2"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-medium text-gray-900">{item.title}</p>
                    <p className="shrink-0 text-sm font-semibold text-blue-700">
                      {formatCountdownLabel(item.daysUntil)}
                    </p>
                  </div>
                  <p className="mt-0.5 text-sm text-gray-500">
                    {formatDisplayDate(item.date)}
                    {item.allDay ? "" : ` · ${item.timeLabel}`}
                  </p>
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>

      <Card>
        <CardTitle
          className={dayIsHoliday ? "text-red-600" : undefined}
        >
          {formatDisplayDate(date)}
          {dayIsHoliday ? "（放假）" : ""}
        </CardTitle>
        <CardDescription>
          {dayEvents.length === 0 ? "尚無活動" : `共 ${dayEvents.length} 筆`}
        </CardDescription>
        <div className="mt-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={dayIsHoliday}
              disabled={savingHoliday || loading}
              onChange={(event) => {
                void toggleHoliday(event.target.checked);
              }}
              className="h-4 w-4 rounded border-gray-300"
            />
            放假日（月曆顯示紅色；六日／七八月預設勾選）
          </label>
        </div>
        <ul className="mt-4 space-y-2">
          {dayEvents.map((event) => (
            <li
              key={event.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2"
            >
              <div>
                <p className="font-medium text-gray-900">{event.title}</p>
                <p className="text-sm text-gray-500">{event.timeLabel}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => startEdit(event)}
                >
                  編輯
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void handleDelete(event.id);
                  }}
                >
                  刪除
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardTitle>{editingId ? "編輯活動" : "新增活動"}</CardTitle>
        <CardDescription>
          寫入日期：{formatDisplayDate(date)}（可設整天或時段）
        </CardDescription>
        <div className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            活動名稱
            <input
              value={draft.title}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, title: event.target.value }))
              }
              placeholder="例：校慶預演、英語日"
              className="h-10 rounded-lg border border-gray-200 px-3 outline-none ring-blue-500 focus:ring-2"
            />
          </label>

          <div className="flex flex-wrap gap-4 text-sm text-gray-700">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={draft.allDay}
                onChange={() =>
                  setDraft((prev) => ({ ...prev, allDay: true }))
                }
              />
              整天
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={!draft.allDay}
                onChange={() =>
                  setDraft((prev) => ({ ...prev, allDay: false }))
                }
              />
              時段
            </label>
          </div>

          {!draft.allDay ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                開始時間
                <input
                  type="time"
                  value={draft.startTime}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      startTime: event.target.value,
                    }))
                  }
                  className="h-10 rounded-lg border border-gray-200 px-3 outline-none ring-blue-500 focus:ring-2"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                結束時間（選填）
                <input
                  type="time"
                  value={draft.endTime}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      endTime: event.target.value,
                    }))
                  }
                  className="h-10 rounded-lg border border-gray-200 px-3 outline-none ring-blue-500 focus:ring-2"
                />
              </label>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              disabled={saving || !draft.title.trim()}
              onClick={() => {
                void handleSave();
              }}
            >
              {saving ? "儲存中…" : editingId ? "更新" : "新增"}
            </Button>
            {editingId ? (
              <Button variant="secondary" onClick={cancelEdit}>
                取消編輯
              </Button>
            ) : null}
          </div>
        </div>
      </Card>
    </div>
  );
}
