import { daysBetween, todayDateString } from "@/lib/dates";

export const SCHOOL_WEEK_MIN = 1;
export const SCHOOL_WEEK_MAX = 25;
export const PASSPORT_WEEK_DEFAULT_START = 3;
export const PASSPORT_WEEK_DEFAULT_END = 16;

export type SchoolWeekState =
  | { kind: "in_term"; week: number; label: string }
  | { kind: "summer"; week: 0; label: "暑假" }
  | { kind: "winter"; week: 0; label: "寒假" }
  | { kind: "before_term"; week: 0; label: "尚未開學" }
  | { kind: "after_term"; week: number; label: string }
  | { kind: "manual"; week: number; label: string };

function vacationOrBefore(today: string): SchoolWeekState {
  const month = Number(today.slice(5, 7));
  if (month === 7 || month === 8) {
    return { kind: "summer", week: 0, label: "暑假" };
  }
  if (month === 1 || month === 2) {
    return { kind: "winter", week: 0, label: "寒假" };
  }
  return { kind: "before_term", week: 0, label: "尚未開學" };
}

function vacationOrAfter(
  today: string,
  lastWeek: number,
): SchoolWeekState {
  const month = Number(today.slice(5, 7));
  if (month === 7 || month === 8) {
    return { kind: "summer", week: 0, label: "暑假" };
  }
  if (month === 1 || month === 2) {
    return { kind: "winter", week: 0, label: "寒假" };
  }
  return {
    kind: "after_term",
    week: lastWeek,
    label: `學期結束（第 ${lastWeek} 週）`,
  };
}

function weekFromStart(start: string, date: string) {
  return Math.floor(daysBetween(start, date) / 7) + 1;
}

/**
 * 依學期開啟日／結束日推算目前週次。
 * - 早於開啟日 + 7/8 月 → 暑假；1/2 月 → 寒假；其餘 → 尚未開學
 * - 開啟日～結束日（含）：第 N 週（安全上限 25）
 * - 晚於結束日：學期結束；若在 7/8 或 1/2 月改標寒暑假
 * - 有開啟日、無結束日：超過 25 週當學期結束
 * - 未設開啟日 → 沿用手動 currentWeek
 */
export function resolveSchoolWeek(input: {
  weekOneStartDate: string;
  termEndDate?: string;
  fallbackWeek: number;
  today?: string;
}): SchoolWeekState {
  const today = input.today ?? todayDateString();
  const start = input.weekOneStartDate.trim();
  const end = (input.termEndDate ?? "").trim();
  const fallback = clampWeek(input.fallbackWeek);

  if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) {
    return {
      kind: "manual",
      week: fallback,
      label: `第 ${fallback} 週`,
    };
  }

  if (today < start) {
    return vacationOrBefore(today);
  }

  const validEnd = end && /^\d{4}-\d{2}-\d{2}$/.test(end) ? end : "";
  if (validEnd && today > validEnd) {
    const lastWeek = clampWeek(weekFromStart(start, validEnd));
    return vacationOrAfter(today, lastWeek);
  }

  const week = weekFromStart(start, today);
  if (!validEnd && week > SCHOOL_WEEK_MAX) {
    return vacationOrAfter(today, SCHOOL_WEEK_MAX);
  }

  const safe = clampWeek(week);
  return {
    kind: "in_term",
    week: safe,
    label: `第 ${safe} 週`,
  };
}

export function clampWeek(week: number) {
  if (!Number.isFinite(week)) return SCHOOL_WEEK_MIN;
  return Math.min(SCHOOL_WEEK_MAX, Math.max(SCHOOL_WEEK_MIN, Math.trunc(week)));
}

/** 學期總週數：開啟日～結束日；缺一則 null */
export function resolveTotalWeeks(
  weekOneStartDate: string,
  termEndDate?: string,
): number | null {
  const start = weekOneStartDate.trim();
  const end = (termEndDate ?? "").trim();
  if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return null;
  if (!end || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start) return null;
  return clampWeek(weekFromStart(start, end));
}

/** 顯示用：第 8 週｜暑假｜學期結束 */
export function formatWeekProgress(
  state: SchoolWeekState,
  totalWeeks: number | null,
): string {
  void totalWeeks;
  if (
    state.kind === "summer" ||
    state.kind === "winter" ||
    state.kind === "before_term"
  ) {
    return state.label;
  }
  if (state.kind === "after_term") {
    return state.week > 0 ? `學期結束（第 ${state.week} 週）` : state.label;
  }
  if (state.week > 0) {
    return `第 ${state.week} 週`;
  }
  return state.label;
}

/** 護照／欠繳用的「有效目前週」：寒暑假／未開學＝0 */
export function effectiveCurrentWeek(state: SchoolWeekState) {
  return state.week;
}
