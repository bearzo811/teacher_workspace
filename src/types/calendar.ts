export type CalendarEventView = {
  id: string;
  date: string;
  title: string;
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
  sortOrder: number;
  /** 大屏／列表顯示用，例：整天、08:30–09:10 */
  timeLabel: string;
};

export type CalendarCountdownItem = CalendarEventView & {
  daysUntil: number;
};

export type CalendarMonthDay = {
  date: string;
  day: number;
  inMonth: boolean;
  eventCount: number;
  titles: string[];
  /** 放假日（六日／七八月預設 true，可覆寫） */
  isHoliday: boolean;
};

/** 六／日 */
export function isWeekendDate(dateStr: string): boolean {
  const [y, m, d] = dateStr.split("-").map(Number);
  const weekday = new Date(y, m - 1, d).getDay();
  return weekday === 0 || weekday === 6;
}

/** 七／八月（暑假） */
export function isSummerBreakMonth(dateStr: string): boolean {
  const month = Number(dateStr.slice(5, 7));
  return month === 7 || month === 8;
}

/** 無覆寫時的預設放假：六日＋七八月 */
export function isDefaultHoliday(dateStr: string): boolean {
  return isWeekendDate(dateStr) || isSummerBreakMonth(dateStr);
}

export function resolveIsHoliday(
  dateStr: string,
  overrides: Record<string, boolean> = {},
): boolean {
  if (Object.prototype.hasOwnProperty.call(overrides, dateStr)) {
    return overrides[dateStr];
  }
  return isDefaultHoliday(dateStr);
}

export function isTimeHhMm(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function formatCalendarTimeLabel(input: {
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
}): string {
  if (input.allDay) return "整天";
  if (!input.startTime) return "時段";
  if (input.endTime) return `${input.startTime}–${input.endTime}`;
  return input.startTime;
}

export function formatCountdownLabel(daysUntil: number) {
  if (daysUntil === 0) return "今天";
  if (daysUntil === 1) return "明天";
  return `還有 ${daysUntil} 天`;
}
