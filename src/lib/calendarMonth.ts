import {
  formatDateInput,
  parseDateInput,
} from "@/lib/dates";
import {
  resolveIsHoliday,
  type CalendarEventView,
  type CalendarMonthDay,
} from "@/types/calendar";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

export function buildMonthGrid(
  year: number,
  month: number,
  events: CalendarEventView[],
  holidayOverrides: Record<string, boolean> = {},
): CalendarMonthDay[] {
  const first = new Date(year, month - 1, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const byDate = new Map<string, CalendarEventView[]>();
  for (const event of events) {
    const list = byDate.get(event.date) ?? [];
    list.push(event);
    byDate.set(event.date, list);
  }

  const cells: CalendarMonthDay[] = [];
  const gridStart = new Date(year, month - 1, 1 - startPad);
  const totalCells = Math.ceil((startPad + daysInMonth) / 7) * 7;

  for (let i = 0; i < totalCells; i += 1) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    const dateStr = formatDateInput(date);
    const dayEvents = byDate.get(dateStr) ?? [];
    cells.push({
      date: dateStr,
      day: date.getDate(),
      inMonth: date.getMonth() === month - 1,
      eventCount: dayEvents.length,
      titles: dayEvents.map((e) => e.title),
      isHoliday: resolveIsHoliday(dateStr, holidayOverrides),
    });
  }
  return cells;
}

export { WEEKDAYS };

export function eventsOnDate(
  events: CalendarEventView[],
  date: string,
): CalendarEventView[] {
  return events.filter((event) => event.date === date);
}

export function isSameMonth(dateStr: string, year: number, month: number) {
  const date = parseDateInput(dateStr);
  return date.getFullYear() === year && date.getMonth() + 1 === month;
}
