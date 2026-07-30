import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { calendarDayOverrides, calendarEvents } from "@/db/schema";
import { daysBetween, formatDateInput, parseDateInput, todayDateString } from "@/lib/dates";
import {
  formatCalendarTimeLabel,
  isTimeHhMm,
  isDefaultHoliday,
  type CalendarCountdownItem,
  type CalendarEventView,
} from "@/types/calendar";

function toView(row: typeof calendarEvents.$inferSelect): CalendarEventView {
  return {
    id: row.id,
    date: row.date,
    title: row.title,
    allDay: row.allDay,
    startTime: row.startTime,
    endTime: row.endTime,
    sortOrder: row.sortOrder,
    timeLabel: formatCalendarTimeLabel({
      allDay: row.allDay,
      startTime: row.startTime,
      endTime: row.endTime,
    }),
  };
}

function sortEvents(a: CalendarEventView, b: CalendarEventView) {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  if (!a.allDay && !b.allDay) {
    const sa = a.startTime ?? "";
    const sb = b.startTime ?? "";
    if (sa !== sb) return sa.localeCompare(sb);
  }
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.title.localeCompare(b.title, "zh-Hant");
}

export async function listCalendarEventsByDate(
  date: string,
): Promise<CalendarEventView[]> {
  parseDateInput(date);
  const rows = await db
    .select()
    .from(calendarEvents)
    .where(eq(calendarEvents.date, date))
    .orderBy(asc(calendarEvents.sortOrder), asc(calendarEvents.createdAt));
  return rows.map(toView).sort(sortEvents);
}

export async function listCalendarEventsInRange(
  from: string,
  to: string,
): Promise<CalendarEventView[]> {
  parseDateInput(from);
  parseDateInput(to);
  const rows = await db
    .select()
    .from(calendarEvents)
    .where(
      and(gte(calendarEvents.date, from), lte(calendarEvents.date, to)),
    )
    .orderBy(asc(calendarEvents.date), asc(calendarEvents.sortOrder));
  return rows.map(toView).sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return sortEvents(a, b);
  });
}

function normalizeEventInput(input: {
  date: string;
  title: string;
  allDay: boolean;
  startTime?: string | null;
  endTime?: string | null;
  sortOrder?: number;
}) {
  parseDateInput(input.date);
  const title = input.title.trim();
  if (!title) throw new Error("請填寫活動名稱");

  if (input.allDay) {
    return {
      date: input.date,
      title,
      allDay: true as const,
      startTime: null,
      endTime: null,
      sortOrder: input.sortOrder ?? 0,
    };
  }

  const startTime = input.startTime?.trim() ?? "";
  const endTime = input.endTime?.trim() || null;
  if (!isTimeHhMm(startTime)) {
    throw new Error("開始時間格式須為 HH:MM");
  }
  if (endTime && !isTimeHhMm(endTime)) {
    throw new Error("結束時間格式須為 HH:MM");
  }
  if (endTime && endTime < startTime) {
    throw new Error("結束時間不可早於開始時間");
  }

  return {
    date: input.date,
    title,
    allDay: false as const,
    startTime,
    endTime,
    sortOrder: input.sortOrder ?? 0,
  };
}

export async function createCalendarEvent(input: {
  date: string;
  title: string;
  allDay: boolean;
  startTime?: string | null;
  endTime?: string | null;
  sortOrder?: number;
}): Promise<CalendarEventView> {
  const normalized = normalizeEventInput(input);
  const [row] = await db
    .insert(calendarEvents)
    .values(normalized)
    .returning();
  return toView(row);
}

export async function updateCalendarEvent(input: {
  id: string;
  date?: string;
  title?: string;
  allDay?: boolean;
  startTime?: string | null;
  endTime?: string | null;
  sortOrder?: number;
}): Promise<CalendarEventView> {
  const existing = await db
    .select()
    .from(calendarEvents)
    .where(eq(calendarEvents.id, input.id))
    .limit(1);
  if (existing.length === 0) throw new Error("找不到此活動");

  const current = existing[0];
  const allDay = input.allDay ?? current.allDay;
  const normalized = normalizeEventInput({
    date: input.date ?? current.date,
    title: input.title ?? current.title,
    allDay,
    startTime:
      input.startTime !== undefined ? input.startTime : current.startTime,
    endTime: input.endTime !== undefined ? input.endTime : current.endTime,
    sortOrder: input.sortOrder ?? current.sortOrder,
  });

  const [row] = await db
    .update(calendarEvents)
    .set(normalized)
    .where(eq(calendarEvents.id, input.id))
    .returning();
  return toView(row);
}

export async function deleteCalendarEvent(id: string) {
  const deleted = await db
    .delete(calendarEvents)
    .where(eq(calendarEvents.id, id))
    .returning({ id: calendarEvents.id });
  if (deleted.length === 0) throw new Error("找不到此活動");
}

/** 今天起（含今天）未來活動＋倒數天數 */
export async function listCalendarCountdown(options?: {
  fromDate?: string;
  limit?: number;
  withinDays?: number;
}): Promise<CalendarCountdownItem[]> {
  const fromDate = options?.fromDate ?? todayDateString();
  parseDateInput(fromDate);
  const withinDays = options?.withinDays ?? 120;
  const limit = options?.limit ?? 12;
  const end = parseDateInput(fromDate);
  end.setDate(end.getDate() + withinDays);
  const toDate = formatDateInput(end);

  const events = await listCalendarEventsInRange(fromDate, toDate);
  return events.slice(0, limit).map((event) => ({
    ...event,
    daysUntil: daysBetween(fromDate, event.date),
  }));
}

/** 區間內的放假覆寫（僅有手動設定的日期） */
export async function listHolidayOverridesInRange(
  from: string,
  to: string,
): Promise<Record<string, boolean>> {
  parseDateInput(from);
  parseDateInput(to);
  const rows = await db
    .select()
    .from(calendarDayOverrides)
    .where(
      and(
        gte(calendarDayOverrides.date, from),
        lte(calendarDayOverrides.date, to),
      ),
    );
  const map: Record<string, boolean> = {};
  for (const row of rows) {
    map[row.date] = row.isHoliday;
  }
  return map;
}

export async function getHolidayOverride(
  date: string,
): Promise<boolean | null> {
  parseDateInput(date);
  const rows = await db
    .select()
    .from(calendarDayOverrides)
    .where(eq(calendarDayOverrides.date, date))
    .limit(1);
  return rows[0]?.isHoliday ?? null;
}

/**
 * 設定某日是否放假。
 * 若與預設相同（六日／七八月放假、其餘上課），刪除覆寫列以保持乾淨。
 */
export async function setDayHoliday(input: {
  date: string;
  isHoliday: boolean;
}): Promise<{ date: string; isHoliday: boolean; overridden: boolean }> {
  parseDateInput(input.date);
  const defaultHoliday = isDefaultHoliday(input.date);
  const existing = await db
    .select()
    .from(calendarDayOverrides)
    .where(eq(calendarDayOverrides.date, input.date))
    .limit(1);

  if (input.isHoliday === defaultHoliday) {
    if (existing[0]) {
      await db
        .delete(calendarDayOverrides)
        .where(eq(calendarDayOverrides.id, existing[0].id));
    }
    return {
      date: input.date,
      isHoliday: input.isHoliday,
      overridden: false,
    };
  }

  if (existing[0]) {
    await db
      .update(calendarDayOverrides)
      .set({ isHoliday: input.isHoliday })
      .where(eq(calendarDayOverrides.id, existing[0].id));
  } else {
    await db.insert(calendarDayOverrides).values({
      date: input.date,
      isHoliday: input.isHoliday,
    });
  }

  return {
    date: input.date,
    isHoliday: input.isHoliday,
    overridden: true,
  };
}
