/** YYYY-MM-DD helpers (local calendar, no timezone shift). */

export function formatDateInput(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayDateString(date = new Date()) {
  return formatDateInput(date);
}

export function parseDateInput(dateStr: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error("日期格式須為 YYYY-MM-DD");
  }
  return new Date(`${dateStr}T00:00:00`);
}

export function formatDisplayDate(dateStr: string) {
  const date = parseDateInput(dateStr);
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}（${weekdays[date.getDay()]}）`;
}

/**
 * Next school day after `dateStr` (skip Sat/Sun).
 * National holidays: MVP skips weekends only; teacher can pick due date later if needed.
 */
export function nextSchoolDay(dateStr: string) {
  const date = parseDateInput(dateStr);
  do {
    date.setDate(date.getDate() + 1);
  } while (date.getDay() === 0 || date.getDay() === 6);
  return formatDateInput(date);
}

/** Month bounds as YYYY-MM-DD (local). month is 1–12. */
export function monthDateRange(year: number, month: number) {
  const from = formatDateInput(new Date(year, month - 1, 1));
  const to = formatDateInput(new Date(year, month, 0));
  return { from, to };
}

export function addMonths(year: number, month: number, delta: number) {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

/** Whole days from `fromDate` to `toDate` (YYYY-MM-DD). */
export function daysBetween(fromDate: string, toDate: string) {
  const from = parseDateInput(fromDate).getTime();
  const to = parseDateInput(toDate).getTime();
  return Math.round((to - from) / 86_400_000);
}

export function formatMonthTitle(year: number, month: number) {
  return `${year} 年 ${month} 月`;
}
